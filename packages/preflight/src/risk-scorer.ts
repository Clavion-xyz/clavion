import type { RiskContext } from "@clavion/types";

export interface RiskResult {
  score: number;
  reasons: string[];
}

const MAX_UINT256 = 2n ** 256n - 1n;
const HIGH_SLIPPAGE_BPS = 300;
const ABNORMAL_GAS_THRESHOLD = 400_000n;
const MAX_RISK_SCORE = 100;

// Risk score penalties
const PENALTY_CONTRACT_NOT_IN_ALLOWLIST = 40;
const PENALTY_TOKEN_NOT_IN_ALLOWLIST = 20;
const PENALTY_HIGH_SLIPPAGE = 15;
const PENALTY_LARGE_VALUE = 20;
const PENALTY_UNBOUNDED_APPROVAL = 25;
const PENALTY_SIMULATION_REVERTED = 50;
const PENALTY_ABNORMAL_GAS = 10;
const APPROVAL_MULTIPLIER_THRESHOLD = 10n;

export function computeRiskScore(context: RiskContext): RiskResult {
  let score = 0;
  const reasons: string[] = [];

  if (!context.contractInAllowlist) {
    score += PENALTY_CONTRACT_NOT_IN_ALLOWLIST;
    reasons.push(`Contract not in allowlist (+${PENALTY_CONTRACT_NOT_IN_ALLOWLIST})`);
  }

  if (!context.tokenInAllowlist) {
    score += PENALTY_TOKEN_NOT_IN_ALLOWLIST;
    reasons.push(`Token not in allowlist (+${PENALTY_TOKEN_NOT_IN_ALLOWLIST})`);
  }

  if (context.slippageBps > HIGH_SLIPPAGE_BPS) {
    score += PENALTY_HIGH_SLIPPAGE;
    reasons.push(
      `High slippage: ${context.slippageBps} bps > ${HIGH_SLIPPAGE_BPS} bps (+${PENALTY_HIGH_SLIPPAGE})`,
    );
  }

  if (
    context.valueWei !== undefined &&
    context.maxValueWei !== undefined &&
    context.maxValueWei > 0n &&
    context.valueWei > context.maxValueWei / 2n
  ) {
    score += PENALTY_LARGE_VALUE;
    reasons.push(`Large value relative to limit (+${PENALTY_LARGE_VALUE})`);
  }

  if (context.approvalAmount !== undefined) {
    const isUnbounded =
      context.approvalAmount === MAX_UINT256 ||
      (context.maxApprovalAmount !== undefined &&
        context.maxApprovalAmount > 0n &&
        context.approvalAmount > context.maxApprovalAmount * APPROVAL_MULTIPLIER_THRESHOLD);
    if (isUnbounded) {
      score += PENALTY_UNBOUNDED_APPROVAL;
      reasons.push(`Unbounded or very large approval amount (+${PENALTY_UNBOUNDED_APPROVAL})`);
    }
  }

  if (context.simulationReverted) {
    score += PENALTY_SIMULATION_REVERTED;
    reasons.push(`Transaction simulation reverted (+${PENALTY_SIMULATION_REVERTED})`);
  }

  if (context.gasEstimate > ABNORMAL_GAS_THRESHOLD) {
    score += PENALTY_ABNORMAL_GAS;
    reasons.push(`Abnormal gas estimate: ${context.gasEstimate.toString()} (+${PENALTY_ABNORMAL_GAS})`);
  }

  return {
    score: Math.min(score, MAX_RISK_SCORE),
    reasons,
  };
}
