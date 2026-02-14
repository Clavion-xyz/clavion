import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { ISCLClient, ISCLError } from "../src/shared/iscl-client.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("ISCLClient", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    test("uses default base URL and timeout", () => {
      const client = new ISCLClient();
      // Verify defaults by calling health which should hit the default URL
      mockFetch.mockResolvedValueOnce(
        jsonResponse(200, { status: "ok", version: "0.1.0", uptime: 42 }),
      );
      void client.health();
      expect(mockFetch).toHaveBeenCalledWith(
        "http://127.0.0.1:3100/v1/health",
        expect.objectContaining({ method: "GET" }),
      );
    });

    test("accepts custom base URL", () => {
      const client = new ISCLClient({ baseUrl: "http://localhost:9999" });
      mockFetch.mockResolvedValueOnce(
        jsonResponse(200, { status: "ok", version: "0.1.0", uptime: 42 }),
      );
      void client.health();
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:9999/v1/health",
        expect.anything(),
      );
    });
  });

  describe("health()", () => {
    test("returns health response on 200", async () => {
      const body = { status: "ok", version: "0.1.0", uptime: 42 };
      mockFetch.mockResolvedValueOnce(jsonResponse(200, body));
      const client = new ISCLClient();
      const result = await client.health();
      expect(result).toEqual(body);
    });

    test("throws ISCLError on non-200", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(500, { error: "internal" }),
      );
      const client = new ISCLClient();
      await expect(client.health()).rejects.toThrow(ISCLError);
      try {
        mockFetch.mockResolvedValueOnce(
          jsonResponse(500, { error: "internal" }),
        );
        await client.health();
      } catch (err) {
        expect(err).toBeInstanceOf(ISCLError);
        expect((err as ISCLError).status).toBe(500);
      }
    });
  });

  describe("txApproveRequest()", () => {
    test("posts intent and returns approval response", async () => {
      const intent = { version: "1", id: "test" };
      const response = {
        intentId: "test",
        approved: true,
        approvalTokenId: "tok-1",
        policyDecision: { decision: "require_approval", reasons: [], policyVersion: "1" },
        riskScore: 10,
        riskReasons: [],
        warnings: [],
        txRequestHash: "0xhash",
        description: "Transfer",
        gasEstimate: "21000",
        balanceDiffs: [],
        approvalRequired: true,
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(200, response));
      const client = new ISCLClient();
      const result = await client.txApproveRequest(intent);
      expect(result.approved).toBe(true);
      expect(result.approvalTokenId).toBe("tok-1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://127.0.0.1:3100/v1/tx/approve-request",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(intent),
        }),
      );
    });

    test("throws on 403 policy deny", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(403, { error: "policy_denied" }),
      );
      const client = new ISCLClient();
      await expect(client.txApproveRequest({})).rejects.toThrow(ISCLError);
    });
  });

  describe("txSignAndSend()", () => {
    test("posts payload and returns sign response", async () => {
      const response = {
        signedTx: "0xsigned",
        txHash: "0xtxhash",
        intentId: "test-id",
        broadcast: true,
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(200, response));
      const client = new ISCLClient();
      const result = await client.txSignAndSend({
        intent: { id: "test-id" },
        approvalTokenId: "tok-1",
      });
      expect(result.txHash).toBe("0xtxhash");
      expect(result.broadcast).toBe(true);
    });
  });

  describe("balance()", () => {
    test("fetches balance for token/account", async () => {
      const response = {
        token: "0xUSDC",
        account: "0xAlice",
        balance: "1000000",
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(200, response));
      const client = new ISCLClient();
      const result = await client.balance("0xUSDC", "0xAlice");
      expect(result.balance).toBe("1000000");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://127.0.0.1:3100/v1/balance/0xUSDC/0xAlice",
        expect.objectContaining({ method: "GET" }),
      );
    });

    test("throws ISCLError on 502", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(502, { error: "no_rpc" }),
      );
      const client = new ISCLClient();
      await expect(client.balance("0xUSDC", "0xAlice")).rejects.toThrow(
        ISCLError,
      );
    });
  });
});
