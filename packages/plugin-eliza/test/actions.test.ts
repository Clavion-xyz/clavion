import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { transferAction } from "../src/actions/transfer.js";
import { transferNativeAction } from "../src/actions/transfer-native.js";
import { approveAction } from "../src/actions/approve.js";
import { swapAction } from "../src/actions/swap.js";
import { balanceAction } from "../src/actions/balance.js";
import { ClavionService } from "../src/service.js";
import { ISCLClient } from "../src/shared/iscl-client.js";

// Mock fetch for ISCLClient + ClavionService
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function mockRuntime(
  settings: Record<string, string | undefined> = {},
  service?: ClavionService | null,
  generateTextResult?: string,
) {
  return {
    getSetting: vi.fn((key: string) => settings[key] ?? undefined),
    getService: vi.fn((_type: string) => service ?? undefined),
    generateText: vi.fn().mockResolvedValue(generateTextResult ?? ""),
  } as any;  // eslint-disable-line @typescript-eslint/no-explicit-any
}

function mockMessage(text: string) {
  return { content: { text } } as any;  // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** Create a ClavionService backed by a mock ISCLClient */
async function createServiceWithMockClient(
  clientOverrides: Partial<ISCLClient> = {},
): Promise<ClavionService> {
  // Start service with successful health
  mockFetch.mockResolvedValueOnce(
    jsonResponse(200, { status: "ok", version: "0.1.0", uptime: 1 }),
  );
  const rt = mockRuntime({});
  const service = (await ClavionService.start(rt)) as ClavionService;

  // Override client methods
  const client = service.getClient();
  for (const [key, value] of Object.entries(clientOverrides)) {
    (client as any)[key] = value;  // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  return service;
}

describe("Action validation", () => {
  const allActions = [
    { name: "CLAVION_TRANSFER", action: transferAction },
    { name: "CLAVION_TRANSFER_NATIVE", action: transferNativeAction },
    { name: "CLAVION_APPROVE", action: approveAction },
    { name: "CLAVION_SWAP", action: swapAction },
    { name: "CLAVION_CHECK_BALANCE", action: balanceAction },
  ];

  for (const { name, action } of allActions) {
    test(`${name}: validate returns true when both settings present`, async () => {
      const runtime = mockRuntime({
        ISCL_API_URL: "http://localhost:3100",
        ISCL_WALLET_ADDRESS: "0x1111",
      });
      const result = await action.validate(runtime, mockMessage("test"));
      expect(result).toBe(true);
    });

    test(`${name}: validate returns false when ISCL_API_URL missing`, async () => {
      const runtime = mockRuntime({ ISCL_WALLET_ADDRESS: "0x1111" });
      const result = await action.validate(runtime, mockMessage("test"));
      expect(result).toBe(false);
    });

    test(`${name}: validate returns false when ISCL_WALLET_ADDRESS missing`, async () => {
      const runtime = mockRuntime({ ISCL_API_URL: "http://localhost:3100" });
      const result = await action.validate(runtime, mockMessage("test"));
      expect(result).toBe(false);
    });
  }
});

describe("transferAction handler", () => {
  beforeEach(() => { mockFetch.mockReset(); });
  afterEach(() => { vi.restoreAllMocks(); });

  test("returns error when service not available", async () => {
    const runtime = mockRuntime({
      ISCL_WALLET_ADDRESS: "0xAlice",
    }, null);

    const result = await transferAction.handler(
      runtime, mockMessage("send tokens"), undefined, undefined, undefined,
    );

    expect(result).toEqual({ success: false, error: "ClavionService not available" });
  });

  test("calls callback on parameter extraction failure", async () => {
    const service = await createServiceWithMockClient();
    const runtime = mockRuntime(
      { ISCL_WALLET_ADDRESS: "0xAlice" },
      service,
      "not valid json",
    );
    const callback = vi.fn();

    await transferAction.handler(
      runtime, mockMessage("send some tokens"), undefined, undefined, callback,
    );

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("Could not extract") }),
    );
  });

  test("executes pipeline on valid parameters", async () => {
    const approvalResponse = {
      intentId: "int-1",
      txRequestHash: "0xhash",
      description: "Transfer 1M USDC",
      policyDecision: { decision: "require_approval", reasons: [], policyVersion: "1" },
      riskScore: 10,
      riskReasons: [],
      warnings: [],
      gasEstimate: "21000",
      balanceDiffs: [],
      approvalRequired: true,
      approved: true,
      approvalTokenId: "tok-1",
    };
    const signResponse = {
      signedTx: "0xsigned",
      txHash: "0xtxhash",
      intentId: "int-1",
      broadcast: true,
    };

    // We need to mock the client methods on the actual ISCLClient
    // The pipeline calls client.txApproveRequest then client.txSignAndSend
    mockFetch
      .mockResolvedValueOnce(jsonResponse(200, { status: "ok", version: "0.1.0", uptime: 1 })) // health during start
      .mockResolvedValueOnce(jsonResponse(200, approvalResponse)) // approve-request
      .mockResolvedValueOnce(jsonResponse(200, signResponse)); // sign-and-send

    const svcRuntime = mockRuntime({});
    const service = (await ClavionService.start(svcRuntime)) as ClavionService;

    const llmResponse = '```json\n{"tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "recipient": "0xBob", "amount": "1000000"}\n```';
    const runtime = mockRuntime(
      { ISCL_WALLET_ADDRESS: "0xAlice" },
      service,
      llmResponse,
    );
    const callback = vi.fn();

    const result = await transferAction.handler(
      runtime, mockMessage("send 1M USDC to 0xBob"), undefined, undefined, callback,
    );

    expect(result).toEqual(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ txHash: "0xtxhash", broadcast: true }),
    }));
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("successful") }),
    );
  });

  test("reports decline via callback", async () => {
    const declineResponse = {
      intentId: "int-2",
      txRequestHash: "0xhash",
      description: "Transfer 1M USDC",
      policyDecision: { decision: "deny", reasons: ["exceeds_limit"], policyVersion: "1" },
      riskScore: 80,
      riskReasons: ["high_value"],
      warnings: [],
      gasEstimate: "21000",
      balanceDiffs: [],
      approvalRequired: true,
      approved: false,
      reason: "policy_denied",
    };

    mockFetch
      .mockResolvedValueOnce(jsonResponse(200, { status: "ok", version: "0.1.0", uptime: 1 }))
      .mockResolvedValueOnce(jsonResponse(200, declineResponse));

    const svcRuntime = mockRuntime({});
    const service = (await ClavionService.start(svcRuntime)) as ClavionService;

    const llmResponse = '```json\n{"tokenAddress": "0xUSDC", "recipient": "0xBob", "amount": "1000000"}\n```';
    const runtime = mockRuntime(
      { ISCL_WALLET_ADDRESS: "0xAlice" },
      service,
      llmResponse,
    );
    const callback = vi.fn();

    const result = await transferAction.handler(
      runtime, mockMessage("send tokens"), undefined, undefined, callback,
    );

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("declined") }),
    );
  });
});

describe("transferNativeAction handler", () => {
  beforeEach(() => { mockFetch.mockReset(); });
  afterEach(() => { vi.restoreAllMocks(); });

  test("executes pipeline for native ETH transfer", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(200, { status: "ok", version: "0.1.0", uptime: 1 }))
      .mockResolvedValueOnce(jsonResponse(200, {
        intentId: "int-3", txRequestHash: "0xh", description: "Transfer 0.1 ETH",
        policyDecision: { decision: "require_approval", reasons: [], policyVersion: "1" },
        riskScore: 5, riskReasons: [], warnings: [], gasEstimate: "21000",
        balanceDiffs: [], approvalRequired: true, approved: true, approvalTokenId: "tok-2",
      }))
      .mockResolvedValueOnce(jsonResponse(200, {
        signedTx: "0xs", txHash: "0xnativetx", intentId: "int-3", broadcast: true,
      }));

    const svcRuntime = mockRuntime({});
    const service = (await ClavionService.start(svcRuntime)) as ClavionService;

    const llmResponse = '```json\n{"recipient": "0xBob", "amount": "100000000000000000"}\n```';
    const runtime = mockRuntime(
      { ISCL_WALLET_ADDRESS: "0xAlice" },
      service,
      llmResponse,
    );
    const callback = vi.fn();

    const result = await transferNativeAction.handler(
      runtime, mockMessage("send 0.1 ETH"), undefined, undefined, callback,
    );

    expect(result).toEqual(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ txHash: "0xnativetx" }),
    }));
  });
});

describe("approveAction handler", () => {
  beforeEach(() => { mockFetch.mockReset(); });
  afterEach(() => { vi.restoreAllMocks(); });

  test("executes approve pipeline", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(200, { status: "ok", version: "0.1.0", uptime: 1 }))
      .mockResolvedValueOnce(jsonResponse(200, {
        intentId: "int-4", txRequestHash: "0xh", description: "Approve USDC",
        policyDecision: { decision: "require_approval", reasons: [], policyVersion: "1" },
        riskScore: 25, riskReasons: ["approval"], warnings: [], gasEstimate: "46000",
        balanceDiffs: [], approvalRequired: true, approved: true, approvalTokenId: "tok-3",
      }))
      .mockResolvedValueOnce(jsonResponse(200, {
        signedTx: "0xs", txHash: "0xapprovetx", intentId: "int-4", broadcast: true,
      }));

    const svcRuntime = mockRuntime({});
    const service = (await ClavionService.start(svcRuntime)) as ClavionService;

    const llmResponse = '```json\n{"tokenAddress": "0xUSDC", "spender": "0xRouter", "amount": "999999999"}\n```';
    const runtime = mockRuntime(
      { ISCL_WALLET_ADDRESS: "0xAlice" },
      service,
      llmResponse,
    );

    const result = await approveAction.handler(
      runtime, mockMessage("approve USDC"), undefined, undefined, vi.fn(),
    );

    expect(result).toEqual(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ txHash: "0xapprovetx" }),
    }));
  });
});

describe("swapAction handler", () => {
  beforeEach(() => { mockFetch.mockReset(); });
  afterEach(() => { vi.restoreAllMocks(); });

  test("executes swap pipeline", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(200, { status: "ok", version: "0.1.0", uptime: 1 }))
      .mockResolvedValueOnce(jsonResponse(200, {
        intentId: "int-5", txRequestHash: "0xh", description: "Swap USDC→WETH",
        policyDecision: { decision: "require_approval", reasons: [], policyVersion: "1" },
        riskScore: 30, riskReasons: ["slippage"], warnings: [], gasEstimate: "200000",
        balanceDiffs: [], approvalRequired: true, approved: true, approvalTokenId: "tok-4",
      }))
      .mockResolvedValueOnce(jsonResponse(200, {
        signedTx: "0xs", txHash: "0xswaptx", intentId: "int-5", broadcast: true,
      }));

    const svcRuntime = mockRuntime({});
    const service = (await ClavionService.start(svcRuntime)) as ClavionService;

    const llmResponse = '```json\n{"router": "0xRouter", "tokenIn": "0xUSDC", "tokenOut": "0xWETH", "amountIn": "1000000", "minAmountOut": "500000"}\n```';
    const runtime = mockRuntime(
      { ISCL_WALLET_ADDRESS: "0xAlice" },
      service,
      llmResponse,
    );

    const result = await swapAction.handler(
      runtime, mockMessage("swap"), undefined, undefined, vi.fn(),
    );

    expect(result).toEqual(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ txHash: "0xswaptx" }),
    }));
  });
});

describe("balanceAction handler", () => {
  beforeEach(() => { mockFetch.mockReset(); });
  afterEach(() => { vi.restoreAllMocks(); });

  test("returns error when service not available", async () => {
    const runtime = mockRuntime({ ISCL_WALLET_ADDRESS: "0xAlice" }, null);
    const result = await balanceAction.handler(
      runtime, mockMessage("check balance"), undefined, undefined, undefined,
    );
    expect(result).toEqual({ success: false, error: "ClavionService not available" });
  });

  test("fetches balance and reports via callback", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(200, { status: "ok", version: "0.1.0", uptime: 1 }))
      .mockResolvedValueOnce(jsonResponse(200, {
        token: "0xUSDC", account: "0xAlice", balance: "5000000",
      }));

    const svcRuntime = mockRuntime({});
    const service = (await ClavionService.start(svcRuntime)) as ClavionService;

    const llmResponse = '```json\n{"tokenAddress": "0xUSDC"}\n```';
    const runtime = mockRuntime(
      { ISCL_WALLET_ADDRESS: "0xAlice" },
      service,
      llmResponse,
    );
    const callback = vi.fn();

    const result = await balanceAction.handler(
      runtime, mockMessage("check USDC balance"), undefined, undefined, callback,
    );

    expect(result).toEqual(expect.objectContaining({
      success: true,
      data: { token: "0xUSDC", account: "0xAlice", balance: "5000000" },
    }));
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("5000000") }),
    );
  });

  test("reports error via callback on failure", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(200, { status: "ok", version: "0.1.0", uptime: 1 }))
      .mockResolvedValueOnce(jsonResponse(502, { error: "no_rpc" }));

    const svcRuntime = mockRuntime({});
    const service = (await ClavionService.start(svcRuntime)) as ClavionService;

    const llmResponse = '```json\n{"tokenAddress": "0xUSDC"}\n```';
    const runtime = mockRuntime(
      { ISCL_WALLET_ADDRESS: "0xAlice" },
      service,
      llmResponse,
    );
    const callback = vi.fn();

    const result = await balanceAction.handler(
      runtime, mockMessage("check balance"), undefined, undefined, callback,
    );

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("failed") }),
    );
  });
});
