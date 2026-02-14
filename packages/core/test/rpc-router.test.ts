import { describe, test, expect, vi } from "vitest";
import { RpcRouter } from "../src/rpc/rpc-router.js";
import { resolveRpc } from "../src/rpc/resolve-rpc.js";
import type { RpcClient } from "@clavion/types/rpc";

function mockRpcClient(label: string): RpcClient {
  return {
    call: vi.fn().mockResolvedValue({ success: true, returnData: "0x" }),
    estimateGas: vi.fn().mockResolvedValue(21000n),
    readBalance: vi.fn().mockResolvedValue(1000000n),
    readNativeBalance: vi.fn().mockResolvedValue(1000000000000000000n),
    readAllowance: vi.fn().mockResolvedValue(0n),
    getTransactionReceipt: vi.fn().mockResolvedValue(null),
    sendRawTransaction: vi.fn().mockResolvedValue(`0x${label}` as `0x${string}`),
    getTransactionCount: vi.fn().mockResolvedValue(0),
    estimateFeesPerGas: vi.fn().mockResolvedValue({
      maxFeePerGas: 1000000000n,
      maxPriorityFeePerGas: 1000000000n,
    }),
  };
}

describe("RpcRouter", () => {
  test("constructor throws with empty map", () => {
    expect(() => new RpcRouter(new Map())).toThrow("at least one chain client");
  });

  test("forChain() returns correct client", () => {
    const eth = mockRpcClient("eth");
    const base = mockRpcClient("base");
    const router = new RpcRouter(new Map([[1, eth], [8453, base]]));

    expect(router.forChain(1)).toBe(eth);
    expect(router.forChain(8453)).toBe(base);
  });

  test("forChain() throws for unconfigured chain", () => {
    const base = mockRpcClient("base");
    const router = new RpcRouter(new Map([[8453, base]]));

    expect(() => router.forChain(42161)).toThrow("No RPC client configured for chain 42161");
    expect(() => router.forChain(42161)).toThrow("Available: [8453]");
  });

  test("hasChain() returns true for configured, false otherwise", () => {
    const router = new RpcRouter(new Map([[1, mockRpcClient("eth")], [8453, mockRpcClient("base")]]));

    expect(router.hasChain(1)).toBe(true);
    expect(router.hasChain(8453)).toBe(true);
    expect(router.hasChain(42161)).toBe(false);
  });

  test("chainIds returns all configured chain IDs", () => {
    const router = new RpcRouter(new Map([
      [1, mockRpcClient("eth")],
      [10, mockRpcClient("op")],
      [8453, mockRpcClient("base")],
    ]));

    expect(router.chainIds).toEqual([1, 10, 8453]);
  });

  test("default delegation uses first chain", async () => {
    const eth = mockRpcClient("eth");
    const base = mockRpcClient("base");
    const router = new RpcRouter(new Map([[1, eth], [8453, base]]));

    await router.readBalance("0x1111111111111111111111111111111111111111", "0x2222222222222222222222222222222222222222");
    expect(eth.readBalance).toHaveBeenCalledTimes(1);
    expect(base.readBalance).not.toHaveBeenCalled();
  });

  test("default delegation uses explicit defaultChainId", async () => {
    const eth = mockRpcClient("eth");
    const base = mockRpcClient("base");
    const router = new RpcRouter(new Map([[1, eth], [8453, base]]), 8453);

    await router.readBalance("0x1111111111111111111111111111111111111111", "0x2222222222222222222222222222222222222222");
    expect(base.readBalance).toHaveBeenCalledTimes(1);
    expect(eth.readBalance).not.toHaveBeenCalled();
  });

  test("all RpcClient methods delegate correctly", async () => {
    const client = mockRpcClient("c");
    const router = new RpcRouter(new Map([[1, client]]));

    await router.call({ to: "0x1111111111111111111111111111111111111111", data: "0x" });
    expect(client.call).toHaveBeenCalledTimes(1);

    await router.estimateGas({ to: "0x1111111111111111111111111111111111111111", data: "0x" });
    expect(client.estimateGas).toHaveBeenCalledTimes(1);

    await router.readNativeBalance("0x1111111111111111111111111111111111111111");
    expect(client.readNativeBalance).toHaveBeenCalledTimes(1);

    await router.readAllowance(
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
      "0x3333333333333333333333333333333333333333",
    );
    expect(client.readAllowance).toHaveBeenCalledTimes(1);

    await router.getTransactionReceipt("0x0000000000000000000000000000000000000000000000000000000000000001");
    expect(client.getTransactionReceipt).toHaveBeenCalledTimes(1);

    await router.sendRawTransaction("0xsigned");
    expect(client.sendRawTransaction).toHaveBeenCalledTimes(1);

    await router.getTransactionCount("0x1111111111111111111111111111111111111111");
    expect(client.getTransactionCount).toHaveBeenCalledTimes(1);

    await router.estimateFeesPerGas();
    expect(client.estimateFeesPerGas).toHaveBeenCalledTimes(1);
  });
});

describe("resolveRpc", () => {
  test("returns null for null rpc", () => {
    expect(resolveRpc(null, 1)).toBeNull();
  });

  test("returns plain RpcClient as-is for any chainId", () => {
    const client = mockRpcClient("plain");
    expect(resolveRpc(client, 1)).toBe(client);
    expect(resolveRpc(client, 8453)).toBe(client);
    expect(resolveRpc(client, 99999)).toBe(client);
  });

  test("returns chain-specific client from RpcRouter", () => {
    const eth = mockRpcClient("eth");
    const base = mockRpcClient("base");
    const router = new RpcRouter(new Map([[1, eth], [8453, base]]));

    expect(resolveRpc(router, 1)).toBe(eth);
    expect(resolveRpc(router, 8453)).toBe(base);
  });

  test("returns null for unconfigured chain in RpcRouter", () => {
    const base = mockRpcClient("base");
    const router = new RpcRouter(new Map([[8453, base]]));

    expect(resolveRpc(router, 42161)).toBeNull();
  });
});
