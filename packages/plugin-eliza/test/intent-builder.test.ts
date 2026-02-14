import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { buildIntent } from "../src/shared/intent-builder.js";
import type { TransferAction, TransferNativeAction, ApproveAction, SwapExactInAction } from "@clavion/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("buildIntent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("builds transfer intent with defaults", () => {
    const action: TransferAction = {
      type: "transfer",
      asset: { kind: "erc20", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
      to: "0x1111111111111111111111111111111111111111",
      amount: "1000000",
    };

    const intent = buildIntent({
      walletAddress: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      action,
    });

    expect(intent.version).toBe("1");
    expect(intent.id).toMatch(UUID_RE);
    expect(intent.chain).toEqual({ type: "evm", chainId: 8453 });
    expect(intent.wallet.address).toBe("0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    expect(intent.action).toEqual(action);
    expect(intent.constraints.maxGasWei).toBe("1000000000000000");
    expect(intent.constraints.maxSlippageBps).toBe(100);
    expect(intent.metadata?.source).toBe("eliza-adapter");
  });

  test("builds transfer_native intent", () => {
    const action: TransferNativeAction = {
      type: "transfer_native",
      to: "0x1111111111111111111111111111111111111111",
      amount: "100000000000000000",
    };

    const intent = buildIntent({
      walletAddress: "0xBBBB",
      action,
    });

    expect(intent.action.type).toBe("transfer_native");
  });

  test("builds approve intent", () => {
    const action: ApproveAction = {
      type: "approve",
      asset: { kind: "erc20", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
      spender: "0x2626664c2603336E57B271c5C0b26F421741e481",
      amount: "1000000",
    };

    const intent = buildIntent({
      walletAddress: "0xCCCC",
      action,
    });

    expect(intent.action.type).toBe("approve");
  });

  test("builds swap intent", () => {
    const action: SwapExactInAction = {
      type: "swap_exact_in",
      router: "0x2626664c2603336E57B271c5C0b26F421741e481",
      assetIn: { kind: "erc20", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
      assetOut: { kind: "erc20", address: "0x4200000000000000000000000000000000000006" },
      amountIn: "1000000",
      minAmountOut: "500000000000000",
    };

    const intent = buildIntent({
      walletAddress: "0xDDDD",
      action,
    });

    expect(intent.action.type).toBe("swap_exact_in");
  });

  test("overrides chainId", () => {
    const intent = buildIntent({
      walletAddress: "0xEEEE",
      action: { type: "transfer_native", to: "0x1111", amount: "100" },
      chainId: 1,
    });

    expect(intent.chain.chainId).toBe(1);
  });

  test("overrides maxGasWei", () => {
    const intent = buildIntent({
      walletAddress: "0xFFFF",
      action: { type: "transfer_native", to: "0x1111", amount: "100" },
      maxGasWei: "5000000",
    });

    expect(intent.constraints.maxGasWei).toBe("5000000");
  });

  test("overrides deadline", () => {
    const intent = buildIntent({
      walletAddress: "0x0000",
      action: { type: "transfer_native", to: "0x1111", amount: "100" },
      deadline: 1800000000,
    });

    expect(intent.constraints.deadline).toBe(1800000000);
  });

  test("overrides slippageBps", () => {
    const intent = buildIntent({
      walletAddress: "0x0001",
      action: { type: "transfer_native", to: "0x1111", amount: "100" },
      slippageBps: 50,
    });

    expect(intent.constraints.maxSlippageBps).toBe(50);
  });

  test("deadline defaults to now + 600", () => {
    const now = Math.floor(Date.now() / 1000);
    const intent = buildIntent({
      walletAddress: "0x0002",
      action: { type: "transfer_native", to: "0x1111", amount: "100" },
    });

    expect(intent.constraints.deadline).toBe(now + 600);
  });

  test("timestamp is set to current time", () => {
    const now = Math.floor(Date.now() / 1000);
    const intent = buildIntent({
      walletAddress: "0x0003",
      action: { type: "transfer_native", to: "0x1111", amount: "100" },
    });

    expect(intent.timestamp).toBe(now);
  });
});
