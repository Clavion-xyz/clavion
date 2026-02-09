import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "@clavion/core";
import type { FastifyInstance } from "fastify";
import type { RpcClient, TransactionReceipt } from "@clavion/types/rpc";

const MOCK_RECEIPT: TransactionReceipt = {
  transactionHash: "0x" + "ab".repeat(32),
  status: "success",
  blockNumber: "12345678",
  blockHash: "0x" + "cd".repeat(32),
  gasUsed: "21000",
  effectiveGasPrice: "1000000000",
  from: "0x1234567890abcdef1234567890abcdef12345678",
  to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  contractAddress: null,
  logs: [],
};

function mockRpcClient(overrides?: Partial<RpcClient>): RpcClient {
  return {
    call: async () => ({ success: true, returnData: "0x" as `0x${string}` }),
    estimateGas: async () => 50_000n,
    readBalance: async () => 0n,
    readNativeBalance: async () => 0n,
    readAllowance: async () => 0n,
    getTransactionReceipt: async () => MOCK_RECEIPT,
    sendRawTransaction: async () => "0x" as `0x${string}`,
    getTransactionCount: async () => 0,
    estimateFeesPerGas: async () => ({ maxFeePerGas: 1_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n }),
    ...overrides,
  };
}

describe("GET /v1/tx/:hash — receipt lookup", () => {
  let app: FastifyInstance;
  let tempDir: string;

  describe("with RPC client", () => {
    beforeAll(async () => {
      tempDir = mkdtempSync(join(tmpdir(), "iscl-test-receipt-"));
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

    test("returns receipt for known tx hash", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/v1/tx/0x${"ab".repeat(32)}`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as TransactionReceipt;
      expect(body.status).toBe("success");
      expect(body.blockNumber).toBe("12345678");
      expect(body.gasUsed).toBe("21000");
    });

    test("returns 404 for unknown tx hash", async () => {
      const notFoundApp = await buildApp({
        logger: false,
        auditDbPath: ":memory:",
        keystorePath: tempDir,
        rpcClient: mockRpcClient({
          getTransactionReceipt: async () => null,
        }),
      });
      await notFoundApp.ready();

      const res = await notFoundApp.inject({
        method: "GET",
        url: `/v1/tx/0x${"00".repeat(32)}`,
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe("not_found");
      await notFoundApp.close();
    });

    test("rejects invalid tx hash format", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/v1/tx/not-a-hash",
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("without RPC client", () => {
    let noRpcApp: FastifyInstance;
    let noRpcDir: string;

    beforeAll(async () => {
      noRpcDir = mkdtempSync(join(tmpdir(), "iscl-test-receipt-norpc-"));
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
        url: `/v1/tx/0x${"ab".repeat(32)}`,
      });
      expect(res.statusCode).toBe(502);
      expect(res.json().error).toBe("no_rpc_client");
    });
  });
});
