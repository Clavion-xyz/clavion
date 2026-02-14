import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ISCLClient } from "./shared/iscl-client.js";
import {
  TransferSchema,
  TransferNativeSchema,
  ApproveSchema,
  SwapSchema,
  BalanceSchema,
  TxStatusSchema,
} from "./tools/schemas.js";
import { handleTransfer } from "./tools/transfer.js";
import { handleTransferNative } from "./tools/transfer-native.js";
import { handleApprove } from "./tools/approve.js";
import { handleSwap } from "./tools/swap.js";
import { handleBalance } from "./tools/balance.js";
import { handleTxStatus } from "./tools/tx-status.js";

export interface ServerOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

export function createServer(options?: ServerOptions): McpServer {
  const server = new McpServer({
    name: "clavion-iscl",
    version: "0.1.0",
  });

  const client = new ISCLClient({
    baseUrl: options?.baseUrl,
    timeoutMs: options?.timeoutMs,
  });

  // --- Fund-affecting tools (full secure pipeline) ---

  server.tool(
    "clavion_transfer",
    "Transfer ERC-20 tokens securely through Clavion. Enforces policy checks, risk scoring, and requires human approval before signing. Private keys never leave the secure layer.",
    TransferSchema,
    async (args) => handleTransfer(args, client),
  );

  server.tool(
    "clavion_transfer_native",
    "Transfer native ETH securely through Clavion. Enforces policy checks, risk scoring, and requires human approval before signing.",
    TransferNativeSchema,
    async (args) => handleTransferNative(args, client),
  );

  server.tool(
    "clavion_approve",
    "Approve an ERC-20 token spending allowance for a contract through Clavion. Policy-enforced with human approval for high-risk approvals.",
    ApproveSchema,
    async (args) => handleApprove(args, client),
  );

  server.tool(
    "clavion_swap",
    "Swap tokens via Uniswap V3 through Clavion with slippage protection, simulation, and human approval. Executes through the secure signing layer.",
    SwapSchema,
    async (args) => handleSwap(args, client),
  );

  // --- Read-only tools (no signing) ---

  server.tool(
    "clavion_balance",
    "Check the ERC-20 token balance of a wallet address. Read-only, no signing required.",
    BalanceSchema,
    async (args) => handleBalance(args, client),
  );

  server.tool(
    "clavion_tx_status",
    "Look up a transaction receipt by hash. Returns status, block number, gas used, and more. Read-only.",
    TxStatusSchema,
    async (args) => handleTxStatus(args, client),
  );

  return server;
}
