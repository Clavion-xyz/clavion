import { describe, test, expect } from "vitest";
import { buildTransfer } from "../../core/tx/builders/transfer-builder.js";
import { validFixtures } from "../../spec/fixtures/index.js";
import type { TxIntent } from "../../core/types.js";

describe("Transfer Builder", () => {
  test("builds valid ERC20 transfer calldata from fixture", () => {
    const plan = buildTransfer(validFixtures.transfer);
    expect(plan.txRequest.data).toBeDefined();
    expect(plan.txRequest.data!.length).toBeGreaterThan(10);
  });

  test("calldata starts with transfer function selector (0xa9059cbb)", () => {
    const plan = buildTransfer(validFixtures.transfer);
    expect(plan.txRequest.data!.startsWith("0xa9059cbb")).toBe(true);
  });

  test("txRequest.to is the token contract address (not the recipient)", () => {
    const plan = buildTransfer(validFixtures.transfer);
    expect(plan.txRequest.to?.toLowerCase()).toBe(
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase(),
    );
  });

  test("description includes token symbol and recipient", () => {
    const plan = buildTransfer(validFixtures.transfer);
    expect(plan.description).toContain("USDC");
    expect(plan.description).toContain("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
  });

  test("txRequestHash is a valid keccak256 hex string", () => {
    const plan = buildTransfer(validFixtures.transfer);
    expect(plan.txRequestHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("intentId matches input intent", () => {
    const plan = buildTransfer(validFixtures.transfer);
    expect(plan.intentId).toBe(validFixtures.transfer.id);
  });

  test("throws for non-transfer action type", () => {
    expect(() => buildTransfer(validFixtures.approve as TxIntent)).toThrow(
      "Expected transfer action",
    );
  });
});
