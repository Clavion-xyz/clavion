import { describe, test, expect, vi } from "vitest";
import { buildSwapOneInch } from "@clavion/core";
import { buildFromIntent } from "@clavion/core";
import { validFixtures } from "../../../tools/fixtures/index.js";
import type { TxIntent } from "@clavion/types";
import type { OneInchClient } from "@clavion/core";

function createMockOneInchClient(
  overrides?: Partial<{ getSwapResult: unknown; getSwapError: Error }>,
): OneInchClient {
  return {
    getSwap: overrides?.getSwapError
      ? vi.fn().mockRejectedValue(overrides.getSwapError)
      : vi.fn().mockResolvedValue(
          overrides?.getSwapResult ?? {
            tx: {
              from: "0x1234567890abcdef1234567890abcdef12345678",
              to: "0x111111125421cA6dc452d289314280a0f8842A65",
              data: "0xabcdef0123456789",
              value: "0",
              gas: 250000,
              gasPrice: "1000000000",
            },
            toAmount: "400000000000000",
            fromAmount: "1000000",
            protocols: [],
          },
        ),
    getQuote: vi.fn().mockResolvedValue({
      toAmount: "400000000000000",
      fromAmount: "1000000",
      gas: 250000,
      protocols: [],
    }),
  } as unknown as OneInchClient;
}

describe("buildSwapOneInch", () => {
  const oneInchIntent = validFixtures.swapExactInOneInch;

  test("builds a valid BuildPlan from 1inch response", async () => {
    const client = createMockOneInchClient();
    const plan = await buildSwapOneInch(oneInchIntent, client);

    expect(plan.intentId).toBe(oneInchIntent.id);
    expect(plan.txRequest.to).toBe("0x111111125421cA6dc452d289314280a0f8842A65");
    expect(plan.txRequest.data).toBe("0xabcdef0123456789");
    expect(plan.txRequest.value).toBe(0n);
    expect(plan.txRequest.chainId).toBe(8453);
    expect(plan.txRequestHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(plan.description).toContain("1inch");
    expect(plan.description).toContain("USDC");
    expect(plan.description).toContain("WETH");
  });

  test("converts slippage from bps to percentage", async () => {
    const client = createMockOneInchClient();
    await buildSwapOneInch(oneInchIntent, client);

    // maxSlippageBps is 100 → should pass "1" (1%)
    expect(client.getSwap).toHaveBeenCalledWith(
      8453,
      expect.objectContaining({ slippage: "1" }),
    );
  });

  test("passes disableEstimate=true", async () => {
    const client = createMockOneInchClient();
    await buildSwapOneInch(oneInchIntent, client);

    expect(client.getSwap).toHaveBeenCalledWith(
      8453,
      expect.objectContaining({ disableEstimate: true }),
    );
  });

  test("throws for swap_exact_out", async () => {
    const client = createMockOneInchClient();
    const exactOutIntent: TxIntent = {
      ...validFixtures.swapExactOut,
      action: {
        ...validFixtures.swapExactOut.action,
        provider: "1inch",
      } as TxIntent["action"],
    };

    await expect(
      buildSwapOneInch(exactOutIntent, client),
    ).rejects.toThrow("1inch only supports swap_exact_in");
  });

  test("throws for unsupported chain", async () => {
    const client = createMockOneInchClient();
    const unsupportedChainIntent: TxIntent = {
      ...oneInchIntent,
      chain: { type: "evm", chainId: 999 },
    };

    await expect(
      buildSwapOneInch(unsupportedChainIntent, client),
    ).rejects.toThrow("1inch swaps not supported on chain 999");
  });

  test("throws for wrong router address", async () => {
    const client = createMockOneInchClient();
    const wrongRouterIntent: TxIntent = {
      ...oneInchIntent,
      action: {
        ...oneInchIntent.action,
        router: "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead",
      } as TxIntent["action"],
    };

    await expect(
      buildSwapOneInch(wrongRouterIntent, client),
    ).rejects.toThrow("Unknown 1inch router");
  });

  test("maps non-zero tx.value correctly (native token swap)", async () => {
    const client = createMockOneInchClient({
      getSwapResult: {
        tx: {
          from: "0x1234567890abcdef1234567890abcdef12345678",
          to: "0x111111125421cA6dc452d289314280a0f8842A65",
          data: "0xabcdef",
          value: "100000000000000000", // 0.1 ETH
          gas: 250000,
          gasPrice: "1000000000",
        },
        toAmount: "1000000",
        fromAmount: "100000000000000000",
        protocols: [],
      },
    });

    const plan = await buildSwapOneInch(oneInchIntent, client);
    expect(plan.txRequest.value).toBe(100000000000000000n);
  });
});

describe("buildFromIntent with 1inch fallback", () => {
  test("uses 1inch when provider is 1inch and client is available", async () => {
    const client = createMockOneInchClient();
    const plan = await buildFromIntent(validFixtures.swapExactInOneInch, {
      oneInchClient: client,
    });

    expect(plan.description).toContain("1inch");
  });

  test("falls back to Uniswap when 1inch client throws", async () => {
    const client = createMockOneInchClient({
      getSwapError: new Error("Rate limited"),
    });

    // Must use Uniswap router for fallback to work
    const intentWithUniRouter: TxIntent = {
      ...validFixtures.swapExactInOneInch,
      action: {
        ...validFixtures.swapExactInOneInch.action,
        router: "0x2626664c2603336E57B271c5C0b26F421741e481",
      } as TxIntent["action"],
    };

    const plan = await buildFromIntent(intentWithUniRouter, {
      oneInchClient: client,
    });

    expect(plan.description).toContain("Uniswap V3");
  });

  test("uses Uniswap when no oneInchClient is provided", async () => {
    // Use the standard Uniswap fixture with provider: "1inch" but no client
    const intentWithProvider: TxIntent = {
      ...validFixtures.swapExactIn,
      action: {
        ...validFixtures.swapExactIn.action,
        provider: "1inch",
      } as TxIntent["action"],
    };

    const plan = await buildFromIntent(intentWithProvider);
    expect(plan.description).toContain("Uniswap V3");
  });

  test("uses Uniswap when provider is absent", async () => {
    const plan = await buildFromIntent(validFixtures.swapExactIn);
    expect(plan.description).toContain("Uniswap V3");
  });

  test("uses Uniswap for swap_exact_out even with provider 1inch", async () => {
    const client = createMockOneInchClient();
    const exactOutWith1inch: TxIntent = {
      ...validFixtures.swapExactOut,
      action: {
        ...validFixtures.swapExactOut.action,
        provider: "1inch",
      } as TxIntent["action"],
    };

    // swap_exact_out with 1inch should fall back to Uniswap
    // (1inch only supports swap_exact_in)
    const plan = await buildFromIntent(exactOutWith1inch, {
      oneInchClient: client,
    });

    expect(plan.description).toContain("Uniswap V3");
  });
});
