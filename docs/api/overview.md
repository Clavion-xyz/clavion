# ISCL API Reference

Base URL: `http://127.0.0.1:3100`

All responses include the header `X-ISCL-Version: 0.1.0`.

> See also: [Error Catalog](errors.md) for a complete reference of every HTTP error returned by every endpoint.

---

## GET /v1/health

Health check endpoint.

**Response (200):**
```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 42.123
}
```

**Example:**
```bash
curl http://localhost:3100/v1/health
```

---

## POST /v1/tx/build

Build a transaction from a TxIntent. Evaluates policy before building.

**Request Body:** TxIntent (see schema below)

**Response (200):**
```json
{
  "intentId": "550e8400-e29b-41d4-a716-446655440000",
  "txRequestHash": "0x1234...abcd",
  "description": "Transfer 1000000 USDC to 0xabcd...",
  "txRequest": {
    "to": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "data": "0xa9059cbb...",
    "value": "0",
    "chainId": 8453,
    "type": "eip1559",
    "maxFeePerGas": "0",
    "maxPriorityFeePerGas": "0"
  },
  "policyDecision": {
    "decision": "allow",
    "reasons": ["All checks passed"],
    "policyVersion": "1"
  }
}
```

**Response (403) — Policy denied:**
```json
{
  "error": "policy_denied",
  "decision": "deny",
  "reasons": ["Chain 999 not in allowed chains [8453]"],
  "policyVersion": "1"
}
```

**Response (400) — Invalid intent:**
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "body/action must be object"
}
```

**Example:**
```bash
curl -X POST http://localhost:3100/v1/tx/build \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": 1700000000,
    "chain": { "type": "evm", "chainId": 8453 },
    "wallet": { "address": "0x1234567890abcdef1234567890abcdef12345678" },
    "action": {
      "type": "transfer",
      "asset": { "kind": "erc20", "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "symbol": "USDC", "decimals": 6 },
      "to": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      "amount": "1000000"
    },
    "constraints": { "maxGasWei": "1000000000000000", "deadline": 1700003600, "maxSlippageBps": 100 }
  }'
```

---

## POST /v1/tx/preflight

Simulate a transaction and compute a risk score. Requires `BASE_RPC_URL` to be configured.

**Request Body:** TxIntent

**Response (200):**
```json
{
  "intentId": "550e8400-e29b-41d4-a716-446655440000",
  "simulationSuccess": true,
  "gasEstimate": "65000",
  "balanceDiffs": [
    { "asset": "USDC", "delta": "-1000000", "before": "100000000", "after": "99000000" }
  ],
  "allowanceChanges": [],
  "riskScore": 0,
  "riskReasons": [],
  "warnings": []
}
```

**Response (502) — No RPC configured:**
```json
{
  "error": "no_rpc_client",
  "message": "PreflightService requires an RPC client, which is not configured."
}
```

---

## POST /v1/tx/approve-request

Generate an approval summary, prompt the user for confirmation (if required by policy), and return an approval token.

When the policy decision is `require_approval`, the Core daemon prompts the operator in the terminal for confirmation. If the operator approves, a single-use approval token is returned. If the policy decision is `allow`, no prompt occurs and no token is needed.

**Request Body:** TxIntent

**Response (200) — Policy allows (no approval needed):**
```json
{
  "intentId": "550e8400-e29b-41d4-a716-446655440000",
  "txRequestHash": "0x1234...abcd",
  "description": "Transfer 1000000 USDC to 0xabcd...",
  "policyDecision": {
    "decision": "allow",
    "reasons": ["All checks passed"],
    "policyVersion": "1"
  },
  "riskScore": 0,
  "riskReasons": [],
  "warnings": [],
  "gasEstimate": "65000",
  "balanceDiffs": [],
  "approvalRequired": false,
  "approved": true
}
```

**Response (200) — Approval required and granted:**
```json
{
  "intentId": "550e8400-e29b-41d4-a716-446655440000",
  "txRequestHash": "0x1234...abcd",
  "description": "Transfer 1000000 USDC to 0xabcd...",
  "policyDecision": {
    "decision": "require_approval",
    "reasons": ["Value 1000000 exceeds approval threshold 0"],
    "policyVersion": "1"
  },
  "riskScore": 0,
  "riskReasons": [],
  "warnings": [],
  "gasEstimate": "0",
  "balanceDiffs": [],
  "approvalRequired": true,
  "approved": true,
  "approvalTokenId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response (403) — User declined:**
```json
{
  "intentId": "550e8400-e29b-41d4-a716-446655440000",
  "txRequestHash": "0x1234...abcd",
  "policyDecision": { "decision": "require_approval", "reasons": ["..."], "policyVersion": "1" },
  "approvalRequired": true,
  "approved": false,
  "reason": "user_declined"
}
```

**Response (403) — Policy denied:**
```json
{
  "error": "policy_denied",
  "decision": "deny",
  "reasons": ["Chain 999 not in allowed chains [8453]"],
  "policyVersion": "1"
}
```

---

## POST /v1/tx/sign-and-send

Sign a transaction. Requires an unlocked key in the keystore. If policy requires approval, an `approvalTokenId` must be provided.

**Request Body:**
```json
{
  "intent": { ... },
  "approvalTokenId": "optional-uuid"
}
```

**Response (200):**
```json
{
  "signedTx": "0x02f8...",
  "txHash": "0xabcd...1234",
  "intentId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (403) — Policy denied:**
```json
{ "error": "policy_denied", "reasons": ["..."] }
```

**Response (403) — Approval required:**
```json
{ "error": "approval_required", "message": "This transaction requires an approval token.", "txRequestHash": "0x..." }
```

**Response (403) — Signing failed:**
```json
{ "error": "signing_failed", "message": "Key for address 0x... is not unlocked" }
```

---

## GET /v1/tx/:hash

Look up a transaction receipt by hash. Requires `BASE_RPC_URL` to be configured.

**Path Parameters:**
- `hash` — Transaction hash (`0x` + 64 hex chars)

**Response (200):**
```json
{
  "transactionHash": "0xabcd...1234",
  "status": "success",
  "blockNumber": "12345678",
  "blockHash": "0x...",
  "gasUsed": "21000",
  "effectiveGasPrice": "1000000000",
  "from": "0x1234...",
  "to": "0xabcd...",
  "contractAddress": null,
  "logs": []
}
```

**Response (404) — Not found:**
```json
{ "error": "not_found", "message": "Transaction receipt not found. It may be pending or the hash is invalid." }
```

**Response (502) — No RPC configured:**
```json
{ "error": "no_rpc_client", "message": "Transaction receipt lookup requires an RPC client, which is not configured." }
```

**Example:**
```bash
curl http://localhost:3100/v1/tx/0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
```

---

## GET /v1/balance/:token/:account

Look up an ERC-20 token or native ETH balance. Requires an RPC endpoint to be configured.

**Path Parameters:**
- `token` — ERC-20 contract address (`0x` + 40 hex chars)
- `account` — Wallet address (`0x` + 40 hex chars)

**Query Parameters:**
- `chainId` — (optional) Target chain ID for multi-chain setups. Uses primary RPC if omitted.

**Response (200):**
```json
{
  "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "account": "0x1234567890abcdef1234567890abcdef12345678",
  "balance": "1000000"
}
```

**Response (502) — No RPC configured:**
```json
{ "error": "no_rpc_client", "message": "Balance lookup requires an RPC client, which is not configured." }
```

**Response (502) — RPC failure:**
```json
{ "error": "rpc_error", "message": "connection refused" }
```

**Example:**
```bash
# Balance on default chain
curl http://localhost:3100/v1/balance/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/0x1234567890abcdef1234567890abcdef12345678

# Balance on Ethereum mainnet
curl "http://localhost:3100/v1/balance/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/0x1234...?chainId=1"
```

---

## Web Approval Endpoints

These endpoints power the web approval dashboard (`ISCL_APPROVAL_MODE=web`). Used by the browser-based approval UI and the Telegram bot adapter.

### GET /v1/approvals/pending

List all pending approval requests awaiting human decision.

**Response (200):**
```json
{
  "pending": [
    {
      "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "summary": {
        "intentId": "550e8400-e29b-41d4-a716-446655440000",
        "action": "transfer",
        "recipient": "0xabcd...1234",
        "expectedOutcome": "Transfer 1000000 USDC to 0xabcd...",
        "riskScore": 20,
        "riskReasons": [],
        "warnings": [],
        "gasEstimateEth": "65000 gas",
        "txRequestHash": "0x1234...abcd",
        "balanceDiffs": []
      },
      "createdAt": 1700000000000,
      "expiresAt": 1700000300000
    }
  ]
}
```

### POST /v1/approvals/:requestId/decide

Submit an approve or deny decision for a pending request.

**Path Parameters:**
- `requestId` — The pending approval request ID

**Request Body:**
```json
{ "approved": true }
```

**Response (200):**
```json
{ "decided": true, "requestId": "a1b2c3d4...", "approved": true }
```

**Response (404) — Not found or expired:**
```json
{ "error": "not_found", "message": "Approval request not found or expired." }
```

### GET /v1/approvals/history

Recent audit events for the approval dashboard.

**Query Parameters:**
- `limit` — (optional) Number of events to return, 1-100. Default: 20.

**Response (200):**
```json
{
  "events": [
    {
      "event": "tx_built",
      "intentId": "550e8400-...",
      "timestamp": 1700000000000,
      "data": { "txRequestHash": "0x1234...", "description": "Transfer 1000000 USDC to 0xabcd..." }
    }
  ]
}
```

### GET /approval-ui

Serves the web approval dashboard as a single HTML page. Dark theme, auto-polling, zero external dependencies.

```bash
open http://localhost:3100/approval-ui
```

---

## Skill Registry Endpoints

### POST /v1/skills/register

Register a skill manifest. Validates schema, verifies ECDSA signature, checks file hashes, and runs static analysis.

**Request Body:** SkillManifest (see [schemas.md](schemas.md))

**Response (200):**
```json
{ "registered": true, "name": "my-skill", "publisherAddress": "0x1234..." }
```

### GET /v1/skills

List all active registered skills.

**Response (200):**
```json
{ "skills": [{ "name": "my-skill", "publisherAddress": "0x1234...", "status": "active" }] }
```

### GET /v1/skills/:name

Get a registered skill by name.

**Response (200):**
```json
{ "name": "my-skill", "publisherAddress": "0x1234...", "manifest": { ... }, "status": "active" }
```

### DELETE /v1/skills/:name

Revoke a registered skill. Audit-logged as `skill_revoked`.

**Response (200):**
```json
{ "revoked": true, "name": "my-skill" }
```

---

## TxIntent Schema (v1)

```typescript
{
  version: "1",
  id: string,           // UUID v4
  timestamp: number,     // Unix epoch (seconds)
  chain: {
    type: "evm",
    chainId: number,     // 1, 10, 42161, 8453
    rpcHint?: string
  },
  wallet: {
    address: string,     // 0x-prefixed, 40 hex chars
    profile?: string
  },
  action: TransferAction | TransferNativeAction | ApproveAction | SwapExactInAction | SwapExactOutAction,
  constraints: {
    maxGasWei: string,   // Integer as string
    deadline: number,    // Unix epoch
    maxSlippageBps: number  // 0-10000
  },
  preferences?: { speed?: string, privateRelay?: boolean },
  metadata?: { source?: string, note?: string }
}
```

### Action Types

**Transfer:** `{ type: "transfer", asset: Asset, to: string, amount: string }`

**Transfer Native:** `{ type: "transfer_native", to: string, amount: string }` — Native ETH, no asset field.

**Approve:** `{ type: "approve", asset: Asset, spender: string, amount: string }`

**Swap Exact In:** `{ type: "swap_exact_in", router: string, provider?: "uniswap_v3" | "1inch", assetIn: Asset, assetOut: Asset, amountIn: string, minAmountOut: string }`

**Swap Exact Out:** `{ type: "swap_exact_out", router: string, provider?: "uniswap_v3" | "1inch", assetIn: Asset, assetOut: Asset, amountOut: string, maxAmountIn: string }`

**Asset:** `{ kind: "erc20", address: string, symbol?: string, decimals?: number }`

### Supported Chains

| Chain | Chain ID | Env Var |
|-------|----------|---------|
| Ethereum | 1 | `ISCL_RPC_URL_1` |
| Optimism | 10 | `ISCL_RPC_URL_10` |
| Arbitrum | 42161 | `ISCL_RPC_URL_42161` |
| Base | 8453 | `ISCL_RPC_URL_8453` or `BASE_RPC_URL` |
