# Eliza (ElizaOS) Integration Guide

This guide covers setting up the Clavion plugin for ElizaOS (`@clavion/plugin-eliza`), which replaces the standard `@elizaos/plugin-evm` wallet management with ISCL's policy-enforced, audited signing pipeline.

---

## Overview

The Eliza plugin provides 5 actions that an ElizaOS agent can invoke through natural language:

| Action | NLP Similes | Description |
|--------|-------------|-------------|
| `CLAVION_TRANSFER` | SEND_TOKENS, TRANSFER_TOKENS | ERC-20 token transfer |
| `CLAVION_TRANSFER_NATIVE` | SEND_ETH, TRANSFER_ETH | Native ETH transfer |
| `CLAVION_APPROVE` | APPROVE_TOKENS, SET_ALLOWANCE | ERC-20 spending approval |
| `CLAVION_SWAP` | SWAP_TOKENS, EXCHANGE_TOKENS | DEX swap (Uniswap V3 or 1inch) |
| `CLAVION_CHECK_BALANCE` | CHECK_BALANCE, GET_BALANCE | Read-only balance lookup |

### Key Difference from plugin-evm

`@elizaos/plugin-evm` stores the private key in the character config (`EVM_PRIVATE_KEY`) and signs directly in action handlers. **Clavion replaces this entirely.** The agent never sees the private key -- it only knows `ISCL_API_URL` and `ISCL_WALLET_ADDRESS`. All signing goes through ISCL Core's secure pipeline.

---

## Prerequisites

- **ElizaOS v1.7+** installed and configured
- **ISCL Core running** on `localhost:3100`
- **A wallet imported** into the ISCL keystore
- **RPC configured** for your target chain(s)
- **Node.js 20+**

---

## Step 1: Install the Plugin

If running from the Clavion monorepo:

```bash
npm install
npm run build
```

If using as a standalone package (future npm publish):

```bash
npm install @clavion/plugin-eliza
```

---

## Step 2: Configure the Character File

Create or modify your ElizaOS character file to include the Clavion plugin:

```json
{
  "name": "SecureCryptoAgent",
  "modelProvider": "anthropic",
  "bio": [
    "A crypto-capable AI agent with secure key isolation.",
    "Uses Clavion/ISCL for all transaction signing.",
    "Can transfer tokens, swap on DEXs, and check balances."
  ],
  "settings": {
    "secrets": {
      "ISCL_API_URL": "http://localhost:3100",
      "ISCL_WALLET_ADDRESS": "0xYourWalletAddress"
    }
  },
  "plugins": ["@clavion/plugin-eliza"],
  "style": {
    "all": ["Be concise about transaction details", "Always confirm amounts before executing"]
  }
}
```

**Important:** Do NOT include `EVM_PRIVATE_KEY`. The whole point of Clavion is that private keys stay in ISCL Core, never in the agent config.

### Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| `settings.secrets.ISCL_API_URL` | Yes | URL of the running ISCL Core instance |
| `settings.secrets.ISCL_WALLET_ADDRESS` | Yes | Wallet address managed by ISCL Core |

---

## Step 3: Start ISCL Core

```bash
# Base chain with web approval
ISCL_APPROVAL_MODE=web \
ISCL_RPC_URL_8453=https://mainnet.base.org \
npm run dev
```

---

## Step 4: Start the ElizaOS Agent

```bash
# From your ElizaOS directory
npx eliza --character path/to/your-character.json
```

On startup, the `ClavionService` initializes:
1. Reads `ISCL_API_URL` from the character secrets
2. Creates an `ISCLClient` HTTP client
3. Calls `/v1/health` to verify ISCL Core is reachable
4. Logs the Core version

The `walletProvider` then injects wallet context into the agent's prompt:
1. Reads `ISCL_WALLET_ADDRESS` from secrets
2. Fetches balances from ISCL Core
3. Provides context like "Clavion Wallet: 0x... | USDC Balance: 500.00"

---

## Plugin Components

### ClavionService

The service manages the `ISCLClient` lifecycle:

```typescript
class ClavionService implements Service {
  async initialize(runtime: IAgentRuntime): Promise<void> {
    const apiUrl = await runtime.getSetting("ISCL_API_URL");
    this.client = new ISCLClient({ baseUrl: apiUrl });
    await this.client.health(); // Verify Core is reachable
  }

  getClient(): ISCLClient { ... }
}
```

### walletProvider

Injects wallet address and balance context into the agent's LLM prompt before each action decision:

```
Clavion Wallet: 0xYourWalletAddress
Chain: Base (8453)
USDC Balance: 500.00
ETH Balance: 0.15
```

This context helps the agent understand what assets are available when deciding how to respond to user requests.

### Action Handlers

Each action follows the same pipeline:

1. **Validate** -- Check that `ISCL_API_URL` is configured
2. **Extract parameters** -- Use LLM template to parse user's natural language into structured parameters (token, amount, recipient)
3. **Build TxIntent** -- Construct a TxIntent v1 JSON object with the extracted parameters
4. **Execute pipeline** -- Call `approve-request` then `sign-and-send` through the ISCLClient
5. **Return result** -- Report success or failure via callback

### LLM Parameter Extraction

Actions use prompt templates to extract structured parameters from natural language:

```
User: "Send 100 USDC to 0xAlice"
      ↓ LLM template extraction
{ "token": "USDC", "to": "0xAlice...", "amount": "100" }
      ↓ Intent builder
TxIntent { action: { type: "transfer", amount: "100000000", ... } }
```

The LLM handles ambiguity, unit conversion, and symbol resolution. The intent builder handles the precise schema construction.

---

## Usage Examples

### Transfer Tokens

**User:** "Send 50 USDC to 0xBob"

**Agent response:** "I'll transfer 50 USDC to 0xBob on Base. Requesting approval..."

*(Transaction goes through ISCL pipeline: policy check, preflight simulation, user approval, signing, broadcast)*

**Agent response:** "Transfer complete! TX: 0xabc123..."

### Check Balance

**User:** "What's my balance?"

**Agent response:** "Your wallet (0xYour...) has 450.00 USDC and 0.15 ETH on Base."

### Swap Tokens

**User:** "Swap 0.1 WETH for USDC"

**Agent response:** "I'll swap 0.1 WETH for USDC via Uniswap V3 on Base. Estimated output: ~250 USDC. Requesting approval..."

---

## Approval Handling

When ISCL Core requires user approval (based on policy rules), the action handler waits for the approval response. The timeout is 60 seconds by default.

| Approval Mode | Behavior |
|---------------|----------|
| `cli` | Prompt appears in the ISCL Core terminal |
| `web` | Request appears on the web dashboard and/or Telegram bot |
| `auto` | Auto-approved (testing only) |

If approval is denied or times out, the agent reports the failure to the user.

---

## Removing plugin-evm

If your character previously used `@elizaos/plugin-evm`, remove it to avoid conflicts:

1. Remove `"@elizaos/plugin-evm"` from the `plugins` array
2. Remove `EVM_PRIVATE_KEY` from `settings.secrets`
3. Add `"@clavion/plugin-eliza"` to the `plugins` array
4. Add `ISCL_API_URL` and `ISCL_WALLET_ADDRESS` to `settings.secrets`

The two plugins are not designed to run simultaneously. Clavion replaces all wallet management functionality.

---

## Multi-Chain Support

The plugin uses Base (chain ID 8453) as the default chain. To use other chains, the agent can specify the chain in natural language:

**User:** "Send 1 ETH to 0xAlice on Ethereum mainnet"

The LLM parameter extraction recognizes chain names and maps them to chain IDs. Ensure ISCL Core has the corresponding RPC URL configured.

---

## Troubleshooting

### "ClavionService not initialized"

The service failed to initialize at startup. Check:
1. Is `ISCL_API_URL` set in the character's `settings.secrets`?
2. Is ISCL Core running at that URL?
3. Check the agent logs for health check errors

### Agent doesn't recognize crypto commands

Ensure the plugin is listed in the character's `plugins` array. The action `similes` (SEND_TOKENS, SWAP_TOKENS, etc.) help the LLM match user intent to the correct action.

### "Policy denied" errors

The transaction was blocked by ISCL Core's policy engine. Check:
- Is the token on the policy's `tokenAllowlist`?
- Is the recipient on the `recipientAllowlist`?
- Does the value exceed `maxValueWei`?
- Has the wallet exceeded `maxTxPerHour`?

### Parameter extraction failures

If the agent misparses amounts or addresses, check the LLM template quality. Common issues:
- Ambiguous token names (use addresses for precision)
- Amounts without units ("send 100" -- 100 of what?)
- Checksummed vs. lowercase addresses

---

## Security Model

The Eliza plugin is a Domain A adapter:

- **No key access.** The plugin never sees private keys. It only knows the wallet address.
- **Full pipeline enforcement.** Every transaction goes through policy evaluation, preflight simulation, and user approval.
- **Audit trail.** All operations are logged with `source: "eliza-adapter"` for traceability.
- **ISCLClient is local-only.** The HTTP client connects to ISCL Core on localhost.

Even if the ElizaOS agent is compromised (prompt injection, malicious plugin), it cannot bypass ISCL's security gates.

---

## References

- [Eliza Adapter Plan](eliza-adapter-plan.md) -- Original design plan with code patterns
- [Adapter Development Tutorial](../development/adapter-tutorial.md) -- How adapters are built
- [API Reference](../api/overview.md) -- Endpoints used by the plugin
- [Configuration Reference](../configuration.md) -- Environment variables and policy settings
- [ElizaOS Documentation](https://elizaos.github.io/eliza/) -- Official ElizaOS docs
