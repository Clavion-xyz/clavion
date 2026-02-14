import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "@clavion/core";
import { EncryptedKeystore } from "@clavion/signer";
import {
  validFixtures,
  TEST_PRIVATE_KEY,
  approvalRequiredConfig,
  noApprovalConfig,
} from "../../tools/fixtures/index.js";
import type { FastifyInstance } from "fastify";
import type { TxIntent } from "@clavion/types";

const TEST_KEY = TEST_PRIVATE_KEY;
const TEST_PASSPHRASE = "test-approval";

describe("Approval Flow — approve-request → sign-and-send", () => {
  // ── Auto-approve ──

  describe("with auto-approve promptFn", () => {
    let app: FastifyInstance;
    let tempDir: string;
    let walletAddress: string;

    beforeAll(async () => {
      tempDir = mkdtempSync(join(tmpdir(), "iscl-approval-auto-"));
      const keystore = new EncryptedKeystore(tempDir, { scryptN: 1024 });
      walletAddress = await keystore.importKey(TEST_KEY, TEST_PASSPHRASE);

      app = await buildApp({
        logger: false,
        auditDbPath: ":memory:",
        keystorePath: tempDir,
        policyConfig: approvalRequiredConfig(),
        promptFn: async () => true, // auto-approve
      });
      await app.ready();

      const appKeystore = (app as unknown as { keystore: EncryptedKeystore }).keystore;
      await appKeystore.unlock(walletAddress, TEST_PASSPHRASE);
    });

    afterAll(async () => {
      await app.close();
      rmSync(tempDir, { recursive: true, force: true });
    });

    test("approve-request returns approvalTokenId when auto-approved", async () => {
      const intent: TxIntent = {
        ...validFixtures.transfer,
        id: "550e8400-e29b-41d4-a716-446655440a01",
        wallet: { address: walletAddress },
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/tx/approve-request",
        payload: intent,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.approvalRequired).toBe(true);
      expect(body.approved).toBe(true);
      expect(body.approvalTokenId).toBeDefined();
      expect(body.approvalTokenId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    test("full flow: approve-request → sign-and-send with token", async () => {
      const intent: TxIntent = {
        ...validFixtures.transfer,
        id: "550e8400-e29b-41d4-a716-446655440a02",
        wallet: { address: walletAddress },
      };

      // Step 1: approve-request
      const approveRes = await app.inject({
        method: "POST",
        url: "/v1/tx/approve-request",
        payload: intent,
      });
      expect(approveRes.statusCode).toBe(200);
      const { approvalTokenId } = approveRes.json() as { approvalTokenId: string };

      // Step 2: sign-and-send with approval token
      const signRes = await app.inject({
        method: "POST",
        url: "/v1/tx/sign-and-send",
        payload: { intent, approvalTokenId },
      });
      expect(signRes.statusCode).toBe(200);
      const signBody = signRes.json() as { signedTx: string; txHash: string; intentId: string; broadcast: boolean };
      expect(signBody.signedTx).toMatch(/^0x/);
      expect(signBody.txHash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(signBody.broadcast).toBe(false); // no RPC client in integration tests
    });
  });

  // ── User-declined ──

  describe("with decline promptFn", () => {
    let app: FastifyInstance;
    let tempDir: string;

    beforeAll(async () => {
      tempDir = mkdtempSync(join(tmpdir(), "iscl-approval-deny-"));
      app = await buildApp({
        logger: false,
        auditDbPath: ":memory:",
        keystorePath: tempDir,
        policyConfig: approvalRequiredConfig(),
        promptFn: async () => false, // user declines
      });
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
      rmSync(tempDir, { recursive: true, force: true });
    });

    test("approve-request returns 403 when user declines", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/tx/approve-request",
        payload: validFixtures.transfer,
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.approvalRequired).toBe(true);
      expect(body.approved).toBe(false);
      expect(body.reason).toBe("user_declined");
    });
  });

  // ── No approval needed ──

  describe("when policy allows without approval", () => {
    let app: FastifyInstance;
    let tempDir: string;

    beforeAll(async () => {
      tempDir = mkdtempSync(join(tmpdir(), "iscl-approval-allow-"));
      app = await buildApp({
        logger: false,
        auditDbPath: ":memory:",
        keystorePath: tempDir,
        policyConfig: noApprovalConfig(),
      });
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
      rmSync(tempDir, { recursive: true, force: true });
    });

    test("approve-request returns approvalRequired=false when policy allows", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/tx/approve-request",
        payload: validFixtures.transfer,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.approvalRequired).toBe(false);
      expect(body.approved).toBe(true);
      expect(body.approvalTokenId).toBeUndefined();
    });
  });
});
