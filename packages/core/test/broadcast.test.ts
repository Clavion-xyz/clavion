import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "@clavion/core";
import { EncryptedKeystore } from "@clavion/signer";
import { validFixtures } from "../../../tools/fixtures/index.js";
import type { FastifyInstance } from "fastify";
import type { RpcClient } from "@clavion/types/rpc";
import type { PolicyConfig, TxIntent, AuditEvent } from "@clavion/types";
import type { AuditTraceService } from "@clavion/audit";

const TEST_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const TEST_PASSPHRASE = "test-broadcast";

function noApprovalConfig(): PolicyConfig {
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
    requireApprovalAbove: { valueWei: "1000000000000000000000" }, // high threshold = no approval needed
    maxTxPerHour: 100,
  };
}

function mockRpcClient(overrides?: Partial<RpcClient>): RpcClient {
  return {
    call: async () => ({ success: true, returnData: "0x" as `0x${string}` }),
    estimateGas: async () => 50_000n,
    readBalance: async () => 10_000_000n,
    readNativeBalance: async () => 0n,
    readAllowance: async () => 0n,
    getTransactionReceipt: async () => null,
    sendRawTransaction: async () => ("0x" + "ab".repeat(32)) as `0x${string}`,
    getTransactionCount: async () => 0,
    estimateFeesPerGas: async () => ({ maxFeePerGas: 1_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n }),
    ...overrides,
  };
}

describe("POST /v1/tx/sign-and-send — broadcast behavior", () => {
  // ── With RPC + successful broadcast ──

  describe("RPC available + broadcast succeeds", () => {
    let app: FastifyInstance;
    let tempDir: string;
    let walletAddress: string;
    let auditTrace: AuditTraceService;

    beforeAll(async () => {
      tempDir = mkdtempSync(join(tmpdir(), "iscl-broadcast-ok-"));
      const keystore = new EncryptedKeystore(tempDir, { scryptN: 1024 });
      walletAddress = await keystore.importKey(TEST_KEY, TEST_PASSPHRASE);

      app = await buildApp({
        logger: false,
        auditDbPath: ":memory:",
        keystorePath: tempDir,
        policyConfig: noApprovalConfig(),
        rpcClient: mockRpcClient(),
      });
      await app.ready();

      const appKeystore = (app as unknown as { keystore: EncryptedKeystore }).keystore;
      await appKeystore.unlock(walletAddress, TEST_PASSPHRASE);
      auditTrace = (app as unknown as { auditTrace: AuditTraceService }).auditTrace;
    });

    afterAll(async () => {
      await app.close();
      rmSync(tempDir, { recursive: true, force: true });
    });

    test("returns broadcast: true on successful broadcast", async () => {
      const intent: TxIntent = {
        ...validFixtures.transfer,
        id: "bbbb0000-0000-0000-0000-000000000001",
        wallet: { address: walletAddress },
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/tx/sign-and-send",
        payload: { intent },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as { signedTx: string; txHash: string; intentId: string; broadcast: boolean; broadcastError?: string };
      expect(body.signedTx).toMatch(/^0x/);
      expect(body.txHash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(body.broadcast).toBe(true);
      expect(body.broadcastError).toBeUndefined();
    });

    test("audit trail contains tx_broadcast event", async () => {
      const intent: TxIntent = {
        ...validFixtures.transfer,
        id: "bbbb0000-0000-0000-0000-000000000002",
        wallet: { address: walletAddress },
      };

      await app.inject({
        method: "POST",
        url: "/v1/tx/sign-and-send",
        payload: { intent },
      });

      const trail = auditTrace.getTrail(intent.id);
      const eventNames = trail.map((e: AuditEvent) => e.event);
      expect(eventNames).toContain("tx_broadcast");
    });
  });

  // ── With RPC + broadcast fails ──

  describe("RPC available + broadcast fails", () => {
    let app: FastifyInstance;
    let tempDir: string;
    let walletAddress: string;
    let auditTrace: AuditTraceService;

    beforeAll(async () => {
      tempDir = mkdtempSync(join(tmpdir(), "iscl-broadcast-fail-"));
      const keystore = new EncryptedKeystore(tempDir, { scryptN: 1024 });
      walletAddress = await keystore.importKey(TEST_KEY, TEST_PASSPHRASE);

      app = await buildApp({
        logger: false,
        auditDbPath: ":memory:",
        keystorePath: tempDir,
        policyConfig: noApprovalConfig(),
        rpcClient: mockRpcClient({
          sendRawTransaction: async () => {
            throw new Error("nonce too low");
          },
        }),
      });
      await app.ready();

      const appKeystore = (app as unknown as { keystore: EncryptedKeystore }).keystore;
      await appKeystore.unlock(walletAddress, TEST_PASSPHRASE);
      auditTrace = (app as unknown as { auditTrace: AuditTraceService }).auditTrace;
    });

    afterAll(async () => {
      await app.close();
      rmSync(tempDir, { recursive: true, force: true });
    });

    test("returns broadcast: false with broadcastError on failure", async () => {
      const intent: TxIntent = {
        ...validFixtures.transfer,
        id: "bbbb0000-0000-0000-0000-000000000003",
        wallet: { address: walletAddress },
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/tx/sign-and-send",
        payload: { intent },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as { signedTx: string; txHash: string; broadcast: boolean; broadcastError?: string };
      expect(body.signedTx).toMatch(/^0x/);
      expect(body.txHash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(body.broadcast).toBe(false);
      expect(body.broadcastError).toBe("nonce too low");
    });

    test("audit trail contains broadcast_failed event", async () => {
      const intent: TxIntent = {
        ...validFixtures.transfer,
        id: "bbbb0000-0000-0000-0000-000000000004",
        wallet: { address: walletAddress },
      };

      await app.inject({
        method: "POST",
        url: "/v1/tx/sign-and-send",
        payload: { intent },
      });

      const trail = auditTrace.getTrail(intent.id);
      const eventNames = trail.map((e: AuditEvent) => e.event);
      expect(eventNames).toContain("broadcast_failed");
    });
  });

  // ── No RPC client (sign-only mode) ──

  describe("no RPC client — sign-only mode", () => {
    let app: FastifyInstance;
    let tempDir: string;
    let walletAddress: string;

    beforeAll(async () => {
      tempDir = mkdtempSync(join(tmpdir(), "iscl-broadcast-norpc-"));
      const keystore = new EncryptedKeystore(tempDir, { scryptN: 1024 });
      walletAddress = await keystore.importKey(TEST_KEY, TEST_PASSPHRASE);

      app = await buildApp({
        logger: false,
        auditDbPath: ":memory:",
        keystorePath: tempDir,
        policyConfig: noApprovalConfig(),
        // No rpcClient — sign-only mode
      });
      await app.ready();

      const appKeystore = (app as unknown as { keystore: EncryptedKeystore }).keystore;
      await appKeystore.unlock(walletAddress, TEST_PASSPHRASE);
    });

    afterAll(async () => {
      await app.close();
      rmSync(tempDir, { recursive: true, force: true });
    });

    test("returns broadcast: false with no error when no RPC", async () => {
      const intent: TxIntent = {
        ...validFixtures.transfer,
        id: "bbbb0000-0000-0000-0000-000000000005",
        wallet: { address: walletAddress },
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/tx/sign-and-send",
        payload: { intent },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as { signedTx: string; txHash: string; broadcast: boolean; broadcastError?: string };
      expect(body.signedTx).toMatch(/^0x/);
      expect(body.txHash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(body.broadcast).toBe(false);
      expect(body.broadcastError).toBeUndefined();
    });

    test("sign-only mode still returns valid signed tx", async () => {
      const intent: TxIntent = {
        ...validFixtures.transfer,
        id: "bbbb0000-0000-0000-0000-000000000006",
        wallet: { address: walletAddress },
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/tx/sign-and-send",
        payload: { intent },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as { signedTx: string; txHash: string; intentId: string };
      expect(body.signedTx.length).toBeGreaterThan(10);
      expect(body.intentId).toBe(intent.id);
    });
  });
});
