import { describe, test, expect, vi } from "vitest";
import { handleTransfer } from "../src/tools/transfer.js";
import { handleTransferNative } from "../src/tools/transfer-native.js";
import { handleApprove } from "../src/tools/approve.js";
import { handleSwap } from "../src/tools/swap.js";
import { handleBalance } from "../src/tools/balance.js";
import { handleTxStatus } from "../src/tools/tx-status.js";
import type { ISCLClient } from "../src/shared/iscl-client.js";
import { ISCLError } from "../src/shared/iscl-client.js";

function mockClient(overrides: Partial<ISCLClient> = {}): ISCLClient {
  return {
    health: vi.fn(),
    txBuild: vi.fn(),
    txPreflight: vi.fn(),
    txApproveRequest: vi.fn().mockResolvedValue({
      intentId: "test-id",
      txRequestHash: "0xhash",
      description: "test operation",
      policyDecision: { decision: "allow", reasons: [], policyVersion: "1" },
      riskScore: 10,
      riskReasons: [],
      warnings: [],
      gasEstimate: "21000",
      balanceDiffs: [],
      approvalRequired: false,
      approved: true,
      approvalTokenId: "token-1",
    }),
    txSignAndSend: vi.fn().mockResolvedValue({
      signedTx: "0xsigned",
      txHash: "0xtxhash",
      intentId: "test-id",
      broadcast: true,
    }),
    balance: vi.fn().mockResolvedValue({
      token: "0xtoken",
      account: "0xaccount",
      balance: "1000000",
    }),
    txReceipt: vi.fn().mockResolvedValue({
      transactionHash: "0xhash",
      status: "success",
      blockNumber: "18000000",
      blockHash: "0xblockhash",
      gasUsed: "21000",
      effectiveGasPrice: "50000000000",
      from: "0xfrom",
      to: "0xto",
      contractAddress: null,
    }),
    ...overrides,
  } as unknown as ISCLClient;
}

describe("handleTransfer", () => {
  test("calls approve-request then sign-and-send", async () => {
    const client = mockClient();
    const result = await handleTransfer(
      {
        wallet: "0x1111111111111111111111111111111111111111",
        asset: { kind: "erc20", address: "0x2222222222222222222222222222222222222222" },
        to: "0x3333333333333333333333333333333333333333",
        amount: "1000000",
      },
      client,
    );

    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("ERC-20 Transfer — SUCCESS");
    expect(client.txApproveRequest).toHaveBeenCalledTimes(1);
    expect(client.txSignAndSend).toHaveBeenCalledTimes(1);
  });

  test("returns error on ISCLError", async () => {
    const client = mockClient({
      txApproveRequest: vi.fn().mockRejectedValue(new ISCLError(403, { error: "policy_denied" })),
    } as Partial<ISCLClient>);

    const result = await handleTransfer(
      {
        wallet: "0x1111111111111111111111111111111111111111",
        asset: { kind: "erc20", address: "0x2222222222222222222222222222222222222222" },
        to: "0x3333333333333333333333333333333333333333",
        amount: "1000000",
      },
      client,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Error:");
  });
});

describe("handleTransferNative", () => {
  test("calls pipeline for native ETH transfer", async () => {
    const client = mockClient();
    const result = await handleTransferNative(
      {
        wallet: "0x1111111111111111111111111111111111111111",
        to: "0x3333333333333333333333333333333333333333",
        amount: "1000000000000000000",
      },
      client,
    );

    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("Native ETH Transfer — SUCCESS");
  });

  test("builds intent with transfer_native action", async () => {
    const client = mockClient();
    await handleTransferNative(
      {
        wallet: "0x1111111111111111111111111111111111111111",
        to: "0x3333333333333333333333333333333333333333",
        amount: "1000000000000000000",
      },
      client,
    );

    const calledIntent = (client.txApproveRequest as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Record<string, unknown>;
    const action = calledIntent.action as Record<string, unknown>;
    expect(action.type).toBe("transfer_native");
    expect(action).not.toHaveProperty("asset");
  });
});

describe("handleApprove", () => {
  test("calls pipeline for ERC-20 approval", async () => {
    const client = mockClient();
    const result = await handleApprove(
      {
        wallet: "0x1111111111111111111111111111111111111111",
        asset: { kind: "erc20", address: "0x2222222222222222222222222222222222222222" },
        spender: "0x4444444444444444444444444444444444444444",
        amount: "1000000",
      },
      client,
    );

    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("ERC-20 Approval — SUCCESS");
  });
});

describe("handleSwap", () => {
  test("calls pipeline for swap", async () => {
    const client = mockClient();
    const result = await handleSwap(
      {
        wallet: "0x1111111111111111111111111111111111111111",
        router: "0x5555555555555555555555555555555555555555",
        assetIn: { kind: "erc20", address: "0x2222222222222222222222222222222222222222" },
        assetOut: { kind: "erc20", address: "0x3333333333333333333333333333333333333333" },
        amountIn: "1000000",
        minAmountOut: "990000",
      },
      client,
    );

    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("Token Swap — SUCCESS");
  });

  test("builds intent with swap_exact_in action", async () => {
    const client = mockClient();
    await handleSwap(
      {
        wallet: "0x1111111111111111111111111111111111111111",
        router: "0x5555555555555555555555555555555555555555",
        assetIn: { kind: "erc20", address: "0x2222222222222222222222222222222222222222" },
        assetOut: { kind: "erc20", address: "0x3333333333333333333333333333333333333333" },
        amountIn: "1000000",
        minAmountOut: "990000",
      },
      client,
    );

    const calledIntent = (client.txApproveRequest as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Record<string, unknown>;
    const action = calledIntent.action as Record<string, unknown>;
    expect(action.type).toBe("swap_exact_in");
    expect(action.router).toBe("0x5555555555555555555555555555555555555555");
  });
});

describe("handleBalance", () => {
  test("returns formatted balance", async () => {
    const client = mockClient();
    const result = await handleBalance(
      {
        wallet: "0x1111111111111111111111111111111111111111",
        token: "0x2222222222222222222222222222222222222222",
      },
      client,
    );

    expect(result.isError).toBeUndefined();
    const text = result.content[0]!.text;
    expect(text).toContain("Token Balance");
    expect(text).toContain("1000000");
    expect(client.txApproveRequest).not.toHaveBeenCalled();
    expect(client.txSignAndSend).not.toHaveBeenCalled();
  });

  test("calls balance endpoint with correct params", async () => {
    const client = mockClient();
    await handleBalance(
      {
        wallet: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        token: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      },
      client,
    );

    expect(client.balance).toHaveBeenCalledWith(
      "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      undefined,
    );
  });

  test("returns error on ISCLError", async () => {
    const client = mockClient({
      balance: vi.fn().mockRejectedValue(new ISCLError(502, { error: "no_rpc_client" })),
    } as Partial<ISCLClient>);

    const result = await handleBalance(
      {
        wallet: "0x1111111111111111111111111111111111111111",
        token: "0x2222222222222222222222222222222222222222",
      },
      client,
    );

    expect(result.isError).toBe(true);
  });
});

describe("handleTxStatus", () => {
  test("returns formatted receipt", async () => {
    const client = mockClient();
    const result = await handleTxStatus(
      { txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" },
      client,
    );

    expect(result.isError).toBeUndefined();
    const text = result.content[0]!.text;
    expect(text).toContain("Transaction Receipt");
    expect(text).toContain("Status: success");
    expect(text).toContain("Block: 18000000");
    expect(text).toContain("Gas used: 21000");
  });

  test("returns error on ISCLError (404)", async () => {
    const client = mockClient({
      txReceipt: vi.fn().mockRejectedValue(new ISCLError(404, { error: "not_found" })),
    } as Partial<ISCLClient>);

    const result = await handleTxStatus(
      { txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" },
      client,
    );

    expect(result.isError).toBe(true);
  });

  test("shows contract address when present", async () => {
    const client = mockClient({
      txReceipt: vi.fn().mockResolvedValue({
        transactionHash: "0xhash",
        status: "success",
        blockNumber: "18000000",
        blockHash: "0xblockhash",
        gasUsed: "500000",
        effectiveGasPrice: "50000000000",
        from: "0xfrom",
        to: null,
        contractAddress: "0xnewcontract",
      }),
    } as Partial<ISCLClient>);

    const result = await handleTxStatus(
      { txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" },
      client,
    );

    const text = result.content[0]!.text;
    expect(text).toContain("contract creation");
    expect(text).toContain("Contract address: 0xnewcontract");
  });
});
