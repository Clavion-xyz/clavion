import { describe, test, expect } from "vitest";
import { evaluate } from "../../core/policy/policy-engine.js";
import { validFixtures } from "../../spec/fixtures/index.js";
import { getDefaultConfig } from "../../core/policy/policy-config.js";
import type { TxIntent, PolicyConfig, ApproveAction } from "../../core/types.js";

// Permissive config that allows all fixtures through
function permissiveConfig(): PolicyConfig {
  return {
    version: "1",
    maxValueWei: "1000000000000000000000",
    maxApprovalAmount: "1000000000000000000000",
    contractAllowlist: ["0x2626664c2603336E57B271c5C0b26F421741e481"],
    tokenAllowlist: [
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "0x4200000000000000000000000000000000000006",
    ],
    allowedChains: [8453],
    recipientAllowlist: [],
    maxRiskScore: 70,
    requireApprovalAbove: { valueWei: "10000000000000000000" },
    maxTxPerHour: 100,
  };
}

describe("PolicyEngine", () => {
  test("allows transfer within all limits (permissive config)", () => {
    const result = evaluate(validFixtures.transfer, permissiveConfig());
    expect(result.decision).toBe("allow");
    expect(result.reasons).toContain("All checks passed");
  });

  test("allows swap within all limits", () => {
    const result = evaluate(validFixtures.swapExactIn, permissiveConfig());
    expect(result.decision).toBe("allow");
  });

  test("denies transfer exceeding maxValueWei", () => {
    const config = { ...permissiveConfig(), maxValueWei: "100" };
    const result = evaluate(validFixtures.transfer, config);
    expect(result.decision).toBe("deny");
    expect(result.reasons.some((r) => r.includes("exceeds max"))).toBe(true);
  });

  test("denies transfer to unlisted recipient (non-empty recipientAllowlist)", () => {
    const config = {
      ...permissiveConfig(),
      recipientAllowlist: ["0x0000000000000000000000000000000000000001"],
    };
    const result = evaluate(validFixtures.transfer, config);
    expect(result.decision).toBe("deny");
    expect(result.reasons.some((r) => r.includes("Recipient"))).toBe(true);
  });

  test("allows transfer to any recipient when recipientAllowlist is empty", () => {
    const config = { ...permissiveConfig(), recipientAllowlist: [] };
    const result = evaluate(validFixtures.transfer, config);
    expect(result.decision).toBe("allow");
  });

  test("denies approval exceeding maxApprovalAmount", () => {
    const config = { ...permissiveConfig(), maxApprovalAmount: "100" };
    const result = evaluate(validFixtures.approve, config);
    expect(result.decision).toBe("deny");
    expect(result.reasons.some((r) => r.includes("Approval amount"))).toBe(true);
  });

  test("denies MaxUint256 approval", () => {
    const maxUintIntent: TxIntent = {
      ...validFixtures.approve,
      action: {
        ...(validFixtures.approve.action as ApproveAction),
        amount: (2n ** 256n - 1n).toString(),
      },
    };
    const config = permissiveConfig();
    const result = evaluate(maxUintIntent, config);
    expect(result.decision).toBe("deny");
    expect(result.reasons.some((r) => r.includes("Approval amount"))).toBe(true);
  });

  test("denies swap with unknown token not in tokenAllowlist", () => {
    const config = {
      ...permissiveConfig(),
      tokenAllowlist: ["0x0000000000000000000000000000000000000001"],
    };
    const result = evaluate(validFixtures.swapExactIn, config);
    expect(result.decision).toBe("deny");
    expect(result.reasons.some((r) => r.includes("Token"))).toBe(true);
  });

  test("denies swap with unknown router not in contractAllowlist", () => {
    const config = {
      ...permissiveConfig(),
      contractAllowlist: ["0x0000000000000000000000000000000000000001"],
    };
    const result = evaluate(validFixtures.swapExactIn, config);
    expect(result.decision).toBe("deny");
    expect(result.reasons.some((r) => r.includes("Contract"))).toBe(true);
  });

  test("denies intent on disallowed chain", () => {
    const config = { ...permissiveConfig(), allowedChains: [1] };
    const result = evaluate(validFixtures.transfer, config);
    expect(result.decision).toBe("deny");
    expect(result.reasons.some((r) => r.includes("Chain"))).toBe(true);
  });

  test("require_approval when value above requireApprovalAbove threshold", () => {
    const config = {
      ...permissiveConfig(),
      requireApprovalAbove: { valueWei: "0" },
    };
    const result = evaluate(validFixtures.transfer, config);
    expect(result.decision).toBe("require_approval");
    expect(result.reasons.some((r) => r.includes("approval threshold"))).toBe(true);
  });

  test("require_approval when riskScore exceeds maxRiskScore", () => {
    const result = evaluate(validFixtures.transfer, permissiveConfig(), {
      riskScore: 80,
    });
    expect(result.decision).toBe("require_approval");
    expect(result.reasons.some((r) => r.includes("Risk score"))).toBe(true);
  });

  test("deny decisions always have non-empty reasons", () => {
    const config = { ...permissiveConfig(), allowedChains: [1] };
    const result = evaluate(validFixtures.transfer, config);
    expect(result.decision).toBe("deny");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  test("multiple deny reasons accumulate", () => {
    const config = {
      ...permissiveConfig(),
      allowedChains: [1],
      tokenAllowlist: ["0x0000000000000000000000000000000000000001"],
    };
    const result = evaluate(validFixtures.transfer, config);
    expect(result.decision).toBe("deny");
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  });

  test("default config requires approval for all operations (conservative)", () => {
    const config = getDefaultConfig();
    const result = evaluate(validFixtures.transfer, config);
    // Default requireApprovalAbove.valueWei is "0" → any non-zero value triggers approval
    expect(result.decision).toBe("require_approval");
  });

  test("policyVersion matches config version", () => {
    const result = evaluate(validFixtures.transfer, permissiveConfig());
    expect(result.policyVersion).toBe("1");
  });

  // ── transfer_native ──

  test("allows native transfer within all limits", () => {
    const result = evaluate(validFixtures.transferNative, permissiveConfig());
    expect(result.decision).toBe("allow");
  });

  test("denies native transfer exceeding maxValueWei", () => {
    const config = { ...permissiveConfig(), maxValueWei: "100" };
    const result = evaluate(validFixtures.transferNative, config);
    expect(result.decision).toBe("deny");
    expect(result.reasons.some((r) => r.includes("exceeds max"))).toBe(true);
  });

  test("denies native transfer to unlisted recipient", () => {
    const config = {
      ...permissiveConfig(),
      recipientAllowlist: ["0x0000000000000000000000000000000000000001"],
    };
    const result = evaluate(validFixtures.transferNative, config);
    expect(result.decision).toBe("deny");
    expect(result.reasons.some((r) => r.includes("Recipient"))).toBe(true);
  });

  test("native transfer skips token and contract allowlist checks", () => {
    const config = {
      ...permissiveConfig(),
      tokenAllowlist: ["0x0000000000000000000000000000000000000001"],
      contractAllowlist: ["0x0000000000000000000000000000000000000001"],
    };
    const result = evaluate(validFixtures.transferNative, config);
    // Should NOT deny — native transfers have no token or contract to check
    expect(result.decision).toBe("allow");
  });

  // ── rate limiting ──

  test("allows when recentTxCount is below maxTxPerHour", () => {
    const config = { ...permissiveConfig(), maxTxPerHour: 10 };
    const result = evaluate(validFixtures.transfer, config, { recentTxCount: 5 });
    expect(result.decision).toBe("allow");
  });

  test("denies when recentTxCount equals maxTxPerHour (boundary)", () => {
    const config = { ...permissiveConfig(), maxTxPerHour: 10 };
    const result = evaluate(validFixtures.transfer, config, { recentTxCount: 10 });
    expect(result.decision).toBe("deny");
    expect(result.reasons.some((r) => r.includes("Rate limit exceeded"))).toBe(true);
  });

  test("denies when recentTxCount exceeds maxTxPerHour", () => {
    const config = { ...permissiveConfig(), maxTxPerHour: 5 };
    const result = evaluate(validFixtures.transfer, config, { recentTxCount: 8 });
    expect(result.decision).toBe("deny");
    expect(result.reasons.some((r) => r.includes("Rate limit exceeded"))).toBe(true);
    expect(result.reasons.some((r) => r.includes("8 transactions"))).toBe(true);
    expect(result.reasons.some((r) => r.includes("limit: 5"))).toBe(true);
  });

  test("skips rate limit check when recentTxCount is not provided", () => {
    const config = { ...permissiveConfig(), maxTxPerHour: 1 };
    // No recentTxCount in options → rate limit not checked
    const result = evaluate(validFixtures.transfer, config);
    expect(result.decision).toBe("allow");
  });
});
