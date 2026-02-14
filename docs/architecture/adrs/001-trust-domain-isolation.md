# ADR-001: Trust Domain Isolation

**Status:** Accepted
**Date:** 2025-02-01
**Deciders:** Architecture team

## Context

AI agents -- OpenClaw, ElizaOS, MCP-connected LLMs, Telegram bots -- need to perform crypto operations on behalf of users: token transfers, swaps, approvals, and balance queries. These agents run potentially untrusted code, including community-authored skills, LLM-generated actions, and third-party plugins.

The core problem: how do you let AI agents sign transactions without giving them access to private keys?

Existing approaches each have fundamental shortcomings:

1. **Agent holds keys directly** -- Simple to implement but catastrophic if the agent is compromised. A single malicious skill or prompt injection can drain the wallet. There is no policy layer, no audit trail, and no approval step.

2. **Hardware wallet with manual approval** -- Secure key isolation, but every transaction requires physical human interaction. This is incompatible with autonomous agent workflows where an agent may execute dozens of operations per hour.

3. **Custodial API (third-party signing service)** -- Introduces counterparty risk, requires trusting an external entity with key material, and creates a single point of failure. Not viable for users who require self-custody.

4. **Embedded TEE / secure enclave** -- Hardware-dependent, complex to deploy, and does not solve the policy or approval problem. The agent still needs to be told "yes" or "no" based on risk assessment.

None of these approaches balance security with agent autonomy. The system needs to isolate keys from untrusted code while still allowing agents to request crypto operations programmatically, with configurable policy enforcement and human-in-the-loop approval when appropriate.

Additional forces at play:

- Multiple agent frameworks exist (OpenClaw, ElizaOS, MCP, custom bots) and the solution must be framework-agnostic.
- Skills are authored by third parties and cannot be fully trusted, even after code review.
- The attack surface includes prompt injection, supply chain compromise, malicious skill packages, and compromised RPC endpoints.
- Operations range from low-risk (balance queries) to high-risk (large transfers, unlimited approvals), requiring graduated security responses.
- Audit and compliance require a tamper-evident record of every signing operation.

## Decision

Divide the system into three trust domains with strict, enforced boundaries. Every line of code belongs to exactly one domain. No component straddles a boundary.

### Domain A -- Untrusted (Agent Framework + Skills)

**Packages:** `@clavion/adapter-openclaw`, `@clavion/adapter-mcp`, `@clavion/plugin-eliza`, `@clavion/adapter-telegram`

Domain A contains all agent-facing code: skill wrappers, intent builders, and adapter clients. Code in this domain is considered potentially compromisable at all times.

**Capabilities:**
- Construct declarative TxIntents (JSON objects describing desired operations)
- Communicate with Domain B exclusively via localhost HTTP API
- Read balance and transaction status data through Domain B

**Restrictions:**
- No access to private keys or any key material
- No direct signing capability
- No direct blockchain RPC access
- No control over approval summaries shown to users
- No access to policy configuration or audit data

The key insight is that Domain A code expresses *intent*, never *execution*. A skill says "I want to transfer 100 USDC to 0xABC" -- it never constructs raw calldata, never sets gas parameters, and never touches a signing function.

### Domain B -- Trusted (ISCL Core)

**Packages:** `@clavion/core`, `@clavion/signer`, `@clavion/audit`, `@clavion/policy`, `@clavion/preflight`, `@clavion/registry`

Domain B is the only domain that holds key material and can sign transactions. Every operation follows a mandatory pipeline:

```
TxIntent --> PolicyEngine.evaluate() --> TxBuilder.build() --> PreflightService.simulate()
--> ApprovalService.requestApproval() --> WalletService.sign() --> Broadcast --> AuditTrace
```

No step in this pipeline can be bypassed. There is no `signRaw` API, no backdoor for "trusted" skills, and no way to skip policy evaluation. The single signing entry point (`WalletService.sign`) requires both a valid `PolicyDecision` and a single-use `ApprovalToken`.

**Security guarantees:**
- Keys are encrypted at rest (scrypt + AES-256-GCM) and decrypted only in memory for signing
- Policy engine evaluates every intent against configurable rules (value limits, contract allowlists, token allowlists)
- Preflight simulation detects anomalies before signing (balance changes, gas estimation, risk scoring)
- Approval tokens are single-use with TTL -- no replay attacks
- Every critical step is written to an append-only audit trail with `intentId` correlation
- RPC access uses an allowlist -- only approved endpoints are contacted

### Domain C -- Limited Trust (Secure Executor)

**Packages:** `@clavion/sandbox`

Domain C runs untrusted skill code in isolated Docker containers with aggressive restrictions:

- `--network none` by default (no network access)
- `--read-only` root filesystem
- `--cap-drop ALL` (all Linux capabilities dropped)
- `--security-opt no-new-privileges`
- seccomp profile blocks `clone`, `fork`, `exec` (no process spawning)
- Resource limits: memory (128MB), CPU (0.5 cores), execution timeout

Domain C communicates with Domain B exclusively via the ISCL Core API. Key material is never present on the container's filesystem or in its environment variables.

### Boundary Enforcement

The three-domain boundary is enforced at multiple levels simultaneously:

- **Package level:** Domain B packages are never imported by Domain A code. TypeScript project references enforce this at build time.
- **Network level:** Keys are never transmitted over HTTP, even on localhost. Only approval tokens and signed transaction hashes cross the API boundary.
- **Process level:** Sandbox containers have no access to the host filesystem where keys are stored.
- **Runtime level:** The API server validates all inputs against strict JSON schemas (`additionalProperties: false`) -- no undocumented fields pass through.
- **Test level:** A dedicated security test suite (`tests/security/`) verifies domain boundaries, including tests for key exfiltration attempts, import graph integrity, and cross-domain access.

### Cross-Domain Communication

All communication between domains flows through the ISCL Core HTTP API at `localhost:3100`. There are no shared memory spaces, no direct function calls, and no file-based communication channels between domains.

```
Domain A  --HTTP-->  Domain B (ISCL Core API)
Domain C  --HTTP-->  Domain B (ISCL Core API)
```

Domain A and Domain C never communicate directly with each other.

## Consequences

### Positive

- **Key isolation is physical, not just logical.** Private keys exist only in Domain B's process memory and encrypted keystore. A compromised agent skill literally cannot access them -- they are in a different process, behind an API with no key-export endpoint.
- **Compromised skills have limited blast radius.** The worst a malicious skill can do is submit a TxIntent, which still must pass policy evaluation, preflight simulation, and user approval before any funds move.
- **Every operation has an audit trail.** The append-only SQLite audit trace in Domain B records the full lifecycle of every intent, from submission through policy decision, approval, signing, and broadcast. This is essential for incident response and compliance.
- **Approval is flexible.** The architecture supports CLI prompts, web-based approval dashboards, and Telegram inline keyboards. Approval mode is configurable per deployment (`cli`, `web`, `auto`) and per policy rule (`requireApprovalAbove`).
- **Framework-agnostic design.** The localhost HTTP API is a universal integration point. Adding support for a new agent framework (e.g., a new LLM orchestrator) requires only writing a thin adapter in Domain A -- no changes to the security-critical Domain B code.
- **Defense in depth.** Multiple independent enforcement layers (package boundaries, process isolation, network restrictions, schema validation, policy engine, preflight simulation) mean that a single failure does not compromise the system.

### Negative

- **HTTP latency between domains.** Every operation from Domain A to Domain B incurs an HTTP round-trip (~1-5ms on localhost). This is acceptable for crypto operations where blockchain confirmation takes seconds, but it means ISCL is not suitable for high-frequency trading use cases.
- **Skills cannot optimize gas or timing directly.** Because skills express intent rather than constructing transactions, they cannot fine-tune gas parameters, MEV strategies, or precise timing. This is an intentional constraint -- it prevents skills from crafting malicious calldata -- but it limits what advanced DeFi strategies can express.
- **Adding new action types requires Domain B changes.** Every new type of crypto operation (e.g., a new DeFi primitive) must be implemented as a TxBuilder in Domain B. Skills cannot introduce new transaction types unilaterally. This is the intended trade-off: security over extensibility speed.
- **Operational complexity.** Running three trust domains means managing multiple processes (or containers), configuring RPC allowlists, and maintaining policy files. This is more complex than a single-process agent with embedded keys.

### Neutral

- **Localhost-only API means per-machine deployment.** ISCL Core is not a shared cloud service -- it runs alongside the agent on the same machine. This matches the self-custody model but means each deployment is independent.
- **Three-domain model adds conceptual overhead.** Developers must understand which domain their code belongs to and follow the corresponding rules. This is mitigated by clear package naming, documentation, and automated boundary tests.
- **The model is deliberately conservative for v0.1.** Features like arbitrary calldata signing, cross-chain atomic operations, and multi-party approval are deferred to future versions. The current model prioritizes provable invariants over feature breadth.

## References

- [Trust Domains](../trust-domains.md) -- Detailed description of each domain's capabilities and restrictions
- [Threat Model](../threat-model.md) -- Threat-to-mitigation mapping for all three domains
- [Engineering Specification](../engineering-spec.md) -- Full technical specification
- [Stack Decisions](../stack-decisions.md) -- Technology choices and rationale
