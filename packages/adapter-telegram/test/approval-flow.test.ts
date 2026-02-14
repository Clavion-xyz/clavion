import { describe, test, expect, vi } from "vitest";
import { pollForPendingApproval } from "../src/approval/approval-flow.js";
import type {
  ISCLClient,
  PendingApprovalItem,
} from "../src/shared/iscl-client.js";

function makePendingItem(intentId: string): PendingApprovalItem {
  return {
    requestId: `req-${intentId}`,
    summary: {
      intentId,
      action: "transfer",
      expectedOutcome: "Send 100 USDC",
      balanceDiffs: [{ asset: "USDC", delta: "-100" }],
      riskScore: 20,
      riskReasons: [],
      warnings: [],
      gasEstimateEth: "0.001",
    },
    createdAt: Date.now(),
    expiresAt: Date.now() + 120_000,
  };
}

function makeMockClient(
  pendingApprovalsFn: () => Promise<{ pending: PendingApprovalItem[] }>,
): ISCLClient {
  return {
    pendingApprovals: vi.fn().mockImplementation(pendingApprovalsFn),
  } as unknown as ISCLClient;
}

describe("pollForPendingApproval", () => {
  test("finds matching pending on first poll", async () => {
    const item = makePendingItem("intent-abc");
    const client = makeMockClient(async () => ({ pending: [item] }));

    const result = await pollForPendingApproval(client, "intent-abc", 50, 500);

    expect(result).not.toBeNull();
    expect(result!.requestId).toBe("req-intent-abc");
    expect(result!.summary.intentId).toBe("intent-abc");
    expect(client.pendingApprovals).toHaveBeenCalledTimes(1);
  });

  test("returns null on timeout", async () => {
    const client = makeMockClient(async () => ({ pending: [] }));

    const result = await pollForPendingApproval(client, "intent-xyz", 30, 100);

    expect(result).toBeNull();
    expect(
      (client.pendingApprovals as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeGreaterThanOrEqual(1);
  });

  test("retries until found", async () => {
    const item = makePendingItem("intent-retry");
    let callCount = 0;
    const client = makeMockClient(async () => {
      callCount++;
      if (callCount < 2) return { pending: [] };
      return { pending: [item] };
    });

    const result = await pollForPendingApproval(
      client,
      "intent-retry",
      50,
      500,
    );

    expect(result).not.toBeNull();
    expect(result!.summary.intentId).toBe("intent-retry");
    expect(
      (client.pendingApprovals as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeGreaterThanOrEqual(2);
  });

  test("handles client errors gracefully", async () => {
    const item = makePendingItem("intent-err");
    let callCount = 0;
    const client = makeMockClient(async () => {
      callCount++;
      if (callCount === 1) throw new Error("connection refused");
      return { pending: [item] };
    });

    const result = await pollForPendingApproval(
      client,
      "intent-err",
      50,
      500,
    );

    expect(result).not.toBeNull();
    expect(result!.summary.intentId).toBe("intent-err");
    expect(
      (client.pendingApprovals as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeGreaterThanOrEqual(2);
  });

  test("matches by intentId, ignores others", async () => {
    const otherItem = makePendingItem("intent-other");
    const targetItem = makePendingItem("intent-target");
    let callCount = 0;
    const client = makeMockClient(async () => {
      callCount++;
      if (callCount === 1) return { pending: [otherItem] };
      return { pending: [otherItem, targetItem] };
    });

    const result = await pollForPendingApproval(
      client,
      "intent-target",
      50,
      500,
    );

    expect(result).not.toBeNull();
    expect(result!.summary.intentId).toBe("intent-target");
    expect(result!.requestId).toBe("req-intent-target");
  });
});
