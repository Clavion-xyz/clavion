# API Cookbook

End-to-end curl workflows for common ISCL operations. Each recipe shows the complete sequence of API calls from intent to confirmation.

> **Base URL:** `http://localhost:3100`
> **Prerequisites:** ISCL Core running with at least one wallet imported and RPC configured.

---

## Recipe 1: ERC-20 Token Transfer (Full Pipeline)

Transfer 100 USDC on Base chain.

### Step 1: Check the sender's balance

```bash
curl -s http://localhost:3100/v1/balance/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/0xYourWalletAddress?chainId=8453 | jq
```

```json
{
  "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "account": "0xYourWalletAddress",
  "balance": "500000000",
  "chainId": 8453
}
```

### Step 2: Request approval (build + preflight + approve)

```bash
curl -s -X POST http://localhost:3100/v1/tx/approve-request \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1",
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "timestamp": 1700000000000,
    "chain": { "type": "evm", "chainId": 8453 },
    "wallet": { "address": "0xYourWalletAddress" },
    "action": {
      "type": "transfer",
      "asset": {
        "kind": "erc20",
        "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "symbol": "USDC",
        "decimals": 6
      },
      "to": "0xRecipientAddress",
      "amount": "100000000"
    },
    "constraints": {
      "maxGasWei": "1000000000000000",
      "deadline": 1700003600,
      "maxSlippageBps": 0
    },
    "metadata": { "source": "curl-cookbook", "note": "Send 100 USDC" }
  }' | jq
```

**Response (auto-approved or after user confirms):**

```json
{
  "intentId": "550e8400-e29b-41d4-a716-446655440001",
  "approved": true,
  "approvalTokenId": "tok_abc123...",
  "txRequestHash": "0x1234...abcd",
  "description": "Transfer 100000000 of ERC-20 0x8335... to 0xReci...",
  "riskScore": 15,
  "warnings": []
}
```

### Step 3: Sign and broadcast

```bash
curl -s -X POST http://localhost:3100/v1/tx/sign-and-send \
  -H "Content-Type: application/json" \
  -d '{
    "intent": {
      "version": "1",
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "timestamp": 1700000000000,
      "chain": { "type": "evm", "chainId": 8453 },
      "wallet": { "address": "0xYourWalletAddress" },
      "action": {
        "type": "transfer",
        "asset": {
          "kind": "erc20",
          "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "symbol": "USDC",
          "decimals": 6
        },
        "to": "0xRecipientAddress",
        "amount": "100000000"
      },
      "constraints": {
        "maxGasWei": "1000000000000000",
        "deadline": 1700003600,
        "maxSlippageBps": 0
      },
      "metadata": { "source": "curl-cookbook", "note": "Send 100 USDC" }
    },
    "approvalTokenId": "tok_abc123..."
  }' | jq
```

**Response:**

```json
{
  "intentId": "550e8400-e29b-41d4-a716-446655440001",
  "signedTx": "0x02f8...",
  "txHash": "0xdef456...",
  "broadcast": true,
  "broadcastError": null
}
```

### Step 4: Check the transaction receipt

```bash
curl -s http://localhost:3100/v1/tx/0xdef456... | jq
```

```json
{
  "txHash": "0xdef456...",
  "status": "success",
  "blockNumber": 12345678,
  "gasUsed": "52000"
}
```

---

## Recipe 2: Native ETH Transfer

Send 0.01 ETH on Base.

### Approve and sign (two steps)

```bash
# Step 1: Approve
RESPONSE=$(curl -s -X POST http://localhost:3100/v1/tx/approve-request \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1",
    "id": "660e8400-e29b-41d4-a716-446655440002",
    "timestamp": 1700000000000,
    "chain": { "type": "evm", "chainId": 8453 },
    "wallet": { "address": "0xYourWalletAddress" },
    "action": {
      "type": "transfer_native",
      "to": "0xRecipientAddress",
      "amount": "10000000000000000"
    },
    "constraints": {
      "maxGasWei": "1000000000000000",
      "deadline": 1700003600,
      "maxSlippageBps": 0
    },
    "metadata": { "source": "curl-cookbook" }
  }')

echo "$RESPONSE" | jq

# Extract approval token
TOKEN=$(echo "$RESPONSE" | jq -r '.approvalTokenId')

# Step 2: Sign and send
curl -s -X POST http://localhost:3100/v1/tx/sign-and-send \
  -H "Content-Type: application/json" \
  -d "{
    \"intent\": {
      \"version\": \"1\",
      \"id\": \"660e8400-e29b-41d4-a716-446655440002\",
      \"timestamp\": 1700000000000,
      \"chain\": { \"type\": \"evm\", \"chainId\": 8453 },
      \"wallet\": { \"address\": \"0xYourWalletAddress\" },
      \"action\": {
        \"type\": \"transfer_native\",
        \"to\": \"0xRecipientAddress\",
        \"amount\": \"10000000000000000\"
      },
      \"constraints\": {
        \"maxGasWei\": \"1000000000000000\",
        \"deadline\": 1700003600,
        \"maxSlippageBps\": 0
      },
      \"metadata\": { \"source\": \"curl-cookbook\" }
    },
    \"approvalTokenId\": \"$TOKEN\"
  }" | jq
```

---

## Recipe 3: DEX Swap (Uniswap V3)

Swap 0.1 WETH for USDC on Base.

```bash
curl -s -X POST http://localhost:3100/v1/tx/approve-request \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1",
    "id": "770e8400-e29b-41d4-a716-446655440003",
    "timestamp": 1700000000000,
    "chain": { "type": "evm", "chainId": 8453 },
    "wallet": { "address": "0xYourWalletAddress" },
    "action": {
      "type": "swap_exact_in",
      "router": "0x2626664c2603336E57B271c5C0b26F421741e481",
      "assetIn": {
        "kind": "erc20",
        "address": "0x4200000000000000000000000000000000000006",
        "symbol": "WETH",
        "decimals": 18
      },
      "assetOut": {
        "kind": "erc20",
        "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "symbol": "USDC",
        "decimals": 6
      },
      "amountIn": "100000000000000000",
      "minAmountOut": "250000000"
    },
    "constraints": {
      "maxGasWei": "2000000000000000",
      "deadline": 1700003600,
      "maxSlippageBps": 100
    },
    "metadata": { "source": "curl-cookbook", "note": "Swap 0.1 WETH for USDC" }
  }' | jq
```

Then call `sign-and-send` with the returned approval token (same pattern as Recipe 1).

---

## Recipe 4: DEX Swap via 1inch Aggregator

Same swap but routed through 1inch for potentially better pricing. Requires `ONEINCH_API_KEY` to be set on ISCL Core.

The only difference from Recipe 3 is adding `"provider": "1inch"` and using the 1inch router address:

```bash
curl -s -X POST http://localhost:3100/v1/tx/approve-request \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1",
    "id": "880e8400-e29b-41d4-a716-446655440004",
    "timestamp": 1700000000000,
    "chain": { "type": "evm", "chainId": 8453 },
    "wallet": { "address": "0xYourWalletAddress" },
    "action": {
      "type": "swap_exact_in",
      "router": "0x111111125421cA6dc452d289314280a0f8842A65",
      "provider": "1inch",
      "assetIn": {
        "kind": "erc20",
        "address": "0x4200000000000000000000000000000000000006",
        "symbol": "WETH",
        "decimals": 18
      },
      "assetOut": {
        "kind": "erc20",
        "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "symbol": "USDC",
        "decimals": 6
      },
      "amountIn": "100000000000000000",
      "minAmountOut": "250000000"
    },
    "constraints": {
      "maxGasWei": "2000000000000000",
      "deadline": 1700003600,
      "maxSlippageBps": 100
    },
    "metadata": { "source": "curl-cookbook" }
  }' | jq
```

If 1inch is unavailable (no API key, rate limited, network error), ISCL automatically falls back to Uniswap V3.

---

## Recipe 5: Web Approval Workflow

When `ISCL_APPROVAL_MODE=web`, `approve-request` blocks until a user approves via the web dashboard or API.

### Terminal 1: Submit the intent (blocks)

```bash
curl -s -X POST http://localhost:3100/v1/tx/approve-request \
  -H "Content-Type: application/json" \
  -d '{ ... intent ... }' | jq
# This blocks waiting for approval
```

### Terminal 2: List pending approvals

```bash
curl -s http://localhost:3100/v1/approvals/pending | jq
```

```json
[
  {
    "requestId": "req_abc123",
    "summary": {
      "action": "Transfer 100000000 of ERC-20 0x8335... to 0xReci...",
      "riskScore": 15,
      "warnings": []
    },
    "ttlSeconds": 285
  }
]
```

### Terminal 2: Approve the request

```bash
curl -s -X POST http://localhost:3100/v1/approvals/req_abc123/decide \
  -H "Content-Type: application/json" \
  -d '{ "approved": true }' | jq
```

Terminal 1 unblocks with the approval token.

### Browser: Use the web dashboard

Open `http://localhost:3100/approval-ui` in a browser. The dashboard polls for pending requests and shows Approve/Deny buttons.

---

## Recipe 6: Check Audit History

View recent transaction events:

```bash
curl -s 'http://localhost:3100/v1/approvals/history?limit=5' | jq
```

```json
[
  {
    "id": "evt_001",
    "timestamp": 1700000001000,
    "intentId": "550e8400-...",
    "event": "policy_evaluated",
    "data": { "decision": "allow", "reasons": [] }
  },
  {
    "id": "evt_002",
    "timestamp": 1700000001500,
    "intentId": "550e8400-...",
    "event": "signed",
    "data": { "txHash": "0xdef456..." }
  }
]
```

---

## Recipe 7: Skill Management

### Register a skill

```bash
curl -s -X POST http://localhost:3100/v1/skills/register \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1",
    "name": "my-rebalancer",
    "publisher": {
      "name": "Operator",
      "address": "0xPublisherAddress",
      "contact": "operator@example.com"
    },
    "permissions": {
      "actions": ["transfer"],
      "chains": [8453],
      "network": false,
      "filesystem": false
    },
    "sandbox": {
      "memoryMb": 128,
      "timeoutMs": 30000,
      "allowSpawn": false
    },
    "files": [
      { "path": "run.mjs", "sha256": "abc123..." }
    ],
    "signature": "0x..."
  }' | jq
```

### List registered skills

```bash
curl -s http://localhost:3100/v1/skills | jq
```

### Get skill details

```bash
curl -s http://localhost:3100/v1/skills/my-rebalancer | jq
```

### Revoke a skill

```bash
curl -s -X DELETE http://localhost:3100/v1/skills/my-rebalancer | jq
```

---

## Recipe 8: Health Check

```bash
curl -s http://localhost:3100/v1/health | jq
```

```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 3600.5
}
```

---

## Common Patterns

### Generating UUIDs for intent IDs

```bash
# macOS / Linux
uuidgen | tr '[:upper:]' '[:lower:]'
```

### Computing deadlines

```bash
# 1 hour from now
echo $(( $(date +%s) + 3600 ))
```

### Converting token amounts

| Token | Decimals | 1 Unit in Base | Example |
|-------|----------|---------------|---------|
| USDC | 6 | `1000000` | 100 USDC = `"100000000"` |
| WETH | 18 | `1000000000000000000` | 0.1 WETH = `"100000000000000000"` |
| DAI | 18 | `1000000000000000000` | 50 DAI = `"50000000000000000000"` |

### Error handling

Check HTTP status codes:
- **200** -- Success
- **400** -- Invalid intent (schema validation failure)
- **403** -- Policy denied the operation
- **502** -- RPC error (check RPC configuration)

See the [Error Catalog](errors.md) for detailed error shapes and recovery guidance.

---

## References

- [API Reference](overview.md) -- Full endpoint documentation
- [Error Catalog](errors.md) -- Error shapes and recovery
- [Schema Specification](schemas.md) -- TxIntent and SkillManifest schemas
- [Configuration Reference](../configuration.md) -- Environment variables and policy config
