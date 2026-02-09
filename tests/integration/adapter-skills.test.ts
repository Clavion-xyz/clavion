import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../core/api/app.js";
import { ISCLClient } from "../../adapter/shared/iscl-client.js";
import { handleTransfer } from "../../adapter/skills/clavion-transfer/index.js";
import { handleTransferNative } from "../../adapter/skills/clavion-transfer-native/index.js";
import { handleApprove } from "../../adapter/skills/clavion-approve/index.js";
import { handleSwap } from "../../adapter/skills/clavion-swap/index.js";
import { handleBalance } from "../../adapter/skills/clavion-balance/index.js";
import { verifyInstallation } from "../../adapter/install.js";
import type { PolicyConfig } from "../../core/types.js";
import type {
  TransferParams,
  TransferNativeParams,
  ApproveParams,
  SwapParams,
  BalanceParams,
  AssetParam,
} from "../../adapter/skills/types.js";

const WALLET = "0x1234567890abcdef1234567890abcdef12345678";

const USDC: AssetParam = {
  kind: "erc20",
  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  symbol: "USDC",
  decimals: 6,
};

const WETH: AssetParam = {
  kind: "erc20",
  address: "0x4200000000000000000000000000000000000006",
  symbol: "WETH",
  decimals: 18,
};

function permissiveConfig(): PolicyConfig {
  return {
    version: "1",
    maxValueWei: "1000000000000000000000",
    maxApprovalAmount: "1000000000000000000000",
    contractAllowlist: ["0x2626664c2603336E57B271c5C0b26F421741e481"],
    tokenAllowlist: [USDC.address, WETH.address],
    allowedChains: [8453],
    recipientAllowlist: [],
    maxRiskScore: 70,
    requireApprovalAbove: { valueWei: "10000000000000000000" },
    maxTxPerHour: 100,
  };
}

describe("Adapter skills — integration with real Fastify app", () => {
  let app: FastifyInstance;
  let client: ISCLClient;
  let tempKeystorePath: string;

  beforeAll(async () => {
    tempKeystorePath = mkdtempSync(join(tmpdir(), "iscl-adapter-skills-"));
    app = await buildApp({
      logger: false,
      auditDbPath: ":memory:",
      keystorePath: tempKeystorePath,
      policyConfig: permissiveConfig(),
    });
    await app.listen({ port: 0 });
    const addr = app.server.address();
    const port = typeof addr === "object" && addr ? addr.port : 3000;
    client = new ISCLClient({ baseUrl: `http://127.0.0.1:${String(port)}` });
  });

  afterAll(async () => {
    await app.close();
    rmSync(tempKeystorePath, { recursive: true, force: true });
  });

  // --- handleTransfer ---

  test("handleTransfer() returns success with intentId", async () => {
    const params: TransferParams = {
      walletAddress: WALLET,
      asset: USDC,
      to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      amount: "1000000",
    };

    const result = await handleTransfer(params, client);
    expect(result.success).toBe(true);
    expect(result.intentId).toBeDefined();
    expect(result.description).toContain("Transfer");
    expect(result.data?.txRequestHash).toBeDefined();
  });

  test("handleTransfer() with policy-denied chain returns error", async () => {
    const params: TransferParams = {
      walletAddress: WALLET,
      asset: USDC,
      to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      amount: "1000000",
      chainId: 1, // not in allowed chains
    };

    const result = await handleTransfer(params, client);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  // --- handleTransferNative ---

  test("handleTransferNative() returns success with intentId", async () => {
    const params: TransferNativeParams = {
      walletAddress: WALLET,
      to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      amount: "100000000000000000",
    };

    const result = await handleTransferNative(params, client);
    expect(result.success).toBe(true);
    expect(result.intentId).toBeDefined();
    expect(result.description).toContain("native ETH");
    expect(result.data?.txRequestHash).toBeDefined();
  });

  test("handleTransferNative() with policy-denied chain returns error", async () => {
    const params: TransferNativeParams = {
      walletAddress: WALLET,
      to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      amount: "100000000000000000",
      chainId: 1,
    };

    const result = await handleTransferNative(params, client);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  // --- handleApprove ---

  test("handleApprove() returns success with intentId", async () => {
    const params: ApproveParams = {
      walletAddress: WALLET,
      asset: USDC,
      spender: "0x2626664c2603336E57B271c5C0b26F421741e481",
      amount: "1000000000",
    };

    const result = await handleApprove(params, client);
    expect(result.success).toBe(true);
    expect(result.intentId).toBeDefined();
    expect(result.data?.txRequestHash).toBeDefined();
  });

  test("handleApprove() with policy-denied chain returns error", async () => {
    const params: ApproveParams = {
      walletAddress: WALLET,
      asset: USDC,
      spender: "0x2626664c2603336E57B271c5C0b26F421741e481",
      amount: "1000000000",
      chainId: 1,
    };

    const result = await handleApprove(params, client);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  // --- handleSwap ---

  test("handleSwap() returns success with intentId", async () => {
    const params: SwapParams = {
      walletAddress: WALLET,
      router: "0x2626664c2603336E57B271c5C0b26F421741e481",
      assetIn: USDC,
      assetOut: WETH,
      amountIn: "1000000",
      minAmountOut: "400000000000000",
    };

    const result = await handleSwap(params, client);
    expect(result.success).toBe(true);
    expect(result.intentId).toBeDefined();
    expect(result.description).toContain("Uniswap V3");
    expect(result.data?.txRequestHash).toBeDefined();
  });

  test("handleSwap() with policy-denied chain returns error", async () => {
    const params: SwapParams = {
      walletAddress: WALLET,
      router: "0x2626664c2603336E57B271c5C0b26F421741e481",
      assetIn: USDC,
      assetOut: WETH,
      amountIn: "1000000",
      minAmountOut: "400000000000000",
      chainId: 1,
    };

    const result = await handleSwap(params, client);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  // --- handleBalance ---

  test("handleBalance() returns error when no RPC client configured", async () => {
    const params: BalanceParams = {
      walletAddress: WALLET,
      tokenAddress: USDC.address,
    };

    const result = await handleBalance(params, client);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  // --- SkillResult shape ---

  test("all results have correct SkillResult shape", async () => {
    const transferResult = await handleTransfer(
      { walletAddress: WALLET, asset: USDC, to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd", amount: "1000000" },
      client,
    );
    expect(typeof transferResult.success).toBe("boolean");
    expect(transferResult.intentId === undefined || typeof transferResult.intentId === "string").toBe(true);
  });

  // --- Custom options ---

  test("skills work with custom deadline", async () => {
    const params: TransferParams = {
      walletAddress: WALLET,
      asset: USDC,
      to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      amount: "1000000",
      deadline: 1800000000,
    };

    const result = await handleTransfer(params, client);
    expect(result.success).toBe(true);
  });

  // --- Installer ---

  test("verifyInstallation() succeeds against running server", async () => {
    const addr = app.server.address();
    const port = typeof addr === "object" && addr ? addr.port : 3000;
    const result = await verifyInstallation(`http://127.0.0.1:${String(port)}`);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
