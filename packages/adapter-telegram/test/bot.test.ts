import { describe, test, expect, vi } from "vitest";
import { createBot } from "../src/bot.js";
import type { ISCLClient } from "../src/shared/iscl-client.js";
import type { TelegramAdapterConfig } from "../src/config.js";

/* ---------- mock deps ---------- */

const mockConfig: TelegramAdapterConfig = {
  botToken: "test:token",
  iscl: { baseUrl: "http://localhost:3100", timeoutMs: 5000 },
  allowedChatIds: new Set(),
  walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
  chainId: 8453,
  pollIntervalMs: 50,
  approvalTimeoutMs: 300000,
};

const mockClient = {
  health: vi.fn(),
  txBuild: vi.fn(),
  txPreflight: vi.fn(),
  txApproveRequest: vi.fn(),
  txSignAndSend: vi.fn(),
  balance: vi.fn(),
  txReceipt: vi.fn(),
  pendingApprovals: vi.fn(),
  submitDecision: vi.fn(),
} as unknown as ISCLClient;

/* ========================================================== */
/*  createBot                                                  */
/* ========================================================== */
describe("createBot", () => {
  test("createBot returns a Bot instance", () => {
    const bot = createBot({ client: mockClient, config: mockConfig });

    expect(bot).toBeDefined();
    expect(typeof bot.command).toBe("function");
  });

  test("bot has expected API property", () => {
    const bot = createBot({ client: mockClient, config: mockConfig });

    expect(bot.api).toBeDefined();
  });

  test("createBot does not throw with valid deps", () => {
    expect(() =>
      createBot({ client: mockClient, config: mockConfig }),
    ).not.toThrow();
  });
});
