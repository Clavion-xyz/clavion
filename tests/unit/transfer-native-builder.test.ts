import { describe, test, expect } from "vitest";
import { buildTransferNative } from "../../core/tx/builders/transfer-native-builder.js";
import { buildFromIntent } from "../../core/tx/builders/index.js";
import { validFixtures } from "../../spec/fixtures/index.js";
import type { TxIntent } from "../../core/types.js";

describe("buildTransferNative", () => {
  test("builds correct txRequest for native ETH transfer", () => {
    const plan = buildTransferNative(validFixtures.transferNative);

    expect(plan.intentId).toBe(validFixtures.transferNative.id);
    expect(plan.txRequest.to).toBe("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
    expect(plan.txRequest.value).toBe(100_000_000_000_000_000n);
    expect(plan.txRequest.data).toBe("0x");
    expect(plan.txRequest.chainId).toBe(8453);
    expect(plan.txRequest.type).toBe("eip1559");
    expect(plan.txRequest.maxFeePerGas).toBe(0n);
    expect(plan.txRequest.maxPriorityFeePerGas).toBe(0n);
  });

  test("txRequestHash is a valid keccak256 hex string", () => {
    const plan = buildTransferNative(validFixtures.transferNative);
    expect(plan.txRequestHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("description contains amount and recipient", () => {
    const plan = buildTransferNative(validFixtures.transferNative);
    expect(plan.description).toContain("100000000000000000");
    expect(plan.description).toContain("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
    expect(plan.description).toContain("native ETH");
  });

  test("throws for non-transfer_native action", () => {
    expect(() => buildTransferNative(validFixtures.transfer)).toThrow(
      "Expected transfer_native action",
    );
  });

  test("handles large amounts correctly", () => {
    const largeIntent: TxIntent = {
      ...validFixtures.transferNative,
      action: {
        type: "transfer_native",
        to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        amount: "1000000000000000000000", // 1000 ETH
      },
    };
    const plan = buildTransferNative(largeIntent);
    expect(plan.txRequest.value).toBe(1_000_000_000_000_000_000_000n);
  });

  test("buildFromIntent dispatches to buildTransferNative", () => {
    const plan = buildFromIntent(validFixtures.transferNative);
    expect(plan.intentId).toBe(validFixtures.transferNative.id);
    expect(plan.txRequest.data).toBe("0x");
    expect(plan.txRequest.value).toBe(100_000_000_000_000_000n);
  });
});
