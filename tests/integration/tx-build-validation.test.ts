import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "@clavion/core";
import { validFixtures, invalidFixtures } from "../../tools/fixtures/index.js";
import type { FastifyInstance } from "fastify";
import type { PolicyConfig } from "@clavion/types";

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

describe("POST /v1/tx/build — validation & policy", () => {
  let app: FastifyInstance;
  let tempKeystorePath: string;

  beforeAll(async () => {
    tempKeystorePath = mkdtempSync(join(tmpdir(), "iscl-test-ks-"));
    app = await buildApp({
      logger: false,
      auditDbPath: ":memory:",
      keystorePath: tempKeystorePath,
      policyConfig: permissiveConfig(),
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    rmSync(tempKeystorePath, { recursive: true, force: true });
  });

  test("valid intent returns 200 with BuildPlan", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tx/build",
      payload: validFixtures.transfer,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.intentId).toBe(validFixtures.transfer.id);
    expect(body.txRequestHash).toBeDefined();
    expect(body.description).toContain("Transfer");
    expect(body.txRequest).toBeDefined();
  });

  test("BuildPlan includes policyDecision", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tx/build",
      payload: validFixtures.transfer,
    });
    const body = res.json();
    expect(body.policyDecision).toBeDefined();
    expect(body.policyDecision.decision).toBe("allow");
    expect(body.policyDecision.policyVersion).toBe("1");
  });

  test("native transfer intent returns 200 with BuildPlan", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tx/build",
      payload: validFixtures.transferNative,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.intentId).toBe(validFixtures.transferNative.id);
    expect(body.txRequestHash).toBeDefined();
    expect(body.description).toContain("native ETH");
    expect(body.txRequest.data).toBe("0x");
    expect(body.txRequest.value).toBe("100000000000000000");
  });

  test("swap intent builds successfully", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tx/build",
      payload: validFixtures.swapExactIn,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.description).toContain("Uniswap V3");
  });

  test("malformed intent returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tx/build",
      payload: invalidFixtures.missingAction,
    });
    expect(res.statusCode).toBe(400);
  });

  test("intent with unknown fields returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tx/build",
      payload: invalidFixtures.unknownField,
    });
    expect(res.statusCode).toBe(400);
  });

  test("empty object returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tx/build",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /v1/tx/build — policy deny", () => {
  let app: FastifyInstance;
  let tempKeystorePath: string;

  beforeAll(async () => {
    tempKeystorePath = mkdtempSync(join(tmpdir(), "iscl-test-ks-deny-"));
    app = await buildApp({
      logger: false,
      auditDbPath: ":memory:",
      keystorePath: tempKeystorePath,
      policyConfig: {
        ...permissiveConfig(),
        allowedChains: [1], // Ethereum mainnet — fixture uses 8453 (Base)
      },
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    rmSync(tempKeystorePath, { recursive: true, force: true });
  });

  test("policy deny returns 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tx/build",
      payload: validFixtures.transfer,
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error).toBe("policy_denied");
    expect(body.reasons.length).toBeGreaterThan(0);
  });
});

describe("Other tx endpoints", () => {
  let app: FastifyInstance;
  let tempKeystorePath: string;

  beforeAll(async () => {
    tempKeystorePath = mkdtempSync(join(tmpdir(), "iscl-test-ks-other-"));
    app = await buildApp({
      logger: false,
      auditDbPath: ":memory:",
      keystorePath: tempKeystorePath,
      policyConfig: permissiveConfig(),
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    rmSync(tempKeystorePath, { recursive: true, force: true });
  });

  test("preflight without RPC returns 502", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tx/preflight",
      payload: validFixtures.transfer,
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toBe("no_rpc_client");
  });

  test("approve-request returns 200 with summary", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tx/approve-request",
      payload: validFixtures.transfer,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.intentId).toBe(validFixtures.transfer.id);
    expect(body.policyDecision).toBeDefined();
    expect(body.txRequestHash).toBeDefined();
  });

  test("sign-and-send without unlocked key returns 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tx/sign-and-send",
      payload: { intent: validFixtures.transfer },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("signing_failed");
  });

  test("GET /v1/tx/:hash returns 502 when no RPC client configured", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/tx/0x" + "a".repeat(64),
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toBe("no_rpc_client");
  });
});
