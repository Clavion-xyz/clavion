import { describe, test, expect } from "vitest";
import { buildIntent } from "@clavion/adapter-openclaw";
import { validateTxIntent } from "@clavion/core";
import type { TransferAction, ApproveAction, SwapExactInAction } from "@clavion/types";

const WALLET = "0x1234567890abcdef1234567890abcdef12345678";

const transferAction: TransferAction = {
  type: "transfer",
  asset: {
    kind: "erc20",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    symbol: "USDC",
    decimals: 6,
  },
  to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  amount: "1000000",
};

const approveAction: ApproveAction = {
  type: "approve",
  asset: {
    kind: "erc20",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    symbol: "USDC",
    decimals: 6,
  },
  spender: "0x2626664c2603336E57B271c5C0b26F421741e481",
  amount: "1000000000",
};

const swapAction: SwapExactInAction = {
  type: "swap_exact_in",
  router: "0x2626664c2603336E57B271c5C0b26F421741e481",
  assetIn: {
    kind: "erc20",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    symbol: "USDC",
    decimals: 6,
  },
  assetOut: {
    kind: "erc20",
    address: "0x4200000000000000000000000000000000000006",
    symbol: "WETH",
    decimals: 18,
  },
  amountIn: "1000000",
  minAmountOut: "400000000000000",
};

describe("buildIntent — structure", () => {
  test("returns valid TxIntent with version 1", () => {
    const intent = buildIntent({ walletAddress: WALLET, action: transferAction });
    expect(intent.version).toBe("1");
  });

  test("generates a valid UUID for id", () => {
    const intent = buildIntent({ walletAddress: WALLET, action: transferAction });
    expect(intent.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  test("timestamp is current epoch (within 5 seconds)", () => {
    const before = Math.floor(Date.now() / 1000);
    const intent = buildIntent({ walletAddress: WALLET, action: transferAction });
    const after = Math.floor(Date.now() / 1000);
    expect(intent.timestamp).toBeGreaterThanOrEqual(before);
    expect(intent.timestamp).toBeLessThanOrEqual(after);
  });

  test("wallet address is set from params", () => {
    const intent = buildIntent({ walletAddress: WALLET, action: transferAction });
    expect(intent.wallet.address).toBe(WALLET);
  });

  test("action is set from params", () => {
    const intent = buildIntent({ walletAddress: WALLET, action: transferAction });
    expect(intent.action).toEqual(transferAction);
  });
});

describe("buildIntent — defaults", () => {
  test("default chainId is 8453", () => {
    const intent = buildIntent({ walletAddress: WALLET, action: transferAction });
    expect(intent.chain.chainId).toBe(8453);
  });

  test("default maxGasWei is 1000000000000000", () => {
    const intent = buildIntent({ walletAddress: WALLET, action: transferAction });
    expect(intent.constraints.maxGasWei).toBe("1000000000000000");
  });

  test("default deadline is ~now + 600", () => {
    const now = Math.floor(Date.now() / 1000);
    const intent = buildIntent({ walletAddress: WALLET, action: transferAction });
    expect(intent.constraints.deadline).toBeGreaterThanOrEqual(now + 598);
    expect(intent.constraints.deadline).toBeLessThanOrEqual(now + 602);
  });

  test("default slippageBps is 100", () => {
    const intent = buildIntent({ walletAddress: WALLET, action: transferAction });
    expect(intent.constraints.maxSlippageBps).toBe(100);
  });

  test("default source is openclaw-adapter", () => {
    const intent = buildIntent({ walletAddress: WALLET, action: transferAction });
    expect(intent.metadata?.source).toBe("openclaw-adapter");
  });

  test("rpcHint omitted when not provided", () => {
    const intent = buildIntent({ walletAddress: WALLET, action: transferAction });
    expect(intent.chain.rpcHint).toBeUndefined();
  });
});

describe("buildIntent — custom values", () => {
  test("custom chainId overrides default", () => {
    const intent = buildIntent({
      walletAddress: WALLET,
      action: transferAction,
      chainId: 1,
    });
    expect(intent.chain.chainId).toBe(1);
  });

  test("custom maxGasWei overrides default", () => {
    const intent = buildIntent({
      walletAddress: WALLET,
      action: transferAction,
      maxGasWei: "999",
    });
    expect(intent.constraints.maxGasWei).toBe("999");
  });

  test("custom deadline overrides default", () => {
    const intent = buildIntent({
      walletAddress: WALLET,
      action: transferAction,
      deadline: 1700000000,
    });
    expect(intent.constraints.deadline).toBe(1700000000);
  });

  test("custom slippageBps overrides default", () => {
    const intent = buildIntent({
      walletAddress: WALLET,
      action: transferAction,
      slippageBps: 50,
    });
    expect(intent.constraints.maxSlippageBps).toBe(50);
  });

  test("custom source overrides default", () => {
    const intent = buildIntent({
      walletAddress: WALLET,
      action: transferAction,
      source: "my-custom-skill",
    });
    expect(intent.metadata?.source).toBe("my-custom-skill");
  });

  test("rpcHint included when provided", () => {
    const intent = buildIntent({
      walletAddress: WALLET,
      action: transferAction,
      rpcHint: "base",
    });
    expect(intent.chain.rpcHint).toBe("base");
  });
});

describe("buildIntent — action types", () => {
  test("transfer action fields mapped correctly", () => {
    const intent = buildIntent({ walletAddress: WALLET, action: transferAction });
    expect(intent.action.type).toBe("transfer");
    expect((intent.action as TransferAction).to).toBe(transferAction.to);
    expect((intent.action as TransferAction).amount).toBe(transferAction.amount);
  });

  test("approve action fields mapped correctly", () => {
    const intent = buildIntent({ walletAddress: WALLET, action: approveAction });
    expect(intent.action.type).toBe("approve");
    expect((intent.action as ApproveAction).spender).toBe(approveAction.spender);
  });

  test("swap action fields mapped correctly", () => {
    const intent = buildIntent({ walletAddress: WALLET, action: swapAction });
    expect(intent.action.type).toBe("swap_exact_in");
    expect((intent.action as SwapExactInAction).amountIn).toBe(swapAction.amountIn);
    expect((intent.action as SwapExactInAction).minAmountOut).toBe(swapAction.minAmountOut);
  });
});

describe("buildIntent — schema validation", () => {
  test("transfer intent validates against TxIntent AJV schema", () => {
    const intent = buildIntent({ walletAddress: WALLET, action: transferAction });
    const result = validateTxIntent(intent);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeNull();
  });

  test("approve intent validates against TxIntent AJV schema", () => {
    const intent = buildIntent({ walletAddress: WALLET, action: approveAction });
    const result = validateTxIntent(intent);
    expect(result.valid).toBe(true);
  });

  test("swap intent validates against TxIntent AJV schema", () => {
    const intent = buildIntent({ walletAddress: WALLET, action: swapAction });
    const result = validateTxIntent(intent);
    expect(result.valid).toBe(true);
  });
});
