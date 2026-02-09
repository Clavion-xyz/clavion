import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEther } from "viem";
import { privateKeyToAddress } from "viem/accounts";
import { EncryptedKeystore } from "../../core/wallet/keystore.js";
import { ApprovalTokenManager } from "../../core/approval/approval-token-manager.js";
import { AuditTraceService } from "../../core/audit/audit-trace-service.js";
import { WalletService } from "../../core/wallet/wallet-service.js";
import type { SignRequest, PolicyDecision } from "../../core/types.js";

// Well-known test key
const TEST_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as `0x${string}`;
const TEST_ADDRESS = privateKeyToAddress(TEST_PRIVATE_KEY).toLowerCase();
const INTENT_ID = "550e8400-e29b-41d4-a716-446655440000";
const TX_REQUEST_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

function makeSignRequest(overrides: Partial<SignRequest> = {}): SignRequest {
  return {
    intentId: INTENT_ID,
    walletAddress: TEST_ADDRESS,
    txRequest: {
      to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
      value: parseEther("0.01"),
      chainId: 8453,
      type: "eip1559" as const,
      maxFeePerGas: 1000000000n,
      maxPriorityFeePerGas: 100000000n,
    },
    txRequestHash: TX_REQUEST_HASH,
    policyDecision: {
      decision: "allow",
      reasons: [],
      policyVersion: "test-1.0",
    },
    ...overrides,
  };
}

describe("WalletService", () => {
  let keystorePath: string;
  let keystore: EncryptedKeystore;
  let tokenManager: ApprovalTokenManager;
  let auditTrace: AuditTraceService;
  let walletService: WalletService;

  beforeEach(async () => {
    keystorePath = mkdtempSync(join(tmpdir(), "iscl-wallet-test-"));
    keystore = new EncryptedKeystore(keystorePath, { scryptN: 1024 });
    tokenManager = new ApprovalTokenManager(":memory:");
    auditTrace = new AuditTraceService(":memory:");
    walletService = new WalletService(keystore, tokenManager, auditTrace);

    // Import and unlock test key
    await keystore.importKey(TEST_PRIVATE_KEY, "test-pass");
    await keystore.unlock(TEST_ADDRESS, "test-pass");
  });

  afterEach(() => {
    tokenManager.close();
    auditTrace.close();
    rmSync(keystorePath, { recursive: true, force: true });
  });

  test("sign() succeeds with allow policy decision", async () => {
    const request = makeSignRequest();
    const result = await walletService.sign(request);
    expect(result.signedTx).toMatch(/^0x/);
    expect(result.txHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("sign() succeeds with require_approval and valid token", async () => {
    const token = tokenManager.issue(INTENT_ID, TX_REQUEST_HASH);
    const request = makeSignRequest({
      policyDecision: {
        decision: "require_approval",
        reasons: ["value above threshold"],
        policyVersion: "test-1.0",
      },
      approvalToken: token,
    });
    const result = await walletService.sign(request);
    expect(result.signedTx).toMatch(/^0x/);
    expect(result.txHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("sign() throws without PolicyDecision", async () => {
    const request = makeSignRequest({
      policyDecision: undefined as unknown as PolicyDecision,
    });
    await expect(walletService.sign(request)).rejects.toThrow("PolicyDecision is required");
  });

  test("sign() throws with deny PolicyDecision", async () => {
    const request = makeSignRequest({
      policyDecision: {
        decision: "deny",
        reasons: ["value too high"],
        policyVersion: "test-1.0",
      },
    });
    await expect(walletService.sign(request)).rejects.toThrow("Signing denied by policy");
  });

  test("sign() throws with require_approval but missing token", async () => {
    const request = makeSignRequest({
      policyDecision: {
        decision: "require_approval",
        reasons: ["needs approval"],
        policyVersion: "test-1.0",
      },
      approvalToken: undefined,
    });
    await expect(walletService.sign(request)).rejects.toThrow("ApprovalToken is required");
  });

  test("sign() throws with consumed approval token", async () => {
    const token = tokenManager.issue(INTENT_ID, TX_REQUEST_HASH);
    tokenManager.consume(token.id);

    const request = makeSignRequest({
      policyDecision: {
        decision: "require_approval",
        reasons: ["needs approval"],
        policyVersion: "test-1.0",
      },
      approvalToken: token,
    });
    await expect(walletService.sign(request)).rejects.toThrow("invalid, expired, or already consumed");
  });

  test("sign() throws with expired approval token", async () => {
    const token = tokenManager.issue(INTENT_ID, TX_REQUEST_HASH, 0); // TTL=0

    const request = makeSignRequest({
      policyDecision: {
        decision: "require_approval",
        reasons: ["needs approval"],
        policyVersion: "test-1.0",
      },
      approvalToken: token,
    });
    await expect(walletService.sign(request)).rejects.toThrow("invalid, expired, or already consumed");
  });

  test("sign() throws with wrong intentId in token", async () => {
    const token = tokenManager.issue("wrong-intent-id", TX_REQUEST_HASH);

    const request = makeSignRequest({
      policyDecision: {
        decision: "require_approval",
        reasons: ["needs approval"],
        policyVersion: "test-1.0",
      },
      approvalToken: token,
    });
    await expect(walletService.sign(request)).rejects.toThrow("invalid, expired, or already consumed");
  });

  test("sign() throws with locked key", async () => {
    keystore.lock(TEST_ADDRESS);
    const request = makeSignRequest();
    await expect(walletService.sign(request)).rejects.toThrow("is not unlocked");
  });

  test("sign() consumes approval token (single-use)", async () => {
    const token = tokenManager.issue(INTENT_ID, TX_REQUEST_HASH);
    const request = makeSignRequest({
      policyDecision: {
        decision: "require_approval",
        reasons: ["needs approval"],
        policyVersion: "test-1.0",
      },
      approvalToken: token,
    });

    // First sign should succeed
    await walletService.sign(request);

    // Second sign with same token should fail
    await expect(walletService.sign(request)).rejects.toThrow("invalid, expired, or already consumed");
  });

  test("signature_created event appears in audit trail", async () => {
    const request = makeSignRequest();
    await walletService.sign(request);

    const trail = auditTrace.getTrail(INTENT_ID);
    const signEvent = trail.find((e) => e.event === "signature_created");
    expect(signEvent).toBeDefined();
    expect(signEvent!.data.signerAddress).toBe(TEST_ADDRESS);
    expect(signEvent!.data.txRequestHash).toBe(TX_REQUEST_HASH);
  });

  test("signing_denied event appears for deny policy", async () => {
    const request = makeSignRequest({
      policyDecision: {
        decision: "deny",
        reasons: ["too risky"],
        policyVersion: "test-1.0",
      },
    });

    await expect(walletService.sign(request)).rejects.toThrow();

    const trail = auditTrace.getTrail(INTENT_ID);
    const denyEvent = trail.find((e) => e.event === "signing_denied");
    expect(denyEvent).toBeDefined();
    expect(denyEvent!.data.reason).toBe("policy_deny");
  });
});
