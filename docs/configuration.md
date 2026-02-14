# Configuration Reference

Complete reference for all environment variables, PolicyConfig fields, and programmatic options.

---

## Environment Variables

### ISCL Core Server

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ISCL_PORT` | number | `3100` | HTTP server listen port |
| `ISCL_HOST` | string | `127.0.0.1` | HTTP server bind address. Set to `0.0.0.0` in Docker to expose externally |
| `ISCL_AUDIT_DB` | string | `./iscl-audit.sqlite` | SQLite database path for audit trace and rate limiting |
| `ISCL_KEYSTORE_PATH` | string | `~/.iscl/keystore` | Directory for encrypted keystore files |
| `ISCL_APPROVAL_MODE` | string | `cli` | Approval UI mode: `cli` (terminal readline), `web` (HTTP dashboard + API), `auto` (auto-approve all — testing only) |

### Multi-Chain RPC

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ISCL_RPC_URL_{chainId}` | string | — | Per-chain RPC URL. Replace `{chainId}` with the numeric chain ID (e.g., `ISCL_RPC_URL_1` for Ethereum, `ISCL_RPC_URL_8453` for Base) |
| `BASE_RPC_URL` | string | — | Legacy fallback. Maps to chain 8453 (Base). Overridden by `ISCL_RPC_URL_8453` if both set |

Supported chains: Ethereum (1), Optimism (10), Arbitrum (42161), Base (8453). See [Multi-Chain Operations](operations/multi-chain.md) for chain-specific details.

**Resolution logic** (from `parseRpcEnv` in `packages/core/src/rpc/parse-rpc-env.ts`):

1. Scan all env vars matching `ISCL_RPC_URL_{digits}` — add each to the URL map
2. If `BASE_RPC_URL` is set and `ISCL_RPC_URL_8453` is NOT set, add `BASE_RPC_URL` as chain 8453
3. If only one URL found — create a single `ViemRpcClient` (backward compatible)
4. If multiple URLs found — create a `RpcRouter` that dispatches per-chain

### DEX Aggregation

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ONEINCH_API_KEY` | string | — | Optional API key for 1inch Swap API v6. When set, swap intents with `provider: "1inch"` use 1inch routing. When absent, all swaps use Uniswap V3 |

### Demo / Development

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ISCL_DEMO_PASSPHRASE` | string | `test-passphrase-123` | Passphrase for demo keystore auto-unlock (used by `demo-boot.ts` only) |
| `ISCL_AUTO_APPROVE` | string | `false` | Set to `"true"` to auto-approve all transactions. Demo environments only |

### Adapter-Specific

**Telegram Bot** (`@clavion/adapter-telegram`):

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | string | — | Telegram Bot API token (required) |
| `ISCL_WALLET_ADDRESS` | string | — | Wallet address for all bot operations (required) |
| `ISCL_CHAIN_ID` | number | `8453` | Default chain ID for Telegram bot operations |
| `ISCL_TELEGRAM_ALLOWED_CHATS` | string | — | Comma-separated Telegram chat IDs authorized to use the bot |
| `ISCL_API_URL` | string | `http://127.0.0.1:3000` | ISCL Core API endpoint |
| `ISCL_TIMEOUT_MS` | number | `30000` | Timeout for ISCL API calls in milliseconds |

**MCP Adapter** (`@clavion/adapter-mcp`):

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ISCL_API_URL` | string | `http://127.0.0.1:3000` | ISCL Core API endpoint |

**Eliza Plugin** (`@clavion/plugin-eliza`):

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ISCL_API_URL` | string | `http://127.0.0.1:3000` | ISCL Core API endpoint (ElizaOS runtime setting) |
| `ISCL_WALLET_ADDRESS` | string | — | Wallet address for plugin actions (ElizaOS runtime setting) |
| `ISCL_CHAIN_ID` | number | `8453` | Default chain ID |

---

## PolicyConfig

The PolicyConfig controls which transactions are allowed, denied, or require user approval. It can be provided as a JSON file (via `ISCL_POLICY_CONFIG_PATH` or `--policy-config` flag) or programmatically via `AppOptions.policyConfig`.

### Schema

All fields are required. `additionalProperties: false` — no undocumented fields.

| Field | Type | Default | Constraints | Description |
|-------|------|---------|-------------|-------------|
| `version` | `"1"` | `"1"` | Literal `"1"` | Schema version |
| `maxValueWei` | string | `"0"` | Numeric string (`^[0-9]+$`) | Maximum transaction value in wei. `"0"` means deny all value-bearing transactions |
| `maxApprovalAmount` | string | `"0"` | Numeric string | Maximum ERC-20 approval amount. `"0"` means deny all approvals |
| `contractAllowlist` | string[] | `[]` | Array of `0x`-prefixed 40-hex addresses | Contracts allowed for swaps/approvals. Empty array = allow all contracts |
| `tokenAllowlist` | string[] | `[]` | Array of `0x`-prefixed 40-hex addresses | Tokens allowed for transfers/swaps. Empty array = allow all tokens |
| `allowedChains` | number[] | `[1, 10, 42161, 8453]` | Array of positive integers, min 1 item | Chain IDs allowed for transactions |
| `recipientAllowlist` | string[] | `[]` | Array of `0x`-prefixed 40-hex addresses | Recipients allowed for transfers. Empty array = allow all recipients |
| `maxRiskScore` | integer | `50` | 0--100 | Risk score threshold. Transactions scoring above this require user approval |
| `requireApprovalAbove` | object | `{"valueWei":"0"}` | Object with `valueWei` numeric string | Value threshold for mandatory user approval |
| `maxTxPerHour` | integer | `10` | Minimum 1 | Maximum transactions per wallet per rolling hour |

### Default Policy

The default policy (when no config file is provided) denies all value-bearing transactions:

```json
{
  "version": "1",
  "maxValueWei": "0",
  "maxApprovalAmount": "0",
  "contractAllowlist": [],
  "tokenAllowlist": [],
  "allowedChains": [1, 10, 42161, 8453],
  "recipientAllowlist": [],
  "maxRiskScore": 50,
  "requireApprovalAbove": { "valueWei": "0" },
  "maxTxPerHour": 10
}
```

This is fail-closed by design — you must explicitly configure limits to allow transactions.

### Example: Restrictive Policy

```json
{
  "version": "1",
  "maxValueWei": "1000000000000000000",
  "maxApprovalAmount": "1000000000000000000",
  "contractAllowlist": ["0x2626664c2603336E57B271c5C0b26F421741e481"],
  "tokenAllowlist": [
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "0x4200000000000000000000000000000000000006"
  ],
  "allowedChains": [8453],
  "recipientAllowlist": ["0xYourTrustedRecipient"],
  "maxRiskScore": 30,
  "requireApprovalAbove": { "valueWei": "500000000000000000" },
  "maxTxPerHour": 5
}
```

### Example: Permissive Policy (for development)

```json
{
  "version": "1",
  "maxValueWei": "100000000000000000000",
  "maxApprovalAmount": "100000000000000000000",
  "contractAllowlist": [],
  "tokenAllowlist": [],
  "allowedChains": [1, 10, 42161, 8453],
  "recipientAllowlist": [],
  "maxRiskScore": 80,
  "requireApprovalAbove": { "valueWei": "10000000000000000000" },
  "maxTxPerHour": 100
}
```

---

## Policy Evaluation Rules

The policy engine evaluates TxIntents in this order. The first `deny` stops evaluation. `require_approval` is accumulated. If no denials, the decision is the highest priority outcome. See [Risk Scoring](security/risk-scoring.md) for details on how risk scores are computed.

| # | Rule | Condition | Decision |
|---|------|-----------|----------|
| 1 | Chain restriction | `chainId` not in `allowedChains` | **deny** |
| 2 | Token allowlist | Token address not in `tokenAllowlist` (when list is non-empty) | **deny** |
| 3 | Contract allowlist | Router/spender not in `contractAllowlist` (when list is non-empty) | **deny** |
| 4 | Value limit | Value > `maxValueWei` (when maxValueWei > 0) | **deny** |
| 5 | Approval amount limit | Approval amount > `maxApprovalAmount` (when > 0) | **deny** |
| 6 | Recipient allowlist | Transfer recipient not in `recipientAllowlist` (when list is non-empty) | **deny** |
| 7 | Risk score | `riskScore > maxRiskScore` (from preflight) | **require_approval** |
| 8 | Rate limit | Recent transactions >= `maxTxPerHour` | **deny** |

**Decision priority:** deny > require_approval > allow

Empty allowlists (`[]`) are permissive — they allow all values. This applies to `contractAllowlist`, `tokenAllowlist`, and `recipientAllowlist`.

### Value Extraction per Action Type

| Action Type | Value Used | Contract Checked | Tokens Checked |
|-------------|-----------|-----------------|----------------|
| `transfer` | `amount` | — | `asset.address` |
| `transfer_native` | `amount` | — | — |
| `approve` | `amount` | `spender` | `asset.address` |
| `swap_exact_in` | `amountIn` | `router` | `assetIn.address`, `assetOut.address` |
| `swap_exact_out` | `maxAmountIn` | `router` | `assetIn.address`, `assetOut.address` |

---

## AppOptions (Programmatic)

When using `buildApp()` directly (for testing or custom entry points), these options are available. See the [API Overview](api/overview.md) for endpoint documentation.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `logger` | boolean | `true` | Enable pino structured logging |
| `auditDbPath` | string | `./iscl-audit.sqlite` | SQLite path for audit + rate limiting |
| `keystorePath` | string | `~/.iscl/keystore` | Encrypted keystore directory |
| `policyConfigPath` | string | — | Path to PolicyConfig JSON file |
| `policyConfig` | PolicyConfig | default (deny-all) | Inline policy config (overrides file path) |
| `rpcClient` | RpcClient | — | Pre-configured RPC client (enables preflight + broadcast) |
| `promptFn` | PromptFn | — | Custom approval prompt function. Overrides `approvalMode` |
| `approvalMode` | `"cli" \| "web" \| "auto"` | `"cli"` | Approval mode (only used when `promptFn` not set) |
| `skillRegistryDbPath` | string | same as `auditDbPath` | SQLite path for skill registry |
| `oneInchApiKey` | string | — | 1inch DEX aggregator API key |

**PromptFn signature:**

```typescript
type PromptFn = (summary: ApprovalSummary) => Promise<boolean>;
```

The function receives a full `ApprovalSummary` (action, risk score, balance diffs, warnings) and returns `true` to approve or `false` to deny.
