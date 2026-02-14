import { describe, test, expect, afterEach, vi } from "vitest";
import { PendingApprovalStore } from "../src/approval/pending-approval-store.js";
import type { ApprovalSummary } from "@clavion/types";

function mockSummary(overrides?: Partial<ApprovalSummary>): ApprovalSummary {
  return {
    intentId: "intent-" + Math.random().toString(36).slice(2, 8),
    action: "transfer",
    expectedOutcome: "Transfer 100 USDC",
    balanceDiffs: [{ asset: "USDC", delta: "-100" }],
    riskScore: 10,
    riskReasons: [],
    warnings: [],
    gasEstimateEth: "0.001 ETH",
    txRequestHash: "0xabc123",
    ...overrides,
  };
}

describe("PendingApprovalStore", () => {
  let store: PendingApprovalStore;

  afterEach(() => {
    store?.close();
  });

  test("add() creates entry retrievable via get()", () => {
    store = new PendingApprovalStore();
    const summary = mockSummary();
    // Don't await — add() blocks until decided
    store.add(summary);

    const items = store.list();
    expect(items).toHaveLength(1);
    expect(items[0]!.summary.intentId).toBe(summary.intentId);

    const got = store.get(items[0]!.requestId);
    expect(got).toBeDefined();
    expect(got!.summary.action).toBe("transfer");
  });

  test("decide(requestId, true) resolves promise with true", async () => {
    store = new PendingApprovalStore();
    const summary = mockSummary();
    const promise = store.add(summary);

    const items = store.list();
    const decided = store.decide(items[0]!.requestId, true);
    expect(decided).toBe(true);

    const result = await promise;
    expect(result).toBe(true);
  });

  test("decide(requestId, false) resolves promise with false", async () => {
    store = new PendingApprovalStore();
    const summary = mockSummary();
    const promise = store.add(summary);

    const items = store.list();
    const decided = store.decide(items[0]!.requestId, false);
    expect(decided).toBe(true);

    const result = await promise;
    expect(result).toBe(false);
  });

  test("decide() returns false for unknown requestId", () => {
    store = new PendingApprovalStore();
    expect(store.decide("nonexistent", true)).toBe(false);
  });

  test("list() excludes expired entries", () => {
    store = new PendingApprovalStore(50); // 50ms TTL
    store.add(mockSummary());

    expect(store.list()).toHaveLength(1);

    // Wait for expiry
    vi.useFakeTimers();
    vi.advanceTimersByTime(100);

    expect(store.list()).toHaveLength(0);
    vi.useRealTimers();
  });

  test("get() returns undefined for expired entry", () => {
    store = new PendingApprovalStore(50);
    store.add(mockSummary());

    const items = store.list();
    const requestId = items[0]!.requestId;

    vi.useFakeTimers();
    vi.advanceTimersByTime(100);

    expect(store.get(requestId)).toBeUndefined();
    vi.useRealTimers();
  });

  test("decide() returns false for expired entry", () => {
    store = new PendingApprovalStore(50);
    store.add(mockSummary());

    const items = store.list();
    const requestId = items[0]!.requestId;

    vi.useFakeTimers();
    vi.advanceTimersByTime(100);

    expect(store.decide(requestId, true)).toBe(false);
    vi.useRealTimers();
  });

  test("multiple concurrent pending approvals work independently", async () => {
    store = new PendingApprovalStore();
    const p1 = store.add(mockSummary({ intentId: "intent-1" }));
    const p2 = store.add(mockSummary({ intentId: "intent-2" }));

    expect(store.list()).toHaveLength(2);

    const items = store.list();
    const id1 = items.find((i) => i.summary.intentId === "intent-1")!.requestId;
    const id2 = items.find((i) => i.summary.intentId === "intent-2")!.requestId;

    store.decide(id1, true);
    store.decide(id2, false);

    expect(await p1).toBe(true);
    expect(await p2).toBe(false);
    expect(store.list()).toHaveLength(0);
  });

  test("close() resolves all pending with false", async () => {
    store = new PendingApprovalStore();
    const p1 = store.add(mockSummary());
    const p2 = store.add(mockSummary());

    store.close();

    expect(await p1).toBe(false);
    expect(await p2).toBe(false);
  });
});
