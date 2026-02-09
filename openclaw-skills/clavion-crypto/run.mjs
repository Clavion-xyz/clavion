#!/usr/bin/env node
/**
 * Clavion/ISCL tool runner for OpenClaw.
 *
 * Standalone script — uses only Node.js built-in fetch (no project imports).
 * Communicates with ISCL Core over HTTP (Domain A → Domain B boundary).
 *
 * Usage:
 *   node run.mjs <tool_name> '<json_args>'
 *
 * Environment:
 *   ISCL_API_URL  — Base URL for ISCL Core (default: http://iscl-core:3100)
 */

const ISCL_BASE = process.env.ISCL_API_URL || "http://iscl-core:3100";

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function post(path, body) {
  const res = await fetch(`${ISCL_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(`ISCL ${res.status}`), { status: res.status, body: data });
  return data;
}

async function get(path) {
  const res = await fetch(`${ISCL_BASE}${path}`, {
    method: "GET",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(`ISCL ${res.status}`), { status: res.status, body: data });
  return data;
}

// ---------------------------------------------------------------------------
// TxIntent builder (mirrors adapter/skills/intent-builder.ts logic)
// ---------------------------------------------------------------------------

function buildIntent(opts) {
  const now = Math.floor(Date.now() / 1000);
  return {
    version: "1",
    id: crypto.randomUUID(),
    timestamp: now,
    chain: {
      type: "evm",
      chainId: opts.chainId ?? 8453,
      rpcHint: opts.rpcHint,
    },
    wallet: {
      address: opts.walletAddress,
      profile: "default",
    },
    action: opts.action,
    constraints: {
      maxGasWei: opts.maxGasWei ?? "1000000000000000",
      deadline: opts.deadline ?? now + 600,
      maxSlippageBps: opts.slippageBps ?? 100,
    },
    preferences: {},
    metadata: {
      source: opts.source ?? "openclaw-agent",
    },
  };
}

// ---------------------------------------------------------------------------
// Secure pipeline: approve-request → sign-and-send
// ---------------------------------------------------------------------------

async function securePipeline(intent) {
  // Step 1: Request approval (Core prompts the operator in its terminal)
  const approval = await post("/v1/tx/approve-request", intent);

  if (!approval.approved) {
    return {
      success: false,
      intentId: approval.intentId,
      error: approval.reason ?? "user_declined",
      description: approval.description,
    };
  }

  // Step 2: Sign and send (with approval token)
  const signed = await post("/v1/tx/sign-and-send", {
    intent,
    approvalTokenId: approval.approvalTokenId,
  });

  return {
    success: true,
    intentId: signed.intentId,
    txHash: signed.txHash,
    description: `Signed: ${signed.txHash}`,
  };
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function safeTransfer(args) {
  const intent = buildIntent({
    walletAddress: args.walletAddress,
    chainId: args.chainId,
    maxGasWei: args.maxGasWei,
    action: {
      type: "transfer",
      asset: args.asset,
      to: args.to,
      amount: args.amount,
    },
  });
  return securePipeline(intent);
}

async function safeTransferNative(args) {
  const intent = buildIntent({
    walletAddress: args.walletAddress,
    chainId: args.chainId,
    maxGasWei: args.maxGasWei,
    action: {
      type: "transfer_native",
      to: args.to,
      amount: args.amount,
    },
  });
  return securePipeline(intent);
}

async function safeApprove(args) {
  const intent = buildIntent({
    walletAddress: args.walletAddress,
    chainId: args.chainId,
    maxGasWei: args.maxGasWei,
    action: {
      type: "approve",
      asset: args.asset,
      spender: args.spender,
      amount: args.amount,
    },
  });
  return securePipeline(intent);
}

async function safeSwapExactIn(args) {
  const intent = buildIntent({
    walletAddress: args.walletAddress,
    chainId: args.chainId,
    maxGasWei: args.maxGasWei,
    slippageBps: args.slippageBps,
    action: {
      type: "swap_exact_in",
      router: args.router,
      assetIn: args.assetIn,
      assetOut: args.assetOut,
      amountIn: args.amountIn,
      minAmountOut: args.minAmountOut,
    },
  });
  return securePipeline(intent);
}

async function checkBalance(args) {
  const data = await get(`/v1/balance/${args.tokenAddress}/${args.walletAddress}`);
  return { success: true, data };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const [toolName, argsJson] = process.argv.slice(2);

if (!toolName) {
  console.error("Usage: node run.mjs <tool_name> '<json_args>'");
  console.error("Tools: safe_transfer, safe_transfer_native, safe_approve, safe_swap_exact_in, check_balance");
  process.exit(1);
}

const args = argsJson ? JSON.parse(argsJson) : {};

const tools = {
  safe_transfer: safeTransfer,
  safe_transfer_native: safeTransferNative,
  safe_approve: safeApprove,
  safe_swap_exact_in: safeSwapExactIn,
  check_balance: checkBalance,
};

const handler = tools[toolName];
if (!handler) {
  console.log(JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` }));
  process.exit(1);
}

try {
  const result = await handler(args);
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  const output = { success: false, error: err.message };
  if (err.body) output.details = err.body;
  console.log(JSON.stringify(output, null, 2));
  process.exit(1);
}
