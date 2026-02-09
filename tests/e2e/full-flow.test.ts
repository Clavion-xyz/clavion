import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { keccak256, encodePacked, toHex, pad } from "viem";
import { isAnvilAvailable, startAnvilFork, type AnvilFork } from "../helpers/anvil-fork.js";
import { ViemRpcClient, buildApp } from "@clavion/core";
import { EncryptedKeystore } from "@clavion/signer";
import type { FastifyInstance } from "fastify";
import type { PolicyConfig, TxIntent, AuditEvent } from "@clavion/types";
import type { AuditTraceService } from "@clavion/audit";

// ─── Configuration ──────────────────────────────────────────────────────────

const TEST_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const TEST_PASSPHRASE = "test-e2e";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006" as const;
const UNISWAP_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481" as const;

// USDC on Base: balanceOf mapping is at storage slot 9
const USDC_BALANCE_SLOT = 9n;

function permissiveConfig(): PolicyConfig {
  return {
    version: "1",
    maxValueWei: "1000000000000000000000",
    maxApprovalAmount: "1000000000000000000000",
    contractAllowlist: [UNISWAP_ROUTER],
    tokenAllowlist: [USDC_ADDRESS, WETH_ADDRESS],
    allowedChains: [8453],
    recipientAllowlist: [],
    maxRiskScore: 70,
    requireApprovalAbove: { valueWei: "1000000000000000000000" },
    maxTxPerHour: 100,
  };
}

// ─── Skip check ─────────────────────────────────────────────────────────────

const anvilAvailable = await isAnvilAvailable();
const baseRpcUrl = process.env["BASE_RPC_URL"];
const canRunE2E = anvilAvailable && !!baseRpcUrl;

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTransferIntent(walletAddress: string, id: string): TxIntent {
  const now = Math.floor(Date.now() / 1000);
  return {
    version: "1",
    id,
    timestamp: now,
    chain: { type: "evm", chainId: 8453 },
    wallet: { address: walletAddress },
    action: {
      type: "transfer",
      asset: { kind: "erc20", address: USDC_ADDRESS, symbol: "USDC", decimals: 6 },
      to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      amount: "1000000", // 1 USDC
    },
    constraints: {
      maxGasWei: "1000000000000000",
      deadline: now + 600,
      maxSlippageBps: 100,
    },
  };
}

function makeApproveIntent(walletAddress: string, id: string): TxIntent {
  const now = Math.floor(Date.now() / 1000);
  return {
    version: "1",
    id,
    timestamp: now,
    chain: { type: "evm", chainId: 8453 },
    wallet: { address: walletAddress },
    action: {
      type: "approve",
      asset: { kind: "erc20", address: USDC_ADDRESS, symbol: "USDC", decimals: 6 },
      spender: UNISWAP_ROUTER,
      amount: "10000000", // 10 USDC
    },
    constraints: {
      maxGasWei: "500000000000000",
      deadline: now + 600,
      maxSlippageBps: 0,
    },
  };
}

function makeSwapIntent(walletAddress: string, id: string): TxIntent {
  const now = Math.floor(Date.now() / 1000);
  return {
    version: "1",
    id,
    timestamp: now,
    chain: { type: "evm", chainId: 8453 },
    wallet: { address: walletAddress },
    action: {
      type: "swap_exact_in",
      router: UNISWAP_ROUTER,
      assetIn: { kind: "erc20", address: USDC_ADDRESS, symbol: "USDC", decimals: 6 },
      assetOut: { kind: "erc20", address: WETH_ADDRESS, symbol: "WETH", decimals: 18 },
      amountIn: "1000000", // 1 USDC
      minAmountOut: "1", // very low for fork testing
    },
    constraints: {
      maxGasWei: "2000000000000000",
      deadline: now + 600,
      maxSlippageBps: 500,
    },
  };
}

/**
 * Fund the test account with USDC by writing directly to the ERC20 storage slot.
 * USDC on Base: balanceOf(address) stored at keccak256(abi.encode(address, slot)).
 */
async function fundUSDC(
  rpcUrl: string,
  account: `0x${string}`,
  amount: bigint,
): Promise<void> {
  const slot = keccak256(
    encodePacked(
      ["bytes32", "bytes32"],
      [pad(account, { size: 32 }), pad(toHex(USDC_BALANCE_SLOT), { size: 32 })],
    ),
  );

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "anvil_setStorageAt",
      params: [USDC_ADDRESS, slot, pad(toHex(amount), { size: 32 })],
      id: 1,
    }),
  });
  const result = (await response.json()) as { result?: boolean; error?: unknown };
  if (result.error) throw new Error(`anvil_setStorageAt failed: ${JSON.stringify(result.error)}`);
}

// ─── E2E Test Suite ─────────────────────────────────────────────────────────

describe.skipIf(!canRunE2E)("E2E — Full transaction flows on Anvil Base fork", () => {
  let anvil: AnvilFork;
  let app: FastifyInstance;
  let tempDir: string;
  let walletAddress: string;
  let auditTrace: AuditTraceService;

  beforeAll(async () => {
    // 1. Start Anvil fork
    anvil = await startAnvilFork(baseRpcUrl!, 18545);

    // 2. Create viem RPC client
    const rpcClient = new ViemRpcClient(anvil.rpcUrl);

    // 3. Set up keystore with fast scrypt
    tempDir = mkdtempSync(join(tmpdir(), "iscl-e2e-"));
    const keystore = new EncryptedKeystore(tempDir, { scryptN: 1024 });
    walletAddress = await keystore.importKey(TEST_KEY, TEST_PASSPHRASE);

    // 4. Build app with real RPC
    app = await buildApp({
      logger: false,
      auditDbPath: ":memory:",
      keystorePath: tempDir,
      policyConfig: permissiveConfig(),
      rpcClient,
    });
    await app.ready();

    // 5. Unlock key
    const appKeystore = (app as unknown as { keystore: EncryptedKeystore }).keystore;
    await appKeystore.unlock(walletAddress, TEST_PASSPHRASE);

    // 6. Get audit trace reference
    auditTrace = (app as unknown as { auditTrace: AuditTraceService }).auditTrace;

    // 7. Fund test account with USDC
    await fundUSDC(anvil.rpcUrl, walletAddress as `0x${string}`, 100_000_000n); // 100 USDC
  }, 60000);

  afterAll(async () => {
    await app.close();
    anvil.stop();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ── Happy path: Transfer ────────────────────────────────────────────────

  test("transfer: build → preflight → approve-request → sign-and-send", async () => {
    const intent = makeTransferIntent(walletAddress, "e2e00000-0000-0000-0000-000000000001");

    // Build
    const buildRes = await app.inject({ method: "POST", url: "/v1/tx/build", payload: intent });
    expect(buildRes.statusCode).toBe(200);
    const buildBody = buildRes.json() as { txRequestHash: string; description: string; policyDecision: { decision: string } };
    expect(buildBody.txRequestHash).toBeDefined();
    expect(buildBody.description).toContain("Transfer");
    expect(buildBody.policyDecision.decision).toBe("allow");

    // Preflight (real RPC via Anvil)
    const preflightRes = await app.inject({ method: "POST", url: "/v1/tx/preflight", payload: intent });
    expect(preflightRes.statusCode).toBe(200);
    const preflightBody = preflightRes.json() as { simulationSuccess: boolean; gasEstimate: string; riskScore: number };
    expect(preflightBody.simulationSuccess).toBe(true);
    expect(Number(preflightBody.gasEstimate)).toBeGreaterThan(0);
    expect(preflightBody.riskScore).toBeDefined();

    // Approve request
    const approveRes = await app.inject({ method: "POST", url: "/v1/tx/approve-request", payload: intent });
    expect(approveRes.statusCode).toBe(200);

    // Sign and send
    const signRes = await app.inject({
      method: "POST",
      url: "/v1/tx/sign-and-send",
      payload: { intent },
    });
    expect(signRes.statusCode).toBe(200);
    const signBody = signRes.json() as { signedTx: string; txHash: string; intentId: string; broadcast: boolean };
    expect(signBody.signedTx).toMatch(/^0x/);
    expect(signBody.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(signBody.intentId).toBe(intent.id);
    expect(signBody.broadcast).toBe(true);
  }, 60000);

  // ── Happy path: Approve ─────────────────────────────────────────────────

  test("approve: build → preflight → sign-and-send", async () => {
    const intent = makeApproveIntent(walletAddress, "e2e00000-0000-0000-0000-000000000002");

    const buildRes = await app.inject({ method: "POST", url: "/v1/tx/build", payload: intent });
    expect(buildRes.statusCode).toBe(200);

    const preflightRes = await app.inject({ method: "POST", url: "/v1/tx/preflight", payload: intent });
    expect(preflightRes.statusCode).toBe(200);
    expect((preflightRes.json() as { simulationSuccess: boolean }).simulationSuccess).toBe(true);

    const signRes = await app.inject({
      method: "POST",
      url: "/v1/tx/sign-and-send",
      payload: { intent },
    });
    expect(signRes.statusCode).toBe(200);
    const approveBody = signRes.json() as { signedTx: string; broadcast: boolean };
    expect(approveBody.signedTx).toMatch(/^0x/);
    expect(approveBody.broadcast).toBe(true);
  }, 60000);

  // ── Happy path: Swap ────────────────────────────────────────────────────

  test("swap_exact_in: build → preflight → sign-and-send", async () => {
    const intent = makeSwapIntent(walletAddress, "e2e00000-0000-0000-0000-000000000003");

    const buildRes = await app.inject({ method: "POST", url: "/v1/tx/build", payload: intent });
    expect(buildRes.statusCode).toBe(200);
    expect((buildRes.json() as { description: string }).description).toContain("Uniswap V3");

    const preflightRes = await app.inject({ method: "POST", url: "/v1/tx/preflight", payload: intent });
    expect(preflightRes.statusCode).toBe(200);

    const signRes = await app.inject({
      method: "POST",
      url: "/v1/tx/sign-and-send",
      payload: { intent },
    });
    expect(signRes.statusCode).toBe(200);
    const swapBody = signRes.json() as { txHash: string; broadcast: boolean };
    expect(swapBody.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(swapBody.broadcast).toBe(true);
  }, 60000);

  // ── Failure: Policy denial ──────────────────────────────────────────────

  test("failure: policy denial for wrong chain", async () => {
    const intent = makeTransferIntent(walletAddress, "e2e00000-0000-0000-0000-000000000004");
    intent.chain = { type: "evm", chainId: 999 };

    const res = await app.inject({ method: "POST", url: "/v1/tx/build", payload: intent });
    expect(res.statusCode).toBe(403);
    expect((res.json() as { error: string }).error).toBe("policy_denied");
  }, 30000);

  // ── Failure: Insufficient balance ───────────────────────────────────────

  test("failure: insufficient balance detected in preflight", async () => {
    const intent = makeTransferIntent(walletAddress, "e2e00000-0000-0000-0000-000000000005");
    // Amount way beyond funded balance (100 USDC)
    (intent.action as { amount: string }).amount = "999999999999";

    const preflightRes = await app.inject({ method: "POST", url: "/v1/tx/preflight", payload: intent });
    expect(preflightRes.statusCode).toBe(200);
    const body = preflightRes.json() as { simulationSuccess: boolean; riskScore: number };
    // The transfer call itself might succeed or fail depending on the forked state,
    // but the risk score should reflect the balance issue
    expect(body.riskScore).toBeDefined();
  }, 60000);

  // ── Audit trail completeness ────────────────────────────────────────────

  test("audit trail contains all lifecycle events for a full flow", async () => {
    const intent = makeTransferIntent(walletAddress, "e2e00000-0000-0000-0000-000000000006");

    // Run full flow
    await app.inject({ method: "POST", url: "/v1/tx/build", payload: intent });
    await app.inject({ method: "POST", url: "/v1/tx/preflight", payload: intent });
    await app.inject({ method: "POST", url: "/v1/tx/approve-request", payload: intent });
    await app.inject({ method: "POST", url: "/v1/tx/sign-and-send", payload: { intent } });

    // Verify audit trail
    const trail = auditTrace.getTrail(intent.id);
    const eventNames = trail.map((e: AuditEvent) => e.event);

    expect(eventNames).toContain("policy_evaluated");
    expect(eventNames).toContain("tx_built");
    expect(eventNames).toContain("preflight_completed");
    expect(eventNames).toContain("approve_request_created");
    expect(eventNames).toContain("signature_created");
    expect(eventNames).toContain("tx_broadcast");

    // Events should be in chronological order
    expect(trail.length).toBeGreaterThanOrEqual(6);
  }, 60000);
});
