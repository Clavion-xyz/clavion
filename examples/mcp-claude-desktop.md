# Using Clavion with Claude Desktop via MCP

This guide shows how to connect Claude Desktop to Clavion's secure crypto
layer using the Model Context Protocol (MCP) adapter.

## Prerequisites

1. **ISCL Core running** on `http://localhost:3100` (see `docs/development/dev-setup.md`)
2. **Wallet imported and unlocked** via `clavion-cli key import`
3. **RPC configured** (`BASE_RPC_URL` or `ISCL_RPC_URL_8453` for Base)
4. **Claude Desktop** installed (macOS or Windows)

## Step 1: Build the MCP adapter

```bash
cd packages/adapter-mcp
npm run build
```

## Step 2: Configure Claude Desktop

Open Claude Desktop settings and edit `claude_desktop_config.json`:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add the Clavion MCP server:

```json
{
  "mcpServers": {
    "clavion": {
      "command": "node",
      "args": ["/absolute/path/to/clavion/packages/adapter-mcp/dist/index.js"],
      "env": {
        "ISCL_API_URL": "http://localhost:3100"
      }
    }
  }
}
```

Replace `/absolute/path/to/clavion` with your actual project path.

## Step 3: Restart Claude Desktop

Quit and reopen Claude Desktop. You should see a hammer icon indicating
MCP tools are available. Six tools will be registered:

| Tool | Description |
|------|-------------|
| `clavion_transfer` | Transfer ERC-20 tokens |
| `clavion_transfer_native` | Transfer native ETH |
| `clavion_approve` | Approve token spending allowance |
| `clavion_swap` | Swap tokens via Uniswap V3 |
| `clavion_balance` | Check ERC-20 balance (read-only) |
| `clavion_tx_status` | Look up transaction receipt (read-only) |

## Example Prompts

Once connected, try these prompts in Claude Desktop:

- **"Check my USDC balance on 0xYourAddress"**
  Uses `clavion_balance` -- read-only, no signing required.

- **"Transfer 10 USDC to 0xRecipientAddress"**
  Triggers `clavion_transfer` -- builds intent, checks policy, requests
  approval, signs and broadcasts.

- **"Swap 1 USDC for WETH on Base"**
  Triggers `clavion_swap` -- builds swap intent with slippage protection,
  simulates, requests approval, then executes.

- **"Send 0.01 ETH to 0xRecipientAddress"**
  Uses `clavion_transfer_native` for native ETH transfers.

## Security Notes

- Private keys never leave the ISCL Core process (Domain B).
- All fund-affecting operations go through policy checks and risk scoring.
- High-value transactions require explicit human approval via the configured
  approval mode (`cli`, `web`, or `auto`).
- Every operation is audit-logged with a correlated `intentId`.
