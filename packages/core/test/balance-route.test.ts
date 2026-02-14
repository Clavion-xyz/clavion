import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "@clavion/core";
import { mockRpcClient as baseMockRpc } from "../../../tools/fixtures/index.js";
import type { FastifyInstance } from "fastify";
import type { RpcClient } from "@clavion/types/rpc";

function mockRpcClient(overrides?: Partial<RpcClient>): RpcClient {
  return baseMockRpc({ readBalance: async () => 1_000_000n, ...overrides });
}

describe("GET /v1/balance/:token/:account", () => {
  let app: FastifyInstance;
  let tempDir: string;

  describe("with RPC client", () => {
    beforeAll(async () => {
      tempDir = mkdtempSync(join(tmpdir(), "iscl-test-balance-"));
      app = await buildApp({
        logger: false,
        auditDbPath: ":memory:",
        keystorePath: tempDir,
        rpcClient: mockRpcClient(),
      });
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
      rmSync(tempDir, { recursive: true, force: true });
    });

    test("returns balance for valid token and account", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/v1/balance/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/0x1234567890abcdef1234567890abcdef12345678",
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { token: string; account: string; balance: string };
      expect(body.token).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
      expect(body.account).toBe("0x1234567890abcdef1234567890abcdef12345678");
      expect(body.balance).toBe("1000000");
    });

    test("rejects invalid token address", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/v1/balance/not-an-address/0x1234567890abcdef1234567890abcdef12345678",
      });
      expect(res.statusCode).toBe(400);
    });

    test("rejects invalid account address", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/v1/balance/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/xyz",
      });
      expect(res.statusCode).toBe(400);
    });

    test("returns RPC error on failure", async () => {
      const failApp = await buildApp({
        logger: false,
        auditDbPath: ":memory:",
        keystorePath: tempDir,
        rpcClient: mockRpcClient({
          readBalance: async () => {
            throw new Error("connection refused");
          },
        }),
      });
      await failApp.ready();

      const res = await failApp.inject({
        method: "GET",
        url: "/v1/balance/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/0x1234567890abcdef1234567890abcdef12345678",
      });
      expect(res.statusCode).toBe(502);
      expect(res.json().error).toBe("rpc_error");
      await failApp.close();
    });
  });

  describe("without RPC client", () => {
    let noRpcApp: FastifyInstance;
    let noRpcDir: string;

    beforeAll(async () => {
      noRpcDir = mkdtempSync(join(tmpdir(), "iscl-test-balance-norpc-"));
      noRpcApp = await buildApp({
        logger: false,
        auditDbPath: ":memory:",
        keystorePath: noRpcDir,
      });
      await noRpcApp.ready();
    });

    afterAll(async () => {
      await noRpcApp.close();
      rmSync(noRpcDir, { recursive: true, force: true });
    });

    test("returns 502 when no RPC client configured", async () => {
      const res = await noRpcApp.inject({
        method: "GET",
        url: "/v1/balance/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/0x1234567890abcdef1234567890abcdef12345678",
      });
      expect(res.statusCode).toBe(502);
      expect(res.json().error).toBe("no_rpc_client");
    });
  });
});
