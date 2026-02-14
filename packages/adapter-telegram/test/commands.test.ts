import { describe, it, expect } from "vitest";

import { parseTransferCommand } from "../src/commands/transfer.js";
import { parseSendCommand } from "../src/commands/send.js";
import { parseSwapCommand } from "../src/commands/swap.js";
import { parseApproveCommand } from "../src/commands/approve-token.js";
import { parseBalanceCommand } from "../src/commands/balance.js";
import { parseStatusCommand } from "../src/commands/status.js";

/* ---------- helpers ---------- */
const ADDR_A = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const ADDR_B = "0x1234567890abcdef1234567890abcdef12345678";
const ADDR_C = "0xaabbccddee11223344556677889900aabbccddee";
const TX_HASH =
  "0x" + "ab".repeat(32); // 0xabab...ab  (64 hex chars)

/* ========================================================== */
/*  parseTransferCommand                                      */
/* ========================================================== */
describe("parseTransferCommand", () => {
  it("parses a valid /transfer command", () => {
    const result = parseTransferCommand(
      `/transfer 1000000 ${ADDR_A} to ${ADDR_B}`,
    );
    expect(result).toEqual({
      amount: "1000000",
      tokenAddress: ADDR_A,
      recipient: ADDR_B,
    });
  });

  it("is case-insensitive for the TO keyword", () => {
    const result = parseTransferCommand(
      `/transfer 500 ${ADDR_A} TO ${ADDR_B}`,
    );
    expect(result).not.toBeNull();
    expect(result!.recipient).toBe(ADDR_B);
  });

  it("returns null for missing recipient", () => {
    expect(parseTransferCommand(`/transfer 1000000 ${ADDR_A}`)).toBeNull();
  });

  it("returns null for an address that is too short", () => {
    expect(
      parseTransferCommand(`/transfer 1000000 0x1234 to ${ADDR_B}`),
    ).toBeNull();
  });
});

/* ========================================================== */
/*  parseSendCommand                                          */
/* ========================================================== */
describe("parseSendCommand", () => {
  it("parses a valid /send command", () => {
    const result = parseSendCommand(
      `/send 1000000000000000000 to ${ADDR_B}`,
    );
    expect(result).toEqual({
      amount: "1000000000000000000",
      recipient: ADDR_B,
    });
  });

  it("is case-insensitive for the TO keyword", () => {
    const result = parseSendCommand(`/send 100 To ${ADDR_B}`);
    expect(result).not.toBeNull();
    expect(result!.amount).toBe("100");
  });

  it("returns null when 'to' keyword is missing", () => {
    expect(parseSendCommand(`/send 100 ${ADDR_B}`)).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseSendCommand("")).toBeNull();
  });
});

/* ========================================================== */
/*  parseSwapCommand                                          */
/* ========================================================== */
describe("parseSwapCommand", () => {
  it("parses a basic /swap command (no optional fields)", () => {
    const result = parseSwapCommand(
      `/swap 1000000 ${ADDR_A} for ${ADDR_B}`,
    );
    expect(result).toEqual({
      amountIn: "1000000",
      tokenIn: ADDR_A,
      tokenOut: ADDR_B,
      minAmountOut: "0",
      router: undefined,
    });
  });

  it("parses /swap with optional min amount", () => {
    const result = parseSwapCommand(
      `/swap 1000000 ${ADDR_A} for ${ADDR_B} min 990000`,
    );
    expect(result).not.toBeNull();
    expect(result!.minAmountOut).toBe("990000");
    expect(result!.router).toBeUndefined();
  });

  it("parses /swap with both min and router", () => {
    const result = parseSwapCommand(
      `/swap 1000000 ${ADDR_A} for ${ADDR_B} min 990000 router ${ADDR_C}`,
    );
    expect(result).not.toBeNull();
    expect(result!.minAmountOut).toBe("990000");
    expect(result!.router).toBe(ADDR_C);
  });

  it("returns null for invalid input (missing 'for' keyword)", () => {
    expect(
      parseSwapCommand(`/swap 1000000 ${ADDR_A} ${ADDR_B}`),
    ).toBeNull();
  });
});

/* ========================================================== */
/*  parseApproveCommand                                       */
/* ========================================================== */
describe("parseApproveCommand", () => {
  it("parses a valid /approve command", () => {
    const result = parseApproveCommand(
      `/approve 1000000 ${ADDR_A} for ${ADDR_B}`,
    );
    expect(result).toEqual({
      amount: "1000000",
      tokenAddress: ADDR_A,
      spender: ADDR_B,
    });
  });

  it("is case-insensitive for the FOR keyword", () => {
    const result = parseApproveCommand(
      `/approve 500 ${ADDR_A} FOR ${ADDR_B}`,
    );
    expect(result).not.toBeNull();
    expect(result!.spender).toBe(ADDR_B);
  });

  it("returns null when 'for' keyword is missing", () => {
    expect(
      parseApproveCommand(`/approve 1000000 ${ADDR_A} ${ADDR_B}`),
    ).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseApproveCommand("")).toBeNull();
  });
});

/* ========================================================== */
/*  parseBalanceCommand                                       */
/* ========================================================== */
describe("parseBalanceCommand", () => {
  it("parses a valid /balance command", () => {
    const result = parseBalanceCommand(`/balance ${ADDR_A} ${ADDR_B}`);
    expect(result).toEqual({
      token: ADDR_A,
      account: ADDR_B,
    });
  });

  it("returns null when account address is missing", () => {
    expect(parseBalanceCommand(`/balance ${ADDR_A}`)).toBeNull();
  });

  it("returns null for non-hex address", () => {
    expect(parseBalanceCommand("/balance notanaddress 0x1234")).toBeNull();
  });
});

/* ========================================================== */
/*  parseStatusCommand                                        */
/* ========================================================== */
describe("parseStatusCommand", () => {
  it("parses a valid /status command with 64-char tx hash", () => {
    const result = parseStatusCommand(`/status ${TX_HASH}`);
    expect(result).toEqual({ txHash: TX_HASH });
  });

  it("returns the full hash including 0x prefix", () => {
    const result = parseStatusCommand(`/status ${TX_HASH}`);
    expect(result).not.toBeNull();
    expect(result!.txHash).toBe(TX_HASH);
    expect(result!.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it("returns null for a hash that is too short", () => {
    expect(parseStatusCommand("/status 0xabcdef")).toBeNull();
  });

  it("returns null for missing hash", () => {
    expect(parseStatusCommand("/status")).toBeNull();
  });
});
