---
name: preflight-simulation
description: >
  ISCL PreflightService — transaction simulation, balance diffs, and risk scoring. Use when
  working on preflight simulation logic, risk scoring algorithms, RPC simulation calls,
  balance diff calculations, or the approval summary generation. Triggers: preflight,
  simulation, eth_call, risk score, balance diffs, allowance checks, gas estimation,
  PreflightService, risk report.
---

# Preflight Simulation

PreflightService simulates transactions before signing to assess risk and generate a
human-readable approval summary. No transaction is signed without a preflight result.

## Simulation Layers (v0.1)

Layered approach — minimum is mandatory, trace is optional enhancement:

| Layer | Required | Method | Purpose |
|---|---|---|---|
| Balance reads | ✅ | `eth_call` (balanceOf) | Pre/post balance diffs |
| Allowance reads | ✅ | `eth_call` (allowance) | Track approval changes |
| Gas estimate | ✅ | `eth_estimateGas` | Validate executability + cost |
| Simulation | ✅ | `eth_call` (full tx) | Detect reverts |
| Trace | Optional | `trace_call` / `debug_traceCall` | Detailed state diffs (if RPC supports) |

## PreflightResult Structure

```typescript
interface PreflightResult {
  intentId: string;
  simulationSuccess: boolean;
  revertReason?: string;
  gasEstimate: string;           // wei string
  balanceDiffs: BalanceDiff[];   // token balance changes
  allowanceChanges: AllowanceChange[];
  riskScore: number;             // 0–100
  riskReasons: string[];         // human-readable
  warnings: string[];            // non-blocking concerns
  rpcSource: string;             // which RPC was used
}

interface BalanceDiff {
  token: string;      // address or "ETH"
  symbol?: string;
  before: string;     // integer string
  after: string;      // integer string
  delta: string;      // signed integer string
}
```

## Risk Scoring (v0.1)

Start with rule-based scoring. Each rule adds points:

```typescript
function computeRiskScore(context: RiskContext): number {
  let score = 0;

  if (context.contractNotInAllowlist) score += 40;
  if (context.tokenNotInAllowlist) score += 20;
  if (context.highSlippage) score += 15;          // > 3%
  if (context.largeValueRelativeToBalance) score += 20; // > 50% of balance
  if (context.approvalIsUnbounded) score += 25;   // MaxUint or very large
  if (context.simulationReverted) score += 50;
  if (context.gasEstimateAbnormal) score += 10;   // > 2x typical
  if (context.rpcMismatch) score += 30;           // multi-RPC disagreement

  return Math.min(score, 100);
}
```

Score interpretation:
- 0–30: Low risk → auto-allow (if policy permits)
- 31–70: Medium risk → require approval
- 71–100: High risk → require approval + display warnings prominently

## Approval Summary Generation

PreflightService generates the data for ApprovalComposer (not the skill!):

```typescript
interface ApprovalSummary {
  action: string;            // "Swap 100 USDC → WETH"
  recipient?: string;        // for transfers
  spender?: string;          // for approvals
  expectedOutcome: string;   // "Receive ≥ 0.05 WETH"
  balanceDiffs: BalanceDiff[];
  riskScore: number;
  riskReasons: string[];
  warnings: string[];
  gasEstimateEth: string;    // human-readable gas cost
}
```

This summary is shown to the user. **The skill does not control this text** — it's derived
entirely from the build plan and preflight results.

## Multi-RPC Comparison (Optional v0.1)

When configured with two RPCs:
1. Run simulation on both
2. Compare results (balances, gas, revert status)
3. On mismatch → elevate risk score (+30) and add warning
4. Log mismatch details in audit trace

## Adding a New Risk Rule

1. Add the condition to `RiskContext` interface
2. Add scoring logic in `computeRiskScore()`
3. Add human-readable reason string to `riskReasons`
4. Write tests: intent that triggers the rule → expected score increase
5. Update approval summary if the rule affects displayed warnings
