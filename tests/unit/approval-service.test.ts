import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { ApprovalTokenManager } from "../../core/approval/approval-token-manager.js";
import { ApprovalService } from "../../core/approval/approval-service.js";
import { AuditTraceService } from "../../core/audit/audit-trace-service.js";
import type { ApprovalSummary } from "../../core/types.js";

const INTENT_ID = "550e8400-e29b-41d4-a716-446655440000";
const TX_REQUEST_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

function makeSummary(overrides: Partial<ApprovalSummary> = {}): ApprovalSummary {
  return {
    intentId: INTENT_ID,
    action: "Swap 100 USDC -> WETH via Uniswap V3",
    expectedOutcome: "Receive >= 0.05 WETH",
    balanceDiffs: [
      { asset: "USDC", delta: "-100000000" },
      { asset: "WETH", delta: "+50000000000000000", usdValue: "120.00" },
    ],
    riskScore: 25,
    riskReasons: [],
    warnings: [],
    gasEstimateEth: "0.0012 ETH",
    txRequestHash: TX_REQUEST_HASH,
    ...overrides,
  };
}

describe("ApprovalService", () => {
  let tokenManager: ApprovalTokenManager;
  let auditTrace: AuditTraceService;

  beforeEach(() => {
    tokenManager = new ApprovalTokenManager(":memory:");
    auditTrace = new AuditTraceService(":memory:");
  });

  afterEach(() => {
    tokenManager.close();
    auditTrace.close();
  });

  test("requestApproval() returns token when user approves", async () => {
    const service = new ApprovalService(tokenManager, auditTrace, async () => true);
    const result = await service.requestApproval(makeSummary());

    expect(result.approved).toBe(true);
    expect(result.token).toBeDefined();
    expect(result.token!.intentId).toBe(INTENT_ID);
    expect(result.token!.txRequestHash).toBe(TX_REQUEST_HASH);
  });

  test("requestApproval() returns no token when user rejects", async () => {
    const service = new ApprovalService(tokenManager, auditTrace, async () => false);
    const result = await service.requestApproval(makeSummary());

    expect(result.approved).toBe(false);
    expect(result.token).toBeUndefined();
  });

  test("issued token is valid and usable", async () => {
    const service = new ApprovalService(tokenManager, auditTrace, async () => true);
    const result = await service.requestApproval(makeSummary());

    const isValid = tokenManager.validate(result.token!.id, INTENT_ID, TX_REQUEST_HASH);
    expect(isValid).toBe(true);
  });

  test("approval_granted event logged on approval", async () => {
    const service = new ApprovalService(tokenManager, auditTrace, async () => true);
    await service.requestApproval(makeSummary());

    const trail = auditTrace.getTrail(INTENT_ID);
    const event = trail.find((e) => e.event === "approval_granted");
    expect(event).toBeDefined();
    expect(event!.data.tokenId).toBeDefined();
    expect(event!.data.riskScore).toBe(25);
  });

  test("approval_rejected event logged on rejection", async () => {
    const service = new ApprovalService(tokenManager, auditTrace, async () => false);
    await service.requestApproval(makeSummary());

    const trail = auditTrace.getTrail(INTENT_ID);
    const event = trail.find((e) => e.event === "approval_rejected");
    expect(event).toBeDefined();
    expect(event!.data.reason).toBe("user_declined");
  });

  test("renderSummary() includes action and outcome", () => {
    const service = new ApprovalService(tokenManager, auditTrace, async () => false);
    const output = service.renderSummary(makeSummary());

    expect(output).toContain("Swap 100 USDC");
    expect(output).toContain("Receive >= 0.05 WETH");
  });

  test("renderSummary() includes balance diffs", () => {
    const service = new ApprovalService(tokenManager, auditTrace, async () => false);
    const output = service.renderSummary(makeSummary());

    expect(output).toContain("-100000000 USDC");
    expect(output).toContain("+50000000000000000 WETH");
    expect(output).toContain("~$120.00");
  });

  test("renderSummary() includes risk score and warnings", () => {
    const service = new ApprovalService(tokenManager, auditTrace, async () => false);
    const output = service.renderSummary(
      makeSummary({
        riskScore: 75,
        riskReasons: ["Unknown contract"],
        warnings: ["High value transaction"],
      }),
    );

    expect(output).toContain("75/100");
    expect(output).toContain("Unknown contract");
    expect(output).toContain("High value transaction");
  });

  test("renderSummary() includes recipient for transfers", () => {
    const service = new ApprovalService(tokenManager, auditTrace, async () => false);
    const output = service.renderSummary(
      makeSummary({
        action: "Transfer 100 USDC",
        recipient: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      }),
    );

    expect(output).toContain("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
  });
});
