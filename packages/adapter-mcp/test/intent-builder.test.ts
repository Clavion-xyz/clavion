import { describe, test, expect } from "vitest";
import { buildIntent } from "../src/tools/intent-builder.js";

describe("buildIntent", () => {
  test("produces a valid TxIntent structure", () => {
    const intent = buildIntent({
      walletAddress: "0x1111111111111111111111111111111111111111",
      action: {
        type: "transfer",
        asset: { kind: "erc20", address: "0x2222222222222222222222222222222222222222" },
        to: "0x3333333333333333333333333333333333333333",
        amount: "1000000",
      },
    });

    expect(intent.version).toBe("1");
    expect(intent.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(intent.chain.type).toBe("evm");
    expect(intent.wallet.address).toBe("0x1111111111111111111111111111111111111111");
    expect(intent.action.type).toBe("transfer");
  });

  test("defaults chainId to 8453 (Base)", () => {
    const intent = buildIntent({
      walletAddress: "0x1111111111111111111111111111111111111111",
      action: { type: "transfer_native", to: "0x2222222222222222222222222222222222222222", amount: "1" },
    });

    expect(intent.chain.chainId).toBe(8453);
  });

  test("allows custom chainId", () => {
    const intent = buildIntent({
      walletAddress: "0x1111111111111111111111111111111111111111",
      action: { type: "transfer_native", to: "0x2222222222222222222222222222222222222222", amount: "1" },
      chainId: 1,
    });

    expect(intent.chain.chainId).toBe(1);
  });

  test("defaults source to mcp-adapter", () => {
    const intent = buildIntent({
      walletAddress: "0x1111111111111111111111111111111111111111",
      action: { type: "transfer_native", to: "0x2222222222222222222222222222222222222222", amount: "1" },
    });

    expect(intent.metadata?.source).toBe("mcp-adapter");
  });

  test("allows custom source", () => {
    const intent = buildIntent({
      walletAddress: "0x1111111111111111111111111111111111111111",
      action: { type: "transfer_native", to: "0x2222222222222222222222222222222222222222", amount: "1" },
      source: "custom-source",
    });

    expect(intent.metadata?.source).toBe("custom-source");
  });

  test("sets maxGasWei default", () => {
    const intent = buildIntent({
      walletAddress: "0x1111111111111111111111111111111111111111",
      action: { type: "transfer_native", to: "0x2222222222222222222222222222222222222222", amount: "1" },
    });

    expect(intent.constraints.maxGasWei).toBe("1000000000000000");
  });

  test("sets deadline ~600s in the future", () => {
    const before = Math.floor(Date.now() / 1000);
    const intent = buildIntent({
      walletAddress: "0x1111111111111111111111111111111111111111",
      action: { type: "transfer_native", to: "0x2222222222222222222222222222222222222222", amount: "1" },
    });
    const after = Math.floor(Date.now() / 1000);

    expect(intent.constraints.deadline).toBeGreaterThanOrEqual(before + 599);
    expect(intent.constraints.deadline).toBeLessThanOrEqual(after + 601);
  });

  test("defaults maxSlippageBps to 100", () => {
    const intent = buildIntent({
      walletAddress: "0x1111111111111111111111111111111111111111",
      action: { type: "transfer_native", to: "0x2222222222222222222222222222222222222222", amount: "1" },
    });

    expect(intent.constraints.maxSlippageBps).toBe(100);
  });

  test("includes rpcHint when provided", () => {
    const intent = buildIntent({
      walletAddress: "0x1111111111111111111111111111111111111111",
      action: { type: "transfer_native", to: "0x2222222222222222222222222222222222222222", amount: "1" },
      rpcHint: "https://rpc.example.com",
    });

    expect(intent.chain.rpcHint).toBe("https://rpc.example.com");
  });

  test("omits rpcHint when not provided", () => {
    const intent = buildIntent({
      walletAddress: "0x1111111111111111111111111111111111111111",
      action: { type: "transfer_native", to: "0x2222222222222222222222222222222222222222", amount: "1" },
    });

    expect(intent.chain).not.toHaveProperty("rpcHint");
  });
});
