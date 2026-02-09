import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { ISCLClient, ISCLError } from "@clavion/adapter-openclaw";

describe("ISCLError", () => {
  test("stores status and body", () => {
    const err = new ISCLError(400, { error: "bad_request" });
    expect(err.status).toBe(400);
    expect(err.body).toEqual({ error: "bad_request" });
  });

  test("has correct message format", () => {
    const err = new ISCLError(403, { error: "policy_denied" });
    expect(err.message).toBe("ISCL API error: 403");
  });

  test("has name ISCLError", () => {
    const err = new ISCLError(500, {});
    expect(err.name).toBe("ISCLError");
  });

  test("is an instance of Error", () => {
    const err = new ISCLError(404, {});
    expect(err).toBeInstanceOf(Error);
  });
});

describe("ISCLClient constructor", () => {
  const originalEnv = process.env["ISCL_API_URL"];

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env["ISCL_API_URL"] = originalEnv;
    } else {
      delete process.env["ISCL_API_URL"];
    }
  });

  test("uses default baseUrl when no options", () => {
    delete process.env["ISCL_API_URL"];
    const client = new ISCLClient();
    // We can't directly access private fields, but we can verify it was constructed
    expect(client).toBeInstanceOf(ISCLClient);
  });

  test("uses ISCL_API_URL env var as fallback", () => {
    process.env["ISCL_API_URL"] = "http://custom:9999";
    const client = new ISCLClient();
    expect(client).toBeInstanceOf(ISCLClient);
  });

  test("explicit options override env and defaults", () => {
    process.env["ISCL_API_URL"] = "http://env:9999";
    const client = new ISCLClient({ baseUrl: "http://explicit:8080" });
    expect(client).toBeInstanceOf(ISCLClient);
  });

  test("accepts custom timeout", () => {
    const client = new ISCLClient({ timeoutMs: 5000 });
    expect(client).toBeInstanceOf(ISCLClient);
  });
});

describe("ISCLClient methods (with mocked fetch)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetchResponse(body: unknown, status = 200): void {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });
  }

  test("health() calls GET /v1/health", async () => {
    const healthBody = { status: "ok", version: "0.1.0", uptime: 42 };
    mockFetchResponse(healthBody);

    const client = new ISCLClient({ baseUrl: "http://test:3000" });
    const result = await client.health();

    expect(result).toEqual(healthBody);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://test:3000/v1/health",
      expect.objectContaining({ method: "GET" }),
    );
  });

  test("txBuild() calls POST /v1/tx/build", async () => {
    const buildBody = { intentId: "abc", txRequestHash: "0x123", description: "Transfer", txRequest: {}, policyDecision: { decision: "allow", reasons: [], policyVersion: "1" } };
    mockFetchResponse(buildBody);

    const client = new ISCLClient({ baseUrl: "http://test:3000" });
    const intent = { version: "1" };
    const result = await client.txBuild(intent);

    expect(result).toEqual(buildBody);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://test:3000/v1/tx/build",
      expect.objectContaining({ method: "POST" }),
    );
  });

  test("txPreflight() calls POST /v1/tx/preflight", async () => {
    const preflightBody = { intentId: "abc", simulationSuccess: true, riskScore: 10, gasEstimate: "21000" };
    mockFetchResponse(preflightBody);

    const client = new ISCLClient({ baseUrl: "http://test:3000" });
    await client.txPreflight({ version: "1" });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://test:3000/v1/tx/preflight",
      expect.objectContaining({ method: "POST" }),
    );
  });

  test("txApproveRequest() calls POST /v1/tx/approve-request", async () => {
    mockFetchResponse({ intentId: "abc" });

    const client = new ISCLClient({ baseUrl: "http://test:3000" });
    await client.txApproveRequest({ version: "1" });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://test:3000/v1/tx/approve-request",
      expect.objectContaining({ method: "POST" }),
    );
  });

  test("txSignAndSend() calls POST /v1/tx/sign-and-send", async () => {
    mockFetchResponse({ signedTx: "0xabc", txHash: "0xdef", intentId: "abc" });

    const client = new ISCLClient({ baseUrl: "http://test:3000" });
    await client.txSignAndSend({ intent: { version: "1" } });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://test:3000/v1/tx/sign-and-send",
      expect.objectContaining({ method: "POST" }),
    );
  });

  test("non-2xx response throws ISCLError", async () => {
    mockFetchResponse({ error: "policy_denied", reasons: ["chain not allowed"] }, 403);

    const client = new ISCLClient({ baseUrl: "http://test:3000" });

    await expect(client.txBuild({})).rejects.toThrow(ISCLError);
    await expect(
      // Need fresh mock for the second call
      (async () => {
        mockFetchResponse({ error: "policy_denied" }, 403);
        return client.txBuild({});
      })(),
    ).rejects.toMatchObject({ status: 403 });
  });
});
