import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { AuditTraceService } from "@clavion/audit";

const WALLET_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const WALLET_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("AuditTraceService — rate limit methods", () => {
  let audit: AuditTraceService;

  beforeEach(() => {
    audit = new AuditTraceService(":memory:");
  });

  afterEach(() => {
    audit.close();
  });

  test("countRecentTxByWallet returns 0 when no ticks recorded", () => {
    expect(audit.countRecentTxByWallet(WALLET_A, 3_600_000)).toBe(0);
  });

  test("recordRateLimitTick inserts and countRecentTxByWallet counts it", () => {
    audit.recordRateLimitTick(WALLET_A);
    expect(audit.countRecentTxByWallet(WALLET_A, 3_600_000)).toBe(1);
  });

  test("multiple ticks are counted correctly", () => {
    audit.recordRateLimitTick(WALLET_A);
    audit.recordRateLimitTick(WALLET_A);
    audit.recordRateLimitTick(WALLET_A);
    expect(audit.countRecentTxByWallet(WALLET_A, 3_600_000)).toBe(3);
  });

  test("count is per-wallet (different wallets don't interfere)", () => {
    audit.recordRateLimitTick(WALLET_A);
    audit.recordRateLimitTick(WALLET_A);
    audit.recordRateLimitTick(WALLET_B);
    expect(audit.countRecentTxByWallet(WALLET_A, 3_600_000)).toBe(2);
    expect(audit.countRecentTxByWallet(WALLET_B, 3_600_000)).toBe(1);
  });

  test("only events within time window are counted", () => {
    // Record a tick, then advance time past the window
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    audit.recordRateLimitTick(WALLET_A);

    // Move time forward by 2 hours — tick should be outside 1-hour window
    vi.spyOn(Date, "now").mockReturnValue(now + 7_200_000);
    expect(audit.countRecentTxByWallet(WALLET_A, 3_600_000)).toBe(0);

    vi.restoreAllMocks();
  });

  test("window boundary: tick exactly at boundary is excluded", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    audit.recordRateLimitTick(WALLET_A);

    // Move forward by exactly the window size — tick timestamp == since, excluded by `> ?`
    vi.spyOn(Date, "now").mockReturnValue(now + 3_600_000);
    expect(audit.countRecentTxByWallet(WALLET_A, 3_600_000)).toBe(0);

    vi.restoreAllMocks();
  });
});
