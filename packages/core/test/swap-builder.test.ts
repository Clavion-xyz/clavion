import { describe, test, expect } from "vitest";
import { buildSwap } from "@clavion/core";
import { validFixtures } from "../../../tools/fixtures/index.js";
import type { TxIntent, SwapExactInAction } from "@clavion/types";

describe("Swap Builder", () => {
  test("builds valid exactInputSingle calldata from swap_exact_in fixture", () => {
    const plan = buildSwap(validFixtures.swapExactIn);
    expect(plan.txRequest.data).toBeDefined();
    expect(plan.txRequest.data!.length).toBeGreaterThan(10);
  });

  test("exactInputSingle calldata starts with correct selector (0x04e45aaf)", () => {
    const plan = buildSwap(validFixtures.swapExactIn);
    expect(plan.txRequest.data!.startsWith("0x04e45aaf")).toBe(true);
  });

  test("builds valid exactOutputSingle calldata from swap_exact_out fixture", () => {
    const plan = buildSwap(validFixtures.swapExactOut);
    expect(plan.txRequest.data).toBeDefined();
  });

  test("exactOutputSingle calldata starts with correct selector (0x5023b4df)", () => {
    const plan = buildSwap(validFixtures.swapExactOut);
    expect(plan.txRequest.data!.startsWith("0x5023b4df")).toBe(true);
  });

  test("txRequest.to is the router address", () => {
    const plan = buildSwap(validFixtures.swapExactIn);
    expect(plan.txRequest.to?.toLowerCase()).toBe(
      "0x2626664c2603336E57B271c5C0b26F421741e481".toLowerCase(),
    );
  });

  test("throws for unknown router address", () => {
    const badRouterIntent: TxIntent = {
      ...validFixtures.swapExactIn,
      action: {
        ...(validFixtures.swapExactIn.action as SwapExactInAction),
        router: "0x0000000000000000000000000000000000000001",
      },
    };
    expect(() => buildSwap(badRouterIntent)).toThrow("Unknown router");
  });

  test("description includes token symbols for exact_in", () => {
    const plan = buildSwap(validFixtures.swapExactIn);
    expect(plan.description).toContain("USDC");
    expect(plan.description).toContain("WETH");
    expect(plan.description).toContain("Uniswap V3");
  });

  test("throws for non-swap action type", () => {
    expect(() => buildSwap(validFixtures.transfer as TxIntent)).toThrow(
      "Expected swap action",
    );
  });
});
