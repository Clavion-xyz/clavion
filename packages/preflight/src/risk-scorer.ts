import type { RiskContext } from "@clavion/types";

export interface RiskResult {
  score: number;
  reasons: string[];
}

const MAX_UINT256 = 2n ** 256n - 1n;
const HIGH_SLIPPAGE_BPS = 300;
const ABNORMAL_GAS_THRESHOLD = 400_000n;

export function computeRiskScore(context: RiskContext): RiskResult {
  let score = 0;
  const reasons: string[] = [];

  if (!context.contractInAllowlist) {
    score += 40;
    reasons.push("Contract not in allowlist (+40)");
  }

  if (!context.tokenInAllowlist) {
    score += 20;
    reasons.push("Token not in allowlist (+20)");
  }

  if (context.slippageBps > HIGH_SLIPPAGE_BPS) {
    score += 15;
    reasons.push(
      `High slippage: ${context.slippageBps} bps > ${HIGH_SLIPPAGE_BPS} bps (+15)`,
    );
  }

  if (
    context.valueWei !== undefined &&
    context.maxValueWei !== undefined &&
    context.maxValueWei > 0n &&
    context.valueWei > context.maxValueWei / 2n
  ) {
    score += 20;
    reasons.push("Large value relative to limit (+20)");
  }

  if (context.approvalAmount !== undefined) {
    const isUnbounded =
      context.approvalAmount === MAX_UINT256 ||
      (context.maxApprovalAmount !== undefined &&
        context.maxApprovalAmount > 0n &&
        context.approvalAmount > context.maxApprovalAmount * 10n);
    if (isUnbounded) {
      score += 25;
      reasons.push("Unbounded or very large approval amount (+25)");
    }
  }

  if (context.simulationReverted) {
    score += 50;
    reasons.push("Transaction simulation reverted (+50)");
  }

  if (context.gasEstimate > ABNORMAL_GAS_THRESHOLD) {
    score += 10;
    reasons.push(`Abnormal gas estimate: ${context.gasEstimate.toString()} (+10)`);
  }

  return {
    score: Math.min(score, 100),
    reasons,
  };
}
