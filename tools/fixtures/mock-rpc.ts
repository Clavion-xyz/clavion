import type { RpcClient } from "@clavion/types/rpc";
import { vi } from "vitest";

/**
 * Creates a mock RPC client with sensible defaults.
 * Override individual methods via the `overrides` parameter.
 */
export function mockRpcClient(overrides?: Partial<RpcClient>): RpcClient {
  return {
    call: async () => ({ success: true, returnData: "0x" as `0x${string}` }),
    estimateGas: async () => 50_000n,
    readBalance: async () => 10_000_000n,
    readNativeBalance: async () => 0n,
    readAllowance: async () => 0n,
    getTransactionReceipt: async () => null,
    sendRawTransaction: async () => ("0x" + "ab".repeat(32)) as `0x${string}`,
    getTransactionCount: async () => 0,
    estimateFeesPerGas: async () => ({
      maxFeePerGas: 1_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
    }),
    ...overrides,
  };
}

/**
 * Creates a mock RPC client backed by vi.fn() spies for assertion/tracking.
 * Override individual methods via the `overrides` parameter.
 */
export function mockRpcClientWithSpies(overrides?: Partial<RpcClient>): RpcClient {
  return {
    call: vi.fn().mockResolvedValue({ success: true, returnData: "0x" }),
    estimateGas: vi.fn().mockResolvedValue(21000n),
    readBalance: vi.fn().mockResolvedValue(5000000n),
    readNativeBalance: vi.fn().mockResolvedValue(1000000000000000000n),
    readAllowance: vi.fn().mockResolvedValue(0n),
    getTransactionReceipt: vi.fn().mockResolvedValue(null),
    sendRawTransaction: vi.fn().mockResolvedValue("0xdeadbeef" as `0x${string}`),
    getTransactionCount: vi.fn().mockResolvedValue(0),
    estimateFeesPerGas: vi.fn().mockResolvedValue({
      maxFeePerGas: 2000000000n,
      maxPriorityFeePerGas: 1000000000n,
    }),
    ...overrides,
  };
}
