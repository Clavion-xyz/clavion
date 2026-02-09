import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../core/api/app.js";
import { ISCLClient, ISCLError } from "../../adapter/shared/iscl-client.js";
import { validFixtures } from "../../spec/fixtures/index.js";
import type { PolicyConfig } from "../../core/types.js";

function permissiveConfig(): PolicyConfig {
  return {
    version: "1",
    maxValueWei: "1000000000000000000000",
    maxApprovalAmount: "1000000000000000000000",
    contractAllowlist: ["0x2626664c2603336E57B271c5C0b26F421741e481"],
    tokenAllowlist: [
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "0x4200000000000000000000000000000000000006",
    ],
    allowedChains: [8453],
    recipientAllowlist: [],
    maxRiskScore: 70,
    requireApprovalAbove: { valueWei: "10000000000000000000" },
    maxTxPerHour: 100,
  };
}

describe("ISCLClient — integration with real Fastify app", () => {
  let app: FastifyInstance;
  let client: ISCLClient;
  let tempKeystorePath: string;

  beforeAll(async () => {
    tempKeystorePath = mkdtempSync(join(tmpdir(), "iscl-adapter-test-"));
    app = await buildApp({
      logger: false,
      auditDbPath: ":memory:",
      keystorePath: tempKeystorePath,
      policyConfig: permissiveConfig(),
    });
    await app.listen({ port: 0 });
    const addr = app.server.address();
    const port = typeof addr === "object" && addr ? addr.port : 3000;
    client = new ISCLClient({ baseUrl: `http://127.0.0.1:${String(port)}` });
  });

  afterAll(async () => {
    await app.close();
    rmSync(tempKeystorePath, { recursive: true, force: true });
  });

  test("health() returns status ok and version", async () => {
    const result = await client.health();
    expect(result.status).toBe("ok");
    expect(result.version).toBe("0.1.0");
    expect(result.uptime).toBeGreaterThan(0);
  });

  test("txBuild() with valid transfer intent returns BuildResponse", async () => {
    const result = await client.txBuild(validFixtures.transfer);
    expect(result.intentId).toBe(validFixtures.transfer.id);
    expect(result.txRequestHash).toBeDefined();
    expect(result.description).toContain("Transfer");
    expect(result.txRequest).toBeDefined();
    expect(result.policyDecision.decision).toBe("allow");
  });

  test("txBuild() with valid swap intent returns BuildResponse", async () => {
    const result = await client.txBuild(validFixtures.swapExactIn);
    expect(result.intentId).toBe(validFixtures.swapExactIn.id);
    expect(result.description).toContain("Uniswap V3");
  });

  test("txBuild() with invalid intent throws ISCLError (400)", async () => {
    try {
      await client.txBuild({ bad: "data" });
      expect.fail("Expected ISCLError to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ISCLError);
      expect((err as ISCLError).status).toBe(400);
    }
  });

  test("txBuild() policy deny throws ISCLError (403)", async () => {
    // Use chainId 1 (Ethereum mainnet) — policy only allows 8453 (Base)
    const deniedIntent = {
      ...validFixtures.transfer,
      id: "550e8400-e29b-41d4-a716-446655440099",
      chain: { type: "evm", chainId: 1 },
    };

    try {
      await client.txBuild(deniedIntent);
      expect.fail("Expected ISCLError to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ISCLError);
      expect((err as ISCLError).status).toBe(403);
      const body = (err as ISCLError).body as Record<string, unknown>;
      expect(body.error).toBe("policy_denied");
    }
  });

  test("txApproveRequest() returns approval summary", async () => {
    const result = await client.txApproveRequest(validFixtures.transfer);
    expect(result.intentId).toBe(validFixtures.transfer.id);
    expect(result.txRequestHash).toBeDefined();
    expect(result.policyDecision).toBeDefined();
  });

  test("txSignAndSend() without unlocked key throws ISCLError (403)", async () => {
    try {
      await client.txSignAndSend({ intent: validFixtures.transfer });
      expect.fail("Expected ISCLError to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ISCLError);
      expect((err as ISCLError).status).toBe(403);
      const body = (err as ISCLError).body as Record<string, unknown>;
      expect(body.error).toBe("signing_failed");
    }
  });

  test("txPreflight() without RPC throws ISCLError (502)", async () => {
    try {
      await client.txPreflight(validFixtures.transfer);
      expect.fail("Expected ISCLError to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ISCLError);
      expect((err as ISCLError).status).toBe(502);
      const body = (err as ISCLError).body as Record<string, unknown>;
      expect(body.error).toBe("no_rpc_client");
    }
  });

  test("ISCLError body contains error field", async () => {
    try {
      await client.txBuild({});
      expect.fail("Expected ISCLError");
    } catch (err) {
      expect(err).toBeInstanceOf(ISCLError);
      expect((err as ISCLError).body).toBeDefined();
    }
  });

  test("multiple sequential calls work", async () => {
    const health1 = await client.health();
    const health2 = await client.health();
    expect(health1.status).toBe("ok");
    expect(health2.status).toBe("ok");

    const build = await client.txBuild(validFixtures.transfer);
    expect(build.intentId).toBe(validFixtures.transfer.id);
  });
});
