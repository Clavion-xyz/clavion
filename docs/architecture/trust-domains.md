# Trust Domains

Clavion divides the system into three trust domains with strict, enforced boundaries. This separation is the foundation of the security model.

---

## Domain A -- Untrusted (Agent Framework + Skills)

**What lives here:** OpenClaw runtime, agent skills, ISCLClient, skill wrappers, intent builder.

**Trust level:** None. Code in Domain A is considered potentially compromisable.

**Capabilities:**
- Construct TxIntents (declarative JSON describing a desired operation)
- Call ISCL Core API over localhost HTTP
- Read balance data via ISCL Core

**Restrictions:**
- No access to private keys or key material
- No direct signing capability
- No direct blockchain RPC access
- No access to policy internals or audit data
- Cannot control the content of approval summaries

**Example -- skill wrapper:**
```typescript
// Domain A code constructs an intent and delegates to ISCL Core
const intent = buildIntent({
  walletAddress: "0x1234...",
  action: { type: "transfer", asset: usdcAsset, to: recipient, amount: "1000000" },
});
const result = await client.txApproveRequest(intent);
```

The skill never sees the private key, never signs, and never talks to the blockchain directly.

> To build your own Domain A adapter, see the [Adapter Development Tutorial](../development/adapter-tutorial.md).

---

## Domain B -- Trusted (ISCL Core)

**What lives here:** API server, WalletService, PolicyEngine, TxEngine, PreflightService, ApprovalService, AuditTraceService, SkillRegistryService, RPC client.

**Trust level:** Full. This is the only domain that holds key material and can sign transactions.

**Capabilities:**
- Store and manage encrypted keys
- Evaluate policy rules
- Build concrete transactions from TxIntents
- Simulate transactions via RPC
- Issue and consume approval tokens
- Sign and broadcast transactions
- Write audit events

**Security guarantees:**
- Single signing entry point (no `signRaw` or bypass paths)
- Every signature requires PolicyDecision + ApprovalToken
- All operations are audit logged with intentId correlation
- RPC access is allowlisted

**Example -- signing pipeline:**
```
TxIntent -> PolicyEngine.evaluate() -> TxBuilder.build() -> PreflightService.simulate()
-> ApprovalService.requestApproval() -> WalletService.sign() -> Broadcast -> AuditTrace
```

---

## Domain C -- Limited Trust (Secure Executor)

**What lives here:** Docker sandbox runner, seccomp profiles, container isolation infrastructure.

**Trust level:** Limited. Untrusted skill code runs here in restricted containers.

**Capabilities:**
- Execute skill code in isolated containers
- Communicate with ISCL Core via API only

**Restrictions:**
- No key access (keys are not on the filesystem or in environment variables)
- No network access (`--network none` by default)
- Read-only root filesystem
- No arbitrary process spawning (seccomp blocks clone/fork/exec)
- Resource limits (memory, CPU, timeout)
- All capabilities dropped (`--cap-drop ALL`)

**Example -- container execution:**
```
docker run --rm \
  --network none \
  --read-only \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --security-opt seccomp=sandbox/seccomp-no-spawn.json \
  --memory 128m \
  --cpus 0.5 \
  --tmpfs /tmp:noexec \
  skill-image:latest
```

---

## Cross-Domain Communication

All communication between domains flows through the ISCL Core HTTP API at `localhost:3100`. There are no shared memory spaces, no direct function calls, and no file-based communication channels between domains.

```
Domain A  --HTTP-->  Domain B (ISCL Core API)
Domain C  --HTTP-->  Domain B (ISCL Core API)
```

Domain A and Domain C never communicate directly with each other.
