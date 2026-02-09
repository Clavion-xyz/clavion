import { describe, test, expect } from "vitest";
import { buildApprove } from "@clavion/core";
import { validFixtures } from "../../../tools/fixtures/index.js";
import type { TxIntent, ApproveAction } from "@clavion/types";

describe("Approve Builder", () => {
  test("builds valid ERC20 approve calldata from fixture", () => {
    const plan = buildApprove(validFixtures.approve);
    expect(plan.txRequest.data).toBeDefined();
    expect(plan.txRequest.data!.length).toBeGreaterThan(10);
  });

  test("calldata starts with approve function selector (0x095ea7b3)", () => {
    const plan = buildApprove(validFixtures.approve);
    expect(plan.txRequest.data!.startsWith("0x095ea7b3")).toBe(true);
  });

  test("txRequest.to is the token contract address (not the spender)", () => {
    const plan = buildApprove(validFixtures.approve);
    expect(plan.txRequest.to?.toLowerCase()).toBe(
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase(),
    );
  });

  test("detects MaxUint256 approval in description", () => {
    const maxUintIntent: TxIntent = {
      ...validFixtures.approve,
      action: {
        ...(validFixtures.approve.action as ApproveAction),
        amount: (2n ** 256n - 1n).toString(),
      },
    };
    const plan = buildApprove(maxUintIntent);
    expect(plan.description).toContain("UNLIMITED");
  });

  test("throws for non-approve action type", () => {
    expect(() => buildApprove(validFixtures.transfer as TxIntent)).toThrow(
      "Expected approve action",
    );
  });
});
