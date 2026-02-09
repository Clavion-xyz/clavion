import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "@clavion/core";
import { validFixtures } from "../../tools/fixtures/index.js";
import type { FastifyInstance } from "fastify";
import type { PolicyConfig, TxIntent } from "@clavion/types";

function rateLimitConfig(maxTxPerHour: number): PolicyConfig {
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
    maxTxPerHour,
  };
}

/** Create a unique intent (new UUID) to avoid any caching artifacts. */
function uniqueIntent(base: TxIntent): TxIntent {
  return { ...base, id: crypto.randomUUID() };
}

describe("Rate limiting — integration", () => {
  let app: FastifyInstance;
  let tempKeystorePath: string;
  const LIMIT = 3;

  beforeAll(async () => {
    tempKeystorePath = mkdtempSync(join(tmpdir(), "iscl-rate-limit-"));
    app = await buildApp({
      logger: false,
      auditDbPath: ":memory:",
      keystorePath: tempKeystorePath,
      policyConfig: rateLimitConfig(LIMIT),
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    rmSync(tempKeystorePath, { recursive: true, force: true });
  });

  test("build endpoint: first N requests succeed, N+1th is rate-limited", async () => {
    // Send LIMIT requests — all should succeed
    for (let i = 0; i < LIMIT; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/v1/tx/build",
        payload: uniqueIntent(validFixtures.transfer),
      });
      expect(res.statusCode).toBe(200);
    }

    // N+1th request should be denied
    const res = await app.inject({
      method: "POST",
      url: "/v1/tx/build",
      payload: uniqueIntent(validFixtures.transfer),
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error).toBe("policy_denied");
    expect(body.reasons.some((r: string) => r.includes("Rate limit exceeded"))).toBe(true);
  });

  test("approve-request endpoint is also rate-limited", async () => {
    // Rate limit already exhausted from previous test (same wallet, same app)
    const res = await app.inject({
      method: "POST",
      url: "/v1/tx/approve-request",
      payload: uniqueIntent(validFixtures.transfer),
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error).toBe("policy_denied");
    expect(body.reasons.some((r: string) => r.includes("Rate limit"))).toBe(true);
  });

  test("rate limit is per-wallet (different wallet is not limited)", async () => {
    // Use a different wallet address — should not be rate-limited
    const intentWithDifferentWallet = {
      ...uniqueIntent(validFixtures.transfer),
      wallet: {
        ...validFixtures.transfer.wallet,
        address: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      },
    };
    const res = await app.inject({
      method: "POST",
      url: "/v1/tx/build",
      payload: intentWithDifferentWallet,
    });
    expect(res.statusCode).toBe(200);
  });

  test("denied requests (non-rate-limit) don't count toward rate limit", async () => {
    // Create a fresh app with limit of 2
    const tempKs2 = mkdtempSync(join(tmpdir(), "iscl-rate-limit-2-"));
    const app2 = await buildApp({
      logger: false,
      auditDbPath: ":memory:",
      keystorePath: tempKs2,
      policyConfig: rateLimitConfig(2),
    });
    await app2.ready();

    // Send a request that will be denied for chain reasons (not rate limit)
    const badChainIntent = {
      ...uniqueIntent(validFixtures.transfer),
      chain: { ...validFixtures.transfer.chain, chainId: 999 },
    };
    const deniedRes = await app2.inject({
      method: "POST",
      url: "/v1/tx/build",
      payload: badChainIntent,
    });
    expect(deniedRes.statusCode).toBe(403);

    // Now send 2 valid requests — both should succeed (denied request didn't count)
    for (let i = 0; i < 2; i++) {
      const res = await app2.inject({
        method: "POST",
        url: "/v1/tx/build",
        payload: uniqueIntent(validFixtures.transfer),
      });
      expect(res.statusCode).toBe(200);
    }

    // 3rd valid request should be rate-limited
    const res = await app2.inject({
      method: "POST",
      url: "/v1/tx/build",
      payload: uniqueIntent(validFixtures.transfer),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().reasons.some((r: string) => r.includes("Rate limit"))).toBe(true);

    await app2.close();
    rmSync(tempKs2, { recursive: true, force: true });
  });
});
