import { describe, test, expect } from "vitest";
import { parseRpcEnv } from "../src/rpc/parse-rpc-env.js";

describe("parseRpcEnv", () => {
  test("parses ISCL_RPC_URL_{chainId} variables", () => {
    const env = {
      ISCL_RPC_URL_1: "https://eth-rpc.example.com",
      ISCL_RPC_URL_8453: "https://base-rpc.example.com",
    };

    const urls = parseRpcEnv(env);
    expect(urls.size).toBe(2);
    expect(urls.get(1)).toBe("https://eth-rpc.example.com");
    expect(urls.get(8453)).toBe("https://base-rpc.example.com");
  });

  test("falls back to BASE_RPC_URL for chain 8453", () => {
    const env = { BASE_RPC_URL: "http://localhost:8545" };

    const urls = parseRpcEnv(env);
    expect(urls.size).toBe(1);
    expect(urls.get(8453)).toBe("http://localhost:8545");
  });

  test("ISCL_RPC_URL_8453 takes precedence over BASE_RPC_URL", () => {
    const env = {
      ISCL_RPC_URL_8453: "https://base-premium.example.com",
      BASE_RPC_URL: "http://localhost:8545",
    };

    const urls = parseRpcEnv(env);
    expect(urls.size).toBe(1);
    expect(urls.get(8453)).toBe("https://base-premium.example.com");
  });

  test("ignores non-matching env vars", () => {
    const env = {
      HOME: "/home/user",
      ISCL_PORT: "3100",
      ISCL_RPC_URL_EXTRA: "not-a-number",
      ISCL_RPC_URL_1: "https://eth-rpc.example.com",
    };

    const urls = parseRpcEnv(env);
    expect(urls.size).toBe(1);
    expect(urls.get(1)).toBe("https://eth-rpc.example.com");
  });

  test("returns empty map when no RPC URLs configured", () => {
    const env = { HOME: "/home/user", PATH: "/usr/bin" };

    const urls = parseRpcEnv(env);
    expect(urls.size).toBe(0);
  });

  test("skips empty string values", () => {
    const env = {
      ISCL_RPC_URL_1: "",
      ISCL_RPC_URL_8453: "https://base.example.com",
    };

    const urls = parseRpcEnv(env);
    expect(urls.size).toBe(1);
    expect(urls.has(1)).toBe(false);
    expect(urls.get(8453)).toBe("https://base.example.com");
  });

  test("parses all 4 target chains", () => {
    const env = {
      ISCL_RPC_URL_1: "https://eth.example.com",
      ISCL_RPC_URL_10: "https://optimism.example.com",
      ISCL_RPC_URL_42161: "https://arbitrum.example.com",
      ISCL_RPC_URL_8453: "https://base.example.com",
    };

    const urls = parseRpcEnv(env);
    expect(urls.size).toBe(4);
    expect(urls.get(1)).toBe("https://eth.example.com");
    expect(urls.get(10)).toBe("https://optimism.example.com");
    expect(urls.get(42161)).toBe("https://arbitrum.example.com");
    expect(urls.get(8453)).toBe("https://base.example.com");
  });
});
