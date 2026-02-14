import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp } from "@clavion/core";
import type { PolicyConfig } from "@clavion/types";
import { validFixtures, mockRpcClientWithSpies } from "../../tools/fixtures/index.js";

function approvalRequiredConfig(): PolicyConfig {
  return {
    version: "1",
    maxValueWei: "1000000000000000000000",
    maxApprovalAmount: "1000000000000000000000",
    contractAllowlist: [],
    tokenAllowlist: [],
    allowedChains: [1, 10, 42161, 8453],
    recipientAllowlist: [],
    maxRiskScore: 70,
    requireApprovalAbove: { valueWei: "0" },
    maxTxPerHour: 100,
  };
}

describe("Web Approval Flow", () => {
  let app: FastifyInstance;
  let baseUrl: string;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "iscl-web-approval-test-"));
    app = await buildApp({
      logger: false,
      auditDbPath: ":memory:",
      keystorePath: tempDir,
      policyConfig: approvalRequiredConfig(),
      rpcClient: mockRpcClientWithSpies(),
      approvalMode: "web",
    });
    await app.listen({ port: 0 });
    const addr = app.server.address();
    const port = typeof addr === "object" && addr ? addr.port : 3000;
    baseUrl = `http://127.0.0.1:${String(port)}`;
  });

  afterAll(async () => {
    await app.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("full approve flow: request → poll pending → decide approve → token issued", async () => {
    const intent = { ...validFixtures.transfer, id: crypto.randomUUID() };

    // Start the approve-request (will block until web UI decides)
    const approvePromise = fetch(`${baseUrl}/v1/tx/approve-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(intent),
    });

    // Wait for the request to reach the pending store
    await new Promise((r) => setTimeout(r, 100));

    // Poll pending
    const pendingRes = await fetch(`${baseUrl}/v1/approvals/pending`);
    expect(pendingRes.status).toBe(200);
    const pendingBody = (await pendingRes.json()) as { pending: Array<{ requestId: string; summary: { intentId: string } }> };
    expect(pendingBody.pending.length).toBeGreaterThanOrEqual(1);

    const requestId = pendingBody.pending[0]!.requestId;

    // Decide: approve
    const decideRes = await fetch(`${baseUrl}/v1/approvals/${requestId}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: true }),
    });
    expect(decideRes.status).toBe(200);

    // The original approve-request should now resolve
    const approveRes = await approvePromise;
    expect(approveRes.status).toBe(200);
    const body = (await approveRes.json()) as { approved: boolean; approvalTokenId?: string };
    expect(body.approved).toBe(true);
    expect(body.approvalTokenId).toBeDefined();
  });

  test("full deny flow: request → poll pending → decide deny → 403", async () => {
    const intent = { ...validFixtures.transfer, id: crypto.randomUUID() };

    const approvePromise = fetch(`${baseUrl}/v1/tx/approve-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(intent),
    });

    await new Promise((r) => setTimeout(r, 100));

    const pendingRes = await fetch(`${baseUrl}/v1/approvals/pending`);
    const pendingBody = (await pendingRes.json()) as { pending: Array<{ requestId: string }> };
    const requestId = pendingBody.pending[0]!.requestId;

    const decideRes = await fetch(`${baseUrl}/v1/approvals/${requestId}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: false }),
    });
    expect(decideRes.status).toBe(200);

    const approveRes = await approvePromise;
    expect(approveRes.status).toBe(403);
    const body = (await approveRes.json()) as { approved: boolean };
    expect(body.approved).toBe(false);
  });

  test("GET /approval-ui serves the web page", async () => {
    const res = await fetch(`${baseUrl}/approval-ui`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("ISCL Approval Dashboard");
    expect(html).toContain("Pending Approvals");
  });

  test("GET /v1/approvals/history returns audit events", async () => {
    const res = await fetch(`${baseUrl}/v1/approvals/history?limit=10`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: Array<{ event: string }> };
    expect(Array.isArray(body.events)).toBe(true);
    // Previous tests should have generated some events
    expect(body.events.length).toBeGreaterThan(0);
  });
});
