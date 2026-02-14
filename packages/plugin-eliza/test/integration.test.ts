/**
 * Integration tests: Boot a real ElizaOS AgentRuntime with clavionPlugin
 *
 * These tests verify that:
 * 1. Plugin can be registered with a real AgentRuntime
 * 2. ClavionService starts and is accessible via getService()
 * 3. Actions are registered and callable through the runtime
 * 4. Provider returns wallet info through the runtime
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { clavionPlugin } from "../src/index.js";
import { ClavionService } from "../src/service.js";

// @elizaos/core has broken Node16 module resolution — declare module so
// test compiles under the root tsconfig (Node16). At runtime vitest uses
// the plugin-eliza tsconfig (Bundler) which resolves it correctly.
declare module "@elizaos/core" {
  type UUID = `${string}-${string}-${string}-${string}-${string}`;
  interface IDatabaseAdapter { db?: unknown; }
  class AgentRuntime {
    constructor(opts: any);
    plugins: any[];
    actions: { name: string; validate: (...args: any[]) => Promise<boolean>; handler: (...args: any[]) => Promise<any> }[];
    providers: { name: string }[];
    services: Map<string, any>;
    initialize(opts?: { skipMigrations?: boolean }): Promise<void>;
    stop(): Promise<void>;
    getService<T>(name: string): T | null;
    getServiceLoadPromise(name: any): Promise<any>;
    getSetting(key: string): string | boolean | number | null;
    generateText: any;
  }
  class Service {
    constructor(runtime?: any);
    static serviceType: string;
    static start(runtime: any): Promise<Service>;
    capabilityDescription: string;
    stop(): Promise<void>;
  }
  interface Plugin { name: string; description?: string; services?: any[]; providers?: any[]; actions?: any[]; }
  interface IAgentRuntime { getSetting(key: string): any; }
}
import { AgentRuntime } from "@elizaos/core";
import type { IDatabaseAdapter, UUID } from "@elizaos/core";

// Mock fetch for ISCLClient health checks
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

/**
 * Minimal mock database adapter using Proxy.
 * Returns sensible defaults for all IDatabaseAdapter methods
 * so AgentRuntime can initialize without a real database.
 */
function createMockAdapter(): IDatabaseAdapter {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "db") return {};
      if (prop === "then") return undefined; // Not thenable

      // Return async no-op functions that return sensible defaults
      return (...args: unknown[]) => {
        const name = String(prop);

        // --- Specific methods first (before generic prefix matching) ---

        // Agent lifecycle: createAgent must return truthy for runtime init
        if (name === "getAgent") return Promise.resolve(null);
        if (name === "createAgent") return Promise.resolve(args[0] ?? true);

        // Entity lifecycle: createEntities must return truthy
        if (name === "createEntities") return Promise.resolve(true);
        // Room lifecycle: createRooms must return an array of created rooms
        if (name === "createRooms") return Promise.resolve(args[0] ?? [{ id: "mock-room" }]);

        // World/Room: return null (runtime creates if needed)
        if (name === "getWorld") return Promise.resolve(null);
        if (name === "getRoom") return Promise.resolve(null);

        // Participant: return empty (runtime adds agent)
        if (name === "getParticipantsForRoom") return Promise.resolve([]);
        if (name === "addParticipant" || name === "addParticipantsRoom") return Promise.resolve(true);

        if (name === "isReady") return Promise.resolve(true);
        if (name === "getConnection") return Promise.resolve({});
        if (name === "getMemoryById") return Promise.resolve(null);
        if (name === "getEntity") return Promise.resolve(null);
        if (name === "getParticipantUserState") return Promise.resolve(null);

        // --- Generic prefix matching ---

        // Boolean queries
        if (name.startsWith("is") || name.startsWith("has") || name === "removeParticipant") {
          return Promise.resolve(false);
        }
        // Count queries
        if (name.startsWith("count") || name === "getMemoryCount") {
          return Promise.resolve(0);
        }
        // Array queries
        if (
          name.startsWith("get") ||
          name.startsWith("search") ||
          name.startsWith("list") ||
          name.startsWith("find")
        ) {
          return Promise.resolve([]);
        }
        // Mutating operations: return truthy so callers don't fail
        if (
          name.startsWith("create") ||
          name.startsWith("update") ||
          name.startsWith("delete") ||
          name.startsWith("remove") ||
          name.startsWith("add") ||
          name.startsWith("set") ||
          name.startsWith("ensure") ||
          name === "init" ||
          name === "initialize" ||
          name === "close" ||
          name === "runPluginMigrations" ||
          name === "recordLog"
        ) {
          return Promise.resolve(true);
        }

        // Default: resolve with undefined
        return Promise.resolve(undefined);
      };
    },
  };

  return new Proxy({}, handler) as unknown as IDatabaseAdapter;
}

/**
 * Helper: create runtime, initialize, and wait for ClavionService to register.
 * Service registration is async (fire-and-forget in ElizaOS), so we must
 * await `getServiceLoadPromise("clavion")` after initialize().
 */
async function initRuntimeWithPlugin(
  settings: Record<string, string> = {},
): Promise<AgentRuntime> {
  const runtime = new AgentRuntime({
    character: { name: "TestAgent", bio: "Test" } as any,
    plugins: [clavionPlugin],
    adapter: createMockAdapter(),
    settings: settings as any,
  });

  await runtime.initialize({ skipMigrations: true });

  // Wait for ClavionService to finish async registration
  try {
    await runtime.getServiceLoadPromise("clavion" as any);
  } catch {
    // Service may have failed to register (e.g., fetch errors) — that's ok for some tests
  }

  return runtime;
}

describe("ElizaOS Runtime Integration", () => {
  let runtime: AgentRuntime;

  beforeEach(() => {
    mockFetch.mockReset();
    // Health check during ClavionService.start()
    mockFetch.mockResolvedValue(
      jsonResponse(200, { status: "ok", version: "0.1.0", uptime: 42 }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Plugin registration", () => {
    test("AgentRuntime can be constructed with clavionPlugin", () => {
      runtime = new AgentRuntime({
        character: { name: "TestAgent", bio: "Test agent for Clavion" } as any,
        plugins: [clavionPlugin],
        adapter: createMockAdapter(),
        settings: {
          ISCL_API_URL: "http://127.0.0.1:3100",
          ISCL_WALLET_ADDRESS: "0x1111111111111111111111111111111111111111",
        } as any,
      });

      expect(runtime).toBeDefined();
      expect(runtime.plugins).toBeDefined();
    });

    test("runtime.initialize() completes with plugin", async () => {
      runtime = new AgentRuntime({
        character: { name: "TestAgent", bio: "Test" } as any,
        plugins: [clavionPlugin],
        adapter: createMockAdapter(),
        settings: {
          ISCL_API_URL: "http://127.0.0.1:3100",
          ISCL_WALLET_ADDRESS: "0xAlice",
        } as any,
      });

      // Initialize should not throw
      await runtime.initialize({ skipMigrations: true });
    });

    test("all 5 actions are registered", async () => {
      runtime = new AgentRuntime({
        character: { name: "TestAgent", bio: "Test" } as any,
        plugins: [clavionPlugin],
        adapter: createMockAdapter(),
        settings: {
          ISCL_API_URL: "http://127.0.0.1:3100",
          ISCL_WALLET_ADDRESS: "0xAlice",
        } as any,
      });

      await runtime.initialize({ skipMigrations: true });

      const actionNames = runtime.actions.map((a) => a.name);
      expect(actionNames).toContain("CLAVION_TRANSFER");
      expect(actionNames).toContain("CLAVION_TRANSFER_NATIVE");
      expect(actionNames).toContain("CLAVION_APPROVE");
      expect(actionNames).toContain("CLAVION_SWAP");
      expect(actionNames).toContain("CLAVION_CHECK_BALANCE");
    });

    test("walletProvider is registered", async () => {
      runtime = new AgentRuntime({
        character: { name: "TestAgent", bio: "Test" } as any,
        plugins: [clavionPlugin],
        adapter: createMockAdapter(),
        settings: {
          ISCL_API_URL: "http://127.0.0.1:3100",
          ISCL_WALLET_ADDRESS: "0xAlice",
        } as any,
      });

      await runtime.initialize({ skipMigrations: true });

      const providerNames = runtime.providers.map((p) => p.name);
      expect(providerNames).toContain("clavionWallet");
    });
  });

  describe("ClavionService lifecycle", () => {
    test("ClavionService is accessible via getService()", async () => {
      runtime = await initRuntimeWithPlugin({
        ISCL_API_URL: "http://127.0.0.1:3100",
        ISCL_WALLET_ADDRESS: "0xAlice",
      });

      const service = runtime.getService<ClavionService>("clavion");
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(ClavionService);
    });

    test("ClavionService client is functional after init", async () => {
      runtime = await initRuntimeWithPlugin({
        ISCL_API_URL: "http://localhost:9999",
        ISCL_WALLET_ADDRESS: "0xAlice",
      });

      const service = runtime.getService<ClavionService>("clavion");
      expect(service).not.toBeNull();
      const client = service!.getClient();
      expect(client).toBeDefined();
    });

    test("service starts even when ISCL Core is not running", async () => {
      mockFetch.mockReset();
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      runtime = await initRuntimeWithPlugin({
        ISCL_API_URL: "http://127.0.0.1:3100",
        ISCL_WALLET_ADDRESS: "0xAlice",
      });

      const service = runtime.getService<ClavionService>("clavion");
      expect(service).toBeDefined();
    });
  });

  describe("Action invocation through runtime", () => {
    test("action validate() works through runtime context", async () => {
      runtime = new AgentRuntime({
        character: { name: "TestAgent", bio: "Test" } as any,
        plugins: [clavionPlugin],
        adapter: createMockAdapter(),
        settings: {
          ISCL_API_URL: "http://127.0.0.1:3100",
          ISCL_WALLET_ADDRESS: "0xAlice",
        } as any,
      });

      await runtime.initialize({ skipMigrations: true });

      const transferAction = runtime.actions.find((a) => a.name === "CLAVION_TRANSFER");
      expect(transferAction).toBeDefined();

      // Validate should return true since both settings are configured
      const message = {
        content: { text: "send tokens" },
        entityId: "00000000-0000-0000-0000-000000000001" as UUID,
      } as any;

      const valid = await transferAction!.validate(runtime, message);
      expect(valid).toBe(true);
    });

    test("action validate() returns false without settings", async () => {
      runtime = new AgentRuntime({
        character: { name: "TestAgent", bio: "Test" } as any,
        plugins: [clavionPlugin],
        adapter: createMockAdapter(),
        // No ISCL settings
      });

      await runtime.initialize({ skipMigrations: true });

      const transferAction = runtime.actions.find((a) => a.name === "CLAVION_TRANSFER");
      const message = { content: { text: "send tokens" } } as any;

      const valid = await transferAction!.validate(runtime, message);
      expect(valid).toBe(false);
    });

    test("action handler executes full pipeline through runtime", async () => {
      // First: init with health check
      runtime = await initRuntimeWithPlugin({
        ISCL_API_URL: "http://127.0.0.1:3100",
        ISCL_WALLET_ADDRESS: "0xAlice",
      });

      // Now set up mocked ISCL responses for the pipeline
      mockFetch.mockReset();
      mockFetch
        // approve-request
        .mockResolvedValueOnce(jsonResponse(200, {
          intentId: "int-rt-1",
          txRequestHash: "0xhash",
          description: "Transfer via runtime",
          policyDecision: { decision: "require_approval", reasons: [], policyVersion: "1" },
          riskScore: 10,
          riskReasons: [],
          warnings: [],
          gasEstimate: "21000",
          balanceDiffs: [],
          approvalRequired: true,
          approved: true,
          approvalTokenId: "tok-rt-1",
        }))
        // sign-and-send
        .mockResolvedValueOnce(jsonResponse(200, {
          signedTx: "0xsigned",
          txHash: "0xruntimetx",
          intentId: "int-rt-1",
          broadcast: true,
        }));

      const transferAction = runtime.actions.find((a) => a.name === "CLAVION_TRANSFER");
      expect(transferAction).toBeDefined();

      // Mock the LLM response
      runtime.generateText = vi.fn().mockResolvedValue({
        text: '```json\n{"tokenAddress": "0xUSDC", "recipient": "0xBob", "amount": "1000000"}\n```',
      });

      const callback = vi.fn();
      const message = {
        content: { text: "send 1M USDC to 0xBob" },
        entityId: "00000000-0000-0000-0000-000000000001" as UUID,
      } as any;

      const result = await transferAction!.handler(
        runtime, message, undefined, undefined, callback,
      );

      expect(result).toEqual(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ txHash: "0xruntimetx", broadcast: true }),
      }));
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining("successful") }),
      );
    });

    test("balance check through runtime", async () => {
      runtime = await initRuntimeWithPlugin({
        ISCL_API_URL: "http://127.0.0.1:3100",
        ISCL_WALLET_ADDRESS: "0xAlice",
      });

      // Set up balance response
      mockFetch.mockReset();
      mockFetch.mockResolvedValueOnce(jsonResponse(200, {
        token: "0xUSDC",
        account: "0xAlice",
        balance: "5000000",
      }));

      const balanceAction = runtime.actions.find((a) => a.name === "CLAVION_CHECK_BALANCE");
      expect(balanceAction).toBeDefined();

      runtime.generateText = vi.fn().mockResolvedValue({
        text: '```json\n{"tokenAddress": "0xUSDC"}\n```',
      });

      const callback = vi.fn();
      const message = {
        content: { text: "check my USDC balance" },
        entityId: "00000000-0000-0000-0000-000000000001" as UUID,
      } as any;

      const result = await balanceAction!.handler(
        runtime, message, undefined, undefined, callback,
      );

      expect(result).toEqual(expect.objectContaining({
        success: true,
        data: { token: "0xUSDC", account: "0xAlice", balance: "5000000" },
      }));
    });
  });

  describe("Runtime stop/cleanup", () => {
    test("runtime.stop() cleans up ClavionService", async () => {
      runtime = await initRuntimeWithPlugin({
        ISCL_API_URL: "http://127.0.0.1:3100",
        ISCL_WALLET_ADDRESS: "0xAlice",
      });

      const service = runtime.getService<ClavionService>("clavion");
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(ClavionService);

      // Verify client works before stop
      expect(service!.getClient()).toBeDefined();

      // Stop runtime — this should call service.stop()
      await runtime.stop();

      // After stop, getClient should throw
      expect(() => service!.getClient()).toThrow("ClavionService not initialized");
    });
  });
});
