import { describe, test, expect } from "vitest";
import {
  formatApprovalCard,
  formatSuccessMessage,
  formatDeniedMessage,
  formatErrorMessage,
  formatBalanceMessage,
  formatHelp,
} from "../src/approval/formatters.js";
import type {
  PendingApprovalItem,
  BalanceResponse,
} from "../src/shared/iscl-client.js";

function makePendingItem(
  overrides?: Partial<PendingApprovalItem["summary"]>,
): PendingApprovalItem {
  return {
    requestId: "req-001",
    summary: {
      intentId: "intent-001",
      action: "transfer",
      expectedOutcome: "Send 100 USDC to 0xAlice",
      balanceDiffs: [],
      riskScore: 25,
      riskReasons: [],
      warnings: [],
      gasEstimateEth: "0.002",
      ...overrides,
    },
    createdAt: Date.now(),
    expiresAt: Date.now() + 120_000,
  };
}

describe("formatApprovalCard", () => {
  test("includes action and expected outcome", () => {
    const item = makePendingItem({
      action: "transfer",
      expectedOutcome: "Send 100 USDC to 0xAlice",
    });

    const output = formatApprovalCard(item);

    expect(output).toContain("transfer");
    expect(output).toContain("Send 100 USDC to 0xAlice");
  });

  test("includes risk score with green emoji for low risk", () => {
    const item = makePendingItem({ riskScore: 25 });

    const output = formatApprovalCard(item);

    expect(output).toContain("25/100");
    // Green circle U+1F7E2
    expect(output).toContain("\u{1F7E2}");
  });

  test("includes risk score with red emoji for high risk", () => {
    const item = makePendingItem({ riskScore: 75 });

    const output = formatApprovalCard(item);

    expect(output).toContain("75/100");
    // Red circle U+1F534
    expect(output).toContain("\u{1F534}");
  });

  test("includes balance diffs", () => {
    const item = makePendingItem({
      balanceDiffs: [{ asset: "USDC", delta: "-100" }],
    });

    const output = formatApprovalCard(item);

    expect(output).toContain("-100");
    expect(output).toContain("USDC");
  });

  test("includes warnings with warning emoji", () => {
    const item = makePendingItem({
      warnings: ["Unverified contract interaction"],
    });

    const output = formatApprovalCard(item);

    expect(output).toContain("Unverified contract interaction");
    // Warning sign U+26A0 + variation selector U+FE0F
    expect(output).toContain("\u{26A0}\u{FE0F}");
  });
});

describe("formatSuccessMessage", () => {
  test("includes tx hash", () => {
    const output = formatSuccessMessage({
      intentId: "intent-001",
      txHash: "0xdeadbeef1234567890",
      broadcast: true,
    });

    expect(output).toContain("0xdeadbeef1234567890");
    expect(output).toContain("Transaction Sent");
  });
});

describe("formatDeniedMessage", () => {
  test("returns denied text", () => {
    const output = formatDeniedMessage();

    expect(output.toLowerCase()).toContain("denied");
  });
});

describe("formatErrorMessage", () => {
  test("handles string error", () => {
    const output = formatErrorMessage("insufficient balance");

    expect(output).toContain("insufficient balance");
    expect(output).toContain("Error");
  });

  test("handles Error object", () => {
    const output = formatErrorMessage(new Error("test failure"));

    expect(output).toContain("test failure");
    expect(output).toContain("Error");
  });
});

describe("formatBalanceMessage", () => {
  test("includes token, account, and balance", () => {
    const resp: BalanceResponse = {
      token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      account: "0x1234567890abcdef1234567890abcdef12345678",
      balance: "1000000",
    };

    const output = formatBalanceMessage(resp);

    expect(output).toContain("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
    expect(output).toContain("0x1234567890abcdef1234567890abcdef12345678");
    expect(output).toContain("1000000");
  });
});

describe("formatHelp", () => {
  test("includes commands", () => {
    const output = formatHelp();

    expect(output).toContain("/transfer");
    expect(output).toContain("/send");
    expect(output).toContain("/swap");
    expect(output).toContain("/approve");
    expect(output).toContain("/balance");
    expect(output).toContain("/status");
    expect(output).toContain("/help");
  });
});
