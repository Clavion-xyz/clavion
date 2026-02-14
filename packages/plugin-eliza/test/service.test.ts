import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { ClavionService } from "../src/service.js";

// Mock global fetch for ISCLClient's health check
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function mockRuntime(settings: Record<string, string | undefined> = {}) {
  return {
    getSetting: vi.fn((key: string) => settings[key] ?? undefined),
  } as any;  // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe("ClavionService", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("serviceType is 'clavion'", () => {
    expect(ClavionService.serviceType).toBe("clavion");
  });

  test("start() creates service with client from ISCL_API_URL", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, { status: "ok", version: "0.1.0", uptime: 42 }),
    );

    const runtime = mockRuntime({ ISCL_API_URL: "http://localhost:9999" });
    const service = await ClavionService.start(runtime);

    expect(service).toBeInstanceOf(ClavionService);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:9999/v1/health",
      expect.anything(),
    );
  });

  test("start() uses default URL when ISCL_API_URL not set", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, { status: "ok", version: "0.1.0", uptime: 42 }),
    );

    const runtime = mockRuntime({});
    await ClavionService.start(runtime);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://127.0.0.1:3100/v1/health",
      expect.anything(),
    );
  });

  test("start() does not throw when health check fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const runtime = mockRuntime({});
    const service = await ClavionService.start(runtime);

    expect(service).toBeInstanceOf(ClavionService);
  });

  test("getClient() returns client after start()", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, { status: "ok", version: "0.1.0", uptime: 42 }),
    );

    const runtime = mockRuntime({});
    const service = (await ClavionService.start(runtime)) as ClavionService;
    const client = service.getClient();

    expect(client).toBeDefined();
  });

  test("stop() clears client", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, { status: "ok", version: "0.1.0", uptime: 42 }),
    );

    const runtime = mockRuntime({});
    const service = (await ClavionService.start(runtime)) as ClavionService;
    await service.stop();

    expect(() => service.getClient()).toThrow("ClavionService not initialized");
  });

  test("getClient() throws before start()", () => {
    const runtime = mockRuntime({});
    const service = new ClavionService(runtime);

    expect(() => service.getClient()).toThrow("ClavionService not initialized");
  });
});
