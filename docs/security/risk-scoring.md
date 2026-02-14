# Risk Scoring Algorithm

## Overview

The ISCL risk scoring algorithm quantifies transaction risk on a **0--100 integer scale**. It is computed by `computeRiskScore()` in `@clavion/preflight` during the simulation phase of every transaction. The resulting score is passed to `PolicyEngine.evaluate()`, where it can trigger a `require_approval` decision if it exceeds the operator-configured `maxRiskScore` threshold.

The algorithm is deliberately additive and transparent: each scoring factor contributes a fixed weight, and the triggered factors are returned as human-readable `reasons` strings alongside the numeric score. This makes risk outcomes auditable and explainable to both operators and end users reviewing approval prompts.

**Key source files:**

- [`packages/preflight/src/risk-scorer.ts`](../../packages/preflight/src/risk-scorer.ts) -- scoring factors, weights, constants
- [`packages/preflight/src/preflight-service.ts`](../../packages/preflight/src/preflight-service.ts) -- `RiskContext` construction, simulation flow
- [`packages/policy/src/policy-engine.ts`](../../packages/policy/src/policy-engine.ts) -- policy decision based on risk score

## Scoring Factors

The scorer evaluates seven independent factors. Each factor is a boolean test; when the condition is true, its fixed weight is added to the running total. The final score is capped at `MAX_SCORE` (100).

| # | Factor | Weight | Condition | Reason String |
|---|--------|--------|-----------|---------------|
| 1 | Contract not in allowlist | +40 | `!context.contractInAllowlist` | `"Contract not in allowlist (+40)"` |
| 2 | Token not in allowlist | +20 | `!context.tokenInAllowlist` | `"Token not in allowlist (+20)"` |
| 3 | High slippage | +15 | `context.slippageBps > 300` | `"High slippage: {bps} bps > 300 bps (+15)"` |
| 4 | Large value relative to limit | +20 | `valueWei > maxValueWei / 2` (both defined, maxValueWei > 0) | `"Large value relative to limit (+20)"` |
| 5 | Unbounded approval | +25 | `approvalAmount === MAX_UINT256` **or** `approvalAmount > maxApprovalAmount * 10` | `"Unbounded or very large approval amount (+25)"` |
| 6 | Simulation reverted | +50 | `context.simulationReverted === true` | `"Transaction simulation reverted (+50)"` |
| 7 | Abnormal gas estimate | +10 | `context.gasEstimate > 400_000` | `"Abnormal gas estimate: {gas} (+10)"` |

The theoretical maximum raw sum is 180 (all factors triggered), but the returned score is `Math.min(sum, 100)`.

```typescript
// packages/preflight/src/risk-scorer.ts (simplified)
export function computeRiskScore(context: RiskContext): RiskResult {
  let score = 0;
  const reasons: string[] = [];

  if (!context.contractInAllowlist)     { score += 40; reasons.push("Contract not in allowlist (+40)"); }
  if (!context.tokenInAllowlist)        { score += 20; reasons.push("Token not in allowlist (+20)"); }
  if (context.slippageBps > 300)        { score += 15; reasons.push(`High slippage ... (+15)`); }
  if (valueWei > maxValueWei / 2n)      { score += 20; reasons.push("Large value relative to limit (+20)"); }
  if (isUnboundedApproval)              { score += 25; reasons.push("Unbounded or very large approval amount (+25)"); }
  if (context.simulationReverted)       { score += 50; reasons.push("Transaction simulation reverted (+50)"); }
  if (context.gasEstimate > 400_000n)   { score += 10; reasons.push(`Abnormal gas estimate: ... (+10)`); }

  return { score: Math.min(score, 100), reasons };
}
```

## Constants

| Constant | Value | Type | Purpose |
|----------|-------|------|---------|
| `MAX_SCORE` | `100` | `number` | Upper bound on returned risk score |
| `HIGH_SLIPPAGE_BPS` | `300` | `number` | Slippage threshold in basis points (3%) |
| `ABNORMAL_GAS_THRESHOLD` | `400_000n` | `bigint` | Gas estimate above which +10 is applied |
| `MAX_UINT256` | `2n ** 256n - 1n` | `bigint` | Used to detect unlimited ERC-20 approvals |

## RiskContext Construction

The `PreflightService.buildRiskContext()` method assembles a `RiskContext` object from three sources: the `TxIntent`, the active `PolicyConfig`, and the simulation results.

```typescript
// packages/types/src/index.ts
export interface RiskContext {
  contractInAllowlist: boolean;
  tokenInAllowlist: boolean;
  slippageBps: number;
  simulationReverted: boolean;
  gasEstimate: bigint;
  approvalAmount?: bigint;      // set for approve actions
  maxApprovalAmount?: bigint;    // from PolicyConfig
  valueWei?: bigint;             // set for transfers and swaps
  maxValueWei?: bigint;          // from PolicyConfig
}
```

### Field resolution

**`contractInAllowlist`** -- Derived from the intent action type. For `approve` actions, the contract is `action.spender`. For `swap_exact_in` / `swap_exact_out`, it is `action.router`. Transfer actions have no target contract, so `contractInAllowlist` defaults to `true`. If `PolicyConfig.contractAllowlist` is empty, the check is bypassed (treated as allowlisted).

**`tokenInAllowlist`** -- All token addresses are extracted from the intent: `asset.address` for transfers/approvals, both `assetIn.address` and `assetOut.address` for swaps. Every token must appear in `PolicyConfig.tokenAllowlist`. An empty allowlist bypasses the check (all tokens treated as allowlisted).

**`slippageBps`** -- Taken directly from `intent.constraints.maxSlippageBps`.

**`simulationReverted`** -- The inverse of the `eth_call` simulation success flag.

**`gasEstimate`** -- The result of `eth_estimateGas`. Falls back to `0n` if estimation fails and the simulation also failed.

**`valueWei`** -- Populated based on action type:

| Action Type | Source Field |
|---|---|
| `transfer` | `action.amount` |
| `transfer_native` | `action.amount` |
| `swap_exact_in` | `action.amountIn` |
| `swap_exact_out` | `action.maxAmountIn` |
| `approve` | not set (uses `approvalAmount` instead) |

**`approvalAmount`** -- Set only for `approve` actions, from `action.amount`.

**`maxValueWei` / `maxApprovalAmount`** -- Sourced from `PolicyConfig`. If the config value is `"0"` (the default), the corresponding context field is set to `undefined`, which disables the associated scoring factor.

## Score in the Policy Pipeline

The risk score flows through the ISCL pipeline as follows:

```
TxIntent
  |
  v
PreflightService.simulate(intent, buildPlan)
  |-- 1. eth_call simulation (reverted?)
  |-- 2. eth_estimateGas
  |-- 3. collectBalanceDiffs
  |-- 4. collectAllowanceChanges
  |-- 5. buildRiskContext(intent, simulationSuccess, gasEstimate)
  |-- 6. computeRiskScore(riskContext) --> { score, reasons }
  |
  v
PreflightResult { riskScore, riskReasons, warnings, ... }
  |
  v
PolicyEngine.evaluate(intent, config, { riskScore })
  |-- Check 7 of 8: if riskScore > config.maxRiskScore
  |       --> decision = "require_approval"
  |
  v
PolicyDecision { decision: "allow" | "require_approval" | "deny" }
```

Within `PolicyEngine.evaluate()`, the risk score check is one of eight policy checks. It can only escalate the decision to `require_approval`; it never causes an outright `deny`. The decision priority is: **deny > require_approval > allow**. This means that if any other check triggers a `deny` (e.g., token not in allowlist at the policy level, or rate limit exceeded), the deny takes precedence regardless of risk score.

```typescript
// packages/policy/src/policy-engine.ts (excerpt)
if (
  options?.riskScore !== undefined &&
  options.riskScore > config.maxRiskScore
) {
  shouldRequireApproval = true;
  reasons.push(`Risk score ${options.riskScore} exceeds max ${config.maxRiskScore}`);
}
```

The `PreflightService` also independently generates warnings when the score exceeds the threshold:

```typescript
if (risk.score >= this.policyConfig.maxRiskScore) {
  warnings.push(`Risk score ${risk.score} exceeds threshold ${this.policyConfig.maxRiskScore}`);
}
```

## Configuration Impact

All scoring thresholds are derived from `PolicyConfig`. Operators tune risk tolerance through configuration rather than code changes. See [docs/configuration.md](../configuration.md) for the full config schema.

### How each config field affects scoring

| PolicyConfig Field | Default | Risk Factor Affected | Effect |
|---|---|---|---|
| `contractAllowlist` | `[]` (empty = all allowed) | Contract not in allowlist (+40) | Adding contracts to this list eliminates the +40 penalty for those contracts. An empty list disables the check entirely. |
| `tokenAllowlist` | `[]` (empty = all allowed) | Token not in allowlist (+20) | Adding tokens eliminates the +20 penalty. An empty list disables the check. |
| `maxValueWei` | `"0"` (disabled) | Large value (+20) | When set to a non-zero value, any transaction exceeding 50% of this limit triggers +20. Setting to `"0"` disables the factor. |
| `maxApprovalAmount` | `"0"` (disabled) | Unbounded approval (+25) | When set to a non-zero value, approvals exceeding 10x this amount trigger +25. `MAX_UINT256` approvals always trigger +25 regardless of this setting. Setting to `"0"` disables the 10x check (but `MAX_UINT256` still triggers). |
| `maxRiskScore` | `50` | Policy decision threshold | Scores above this value cause `require_approval`. Range: 0--100. Setting to `100` effectively disables risk-based approval requirements. Setting to `0` requires approval for any non-zero score. |

### Allowlist behavior

Both `contractAllowlist` and `tokenAllowlist` use an **empty-means-open** semantic: an empty array means all addresses are considered allowlisted (no penalty). This is a deliberate design choice for ease of initial deployment. Once an operator populates an allowlist, only listed addresses avoid the penalty.

Note that PolicyEngine also independently enforces allowlists as hard `deny` rules when the lists are non-empty. The risk scorer's allowlist checks are softer -- they add penalty points rather than blocking outright. This creates a layered defense: PolicyEngine can deny unlisted tokens entirely, while the risk scorer penalizes interactions with unlisted-but-not-denied addresses (possible when the policy allowlist is empty but the operator still wants scoring differentiation).

## Worked Examples

### Example 1: Simple allowlisted ETH transfer -- Score 0

A native ETH transfer to a known recipient. No contract interaction, no tokens, low value.

| Factor | Triggered? | Detail |
|---|---|---|
| Contract not in allowlist | No | `transfer_native` has no target contract; defaults to allowlisted |
| Token not in allowlist | No | No ERC-20 tokens involved; `extractTokenAddresses` returns `[]` |
| High slippage | No | `maxSlippageBps: 50` (0.5%), below 300 threshold |
| Large value | No | `maxValueWei: "0"` in config, factor disabled |
| Unbounded approval | No | Not an approve action |
| Simulation reverted | No | Simulation succeeds |
| Abnormal gas | No | Native transfer gas ~21,000 |

**Final score: 0** -- PolicyEngine decision: `allow`.

### Example 2: Swap with unknown token, high slippage -- Score 35

A `swap_exact_in` on a Uniswap V3 router that is in the contract allowlist, but the output token is not in the token allowlist, and slippage is set to 500 bps (5%).

| Factor | Triggered? | Weight | Detail |
|---|---|---|---|
| Contract not in allowlist | No | -- | Router is in `contractAllowlist` |
| Token not in allowlist | Yes | +20 | `assetOut` not in `tokenAllowlist` |
| High slippage | Yes | +15 | 500 bps > 300 bps threshold |
| Large value | No | -- | `maxValueWei: "0"`, factor disabled |
| Unbounded approval | No | -- | Not an approve action |
| Simulation reverted | No | -- | Simulation succeeds |
| Abnormal gas | No | -- | Gas estimate ~180,000 |

**Final score: 35** -- With default `maxRiskScore: 50`, PolicyEngine decision: `allow`.

### Example 3: Unlimited approval to unknown contract -- Score 75

An `approve` action granting `MAX_UINT256` allowance to a spender that is not in the contract allowlist. The token is in the token allowlist. The approval targets a proxy contract with complex initialization, pushing gas above the 400k threshold.

| Factor | Triggered? | Weight | Detail |
|---|---|---|---|
| Contract not in allowlist | Yes | +40 | Spender not in `contractAllowlist` |
| Token not in allowlist | No | -- | Token is in `tokenAllowlist` |
| High slippage | No | -- | `maxSlippageBps: 50`, below threshold |
| Large value | No | -- | `approve` actions do not set `valueWei` |
| Unbounded approval | Yes | +25 | `approvalAmount === MAX_UINT256` |
| Simulation reverted | No | -- | Simulation succeeds |
| Abnormal gas | Yes | +10 | Gas estimate ~450,000 exceeds 400k threshold |

**Final score: 75** (40 + 25 + 10) -- With default `maxRiskScore: 50`, PolicyEngine decision: `require_approval`. The user sees all three triggered reasons in the approval prompt.

### Example 4: Reverted simulation with unknown contract -- Score 90

A `swap_exact_in` where the simulation reverts (e.g., insufficient liquidity), the router is not allowlisted, and the gas estimate is abnormally high.

| Factor | Triggered? | Weight | Detail |
|---|---|---|---|
| Contract not in allowlist | Yes | +40 | Router not in `contractAllowlist` |
| Token not in allowlist | No | -- | Both tokens in `tokenAllowlist` |
| High slippage | No | -- | `maxSlippageBps: 100`, below 300 threshold |
| Large value | No | -- | `maxValueWei: "0"`, factor disabled |
| Unbounded approval | No | -- | Not an approve action |
| Simulation reverted | Yes | +50 | `eth_call` returned revert |
| Abnormal gas | No | -- | Gas estimation failed, `gasEstimate: 0` |

**Final score: 90** -- PolicyEngine decision: `require_approval`. The approval prompt warns `"Transaction simulation reverted (+50)"` and `"Contract not in allowlist (+40)"`.

Note: when gas estimation fails alongside a reverted simulation, `gasEstimate` falls back to `0n`, so the abnormal gas factor does not trigger. The simulation revert factor alone carries a substantial +50 weight.

## Customization

Risk tolerance should be tuned through `PolicyConfig` rather than by modifying the scoring weights in code. The scoring weights are designed as sensible defaults; the config knobs provide the operational flexibility.

### Strategies for common scenarios

**Conservative (DeFi treasury):** Set `maxRiskScore: 20`, populate both allowlists exhaustively, set `maxValueWei` and `maxApprovalAmount` to reasonable limits. Almost any non-trivial transaction will require human approval.

```json
{
  "version": "1",
  "maxValueWei": "1000000000000000000",
  "maxApprovalAmount": "1000000000000000000000",
  "contractAllowlist": ["0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"],
  "tokenAllowlist": ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0xdAC17F958D2ee523a2206206994597C13D831ec7"],
  "allowedChains": [1],
  "recipientAllowlist": [],
  "maxRiskScore": 20,
  "requireApprovalAbove": { "valueWei": "100000000000000000" },
  "maxTxPerHour": 5
}
```

**Permissive (development/testing):** Set `maxRiskScore: 100`, leave allowlists empty, set value limits to `"0"`. Only simulation reverts will produce nonzero scores, and even those will not trigger approval requirements.

```json
{
  "version": "1",
  "maxValueWei": "0",
  "maxApprovalAmount": "0",
  "contractAllowlist": [],
  "tokenAllowlist": [],
  "allowedChains": [1, 10, 42161, 8453],
  "recipientAllowlist": [],
  "maxRiskScore": 100,
  "requireApprovalAbove": { "valueWei": "0" },
  "maxTxPerHour": 100
}
```

**Balanced (production agent):** Use the defaults (`maxRiskScore: 50`, empty allowlists). Transactions interacting with unknown contracts (+40) or experiencing simulation reverts (+50) will require approval. Routine allowlisted transfers pass through automatically.

### Key tuning relationships

- Populating `contractAllowlist` is the single highest-impact configuration change, eliminating 40 points of potential risk for known contracts.
- `maxRiskScore: 50` (the default) means that any single high-weight factor (contract not allowlisted at +40 combined with any other factor, or simulation revert alone at +50) will trigger approval.
- Setting `maxValueWei` to a non-zero value activates the "large value" factor, adding another layer of scrutiny for high-value transactions even when all other factors are clean.

### Cross-references

- [Trust Domains](../architecture/trust-domains.md) -- how Domain B enforces the policy boundary
- [Configuration Guide](../configuration.md) -- full `PolicyConfig` schema and loading behavior
- [Threat Model](../architecture/threat-model.md) -- threat scenarios the risk scorer mitigates
- [API Reference](../api/overview.md) -- `/v1/tx/preflight` endpoint that exposes risk scores
