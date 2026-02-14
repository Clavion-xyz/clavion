import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { walletProvider } from "../src/provider.js";
import { ClavionService } from "../src/service.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function mockRuntime(settings: Record<string, string | undefined> = {}, service?: ClavionService | null) {
  return {
    getSetting: vi.fn((key: string) => settings[key] ?? undefined),
    getService: vi.fn((_type: string) => service ?? undefined),
  } as any;  // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe("walletProvider", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("has name 'clavionWallet'", () => {
    expect(walletProvider.name).toBe("clavionWallet");
  });

  test("has position -1 (early in chain)", () => {
    expect(walletProvider.position).toBe(-1);
  });

  test("returns 'not configured' when ISCL_WALLET_ADDRESS missing", async () => {
    const runtime = mockRuntime({});
    const result = await walletProvider.get(runtime, {} as any, {} as any);

    expect(result.text).toContain("not configured");
    expect(result.values?.clavionConfigured).toBe(false);
  });

  test("returns 'service not available' when service missing", async () => {
    const runtime = mockRuntime({ ISCL_WALLET_ADDRESS: "0xAlice" }, null);
    const result = await walletProvider.get(runtime, {} as any, {} as any);

    expect(result.text).toContain("0xAlice");
    expect(result.text).toContain("service not available");
    expect(result.values?.clavionConfigured).toBe(false);
  });

  test("returns connected status when health succeeds", async () => {
    // Create a service with working client
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, { status: "ok", version: "0.1.0", uptime: 42 }),
    );
    const svcRuntime = mockRuntime({});
    const service = (await ClavionService.start(svcRuntime)) as ClavionService;

    // Now health will be called by the provider
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, { status: "ok", version: "0.5.0", uptime: 100 }),
    );

    const runtime = mockRuntime({ ISCL_WALLET_ADDRESS: "0xBob" }, service);
    const result = await walletProvider.get(runtime, {} as any, {} as any);

    expect(result.text).toContain("0xBob");
    expect(result.text).toContain("connected");
    expect(result.text).toContain("v0.5.0");
    expect(result.values?.clavionConfigured).toBe(true);
    expect(result.values?.coreVersion).toBe("0.5.0");
  });

  test("returns 'disconnected' when health fails", async () => {
    // Create a service
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, { status: "ok", version: "0.1.0", uptime: 42 }),
    );
    const svcRuntime = mockRuntime({});
    const service = (await ClavionService.start(svcRuntime)) as ClavionService;

    // Now health call fails
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const runtime = mockRuntime({ ISCL_WALLET_ADDRESS: "0xCarol" }, service);
    const result = await walletProvider.get(runtime, {} as any, {} as any);

    expect(result.text).toContain("disconnected");
    expect(result.values?.clavionConfigured).toBe(false);
  });
});
