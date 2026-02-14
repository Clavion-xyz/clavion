# MCP Adapter Setup Guide

This guide covers setting up the Clavion MCP adapter (`@clavion/adapter-mcp`) for use with Claude Desktop, Cursor, and other MCP-compatible IDE clients.

---

## Overview

The MCP (Model Context Protocol) adapter exposes ISCL's crypto operations as MCP tools that AI assistants can invoke. When Claude Desktop or Cursor calls a tool like `clavion_transfer`, the adapter constructs a TxIntent, sends it through the full ISCL pipeline (policy, preflight, approval, signing, broadcast), and returns the result.

### Available Tools

| Tool Name | Action | Description |
|-----------|--------|-------------|
| `clavion_transfer` | `transfer` | Transfer ERC-20 tokens |
| `clavion_transfer_native` | `transfer_native` | Transfer native ETH |
| `clavion_approve` | `approve` | Approve ERC-20 spending allowance |
| `clavion_swap` | `swap_exact_in` | Swap tokens via DEX |
| `clavion_balance` | (read-only) | Check token balance |
| `clavion_tx_status` | (read-only) | Look up transaction receipt |

---

## Prerequisites

- **ISCL Core running** on `localhost:3100`
- **A wallet address** imported into the ISCL keystore
- **RPC configured** for your target chain(s)
- **Node.js 20+**
- **An MCP client** (Claude Desktop, Cursor, or compatible IDE)

---

## Step 1: Build the MCP Adapter

```bash
cd /path/to/clavion
npm install
npm run build
```

The MCP adapter is built as part of the monorepo. The entry point is at `packages/adapter-mcp/dist/index.js`.

---

## Step 2: Configure Claude Desktop

Add the Clavion MCP server to your Claude Desktop configuration file.

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "clavion": {
      "command": "node",
      "args": ["/path/to/clavion/packages/adapter-mcp/dist/index.js"],
      "env": {
        "ISCL_API_URL": "http://127.0.0.1:3100",
        "ISCL_WALLET_ADDRESS": "0xYourWalletAddress"
      }
    }
  }
}
```

Replace `/path/to/clavion` with the absolute path to your Clavion repository, and `0xYourWalletAddress` with the wallet address imported into your keystore.

**Restart Claude Desktop** after modifying the config file.

---

## Step 3: Configure Cursor

For Cursor IDE, add the MCP server via Cursor's settings:

1. Open Cursor Settings (`Cmd+,` on macOS)
2. Search for "MCP" or navigate to the MCP configuration section
3. Add a new MCP server:

```json
{
  "name": "clavion",
  "command": "node",
  "args": ["/path/to/clavion/packages/adapter-mcp/dist/index.js"],
  "env": {
    "ISCL_API_URL": "http://127.0.0.1:3100",
    "ISCL_WALLET_ADDRESS": "0xYourWalletAddress"
  }
}
```

---

## Step 4: Start ISCL Core

The MCP adapter connects to a running ISCL Core instance. Start it in a terminal:

```bash
# Minimal (Base chain)
ISCL_RPC_URL_8453=https://mainnet.base.org npm run dev

# With web approval (recommended for interactive use)
ISCL_APPROVAL_MODE=web ISCL_RPC_URL_8453=https://mainnet.base.org npm run dev
```

Verify it's running:

```bash
curl http://localhost:3100/v1/health
```

---

## Step 5: Use the Tools

Once configured, your AI assistant can invoke Clavion tools directly.

### Example: Transfer Tokens

Ask Claude: *"Send 100 USDC to 0xRecipientAddress on Base"*

Claude will call `clavion_transfer` with:
```json
{
  "wallet": "0xYourWalletAddress",
  "asset": {
    "kind": "erc20",
    "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "symbol": "USDC",
    "decimals": 6
  },
  "to": "0xRecipientAddress",
  "amount": "100000000",
  "chainId": 8453
}
```

### Example: Check Balance

Ask Claude: *"What's my USDC balance?"*

Claude will call `clavion_balance` with the wallet and token addresses.

### Example: Swap Tokens

Ask Claude: *"Swap 0.1 WETH for USDC on Base"*

Claude will call `clavion_swap` with the appropriate parameters.

---

## Tool Parameters

### clavion_transfer

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `wallet` | string | Yes | Sender address (0x + 40 hex) |
| `asset.kind` | string | Yes | Always `"erc20"` |
| `asset.address` | string | Yes | Token contract address |
| `asset.symbol` | string | No | Token symbol (e.g., "USDC") |
| `asset.decimals` | number | No | Token decimals |
| `to` | string | Yes | Recipient address |
| `amount` | string | Yes | Amount in base units (wei) |
| `chainId` | number | No | Chain ID (default: 8453) |
| `maxGasWei` | string | No | Max gas limit in wei |

### clavion_transfer_native

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `wallet` | string | Yes | Sender address |
| `to` | string | Yes | Recipient address |
| `amount` | string | Yes | Amount in wei |
| `chainId` | number | No | Chain ID (default: 8453) |
| `maxGasWei` | string | No | Max gas limit in wei |

### clavion_swap

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `wallet` | string | Yes | Wallet performing the swap |
| `router` | string | Yes | DEX router address |
| `assetIn` | object | Yes | Input token (selling) |
| `assetOut` | object | Yes | Output token (buying) |
| `amountIn` | string | Yes | Exact input amount in base units |
| `minAmountOut` | string | Yes | Minimum output (slippage floor) |
| `slippageBps` | number | No | Slippage in basis points (default: 100 = 1%) |
| `provider` | string | No | `"uniswap_v3"` or `"1inch"` |
| `chainId` | number | No | Chain ID (default: 8453) |

### clavion_balance

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `wallet` | string | Yes | Wallet address to check |
| `token` | string | Yes | ERC-20 token contract address |
| `chainId` | number | No | Chain ID (default: 8453) |

### clavion_tx_status

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `txHash` | string | Yes | Transaction hash (0x + 64 hex) |

---

## Approval Modes

How the user approves transactions depends on the ISCL Core approval mode:

| Mode | Behavior | Best For |
|------|----------|----------|
| `cli` | Readline prompt in the ISCL Core terminal | Development, single-user |
| `web` | Pending in web dashboard at `/approval-ui` | Interactive use, multi-tool |
| `auto` | Auto-approved (no human confirmation) | Testing only |

**Recommended for MCP:** Use `ISCL_APPROVAL_MODE=web` and keep the approval dashboard open in a browser tab. When Claude requests a transaction, you'll see it appear in the dashboard for approval.

---

## Multi-Chain Configuration

The `chainId` parameter on each tool defaults to 8453 (Base). To use other chains, ensure ISCL Core has the corresponding RPC URL configured:

```bash
ISCL_RPC_URL_1=https://eth-mainnet.alchemy.com/v2/KEY \
ISCL_RPC_URL_8453=https://base-mainnet.alchemy.com/v2/KEY \
npm run dev
```

Then ask Claude to specify the chain: *"Send 1 ETH to 0xAlice on Ethereum mainnet"*

---

## Troubleshooting

### Tools don't appear in Claude Desktop

1. Verify the config file path is correct for your OS
2. Check that the `command` path points to the built JS file
3. Restart Claude Desktop after config changes
4. Check Claude Desktop logs for MCP server startup errors

### "ISCL Core not reachable"

The MCP adapter checks ISCL Core health on startup. Ensure Core is running:

```bash
curl http://localhost:3100/v1/health
```

### Approval hangs

If using `cli` mode, check the ISCL Core terminal for the readline prompt. If using `web` mode, open `http://localhost:3100/approval-ui` and approve the pending request.

### Schema validation errors

The MCP adapter validates parameters using Zod schemas. Ensure:
- Addresses are checksummed 0x-prefixed (40 hex chars)
- Amounts are string integers (no decimals, no "0x" prefix)
- Chain IDs are positive integers

---

## Security Notes

- The MCP adapter runs in Domain A (untrusted). It cannot access private keys.
- All transactions go through the full ISCL pipeline: policy, preflight, approval, signing.
- The adapter communicates with ISCL Core over localhost HTTP only.
- Tool descriptions inform the AI about security properties (policy enforcement, human approval).

---

## References

- [Adapter Development Tutorial](../development/adapter-tutorial.md) -- How MCP adapter was built
- [API Reference](../api/overview.md) -- Underlying API endpoints
- [Configuration Reference](../configuration.md) -- Environment variables
- [MCP Protocol Specification](https://modelcontextprotocol.io/) -- Official MCP documentation
