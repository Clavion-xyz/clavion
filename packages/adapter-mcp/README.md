# @clavion/adapter-mcp

MCP (Model Context Protocol) server that exposes Clavion ISCL operations as tools.
Compatible with Claude Desktop, Cursor, Windsurf, and any other MCP client.

All fund-affecting operations go through the full secure pipeline: policy check,
preflight simulation, human approval, then signing. Private keys never leave Core.

## Prerequisites

ISCL Core must be running on `localhost:3100` (or set `ISCL_API_URL`).

## Tools

| Tool | Description |
|------|-------------|
| `clavion_transfer` | Transfer ERC-20 tokens |
| `clavion_transfer_native` | Transfer native ETH |
| `clavion_approve` | Set ERC-20 spending allowance |
| `clavion_swap` | Swap tokens via Uniswap V3 |
| `clavion_balance` | Check ERC-20 token balance (read-only) |
| `clavion_tx_status` | Look up transaction receipt (read-only) |

## Configuration for Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "clavion": {
      "command": "node",
      "args": ["packages/adapter-mcp/dist/index.js"],
      "env": {
        "ISCL_API_URL": "http://localhost:3100"
      }
    }
  }
}
```

## Running Standalone

```bash
npm run build
npm start
```

The server communicates over stdio using the MCP protocol. It is not an HTTP
server -- it is launched by the MCP client (Claude Desktop, Cursor, etc.).

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ISCL_API_URL` | `http://127.0.0.1:3000` | ISCL Core base URL |

## Project Root

[Back to main README](../../README.md)
