import type {
  OneInchSwapParams,
  OneInchSwapResponse,
  OneInchQuoteParams,
  OneInchQuoteResponse,
} from "./oneinch-types.js";
import { ONEINCH_SUPPORTED_CHAINS } from "./oneinch-routers.js";

export interface OneInchClientOptions {
  apiKey: string;
  /** Base URL for the 1inch API. Default: "https://api.1inch.dev" */
  baseUrl?: string;
  /** Request timeout in milliseconds. Default: 10000 */
  timeoutMs?: number;
}

export class OneInchClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: OneInchClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.1inch.dev";
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async getSwap(
    chainId: number,
    params: OneInchSwapParams,
  ): Promise<OneInchSwapResponse> {
    this.assertSupportedChain(chainId);

    const url = new URL(`/swap/v6.0/${chainId}/swap`, this.baseUrl);
    url.searchParams.set("src", params.src);
    url.searchParams.set("dst", params.dst);
    url.searchParams.set("amount", params.amount);
    url.searchParams.set("from", params.from);
    url.searchParams.set("slippage", params.slippage);
    if (params.disableEstimate) {
      url.searchParams.set("disableEstimate", "true");
    }
    if (params.allowPartialFill !== undefined) {
      url.searchParams.set("allowPartialFill", String(params.allowPartialFill));
    }

    return this.request<OneInchSwapResponse>(url);
  }

  async getQuote(
    chainId: number,
    params: OneInchQuoteParams,
  ): Promise<OneInchQuoteResponse> {
    this.assertSupportedChain(chainId);

    const url = new URL(`/swap/v6.0/${chainId}/quote`, this.baseUrl);
    url.searchParams.set("src", params.src);
    url.searchParams.set("dst", params.dst);
    url.searchParams.set("amount", params.amount);

    return this.request<OneInchQuoteResponse>(url);
  }

  private assertSupportedChain(chainId: number): void {
    if (!ONEINCH_SUPPORTED_CHAINS.has(chainId)) {
      throw new OneInchApiError(
        0,
        `Chain ${chainId} is not supported by 1inch`,
      );
    }
  }

  private async request<T>(url: URL): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new OneInchApiError(response.status, body);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}

export class OneInchApiError extends Error {
  public readonly statusCode: number;
  public readonly responseBody: string;

  constructor(statusCode: number, responseBody: string) {
    super(`1inch API error ${statusCode}: ${responseBody}`);
    this.name = "OneInchApiError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}
