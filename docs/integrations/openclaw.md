# OpenClaw Adapter Guide

The ISCL adapter provides thin skill wrappers for OpenClaw-compatible agents. Skills communicate with ISCL Core exclusively over its HTTP API, maintaining trust domain separation.

## Architecture

```
Agent Skill (Domain A) → ISCLClient → HTTP → ISCL Core (Domain B) → Wallet/Policy/Signing
```

Skills never access keys, policy internals, or signing logic directly.

## ISCLClient

The `ISCLClient` class wraps all ISCL Core API calls:

```typescript
import { ISCLClient } from "iscl/adapter";

const client = new ISCLClient({
  baseUrl: "http://127.0.0.1:3100",  // default
  timeoutMs: 10000,                   // default
});

// Check connectivity
const health = await client.health();

// Build a transaction
const buildResult = await client.txBuild(intent);

// Run preflight simulation
const preflight = await client.txPreflight(intent);

// Request approval (prompts user in Core terminal if policy requires it)
const approval = await client.txApproveRequest(intent);
// approval.approvalRequired — whether user prompt was needed
// approval.approved — whether user approved (or policy auto-allowed)
// approval.approvalTokenId — single-use token for sign-and-send (if approved)

// Sign and send (pass approval token when required)
const signed = await client.txSignAndSend({
  intent,
  approvalTokenId: approval.approvalTokenId,
});

// Check ERC-20 balance (requires BASE_RPC_URL on Core)
const bal = await client.balance(tokenAddress, walletAddress);

// Look up transaction receipt
const receipt = await client.txReceipt(txHash);
```

The client reads `ISCL_API_URL` from the environment as a fallback for `baseUrl`.

## Skill Wrappers

Four ready-made skill handlers:

### Transfer

```typescript
import { handleTransfer } from "iscl/adapter";

const result = await handleTransfer({
  walletAddress: "0x1234...",
  asset: { kind: "erc20", address: "0x833589...", symbol: "USDC", decimals: 6 },
  to: "0xabcd...",
  amount: "1000000",
}, client);

// result: { success: true, intentId: "...", description: "Transfer 1000000 USDC to ..." }
```

### Approve

```typescript
import { handleApprove } from "iscl/adapter";

const result = await handleApprove({
  walletAddress: "0x1234...",
  asset: { kind: "erc20", address: "0x833589...", symbol: "USDC", decimals: 6 },
  spender: "0x2626...",
  amount: "10000000",
}, client);
```

### Swap

```typescript
import { handleSwap } from "iscl/adapter";

const result = await handleSwap({
  walletAddress: "0x1234...",
  router: "0x2626...",
  assetIn: { kind: "erc20", address: "0x833589...", symbol: "USDC", decimals: 6 },
  assetOut: { kind: "erc20", address: "0x4200...", symbol: "WETH", decimals: 18 },
  amountIn: "1000000",
  minAmountOut: "400000000000000",
}, client);
```

### Balance

```typescript
import { handleBalance } from "iscl/adapter";

const result = await handleBalance({
  walletAddress: "0x1234...",
  tokenAddress: "0x833589...",
}, client);

// result: { success: true, data: { token: "0x833589...", account: "0x1234...", balance: "1000000" } }
```

Requires `BASE_RPC_URL` to be configured on the Core daemon.

## Installation Verification

```typescript
import { verifyInstallation } from "iscl/adapter";

const check = await verifyInstallation("http://127.0.0.1:3100");
if (!check.ok) {
  console.error("Installation issues:", check.errors);
}
```

## Error Handling

All skill wrappers catch `ISCLError` and return structured results:

```typescript
import { ISCLError } from "iscl/adapter";

// ISCLError has:
//   .status  — HTTP status code (403, 400, 502, etc.)
//   .body    — Parsed response body
//   .message — "ISCL API error: 403"
```

## OpenClaw Agent Integration

The adapter exports an OpenClaw-compatible tool registry and executor. This is the primary integration point for connecting ISCL to an OpenClaw agent.

### Tool Definitions

```typescript
import { openclawTools } from "iscl/adapter";

// openclawTools is an array of 4 tool definitions:
//   - safe_transfer     — ERC-20 token transfer
//   - safe_approve      — ERC-20 allowance approval
//   - safe_swap_exact_in — Uniswap V3 exact-in swap
//   - check_balance     — Read-only balance lookup

// Each tool has: name, description, parameters (JSON Schema)
// Register these with your OpenClaw agent's tool registry.
```

### Executing Tools

```typescript
import { executeOpenClawTool } from "iscl/adapter";

// Execute the full secure pipeline for any tool:
//   build intent → approve-request (user prompt) → sign-and-send
const result = await executeOpenClawTool("safe_transfer", {
  walletAddress: "0x1234...",
  asset: { kind: "erc20", address: "0x833589...", symbol: "USDC", decimals: 6 },
  to: "0xabcd...",
  amount: "1000000",
});

if (result.success) {
  console.log("Tx hash:", result.txHash);
} else {
  console.log("Error:", result.error);
}
```

### Secure Call Sequence

For fund-affecting tools (`safe_transfer`, `safe_approve`, `safe_swap_exact_in`), the executor runs the full pipeline:

1. Build a `TxIntent` from the tool arguments
2. `POST /v1/tx/approve-request` — policy check, risk scoring, and user prompt
3. If approved: `POST /v1/tx/sign-and-send` with the approval token
4. Return the signed transaction hash

For `check_balance`, only a read-only `GET /v1/balance/:token/:account` call is made.

## Custom Skill Development

To build a custom skill using the full secure pipeline:

1. Import `ISCLClient` and `buildIntent` from the adapter
2. Construct a `TxIntent` using `buildIntent()` with your action
3. Call `client.txApproveRequest(intent)` to get approval
4. Call `client.txSignAndSend({ intent, approvalTokenId })` to sign

```typescript
import { ISCLClient, buildIntent } from "iscl/adapter";

const client = new ISCLClient();
const intent = buildIntent({
  walletAddress: "0x1234...",
  action: {
    type: "transfer",
    asset: { kind: "erc20", address: "0x833589...", symbol: "USDC", decimals: 6 },
    to: "0xabcd...",
    amount: "500000",
  },
});

// Request approval (prompts user if policy requires it)
const approval = await client.txApproveRequest(intent);
if (!approval.approved) {
  console.log("User declined or policy denied");
  process.exit(1);
}

// Sign and send with approval token
const signed = await client.txSignAndSend({
  intent,
  approvalTokenId: approval.approvalTokenId,
});
console.log("Tx hash:", signed.txHash);
```
