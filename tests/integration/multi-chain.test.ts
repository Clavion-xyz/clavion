import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp, RpcRouter } from "@clavion/core";
import type { PolicyConfig, TxIntent } from "@clavion/types";
import type { RpcClient } from "@clavion/types/rpc";
import { validFixtures, mockRpcClientWithSpies } from "../../tools/fixtures/index.js";

function multiChainConfig(): PolicyConfig {
  return {
    version: "1",
    maxValueWei: "1000000000000000000000",
    maxApprovalAmount: "1000000000000000000000",
    contractAllowlist: [],
    tokenAllowlist: [],
    allowedChains: [1, 10, 42161, 8453],
    recipientAllowlist: [],
    maxRiskScore: 70,
    requireApprovalAbove: { valueWei: "10000000000000000000" },
    maxTxPerHour: 100,
  };
}

/** Clone a fixture with a different chainId + fresh UUID */
function withChain(fixture: TxIntent, chainId: number): TxIntent {
  return {
    ...fixture,
    id: crypto.randomUUID(),
    chain: { ...fixture.chain, chainId },
  };
}

describe("Multi-chain integration", () => {
  let app: FastifyInstance;
  let baseUrl: string;
  let tempKeystorePath: string;
  let ethRpc: RpcClient;
  let baseRpc: RpcClient;

  beforeAll(async () => {
    ethRpc = mockRpcClientWithSpies();
    baseRpc = mockRpcClientWithSpies();
    const router = new RpcRouter(
      new Map([
        [1, ethRpc],
        [8453, baseRpc],
      ]),
    );

    tempKeystorePath = mkdtempSync(join(tmpdir(), "iscl-multichain-test-"));
    app = await buildApp({
      logger: false,
      auditDbPath: ":memory:",
      keystorePath: tempKeystorePath,
      policyConfig: multiChainConfig(),
      rpcClient: router,
    });
    await app.listen({ port: 0 });
    const addr = app.server.address();
    const port = typeof addr === "object" && addr ? addr.port : 3000;
    baseUrl = `http://127.0.0.1:${String(port)}`;
  });

  afterAll(async () => {
    await app.close();
    rmSync(tempKeystorePath, { recursive: true, force: true });
  });

  test("POST /v1/tx/build accepts intent for chain 1 (Ethereum)", async () => {
    const intent = withChain(validFixtures.transfer, 1);

    const res = await fetch(`${baseUrl}/v1/tx/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(intent),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { intentId: string };
    expect(body.intentId).toBe(intent.id);
  });

  test("POST /v1/tx/build accepts intent for chain 8453 (Base)", async () => {
    const intent = withChain(validFixtures.transfer, 8453);

    const res = await fetch(`${baseUrl}/v1/tx/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(intent),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { intentId: string };
    expect(body.intentId).toBe(intent.id);
  });

  test("POST /v1/tx/build denies intent for unconfigured chain 137 (Polygon)", async () => {
    const intent = withChain(validFixtures.transfer, 137);

    const res = await fetch(`${baseUrl}/v1/tx/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(intent),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("policy_denied");
  });

  test("POST /v1/tx/preflight routes to chain-specific RPC", async () => {
    const ethIntent = withChain(validFixtures.transfer, 1);

    const res = await fetch(`${baseUrl}/v1/tx/preflight`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ethIntent),
    });

    expect(res.status).toBe(200);
    // Ethereum RPC should have been called, not Base
    expect(ethRpc.call).toHaveBeenCalled();
  });

  test("POST /v1/tx/preflight routes Base intent to Base RPC", async () => {
    // Reset to track this test specifically
    (baseRpc.call as ReturnType<typeof vi.fn>).mockClear();

    const baseIntent = withChain(validFixtures.transfer, 8453);

    const res = await fetch(`${baseUrl}/v1/tx/preflight`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(baseIntent),
    });

    expect(res.status).toBe(200);
    expect(baseRpc.call).toHaveBeenCalled();
  });

  test("GET /v1/balance with chainId=1 routes to Ethereum RPC", async () => {
    (ethRpc.readBalance as ReturnType<typeof vi.fn>).mockClear();

    const res = await fetch(
      `${baseUrl}/v1/balance/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/0x1111111111111111111111111111111111111111?chainId=1`,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { chainId: number };
    expect(body.chainId).toBe(1);
    expect(ethRpc.readBalance).toHaveBeenCalled();
  });

  test("GET /v1/balance with chainId=8453 routes to Base RPC", async () => {
    (baseRpc.readBalance as ReturnType<typeof vi.fn>).mockClear();

    const res = await fetch(
      `${baseUrl}/v1/balance/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/0x1111111111111111111111111111111111111111?chainId=8453`,
    );

    expect(res.status).toBe(200);
    expect(baseRpc.readBalance).toHaveBeenCalled();
  });

  test("GET /v1/balance without chainId uses default chain RPC", async () => {
    // RpcRouter defaults to first configured chain (1 = Ethereum in this test)
    (ethRpc.readBalance as ReturnType<typeof vi.fn>).mockClear();

    const res = await fetch(
      `${baseUrl}/v1/balance/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/0x1111111111111111111111111111111111111111`,
    );

    expect(res.status).toBe(200);
  });

  test("GET /v1/balance returns 502 for unconfigured chain", async () => {
    const res = await fetch(
      `${baseUrl}/v1/balance/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/0x1111111111111111111111111111111111111111?chainId=42161`,
    );

    // Chain 42161 (Arbitrum) is in policy allowedChains but NOT in RpcRouter
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe("no_rpc_client");
    expect(body.message).toContain("chain 42161");
  });
});
