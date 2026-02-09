import { describe, test, expect } from "vitest";
import { computeRiskScore } from "../../core/preflight/risk-scorer.js";
import type { RiskContext } from "../../core/types.js";

function safeContext(): RiskContext {
  return {
    contractInAllowlist: true,
    tokenInAllowlist: true,
    slippageBps: 100,
    simulationReverted: false,
    gasEstimate: 50_000n,
  };
}

describe("Risk Scorer", () => {
  test("zero-risk context returns score 0 and empty reasons", () => {
    const result = computeRiskScore(safeContext());
    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  test("contract not in allowlist adds 40 points", () => {
    const result = computeRiskScore({ ...safeContext(), contractInAllowlist: false });
    expect(result.score).toBe(40);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain("+40");
  });

  test("token not in allowlist adds 20 points", () => {
    const result = computeRiskScore({ ...safeContext(), tokenInAllowlist: false });
    expect(result.score).toBe(20);
    expect(result.reasons[0]).toContain("+20");
  });

  test("high slippage (> 300 bps) adds 15 points", () => {
    const result = computeRiskScore({ ...safeContext(), slippageBps: 500 });
    expect(result.score).toBe(15);
    expect(result.reasons[0]).toContain("+15");
  });

  test("slippage at exactly 300 bps does NOT trigger", () => {
    const result = computeRiskScore({ ...safeContext(), slippageBps: 300 });
    expect(result.score).toBe(0);
  });

  test("large value (> 50% of limit) adds 20 points", () => {
    const result = computeRiskScore({
      ...safeContext(),
      valueWei: 600n,
      maxValueWei: 1000n,
    });
    expect(result.score).toBe(20);
    expect(result.reasons[0]).toContain("+20");
  });

  test("MaxUint256 approval adds 25 points", () => {
    const result = computeRiskScore({
      ...safeContext(),
      approvalAmount: 2n ** 256n - 1n,
    });
    expect(result.score).toBe(25);
    expect(result.reasons[0]).toContain("+25");
  });

  test("simulation reverted adds 50 points", () => {
    const result = computeRiskScore({ ...safeContext(), simulationReverted: true });
    expect(result.score).toBe(50);
    expect(result.reasons[0]).toContain("+50");
  });

  test("abnormal gas (> 400_000) adds 10 points", () => {
    const result = computeRiskScore({ ...safeContext(), gasEstimate: 500_000n });
    expect(result.score).toBe(10);
    expect(result.reasons[0]).toContain("+10");
  });

  test("multiple rules combine additively", () => {
    const result = computeRiskScore({
      ...safeContext(),
      contractInAllowlist: false,
      tokenInAllowlist: false,
      slippageBps: 500,
    });
    expect(result.score).toBe(40 + 20 + 15);
    expect(result.reasons).toHaveLength(3);
  });

  test("score capped at 100", () => {
    const result = computeRiskScore({
      contractInAllowlist: false,
      tokenInAllowlist: false,
      slippageBps: 500,
      simulationReverted: true,
      gasEstimate: 500_000n,
      approvalAmount: 2n ** 256n - 1n,
      valueWei: 600n,
      maxValueWei: 1000n,
    });
    expect(result.score).toBe(100);
    expect(result.reasons.length).toBeGreaterThan(3);
  });
});
