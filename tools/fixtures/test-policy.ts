import type { PolicyConfig } from "@clavion/types";

/** High approval threshold — effectively no approval needed for standard test intents. */
export function noApprovalConfig(overrides?: Partial<PolicyConfig>): PolicyConfig {
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
    requireApprovalAbove: { valueWei: "1000000000000000000000" },
    maxTxPerHour: 100,
    ...overrides,
  };
}

/** Requires approval for all transactions (valueWei: "0"). */
export function approvalRequiredConfig(overrides?: Partial<PolicyConfig>): PolicyConfig {
  return noApprovalConfig({
    requireApprovalAbove: { valueWei: "0" },
    ...overrides,
  });
}
