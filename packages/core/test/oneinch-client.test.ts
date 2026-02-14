import { describe, test, expect, vi, afterEach } from "vitest";
import { OneInchClient, OneInchApiError } from "@clavion/core";

const MOCK_API_KEY = "test-api-key";

function createClient(overrides?: { baseUrl?: string; timeoutMs?: number }) {
  return new OneInchClient({
    apiKey: MOCK_API_KEY,
    baseUrl: overrides?.baseUrl ?? "https://api.1inch.dev",
    timeoutMs: overrides?.timeoutMs ?? 10_000,
  });
}

describe("OneInchClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test("getSwap constructs correct URL with query params", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      capturedUrl = typeof input === "string" ? input : input.toString();
      capturedInit = init;
      return new Response(
        JSON.stringify({
          tx: { from: "0xaaa", to: "0xbbb", data: "0x1234", value: "0", gas: 200000, gasPrice: "1000000000" },
          toAmount: "500",
          fromAmount: "1000",
          protocols: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const client = createClient();
    await client.getSwap(8453, {
      src: "0xTokenIn",
      dst: "0xTokenOut",
      amount: "1000000",
      from: "0xWallet",
      slippage: "1",
      disableEstimate: true,
    });

    expect(capturedUrl).toContain("/swap/v6.0/8453/swap");
    expect(capturedUrl).toContain("src=0xTokenIn");
    expect(capturedUrl).toContain("dst=0xTokenOut");
    expect(capturedUrl).toContain("amount=1000000");
    expect(capturedUrl).toContain("from=0xWallet");
    expect(capturedUrl).toContain("slippage=1");
    expect(capturedUrl).toContain("disableEstimate=true");
    expect(capturedInit?.headers).toEqual(
      expect.objectContaining({ Authorization: `Bearer ${MOCK_API_KEY}` }),
    );
  });

  test("getSwap returns parsed response on success", async () => {
    const mockResponse = {
      tx: { from: "0xaaa", to: "0xbbb", data: "0x1234", value: "0", gas: 200000, gasPrice: "1000000000" },
      toAmount: "500",
      fromAmount: "1000",
      protocols: [],
    };

    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    const client = createClient();
    const result = await client.getSwap(8453, {
      src: "0xTokenIn",
      dst: "0xTokenOut",
      amount: "1000",
      from: "0xWallet",
      slippage: "1",
    });

    expect(result.tx.to).toBe("0xbbb");
    expect(result.tx.data).toBe("0x1234");
    expect(result.toAmount).toBe("500");
  });

  test("getSwap throws OneInchApiError on non-2xx response", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("Rate limited", { status: 429 }),
    ) as typeof fetch;

    const client = createClient();
    await expect(
      client.getSwap(8453, {
        src: "0xTokenIn",
        dst: "0xTokenOut",
        amount: "1000",
        from: "0xWallet",
        slippage: "1",
      }),
    ).rejects.toThrow(OneInchApiError);
  });

  test("getSwap throws for unsupported chain", async () => {
    const client = createClient();
    await expect(
      client.getSwap(999, {
        src: "0xTokenIn",
        dst: "0xTokenOut",
        amount: "1000",
        from: "0xWallet",
        slippage: "1",
      }),
    ).rejects.toThrow("Chain 999 is not supported by 1inch");
  });

  test("getQuote constructs correct URL", async () => {
    let capturedUrl = "";

    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      capturedUrl = typeof input === "string" ? input : input.toString();
      return new Response(
        JSON.stringify({ toAmount: "500", fromAmount: "1000", gas: 100000, protocols: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const client = createClient();
    await client.getQuote(1, {
      src: "0xTokenIn",
      dst: "0xTokenOut",
      amount: "1000000",
    });

    expect(capturedUrl).toContain("/swap/v6.0/1/quote");
    expect(capturedUrl).toContain("src=0xTokenIn");
    expect(capturedUrl).toContain("dst=0xTokenOut");
    expect(capturedUrl).toContain("amount=1000000");
  });

  test("getSwap does not include disableEstimate when false/undefined", async () => {
    let capturedUrl = "";

    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      capturedUrl = typeof input === "string" ? input : input.toString();
      return new Response(
        JSON.stringify({
          tx: { from: "0xaaa", to: "0xbbb", data: "0x1234", value: "0", gas: 200000, gasPrice: "1000000000" },
          toAmount: "500",
          fromAmount: "1000",
          protocols: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const client = createClient();
    await client.getSwap(8453, {
      src: "0xTokenIn",
      dst: "0xTokenOut",
      amount: "1000",
      from: "0xWallet",
      slippage: "1",
    });

    expect(capturedUrl).not.toContain("disableEstimate");
  });

  test("API key is not exposed in error messages", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("Unauthorized", { status: 401 }),
    ) as typeof fetch;

    const client = createClient();
    try {
      await client.getSwap(8453, {
        src: "0xTokenIn",
        dst: "0xTokenOut",
        amount: "1000",
        from: "0xWallet",
        slippage: "1",
      });
    } catch (err) {
      expect((err as Error).message).not.toContain(MOCK_API_KEY);
    }
  });

  test("supports all 4 chains", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          tx: { from: "0xaaa", to: "0xbbb", data: "0x1234", value: "0", gas: 200000, gasPrice: "1000000000" },
          toAmount: "500",
          fromAmount: "1000",
          protocols: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as typeof fetch;

    const client = createClient();
    const params = {
      src: "0xTokenIn",
      dst: "0xTokenOut",
      amount: "1000",
      from: "0xWallet",
      slippage: "1",
    };

    for (const chainId of [1, 10, 42161, 8453]) {
      await expect(client.getSwap(chainId, params)).resolves.toBeDefined();
    }
  });
});
