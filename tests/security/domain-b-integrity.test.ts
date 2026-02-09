import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "../../core/api/app.js";
import { PreflightService } from "../../core/preflight/preflight-service.js";
import { buildFromIntent } from "../../core/tx/builders/index.js";
import { EncryptedKeystore } from "../../core/wallet/keystore.js";
import { validFixtures } from "../../spec/fixtures/index.js";
import type { FastifyInstance } from "fastify";
import type { PolicyConfig, TxIntent } from "../../core/types.js";
import type { RpcClient, CallResult } from "../../core/rpc/rpc-client.js";

function permissiveConfig(overrides?: Partial<PolicyConfig>): PolicyConfig {
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
    ...overrides,
  };
}

const TEST_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const TEST_PASSPHRASE = "test-pass";

// ─── B1: Simulation revert elevates risk score ──────────────────────────────

describe("SecurityTest_B1: RPC mismatch elevates risk score", () => {
  test("simulation revert produces risk score >= 50", async () => {
    const mockRpc: RpcClient = {
      call: async (): Promise<CallResult> => ({
        success: false,
        returnData: "0x",
        revertReason: "INSUFFICIENT_BALANCE",
      }),
      estimateGas: async () => 0n,
      readBalance: async () => 0n,
      readNativeBalance: async () => 0n,
      readAllowance: async () => 0n,
      getTransactionReceipt: async () => null,
      sendRawTransaction: async () => "0x" as `0x${string}`,
      getTransactionCount: async () => 0,
      estimateFeesPerGas: async () => ({ maxFeePerGas: 1_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n }),
    };

    const svc = new PreflightService(mockRpc, permissiveConfig());
    const plan = buildFromIntent(validFixtures.transfer);
    const result = await svc.simulate(validFixtures.transfer, plan);

    expect(result.riskScore).toBeGreaterThanOrEqual(50);
    expect(result.simulationSuccess).toBe(false);
    expect(result.riskReasons.some((r) => r.includes("reverted"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("reverted"))).toBe(true);
  });

  test("successful simulation keeps risk score low", async () => {
    const mockRpc: RpcClient = {
      call: async (): Promise<CallResult> => ({
        success: true,
        returnData: "0x0000000000000000000000000000000000000000000000000000000000000001",
      }),
      estimateGas: async () => 60000n,
      readBalance: async () => 100000000n,
      readNativeBalance: async () => 0n,
      readAllowance: async () => 0n,
      getTransactionReceipt: async () => null,
      sendRawTransaction: async () => "0x" as `0x${string}`,
      getTransactionCount: async () => 0,
      estimateFeesPerGas: async () => ({ maxFeePerGas: 1_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n }),
    };

    const svc = new PreflightService(mockRpc, permissiveConfig());
    const plan = buildFromIntent(validFixtures.transfer);
    const result = await svc.simulate(validFixtures.transfer, plan);

    expect(result.riskScore).toBeLessThan(50);
    expect(result.simulationSuccess).toBe(true);
  });
});

// ─── B2: No bypass — cannot sign without valid policy ───────────────────────

describe("SecurityTest_B2: No signing bypass", () => {
  let app: FastifyInstance;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "iscl-sec-b2-"));
    app = await buildApp({
      logger: false,
      auditDbPath: ":memory:",
      keystorePath: tempDir,
      policyConfig: permissiveConfig(),
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("sign-and-send with policy-denied intent (wrong chain) returns 403", async () => {
    const intent: TxIntent = {
      ...validFixtures.transfer,
      id: "550e8400-e29b-41d4-a716-446655440099",
      chain: { type: "evm", chainId: 999 },
    };

    const res = await app.inject({
      method: "POST",
      url: "/v1/tx/sign-and-send",
      payload: { intent },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("policy_denied");
  });

  test("sign-and-send without unlocked key returns 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tx/sign-and-send",
      payload: { intent: validFixtures.transfer },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("signing_failed");
  });
});

// ─── B3: Approval token single-use — no replay ─────────────────────────────

describe("SecurityTest_B3: Approval token replay rejected", () => {
  let app: FastifyInstance;
  let tempDir: string;
  let walletAddress: string;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "iscl-sec-b3-"));

    // Pre-create keystore with fast scryptN and import test key
    const keystore = new EncryptedKeystore(tempDir, { scryptN: 1024 });
    walletAddress = await keystore.importKey(TEST_KEY, TEST_PASSPHRASE);

    // Build app with requireApprovalAbove.valueWei = "0" → all txs require approval
    app = await buildApp({
      logger: false,
      auditDbPath: ":memory:",
      keystorePath: tempDir,
      policyConfig: permissiveConfig({
        requireApprovalAbove: { valueWei: "0" },
      }),
    });
    await app.ready();

    // Unlock the key via the app's keystore instance
    const appKeystore = (app as unknown as { keystore: EncryptedKeystore }).keystore;
    await appKeystore.unlock(walletAddress, TEST_PASSPHRASE);
  });

  afterAll(async () => {
    await app.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("first sign-and-send with valid token succeeds, replay rejected", async () => {
    const intent: TxIntent = {
      ...validFixtures.transfer,
      id: "550e8400-e29b-41d4-a716-44665544b300",
      wallet: { address: walletAddress },
    };

    // Build to get txRequestHash
    const buildRes = await app.inject({
      method: "POST",
      url: "/v1/tx/build",
      payload: intent,
    });
    expect(buildRes.statusCode).toBe(200);
    const { txRequestHash } = buildRes.json() as { txRequestHash: string };

    // Issue approval token directly
    const tokenManager = (
      app as unknown as { approvalTokenManager: { issue: (a: string, b: string, c?: number) => { id: string } } }
    ).approvalTokenManager;
    const token = tokenManager.issue(intent.id, txRequestHash, 300);

    // First sign-and-send → should succeed
    const signRes1 = await app.inject({
      method: "POST",
      url: "/v1/tx/sign-and-send",
      payload: { intent, approvalTokenId: token.id },
    });
    expect(signRes1.statusCode).toBe(200);
    expect(signRes1.json().signedTx).toBeDefined();

    // Replay: same token → should be rejected (consumed)
    const signRes2 = await app.inject({
      method: "POST",
      url: "/v1/tx/sign-and-send",
      payload: { intent, approvalTokenId: token.id },
    });
    expect(signRes2.statusCode).toBe(403);
  });

  test("sign-and-send without approval token when required returns 403", async () => {
    const intent: TxIntent = {
      ...validFixtures.transfer,
      id: "550e8400-e29b-41d4-a716-44665544b301",
      wallet: { address: walletAddress },
    };

    const res = await app.inject({
      method: "POST",
      url: "/v1/tx/sign-and-send",
      payload: { intent },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("approval_required");
  });
});

// ─── B4: MaxUint256 approval denied by policy ───────────────────────────────

describe("SecurityTest_B4: Unbounded approval denied", () => {
  let app: FastifyInstance;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "iscl-sec-b4-"));
    app = await buildApp({
      logger: false,
      auditDbPath: ":memory:",
      keystorePath: tempDir,
      policyConfig: permissiveConfig(),
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("MaxUint256 approval amount is denied by policy", async () => {
    const maxUint256 = (2n ** 256n - 1n).toString();
    const approveAction = validFixtures.approve.action as { type: "approve"; asset: { kind: "erc20"; address: string; symbol: string; decimals: number }; spender: string; amount: string };
    const intent: TxIntent = {
      ...validFixtures.approve,
      id: "550e8400-e29b-41d4-a716-44665544b400",
      action: {
        type: "approve" as const,
        asset: approveAction.asset,
        spender: approveAction.spender,
        amount: maxUint256,
      },
    };

    const res = await app.inject({
      method: "POST",
      url: "/v1/tx/build",
      payload: intent,
    });

    expect(res.statusCode).toBe(403);
    const body = res.json() as { error: string; reasons: string[] };
    expect(body.error).toBe("policy_denied");
    expect(body.reasons.some((r: string) => r.includes("Approval amount"))).toBe(true);
  });

  test("reasonable approval amount is allowed", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tx/build",
      payload: validFixtures.approve,
    });

    expect(res.statusCode).toBe(200);
  });
});
