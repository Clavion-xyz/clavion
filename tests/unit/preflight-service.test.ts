import { describe, test, expect } from "vitest";
import { PreflightService } from "../../core/preflight/preflight-service.js";
import { buildTransfer } from "../../core/tx/builders/transfer-builder.js";
import { buildTransferNative } from "../../core/tx/builders/transfer-native-builder.js";
import { buildApprove } from "../../core/tx/builders/approve-builder.js";
import { buildSwap } from "../../core/tx/builders/swap-builder.js";
import { validFixtures } from "../../spec/fixtures/index.js";
import type { RpcClient } from "../../core/rpc/rpc-client.js";
import type { PolicyConfig } from "../../core/types.js";

function permissiveConfig(): PolicyConfig {
  return {
    version: "1",
    maxValueWei: "1000000000000000000000",
    maxApprovalAmount: "1000000000000000000000",
    contractAllowlist: ["0x2626664c2603336E57B271c5C0b26F421741e481"],
    tokenAllowlist: [
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "0x4200000000000000000000000000000000000006",
    ],
    allowedChains: [8453],
    recipientAllowlist: [],
    maxRiskScore: 70,
    requireApprovalAbove: { valueWei: "10000000000000000000" },
    maxTxPerHour: 100,
  };
}

function mockRpcClient(overrides?: Partial<RpcClient>): RpcClient {
  return {
    call: async () => ({ success: true, returnData: "0x" as `0x${string}` }),
    estimateGas: async () => 50_000n,
    readBalance: async () => 10_000_000n,
    readNativeBalance: async () => 1_000_000_000_000_000_000n,
    readAllowance: async () => 0n,
    getTransactionReceipt: async () => null,
    sendRawTransaction: async () => "0x" as `0x${string}`,
    getTransactionCount: async () => 0,
    estimateFeesPerGas: async () => ({ maxFeePerGas: 1_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n }),
    ...overrides,
  };
}

describe("PreflightService", () => {
  test("successful simulation returns simulationSuccess true", async () => {
    const rpc = mockRpcClient();
    const svc = new PreflightService(rpc, permissiveConfig());
    const plan = buildTransfer(validFixtures.transfer);
    const result = await svc.simulate(validFixtures.transfer, plan);

    expect(result.simulationSuccess).toBe(true);
    expect(result.revertReason).toBeUndefined();
  });

  test("failed simulation returns revertReason", async () => {
    const rpc = mockRpcClient({
      call: async () => ({
        success: false,
        returnData: "0x" as `0x${string}`,
        revertReason: "ERC20: insufficient balance",
      }),
    });
    const svc = new PreflightService(rpc, permissiveConfig());
    const plan = buildTransfer(validFixtures.transfer);
    const result = await svc.simulate(validFixtures.transfer, plan);

    expect(result.simulationSuccess).toBe(false);
    expect(result.revertReason).toBe("ERC20: insufficient balance");
  });

  test("gas estimate is returned as string", async () => {
    const rpc = mockRpcClient({
      estimateGas: async () => 123_456n,
    });
    const svc = new PreflightService(rpc, permissiveConfig());
    const plan = buildTransfer(validFixtures.transfer);
    const result = await svc.simulate(validFixtures.transfer, plan);

    expect(result.gasEstimate).toBe("123456");
  });

  test("intentId matches the intent", async () => {
    const rpc = mockRpcClient();
    const svc = new PreflightService(rpc, permissiveConfig());
    const plan = buildTransfer(validFixtures.transfer);
    const result = await svc.simulate(validFixtures.transfer, plan);

    expect(result.intentId).toBe(validFixtures.transfer.id);
  });

  test("risk score is computed for transfer", async () => {
    const rpc = mockRpcClient();
    const svc = new PreflightService(rpc, permissiveConfig());
    const plan = buildTransfer(validFixtures.transfer);
    const result = await svc.simulate(validFixtures.transfer, plan);

    expect(typeof result.riskScore).toBe("number");
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(100);
  });

  test("reverted simulation produces high risk score", async () => {
    const rpc = mockRpcClient({
      call: async () => ({
        success: false,
        returnData: "0x" as `0x${string}`,
        revertReason: "Reverted",
      }),
    });
    const svc = new PreflightService(rpc, permissiveConfig());
    const plan = buildTransfer(validFixtures.transfer);
    const result = await svc.simulate(validFixtures.transfer, plan);

    // Simulation reverted adds +50
    expect(result.riskScore).toBeGreaterThanOrEqual(50);
  });

  test("warnings generated for reverted simulation", async () => {
    const rpc = mockRpcClient({
      call: async () => ({
        success: false,
        returnData: "0x" as `0x${string}`,
        revertReason: "Reverted",
      }),
    });
    const svc = new PreflightService(rpc, permissiveConfig());
    const plan = buildTransfer(validFixtures.transfer);
    const result = await svc.simulate(validFixtures.transfer, plan);

    expect(result.warnings.some((w) => w.includes("reverted"))).toBe(true);
  });

  test("balance diffs returned for transfer", async () => {
    const rpc = mockRpcClient({
      readBalance: async () => 5_000_000n,
    });
    const svc = new PreflightService(rpc, permissiveConfig());
    const plan = buildTransfer(validFixtures.transfer);
    const result = await svc.simulate(validFixtures.transfer, plan);

    expect(result.balanceDiffs.length).toBeGreaterThan(0);
    const diff0 = result.balanceDiffs[0]!;
    expect(diff0.asset).toBe("USDC");
    expect(diff0.delta).toBe("-1000000");
    expect(diff0.before).toBe("5000000");
    expect(diff0.after).toBe("4000000");
  });

  test("allowance changes returned for approve intent", async () => {
    const rpc = mockRpcClient({
      readAllowance: async () => 500n,
    });
    const svc = new PreflightService(rpc, permissiveConfig());
    const plan = buildApprove(validFixtures.approve);
    const result = await svc.simulate(validFixtures.approve, plan);

    expect(result.allowanceChanges.length).toBe(1);
    const change0 = result.allowanceChanges[0]!;
    expect(change0.before).toBe("500");
    expect(change0.after).toBe("1000000000");
    expect(change0.spender).toBe(
      "0x2626664c2603336E57B271c5C0b26F421741e481",
    );
  });

  test("swap intent returns balance diffs for input token", async () => {
    const rpc = mockRpcClient({
      readBalance: async () => 2_000_000n,
    });
    const svc = new PreflightService(rpc, permissiveConfig());
    const plan = buildSwap(validFixtures.swapExactIn);
    const result = await svc.simulate(validFixtures.swapExactIn, plan);

    expect(result.balanceDiffs.length).toBeGreaterThan(0);
    const swapDiff0 = result.balanceDiffs[0]!;
    expect(swapDiff0.asset).toBe("USDC");
    expect(swapDiff0.delta).toBe("-1000000");
  });

  test("balance diffs returned for native transfer (uses readNativeBalance)", async () => {
    const rpc = mockRpcClient({
      readNativeBalance: async () => 2_000_000_000_000_000_000n,
    });
    const svc = new PreflightService(rpc, permissiveConfig());
    const plan = buildTransferNative(validFixtures.transferNative);
    const result = await svc.simulate(validFixtures.transferNative, plan);

    expect(result.balanceDiffs.length).toBeGreaterThan(0);
    const diff0 = result.balanceDiffs[0]!;
    expect(diff0.asset).toBe("ETH");
    expect(diff0.delta).toBe("-100000000000000000");
    expect(diff0.before).toBe("2000000000000000000");
    expect(diff0.after).toBe("1900000000000000000");
  });

  test("warning generated when risk score exceeds threshold", async () => {
    // Use config with low maxRiskScore and an RPC that returns failed sim (high risk)
    const config = { ...permissiveConfig(), maxRiskScore: 10 };
    const rpc = mockRpcClient({
      call: async () => ({
        success: false,
        returnData: "0x" as `0x${string}`,
        revertReason: "Reverted",
      }),
    });
    const svc = new PreflightService(rpc, config);
    const plan = buildTransfer(validFixtures.transfer);
    const result = await svc.simulate(validFixtures.transfer, plan);

    expect(result.warnings.some((w) => w.includes("Risk score"))).toBe(true);
  });
});
