import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp } from "@clavion/core";

describe("Approval UI routes", () => {
  let app: FastifyInstance;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "iscl-approval-ui-test-"));
    app = await buildApp({
      logger: false,
      auditDbPath: ":memory:",
      keystorePath: tempDir,
      approvalMode: "web",
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("GET /v1/approvals/pending returns empty array initially", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/approvals/pending" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { pending: unknown[] };
    expect(body.pending).toEqual([]);
  });

  test("POST /v1/approvals/unknown/decide returns 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/approvals/00000000-0000-0000-0000-000000000000/decide",
      payload: { approved: true },
    });
    expect(res.statusCode).toBe(404);
    const body = res.json() as { error: string };
    expect(body.error).toBe("not_found");
  });

  test("GET /v1/approvals/history returns events array", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/approvals/history" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { events: unknown[] };
    expect(Array.isArray(body.events)).toBe(true);
  });

  test("GET /v1/approvals/history respects limit parameter", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/approvals/history?limit=5" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { events: unknown[] };
    expect(body.events.length).toBeLessThanOrEqual(5);
  });

  test("GET /approval-ui returns HTML", async () => {
    const res = await app.inject({ method: "GET", url: "/approval-ui" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body).toContain("ISCL Approval Dashboard");
  });

  test("approval UI routes not registered in cli mode", async () => {
    const cliDir = mkdtempSync(join(tmpdir(), "iscl-cli-mode-test-"));
    const cliApp = await buildApp({
      logger: false,
      auditDbPath: ":memory:",
      keystorePath: cliDir,
      approvalMode: "cli",
    });
    await cliApp.ready();

    const res = await cliApp.inject({ method: "GET", url: "/approval-ui" });
    expect(res.statusCode).toBe(404);

    await cliApp.close();
    rmSync(cliDir, { recursive: true, force: true });
  });
});
