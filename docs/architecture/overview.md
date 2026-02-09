# Architecture Overview

Clavion / ISCL is organized around **three trust domains** with strict, enforced boundaries. Every line of code belongs to exactly one domain. Cross-domain communication happens exclusively via the ISCL Core HTTP API.

## Trust Domains

| Domain | Trust Level | Contains | Does NOT Contain |
|--------|------------|----------|-----------------|
| **A** (Untrusted) | None | OpenClaw agent, skill wrappers, ISCLClient | Keys, signing, direct RPC |
| **B** (Trusted) | Full | ISCL Core: wallet, policy, signing, audit, RPC | Agent code, untrusted skills |
| **C** (Limited) | Sandboxed | Container executor for untrusted skill code | Keys, unrestricted network |

For detailed descriptions and examples, see [Trust Domains](trust-domains.md).

## Component Map

```
ISCL Core (Domain B)
  API Server (Fastify)
  WalletService        -- encrypted keystore, signing
  PolicyEngine         -- evaluate intent against rules
  TxEngine             -- deterministic tx building (transfer, approve, swap)
  PreflightService     -- simulation, risk scoring
  ApprovalService      -- human confirmation flow
  AuditTraceService    -- append-only event log (SQLite)
  SkillRegistryService -- manifest validation, scanner

Secure Executor (Domain C)
  Sandbox Runner       -- Docker container isolation, trace logging

OpenClaw Adapter (Domain A)
  ISCLClient           -- HTTP client for ISCL Core API
  Skill Wrappers       -- thin handlers mapping tool calls to TxIntents
  Intent Builder       -- constructs valid TxIntents with safe defaults
```

## Canonical Data Flow

Every crypto operation follows a strict, sequential pipeline. No step can be bypassed.

```
Agent Skill constructs TxIntent (declarative JSON)
    |
    v
  Validate       -- Schema validation, canonicalization, hashing
    |
    v
  Policy Engine  -- Evaluate against rules: allow / deny / require_approval
    |
    v
  Tx Engine      -- Resolve intent into concrete transaction (calldata, gas)
    |
    v
  Preflight      -- Simulate via eth_call, compute balance diffs, score risk
    |
    v
  Approval       -- Generate human-readable summary, prompt for confirmation
    |
    v
  Wallet Service -- Sign transaction (requires PolicyDecision + ApprovalToken)
    |
    v
  Broadcast      -- Send to blockchain, monitor for receipt
    |
    v
  Audit Trace    -- Full lifecycle recorded: intent -> receipt
```

## Security Invariants

1. Private keys exist only in Domain B
2. Every signature passes PolicyEngine + Preflight
3. Skills have no direct RPC access
4. All fund-affecting operations use typed TxIntents
5. All critical steps are audit logged, correlated by `intentId`
6. Approval tokens are single-use with TTL

## Further Reading

- [Engineering Specification](engineering-spec.md) -- Full technical spec
- [Threat Model](threat-model.md) -- Security blueprint with threat-to-test mapping
- [Stack Decisions](stack-decisions.md) -- Technology choices and rationale
