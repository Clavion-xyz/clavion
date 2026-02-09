---
name: policy-engine
description: >
  ISCL PolicyEngine implementation patterns. Use when adding policy rules, modifying evaluation
  logic, working with allowlists/denylists, configuring transaction limits, or debugging policy
  decisions. Triggers: PolicyEngine, policy rules, allowlist, denylist, transaction limits,
  approval requirements, "deny because", policy configuration YAML/JSON.
---

# Policy Engine

The PolicyEngine is a **pure function** — no side effects, fully testable.

```typescript
type PolicyDecision = {
  decision: "allow" | "deny" | "require_approval";
  reasons: string[];          // human-readable explanations
  policyVersion: string;
};

function evaluate(
  intent: TxIntent,
  buildPlan: BuildPlan,
  preflight: PreflightResult,
  config: PolicyConfig
): PolicyDecision;
```

## What the Policy Engine Evaluates

| Check | Config Key | Example |
|---|---|---|
| Transaction value limit | `maxValueWei` | Deny if value > 1 ETH |
| Approval amount limit | `maxApprovalAmount` | Deny MaxUint approvals |
| Contract allowlist | `contractAllowlist` | Only known DEX routers |
| Token allowlist | `tokenAllowlist` | Only verified tokens |
| Chain restriction | `allowedChains` | Only Base (8453) |
| Recipient restriction | `recipientAllowlist` | Optional, for transfers |
| Risk score threshold | `maxRiskScore` | Require approval if risk > threshold |
| Rate limiting | `maxTxPerHour` | Deny if exceeded |

## Policy Configuration

Policies are stored as local YAML/JSON, versioned with `policyVersion` in audit trace.

```yaml
# ~/.iscl/policy.yaml
version: "1"
maxValueWei: "1000000000000000000"  # 1 ETH
maxApprovalAmount: "1000000000"     # bounded, not MaxUint
contractAllowlist:
  - "0x..."  # Uniswap V3 Router on Base
tokenAllowlist:
  - "0x..."  # USDC
  - "0x..."  # WETH
allowedChains: [8453]
maxRiskScore: 70
requireApprovalAbove:
  valueWei: "100000000000000000"    # 0.1 ETH
```

## Implementation Rules

1. **Every** signing path calls `evaluate()` — no exceptions, no bypass
2. PolicyDecision is passed to WalletService; signing refuses without it
3. `reasons` array must be human-readable — shown in approval UI
4. Log `policy_evaluated` event to AuditTrace with decision + reasons + policyVersion
5. Unknown action types → `deny` by default
6. Missing config fields → conservative defaults (deny or require_approval)

## Adding a New Policy Rule

1. Add config key to `PolicyConfig` interface
2. Add evaluation logic inside `evaluate()` — pure, no I/O
3. Add reason string (e.g., `"deny: spender not in contractAllowlist"`)
4. Add default to config schema
5. Write property-based tests: valid config permutations × intent permutations
6. Update `references/policy-config-schema.md` if adding new config keys

## Testing Patterns

```typescript
// Property: deny always includes a reason
test("deny decisions have non-empty reasons", () => {
  const result = evaluate(maliciousIntent, buildPlan, preflight, strictConfig);
  if (result.decision === "deny") {
    expect(result.reasons.length).toBeGreaterThan(0);
  }
});

// Fixture-based: known bad intents
test("approve MaxUint denied by default", () => {
  const intent = fixtures.approveMaxUint;
  const result = evaluate(intent, buildPlan, preflight, defaultConfig);
  expect(result.decision).toBe("deny");
});
```
