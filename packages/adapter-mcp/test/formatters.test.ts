import { describe, test, expect } from "vitest";
import { formatPipelineResult, formatError } from "../src/formatters.js";
import type { PipelineResult } from "../src/tools/pipeline.js";

describe("formatPipelineResult", () => {
  test("formats successful result", () => {
    const result: PipelineResult = {
      success: true,
      intentId: "abc-123",
      approved: true,
      approvalDetails: {
        riskScore: 15,
        riskReasons: [],
        warnings: [],
        gasEstimate: "21000",
        description: "Transfer 1 USDC → 0xAlice",
        policyDecision: "allow",
        policyReasons: [],
      },
      signResult: {
        txHash: "0xtxhash",
        signedTx: "0xsigned",
        broadcast: true,
      },
    };

    const formatted = formatPipelineResult(result, "ERC-20 Transfer");

    expect(formatted.isError).toBeUndefined();
    expect(formatted.content).toHaveLength(1);
    const text = formatted.content[0]!.text;
    expect(text).toContain("ERC-20 Transfer — SUCCESS");
    expect(text).toContain("abc-123");
    expect(text).toContain("Risk score: 15/100");
    expect(text).toContain("Transaction hash: 0xtxhash");
    expect(text).toContain("Broadcast: yes");
  });

  test("formats declined result with isError", () => {
    const result: PipelineResult = {
      success: false,
      intentId: "abc-123",
      approved: false,
      declineReason: "user_declined",
      approvalDetails: {
        riskScore: 55,
        riskReasons: ["high_value_transfer"],
        warnings: ["large_amount"],
        gasEstimate: "100000",
        description: "Transfer 5000 USDC",
        policyDecision: "require_approval",
        policyReasons: [],
      },
    };

    const formatted = formatPipelineResult(result, "ERC-20 Transfer");

    expect(formatted.isError).toBe(true);
    const text = formatted.content[0]!.text;
    expect(text).toContain("DECLINED");
    expect(text).toContain("user_declined");
    expect(text).toContain("Risk score: 55/100");
    expect(text).toContain("Risk factors: high_value_transfer");
    expect(text).toContain("Warnings: large_amount");
  });

  test("includes policy reasons when denied", () => {
    const result: PipelineResult = {
      success: false,
      intentId: "abc-123",
      approved: false,
      declineReason: "policy_denied",
      approvalDetails: {
        riskScore: 0,
        riskReasons: [],
        warnings: [],
        gasEstimate: "0",
        description: "",
        policyDecision: "deny",
        policyReasons: ["exceeds_max_value", "recipient_not_allowed"],
      },
    };

    const formatted = formatPipelineResult(result, "Transfer");

    const text = formatted.content[0]!.text;
    expect(text).toContain("Policy decision: deny");
    expect(text).toContain("exceeds_max_value, recipient_not_allowed");
  });

  test("shows sign-only mode when not broadcast", () => {
    const result: PipelineResult = {
      success: true,
      intentId: "abc-123",
      approved: true,
      signResult: {
        txHash: "0xhash",
        signedTx: "0xsigned",
        broadcast: false,
      },
    };

    const formatted = formatPipelineResult(result, "Transfer");

    const text = formatted.content[0]!.text;
    expect(text).toContain("sign-only mode");
  });

  test("shows broadcast error when present", () => {
    const result: PipelineResult = {
      success: true,
      intentId: "abc-123",
      approved: true,
      signResult: {
        txHash: "0xhash",
        signedTx: "0xsigned",
        broadcast: false,
        broadcastError: "nonce too low",
      },
    };

    const formatted = formatPipelineResult(result, "Transfer");

    const text = formatted.content[0]!.text;
    expect(text).toContain("Broadcast error: nonce too low");
  });

  test("all content items have type text", () => {
    const result: PipelineResult = {
      success: true,
      intentId: "x",
      approved: true,
      signResult: { txHash: "0x", signedTx: "0x", broadcast: true },
    };

    const formatted = formatPipelineResult(result, "Test");
    for (const item of formatted.content) {
      expect(item.type).toBe("text");
    }
  });
});

describe("formatError", () => {
  test("formats Error instance", () => {
    const result = formatError(new Error("connection refused"));
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe("Error: connection refused");
  });

  test("formats string error", () => {
    const result = formatError("something went wrong");
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe("Error: something went wrong");
  });

  test("formats non-Error objects", () => {
    const result = formatError(42);
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe("Error: 42");
  });
});
