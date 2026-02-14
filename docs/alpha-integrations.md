# Alpha Release — Integration Roadmap

## Essential for Alpha

### 1. MCP (Model Context Protocol) Server ✅

MCP is the standard way AI models call external tools. Claude Desktop, Cursor, Windsurf, and other MCP-compatible clients would be able to use Clavion directly.

Expose the same operations (transfer, swap, approve, balance) as MCP tools. Thin adapter layer, similar in scope to the existing OpenClaw adapter.

**Why essential:** OpenClaw is niche. MCP gives access to Claude Desktop + every AI-enabled IDE — that's where the users are.

**Status:** Implemented as `@clavion/adapter-mcp` — 6 MCP tools (transfer, transfer_native, approve, swap, balance, tx_status), 39 unit tests passing. Package: `packages/adapter-mcp/`.

### 2. Web Approval UI ✅

A minimal local web UI that shows:
- Transaction summary (asset, amount, recipient)
- Risk score with color-coded bar (green/yellow/red)
- Approve / Deny buttons with countdown timer
- Balance diffs and warnings
- Recent transaction history from the audit log

Served inline on `GET /approval-ui` alongside the REST API on localhost. Zero external dependencies — single HTML page with embedded CSS/JS.

**Why essential:** CLI-only approval is a demo, not a product.

**Status:** Implemented in `@clavion/core` — `PendingApprovalStore` bridges blocking `promptFn` with async HTTP endpoints. `ISCL_APPROVAL_MODE=web|cli|auto` env var selects mode. API: `GET /v1/approvals/pending`, `POST /v1/approvals/:id/decide`, `GET /v1/approvals/history`. 21 new tests (9 PendingApprovalStore + 6 route + 2 audit + 4 integration). 511 total tests passing.

### 3. Multi-Chain Support (Ethereum Mainnet + L2s) ✅

Supports 4 chains: Ethereum (1), Optimism (10), Arbitrum (42161), Base (8453).

`RpcRouter` implements `RpcClient` and routes calls per-chain. `parseRpcEnv()` reads `ISCL_RPC_URL_{chainId}` env vars with `BASE_RPC_URL` backward compatibility. Swap builder validates per-chain Uniswap V3 router addresses. Balance route accepts `?chainId=N`. All TX routes resolve chain-scoped RPC before preflight, approval, and broadcast.

**Why essential:** Base-only is too limiting. Most users have assets on mainnet.

**Status:** Implemented across `@clavion/core`, `@clavion/preflight`, `@clavion/policy`, and all 3 adapters. 28 new tests (12 RpcRouter unit + 7 parseRpcEnv unit + 9 integration). 490 total tests passing. Zero breaking changes — single-chain mode preserved.

### 4. ElizaOS (ai16z) Plugin ✅

ElizaOS is the de facto standard for AI agent development in Web3 — 90+ community plugins, crypto-native. Existing EVM plugins store private keys in character config and sign directly. Clavion replaces this with policy-enforced signing.

Plugin replaces `@elizaos/plugin-evm`'s wallet layer with 5 actions (transfer, transfer_native, approve, swap, balance), a wallet context provider, and a service for ISCLClient lifecycle. Character config uses `ISCL_API_URL` instead of `EVM_PRIVATE_KEY`.

**Why important:** Direct access to the crypto-AI community. Eliza agents are the primary users who need secure key isolation.

**Status:** Implemented as `@clavion/plugin-eliza` — 5 actions, ClavionService, walletProvider, full ElizaOS runtime integration tests. 84 tests (72 unit + 12 integration with real AgentRuntime). Package: `packages/plugin-eliza/`.

See: [Detailed plan](integrations/eliza-adapter-plan.md)

## Important (Should Have)

### 5. 1inch / DEX Aggregator ✅

Added 1inch Swap API v6 as an alternative swap backend alongside Uniswap V3:
- Optional `provider: "1inch"` field on swap actions (backward compatible)
- `ONEINCH_API_KEY` env var enables 1inch — falls back to Uniswap V3 when absent or on failure
- `buildFromIntent()` is now async to support the 1inch HTTP call
- 1inch AggregationRouterV6 (`0x111111125421cA6dc452d289314280a0f8842A65`) on all 4 chains
- `swap_exact_out` always uses Uniswap V3 (1inch only supports exact-input)
- All 4 adapters updated to pass `provider` through

**Status:** Implemented in `@clavion/core` (OneInchClient, swap-oneinch-builder, async buildFromIntent). 28 new tests (8 client + 12 builder + 6 integration + 2 fixture). 639 total tests passing. Zero new dependencies.

### 6. Existing Wallet Import ✅ (partial)

Let users bring their existing wallets:
- **Private key import** ✅ — CLI-only (`clavion-cli key import`), reads key from stdin, encrypts with scrypt + AES-256-GCM
- **Mnemonic import** ✅ — CLI-only (`clavion-cli key import-mnemonic`), BIP-39 validation, HD derivation (m/44'/60'/N'/0/N), mnemonic never stored
- **WalletConnect v2** — deferred (requires WalletService refactor for external signers)

**Status:** Implemented in `@clavion/signer` (mnemonic.ts, keystore.importMnemonic) + `@clavion/cli` (4 commands: import, import-mnemonic, generate, list). Masked passphrase input, injectable I/O for tests, audit logging. 44 new tests (17 mnemonic + 7 keystore-mnemonic + 16 CLI + 4 security). 611 total tests passing. Zero new dependencies.

### 7. Telegram Bot Adapter ✅

Same-chat Telegram bot: users send commands (`/transfer`, `/swap`, etc.), bot builds intents, shows approval cards with inline Approve/Deny buttons, and broadcasts transactions. Uses grammY framework, polls the web approval API (`/v1/approvals/pending`).

**Status:** Implemented as `@clavion/adapter-telegram` — 7 commands, split approval pipeline (background approve + poll + inline keyboard), auth middleware (chat allowlist + sender verification). 56 new tests. 567 total tests passing. Package: `packages/adapter-telegram/`.

## Nice-to-Have (Post-Alpha)

| Integration | Rationale |
|-------------|-----------|
| LangChain/LangGraph tools | Popular AI framework, but MCP covers most users |
| OpenAI function calling | GPT-based agents, JSON Schema tool defs + webhook |
| Hardware wallets (Ledger/Trezor) | Security-conscious users, complex USB/HID integration |
| Aave/Compound builders | Lending/borrowing — expands DeFi capabilities |
| ENS resolution | "Send 50 USDC to vitalik.eth" — quality of life |
| Webhooks / notifications | Alert on policy violations, large transactions |

## Priority Order

1. ~~**MCP Server** — unlocks the largest user base with least effort~~ ✅
2. ~~**Web Approval UI** — makes it usable by non-developers~~ ✅
3. ~~**Multi-chain config** — removes the Base-only limitation~~ ✅
4. ~~**ElizaOS plugin** — crypto-AI community, replaces insecure key patterns~~ ✅
5. ~~**Private key + mnemonic import** — lets people use existing wallets~~ ✅
6. ~~**1inch aggregator** — makes swaps competitive~~ ✅
7. ~~**Telegram bot** — mobile approval UX~~ ✅
