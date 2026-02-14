import { describe, test, expect, vi } from "vitest";
import { executeSecurePipeline } from "../src/tools/pipeline.js";
import type { ISCLClient } from "../src/shared/iscl-client.js";
import type { TxIntent } from "@clavion/types";

function makeIntent(overrides: Partial<TxIntent> = {}): TxIntent {
  return {
    version: "1",
    id: "test-id",
    timestamp: 1700000000,
    chain: { type: "evm", chainId: 8453 },
    wallet: { address: "0x1111111111111111111111111111111111111111" },
    action: {
      type: "transfer",
      asset: { kind: "erc20", address: "0x2222222222222222222222222222222222222222" },
      to: "0x3333333333333333333333333333333333333333",
      amount: "1000000",
    },
    constraints: { maxGasWei: "1000000000000000", deadline: 1700000600, maxSlippageBps: 100 },
    ...overrides,
  };
}

function makeApproveResponse(approved: boolean, token?: string) {
  return {
    intentId: "test-id",
    txRequestHash: "0xhash",
    description: "Transfer 1 USDC",
    policyDecision: { decision: "require_approval", reasons: [] as string[], policyVersion: "1" },
    riskScore: 15,
    riskReasons: [] as string[],
    warnings: [] as string[],
    gasEstimate: "21000",
    balanceDiffs: [] as string[],
    approvalRequired: true,
    approved,
    ...(token ? { approvalTokenId: token } : {}),
    ...(!approved ? { reason: "user_declined" } : {}),
  };
}

function makeSignResponse() {
  return {
    signedTx: "0xsigned",
    txHash: "0xtxhash",
    intentId: "test-id",
    broadcast: true,
  };
}

describe("executeSecurePipeline", () => {
  test("returns success when approved and signed", async () => {
    const client = {
      txApproveRequest: vi.fn().mockResolvedValue(makeApproveResponse(true, "token-1")),
      txSignAndSend: vi.fn().mockResolvedValue(makeSignResponse()),
    } as unknown as ISCLClient;

    const result = await executeSecurePipeline(makeIntent(), client);

    expect(result.success).toBe(true);
    expect(result.approved).toBe(true);
    expect(result.intentId).toBe("test-id");
    expect(result.signResult?.txHash).toBe("0xtxhash");
    expect(result.signResult?.broadcast).toBe(true);
  });

  test("passes approval token to sign-and-send", async () => {
    const client = {
      txApproveRequest: vi.fn().mockResolvedValue(makeApproveResponse(true, "token-abc")),
      txSignAndSend: vi.fn().mockResolvedValue(makeSignResponse()),
    } as unknown as ISCLClient;

    await executeSecurePipeline(makeIntent(), client);

    expect(client.txSignAndSend).toHaveBeenCalledWith({
      intent: expect.objectContaining({ id: "test-id" }),
      approvalTokenId: "token-abc",
    });
  });

  test("returns declined when user denies", async () => {
    const client = {
      txApproveRequest: vi.fn().mockResolvedValue(makeApproveResponse(false)),
      txSignAndSend: vi.fn(),
    } as unknown as ISCLClient;

    const result = await executeSecurePipeline(makeIntent(), client);

    expect(result.success).toBe(false);
    expect(result.approved).toBe(false);
    expect(result.declineReason).toBe("user_declined");
    expect(client.txSignAndSend).not.toHaveBeenCalled();
  });

  test("includes approval details on decline", async () => {
    const response = makeApproveResponse(false);
    response.riskScore = 55;
    response.riskReasons = ["high_value_transfer"];
    response.policyDecision.decision = "deny";
    response.policyDecision.reasons = ["exceeds_max_value"];

    const client = {
      txApproveRequest: vi.fn().mockResolvedValue(response),
      txSignAndSend: vi.fn(),
    } as unknown as ISCLClient;

    const result = await executeSecurePipeline(makeIntent(), client);

    expect(result.approvalDetails?.riskScore).toBe(55);
    expect(result.approvalDetails?.riskReasons).toEqual(["high_value_transfer"]);
    expect(result.approvalDetails?.policyDecision).toBe("deny");
    expect(result.approvalDetails?.policyReasons).toEqual(["exceeds_max_value"]);
  });

  test("propagates approve-request errors", async () => {
    const client = {
      txApproveRequest: vi.fn().mockRejectedValue(new Error("network error")),
      txSignAndSend: vi.fn(),
    } as unknown as ISCLClient;

    await expect(executeSecurePipeline(makeIntent(), client)).rejects.toThrow("network error");
  });

  test("propagates sign-and-send errors", async () => {
    const client = {
      txApproveRequest: vi.fn().mockResolvedValue(makeApproveResponse(true, "token-1")),
      txSignAndSend: vi.fn().mockRejectedValue(new Error("signing failed")),
    } as unknown as ISCLClient;

    await expect(executeSecurePipeline(makeIntent(), client)).rejects.toThrow("signing failed");
  });

  test("includes broadcast error when broadcast fails", async () => {
    const signResponse = makeSignResponse();
    (signResponse as Record<string, unknown>).broadcast = false;
    (signResponse as Record<string, unknown>).broadcastError = "nonce too low";

    const client = {
      txApproveRequest: vi.fn().mockResolvedValue(makeApproveResponse(true, "token-1")),
      txSignAndSend: vi.fn().mockResolvedValue(signResponse),
    } as unknown as ISCLClient;

    const result = await executeSecurePipeline(makeIntent(), client);

    expect(result.success).toBe(true);
    expect(result.signResult?.broadcast).toBe(false);
    expect(result.signResult?.broadcastError).toBe("nonce too low");
  });
});
