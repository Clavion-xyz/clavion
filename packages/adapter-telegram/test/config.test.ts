import { describe, it, expect } from "vitest";

import { loadConfig } from "../src/config.js";

/* ---------- helpers ---------- */
const VALID_ENV: Record<string, string> = {
  TELEGRAM_BOT_TOKEN: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
  ISCL_WALLET_ADDRESS: "0x1234567890abcdef1234567890abcdef12345678",
};

describe("loadConfig", () => {
  it("returns a valid config when all required env vars are set", () => {
    const config = loadConfig({ ...VALID_ENV });

    expect(config.botToken).toBe(VALID_ENV["TELEGRAM_BOT_TOKEN"]);
    expect(config.walletAddress).toBe(VALID_ENV["ISCL_WALLET_ADDRESS"]);
    expect(config.iscl.baseUrl).toBe("http://127.0.0.1:3100");
    expect(config.chainId).toBe(8453);
    expect(config.allowedChatIds).toBeInstanceOf(Set);
  });

  it("throws when TELEGRAM_BOT_TOKEN is missing", () => {
    const env = { ...VALID_ENV };
    delete (env as Record<string, string | undefined>)["TELEGRAM_BOT_TOKEN"];

    expect(() => loadConfig(env)).toThrow("TELEGRAM_BOT_TOKEN");
  });

  it("throws when ISCL_WALLET_ADDRESS is missing", () => {
    const env = { ...VALID_ENV };
    delete (env as Record<string, string | undefined>)["ISCL_WALLET_ADDRESS"];

    expect(() => loadConfig(env)).toThrow("ISCL_WALLET_ADDRESS");
  });

  it("applies default values for ISCL_API_URL and chainId", () => {
    const config = loadConfig({ ...VALID_ENV });

    expect(config.iscl.baseUrl).toBe("http://127.0.0.1:3100");
    expect(config.chainId).toBe(8453);
  });

  it("overrides defaults when env vars are provided", () => {
    const config = loadConfig({
      ...VALID_ENV,
      ISCL_API_URL: "http://localhost:9999",
      ISCL_CHAIN_ID: "1",
    });

    expect(config.iscl.baseUrl).toBe("http://localhost:9999");
    expect(config.chainId).toBe(1);
  });

  it("parses comma-separated allowed chat IDs", () => {
    const config = loadConfig({
      ...VALID_ENV,
      ISCL_TELEGRAM_ALLOWED_CHATS: "111,222,333",
    });

    expect(config.allowedChatIds.size).toBe(3);
    expect(config.allowedChatIds.has(111)).toBe(true);
    expect(config.allowedChatIds.has(222)).toBe(true);
    expect(config.allowedChatIds.has(333)).toBe(true);
  });

  it("returns an empty Set when allowed chats string is empty", () => {
    const config = loadConfig({
      ...VALID_ENV,
      ISCL_TELEGRAM_ALLOWED_CHATS: "",
    });

    expect(config.allowedChatIds.size).toBe(0);
  });

  it("ignores non-numeric entries in allowed chats", () => {
    const config = loadConfig({
      ...VALID_ENV,
      ISCL_TELEGRAM_ALLOWED_CHATS: "111, abc, 333",
    });

    expect(config.allowedChatIds.size).toBe(2);
    expect(config.allowedChatIds.has(111)).toBe(true);
    expect(config.allowedChatIds.has(333)).toBe(true);
  });
});
