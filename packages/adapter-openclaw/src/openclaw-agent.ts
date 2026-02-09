/**
 * OpenClaw Agent — Tool definitions for ISCL secure crypto operations.
 *
 * Registers safe_transfer, safe_approve, safe_swap_exact_in, and check_balance
 * as OpenClaw tools. Each tool runs the full secure pipeline:
 *   build intent → approve-request (user prompt) → sign-and-send
 *
 * Usage:
 *   import { openclawTools, executeOpenClawTool } from "./openclaw-agent.js";
 *   // Register `openclawTools` with your OpenClaw agent
 *   // Call `executeOpenClawTool(toolName, args)` for execution
 */

import { ISCLClient, ISCLError } from "./shared/iscl-client.js";
import { buildIntent } from "./skills/intent-builder.js";
import type {
  TransferParams,
  TransferNativeParams,
  ApproveParams,
  SwapParams,
  BalanceParams,
  SkillResult,
} from "./skills/types.js";
import type { TransferAction, TransferNativeAction, ApproveAction, SwapExactInAction } from "@clavion/types";

// ---------------------------------------------------------------------------
// Tool schema definitions (JSON Schema for OpenClaw tool registry)
// ---------------------------------------------------------------------------

const AssetParamSchema = {
  type: "object",
  required: ["kind", "address"],
  properties: {
    kind: { type: "string", enum: ["erc20"] },
    address: { type: "string", description: "ERC-20 contract address (0x...)" },
    symbol: { type: "string", description: "Token symbol (e.g. USDC)" },
    decimals: { type: "number", description: "Token decimals (e.g. 6)" },
  },
} as const;

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const openclawTools: ToolDefinition[] = [
  {
    name: "safe_transfer",
    description:
      "Safely transfer ERC-20 tokens. Enforces policy checks, risk scoring, " +
      "and requires human approval before signing. Tokens never leave the secure layer.",
    parameters: {
      type: "object",
      required: ["walletAddress", "asset", "to", "amount"],
      properties: {
        walletAddress: { type: "string", description: "Sender wallet address" },
        asset: AssetParamSchema,
        to: { type: "string", description: "Recipient address" },
        amount: { type: "string", description: "Amount in token base units (wei)" },
        chainId: { type: "number", description: "Chain ID (default: 8453 Base)" },
        maxGasWei: { type: "string", description: "Max gas in wei" },
      },
    },
  },
  {
    name: "safe_approve",
    description:
      "Safely approve an ERC-20 token allowance for a spender contract. " +
      "Policy-enforced with human approval for high-risk approvals.",
    parameters: {
      type: "object",
      required: ["walletAddress", "asset", "spender", "amount"],
      properties: {
        walletAddress: { type: "string", description: "Token owner wallet address" },
        asset: AssetParamSchema,
        spender: { type: "string", description: "Contract to approve for spending" },
        amount: { type: "string", description: "Approval amount in base units" },
        chainId: { type: "number", description: "Chain ID (default: 8453 Base)" },
        maxGasWei: { type: "string", description: "Max gas in wei" },
      },
    },
  },
  {
    name: "safe_swap_exact_in",
    description:
      "Safely swap an exact amount of one ERC-20 token for another via Uniswap V3. " +
      "Includes slippage protection, simulation, and human approval.",
    parameters: {
      type: "object",
      required: ["walletAddress", "router", "assetIn", "assetOut", "amountIn", "minAmountOut"],
      properties: {
        walletAddress: { type: "string", description: "Wallet address" },
        router: { type: "string", description: "Uniswap V3 SwapRouter02 address" },
        assetIn: AssetParamSchema,
        assetOut: AssetParamSchema,
        amountIn: { type: "string", description: "Exact input amount in base units" },
        minAmountOut: { type: "string", description: "Minimum output amount (slippage floor)" },
        slippageBps: { type: "number", description: "Slippage tolerance in basis points (default: 100 = 1%)" },
        chainId: { type: "number", description: "Chain ID (default: 8453 Base)" },
        maxGasWei: { type: "string", description: "Max gas in wei" },
      },
    },
  },
  {
    name: "safe_transfer_native",
    description:
      "Safely transfer native ETH (not ERC-20 tokens). Enforces policy checks, " +
      "risk scoring, and requires human approval before signing.",
    parameters: {
      type: "object",
      required: ["walletAddress", "to", "amount"],
      properties: {
        walletAddress: { type: "string", description: "Sender wallet address" },
        to: { type: "string", description: "Recipient address" },
        amount: { type: "string", description: "Amount in wei" },
        chainId: { type: "number", description: "Chain ID (default: 8453 Base)" },
        maxGasWei: { type: "string", description: "Max gas in wei" },
      },
    },
  },
  {
    name: "check_balance",
    description:
      "Check the ERC-20 token balance of a wallet address. Read-only, no signing required.",
    parameters: {
      type: "object",
      required: ["walletAddress", "tokenAddress"],
      properties: {
        walletAddress: { type: "string", description: "Wallet address to check" },
        tokenAddress: { type: "string", description: "ERC-20 token contract address" },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Full secure pipeline execution
// ---------------------------------------------------------------------------

/**
 * Execute the full ISCL secure pipeline for a fund-affecting tool:
 *   1. Build TxIntent from params
 *   2. POST /tx/approve-request → policy check + user prompt
 *   3. If approved, POST /tx/sign-and-send with approval token
 *   4. Return signed transaction hash
 */
async function executeSecurePipeline(
  intent: ReturnType<typeof buildIntent>,
  client: ISCLClient,
): Promise<SkillResult> {
  // Step 1: Request approval (Core will prompt the user in the terminal)
  const approval = await client.txApproveRequest(intent);

  if (!approval.approved) {
    return {
      success: false,
      intentId: approval.intentId,
      error: approval.reason ?? "user_declined",
      description: approval.description,
    };
  }

  // Step 2: Sign and send (with approval token if required)
  const signed = await client.txSignAndSend({
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

async function execTransfer(params: TransferParams, client: ISCLClient): Promise<SkillResult> {
  const action: TransferAction = {
    type: "transfer",
    asset: params.asset,
    to: params.to,
    amount: params.amount,
  };

  const intent = buildIntent({
    walletAddress: params.walletAddress,
    action,
    chainId: params.chainId,
    maxGasWei: params.maxGasWei,
    deadline: params.deadline,
    source: params.source ?? "openclaw-agent",
  });

  return executeSecurePipeline(intent, client);
}

async function execTransferNative(params: TransferNativeParams, client: ISCLClient): Promise<SkillResult> {
  const action: TransferNativeAction = {
    type: "transfer_native",
    to: params.to,
    amount: params.amount,
  };

  const intent = buildIntent({
    walletAddress: params.walletAddress,
    action,
    chainId: params.chainId,
    maxGasWei: params.maxGasWei,
    deadline: params.deadline,
    source: params.source ?? "openclaw-agent",
  });

  return executeSecurePipeline(intent, client);
}

async function execApprove(params: ApproveParams, client: ISCLClient): Promise<SkillResult> {
  const action: ApproveAction = {
    type: "approve",
    asset: params.asset,
    spender: params.spender,
    amount: params.amount,
  };

  const intent = buildIntent({
    walletAddress: params.walletAddress,
    action,
    chainId: params.chainId,
    maxGasWei: params.maxGasWei,
    deadline: params.deadline,
    source: params.source ?? "openclaw-agent",
  });

  return executeSecurePipeline(intent, client);
}

async function execSwap(params: SwapParams, client: ISCLClient): Promise<SkillResult> {
  const action: SwapExactInAction = {
    type: "swap_exact_in",
    router: params.router,
    assetIn: params.assetIn,
    assetOut: params.assetOut,
    amountIn: params.amountIn,
    minAmountOut: params.minAmountOut,
  };

  const intent = buildIntent({
    walletAddress: params.walletAddress,
    action,
    chainId: params.chainId,
    maxGasWei: params.maxGasWei,
    deadline: params.deadline,
    slippageBps: params.slippageBps,
    source: params.source ?? "openclaw-agent",
  });

  return executeSecurePipeline(intent, client);
}

async function execBalance(params: BalanceParams, client: ISCLClient): Promise<SkillResult> {
  const result = await client.balance(params.tokenAddress, params.walletAddress);
  return {
    success: true,
    data: {
      token: result.token,
      account: result.account,
      balance: result.balance,
    },
  };
}

// ---------------------------------------------------------------------------
// Public API — tool dispatcher
// ---------------------------------------------------------------------------

/**
 * Execute an OpenClaw tool by name with the given arguments.
 * Creates an ISCLClient internally (uses ISCL_API_URL env var or default).
 */
export async function executeOpenClawTool(
  toolName: string,
  args: Record<string, unknown>,
  clientOptions?: { baseUrl?: string },
): Promise<SkillResult> {
  const client = new ISCLClient(clientOptions);

  try {
    switch (toolName) {
      case "safe_transfer":
        return await execTransfer(args as unknown as TransferParams, client);
      case "safe_transfer_native":
        return await execTransferNative(args as unknown as TransferNativeParams, client);
      case "safe_approve":
        return await execApprove(args as unknown as ApproveParams, client);
      case "safe_swap_exact_in":
        return await execSwap(args as unknown as SwapParams, client);
      case "check_balance":
        return await execBalance(args as unknown as BalanceParams, client);
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    if (err instanceof ISCLError) {
      return {
        success: false,
        error: `ISCL API error (${err.status}): ${JSON.stringify(err.body)}`,
      };
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}
