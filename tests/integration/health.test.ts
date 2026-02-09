import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "@clavion/core";
import type { FastifyInstance } from "fastify";

describe("GET /v1/health", () => {
  let app: FastifyInstance;
  let tempKeystorePath: string;

  beforeAll(async () => {
    tempKeystorePath = mkdtempSync(join(tmpdir(), "iscl-test-ks-"));
    app = await buildApp({ logger: false, auditDbPath: ":memory:", keystorePath: tempKeystorePath });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    rmSync(tempKeystorePath, { recursive: true, force: true });
  });

  test("returns 200 with status and version", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/health",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    expect(body.version).toBe("0.1.0");
    expect(body).toHaveProperty("uptime");
  });

  test("includes X-ISCL-Version header", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/health",
    });
    expect(res.headers["x-iscl-version"]).toBe("0.1.0");
  });
});
