# Clavion / ISCL Documentation Snapshot

> A structured documentation blueprint for the Independent Secure Crypto Layer — a local secure runtime that enables AI agents to safely perform crypto operations while isolating private keys from untrusted agent code.

---

## 1. System Architecture Overview

### What ISCL Is

ISCL (Independent Secure Crypto Layer) is a local runtime that sits between autonomous AI agents and EVM blockchains. It provides a secure gateway for crypto operations — signing, swapping, transferring, approving — while ensuring that private key material never leaves a trusted boundary. Agents submit declarative "intents" describing what they want to do; ISCL validates, simulates, and executes those intents under strict policy controls.

### Three Trust Domains

The system partitions all code into three trust domains. This is the foundational architectural decision and it is enforced structurally, not by convention.

**Domain A — Untrusted (Agent Layer):**
Adapters and agent skills live here. This includes the OpenClaw adapter, MCP server, Eliza plugin, and Telegram bot. Domain A code can construct transaction intents and call ISCL Core over HTTP, but it has no access to private keys, no direct blockchain RPC, and no signing capability.

**Domain B — Trusted (Core Runtime):**
The ISCL Core server, policy engine, keystore, signer, preflight simulator, audit trace, and skill registry all live here. This is the only domain that holds private keys, contacts the blockchain, and produces signatures. Every fund-affecting operation passes through multiple independent security gates within Domain B.

**Domain C — Limited Trust (Sandbox):**
Container-isolated execution of untrusted skill code. Sandbox runners operate with no network access, no key material, read-only filesystem, and API-only communication back to Domain B. This domain exists for running third-party skills that need computation but must not have direct system access.

### Component Responsibilities

| Component | Domain | Responsibility |
|-----------|--------|----------------|
| **Core API Server** | B | Fastify HTTP server exposing all `/v1/` endpoints |
| **Transaction Builders** | B | Convert declarative intents into concrete EVM transactions |
| **Policy Engine** | B | Rule-based access control (allowlists, amount limits, rate limits) |
| **Preflight Service** | B | RPC simulation, gas estimation, balance diffs, risk scoring |
| **Approval Service** | B | User confirmation flow with single-use approval tokens |
| **Wallet Service** | B | Encrypted keystore management, transaction signing via viem |
| **Audit Trace** | B | Append-only SQLite event log correlated by intent ID |
| **Skill Registry** | B | Cryptographic skill validation (signatures, file hashes, static scanning) |
| **RPC Router** | B | Multi-chain RPC dispatch (per-chain client selection) |
| **1inch Aggregator** | B | Optional DEX aggregation via 1inch Swap API v6 |
| **Sandbox Runner** | C | Docker-based container isolation for untrusted skill execution |
| **OpenClaw Adapter** | A | Thin skill wrappers for the OpenClaw agent framework |
| **MCP Adapter** | A | Model Context Protocol server for Claude Desktop, Cursor, IDEs |
| **Eliza Plugin** | A | ElizaOS (ai16z) plugin with 5 crypto actions |
| **Telegram Bot** | A | grammY-based bot with inline approval UI |
| **CLI** | B | Key management (import, generate, list) |

### How Components Communicate

All cross-domain communication happens over HTTP to ISCL Core's localhost API. Domain A adapters use a shared `ISCLClient` HTTP client to call `/v1/tx/*`, `/v1/balance/*`, and `/v1/approvals/*` endpoints. Domain C sandbox containers call back to Core at a configured `ISCL_API_URL`. There are no direct function calls, shared memory, or message queues between domains.

Within Domain B, components are composed via dependency injection at server startup. The `buildApp()` function wires together the keystore, policy engine, audit trace, approval service, and RPC clients, decorating them onto the Fastify instance for route handlers to access.

### Transaction Lifecycle

Every fund-affecting operation follows this pipeline:

```
Intent Construction (Domain A)
    ↓
Policy Evaluation — chain, token, contract, value, rate limit checks
    ↓
Transaction Build — intent → concrete EVM calldata
    ↓
Preflight Simulation — eth_call, gas estimation, balance diffs
    ↓
Risk Scoring — weighted heuristic (0-100 scale)
    ↓
Approval Request — user confirmation if policy requires it
    ↓
Approval Token Issuance — single-use, TTL-bound, intent-bound
    ↓
Token Validation + Consumption — verify, then mark consumed
    ↓
Transaction Signing — keystore unlock, viem EIP-1559 signature
    ↓
Broadcast — eth_sendRawTransaction
    ↓
Audit Logging — every step recorded with intent correlation
```

### Design Principles

1. **Declarative intents, not raw calldata.** Agents describe what they want; ISCL decides how to build, validate, and execute it. This prevents arbitrary contract interaction.

2. **Defense in depth.** Policy, preflight, approval, and signing are independent gates. Compromising one does not bypass the others.

3. **Audit everything.** Every security-relevant step is logged to an append-only SQLite trace, correlated by a unique intent ID. This creates a complete forensic chain from intent to receipt.

4. **Fail closed.** Default policy denies all transactions (maxValueWei: "0"). Missing RPC returns 502. Expired tokens reject. The system is safe by default.

5. **Adapter-agnostic core.** The core runtime has no knowledge of which agent framework is calling it. Any adapter that can construct a valid TxIntent and call the HTTP API works.

---

## 2. Repository Structure

### Directory Tree

```
clavion/
├── packages/                     # Monorepo packages (npm workspaces)
│   ├── types/                    # @clavion/types — shared interfaces, schemas, RPC types
│   ├── audit/                    # @clavion/audit — append-only audit trace (SQLite)
│   ├── policy/                   # @clavion/policy — policy engine & config validation
│   ├── signer/                   # @clavion/signer — encrypted keystore & signing
│   ├── preflight/                # @clavion/preflight — risk scoring & simulation
│   ├── registry/                 # @clavion/registry — skill manifest validation & registry
│   ├── sandbox/                  # @clavion/sandbox — Docker container isolation runner
│   ├── core/                     # @clavion/core — API server, tx builders, approval
│   ├── adapter-openclaw/         # @clavion/adapter-openclaw — OpenClaw skill wrappers
│   ├── adapter-mcp/              # @clavion/adapter-mcp — MCP server for IDE integration
│   ├── plugin-eliza/             # @clavion/plugin-eliza — ElizaOS plugin (5 actions)
│   ├── adapter-telegram/         # @clavion/adapter-telegram — Telegram bot
│   ├── cli/                      # @clavion/cli — key management CLI
│   └── sdk/                      # @clavion/sdk — SDK interface (stub, v0.2)
├── tests/                        # Cross-package test suites
│   ├── integration/              # Multi-package flow tests
│   ├── security/                 # Threat model verification tests
│   ├── e2e/                      # End-to-end tests (requires Anvil)
│   └── helpers/                  # Shared test utilities
├── tools/                        # Build-time tooling
│   └── fixtures/                 # Test fixtures & hash generation
├── docker/                       # Containerization
│   ├── Dockerfile.core           # Multi-stage production build
│   └── compose.yaml              # 3-service stack (Anvil + Core + OpenClaw)
├── docs/                         # Project documentation (40 files)
│   ├── architecture/             # Engineering spec, threat model, diagrams
│   │   └── adrs/                 # Architecture Decision Records
│   ├── api/                      # API reference, error catalog, schemas
│   ├── development/              # Setup, testing, adapter tutorial, contributing
│   ├── integrations/             # OpenClaw & Eliza integration docs
│   ├── operations/               # Deployment, multi-chain, audit, observability, migration
│   ├── security/                 # Risk scoring algorithm, threat analysis
│   ├── configuration.md          # Unified configuration reference
│   ├── CHANGELOG.md              # Version history (Keep a Changelog)
│   ├── glossary.md               # Term definitions (70+ terms)
│   └── index.md                  # Documentation index with all sections
├── examples/                     # Example configs, scripts, and guides
├── scripts/                      # Demo and utility scripts
└── openclaw-skills/              # OpenClaw-compatible skill definitions
```

### Package Categories

**Core Runtime (Domain B):** `types`, `audit`, `policy`, `signer`, `preflight`, `registry`, `core` — these form the trusted execution engine. They are built in dependency order via TypeScript project references.

**Sandbox (Domain C):** `sandbox` — isolated container runner with no key access.

**Adapters (Domain A):** `adapter-openclaw`, `adapter-mcp`, `plugin-eliza`, `adapter-telegram` — each maps a different agent framework to ISCL's HTTP API via a shared `ISCLClient` pattern.

**Tooling:** `cli` for key management, `sdk` as a future programmatic interface, `tools/fixtures` for test data generation.

### Architectural Patterns

- **Package-per-concern:** Each security boundary (policy, signing, audit, preflight) is its own package with its own test suite and TypeScript project reference. This enforces separation at the build level.

- **Shared types, separate implementations:** `@clavion/types` defines all interfaces and schemas consumed by other packages. No runtime package depends on another runtime package's internals — they communicate via the types contract.

- **Builder pattern for transactions:** Each action type (transfer, swap, approve) has its own builder module in `core/src/tx/builders/`. A central dispatcher routes intents to the appropriate builder.

- **Duplicated ISCLClient:** Each adapter package contains its own copy of the HTTP client rather than importing from a shared package. This allows adapters to be distributed independently without pulling in core dependencies.

---

## 3. Public Interfaces and Contracts

### API Endpoints

#### Transaction Pipeline

| Endpoint | Method | Purpose | Used By |
|----------|--------|---------|---------|
| `/v1/tx/build` | POST | Build an EVM transaction from a TxIntent. Applies policy check and rate limiting. Returns a `BuildPlan` containing the concrete transaction, its hash, and a human-readable description. | Primarily OpenClaw adapter for two-step flows |
| `/v1/tx/preflight` | POST | Simulate the transaction via RPC. Returns gas estimate, balance diffs, risk score (0-100), warnings, and whether simulation succeeded. Does not modify state. | All adapters (called implicitly via approve-request) |
| `/v1/tx/approve-request` | POST | Full approval pipeline: build + preflight + policy evaluation + user confirmation. If policy allows, returns immediately. If policy requires approval, blocks until user confirms (via CLI prompt, web UI, or Telegram callback). Issues a single-use approval token on confirmation. | All adapters |
| `/v1/tx/sign-and-send` | POST | Validate the approval token, sign the transaction with the encrypted keystore, and broadcast via RPC. Consumes the approval token (single-use enforcement). Returns signed transaction and hash. | All adapters |
| `/v1/tx/:hash` | GET | Retrieve a transaction receipt by hash from the RPC provider. | Any consumer needing confirmation |

#### Balance and Assets

| Endpoint | Method | Purpose | Used By |
|----------|--------|---------|---------|
| `/v1/balance/:token/:account` | GET | Read ERC-20 token balance or native ETH balance. Accepts optional `?chainId=N` query parameter for multi-chain lookups. | All adapters, CLI, dashboards |

#### Approval UI (Web Mode)

| Endpoint | Method | Purpose | Used By |
|----------|--------|---------|---------|
| `/v1/approvals/pending` | GET | List pending approval requests with TTL info. Returns array of approval summaries. | Web dashboard, Telegram bot polling |
| `/v1/approvals/:requestId/decide` | POST | Submit approve/deny decision for a pending request. Body: `{ approved: boolean }`. Unblocks the waiting `approve-request` handler. | Web dashboard, Telegram callback |
| `/v1/approvals/history` | GET | Recent audit events for transaction history. Query: `?limit=N` (1-100, default 20). | Web dashboard |
| `/approval-ui` | GET | Serves inline HTML approval dashboard. Dark theme, polls pending every 1s, history every 5s. Zero external dependencies. | Browser-based operators |

#### Skill Registry

| Endpoint | Method | Purpose | Used By |
|----------|--------|---------|---------|
| `/v1/skills/register` | POST | Register a skill manifest. Validates JSON schema, verifies ECDSA signature, checks file SHA-256 hashes, runs static security scanner. | Skill developers, CI/CD pipelines |
| `/v1/skills` | GET | List all registered skills with status. | Agent frameworks, dashboards |
| `/v1/skills/:name` | GET | Retrieve details for a specific skill. | Agent frameworks |
| `/v1/skills/:name` | DELETE | Revoke a registered skill (soft delete). | Operators |

#### System

| Endpoint | Method | Purpose | Used By |
|----------|--------|---------|---------|
| `/v1/health` | GET | Returns server status, version, and uptime. | Health checks, monitoring |

### Data Schemas

#### TxIntent v1

The TxIntent is the universal request format. Every adapter constructs one regardless of the agent framework.

**Structure:**

- **version** — Always `"1"`. Schema versioning for forward compatibility.
- **id** — UUID. Used for idempotency and audit correlation across the pipeline.
- **timestamp** — Unix milliseconds. When the intent was created.
- **chain** — Target blockchain: `{ type: "evm", chainId: number, rpcHint?: string }`. Supported chains: Ethereum (1), Optimism (10), Arbitrum (42161), Base (8453).
- **wallet** — Signing wallet: `{ address: "0x...", profile?: string }`.
- **action** — One of five action types (see below).
- **constraints** — Execution limits: `{ maxGasWei: string, deadline: number, maxSlippageBps: number }`.
- **preferences** — Optional hints: gas speed (`slow|normal|fast`), private relay flag.
- **metadata** — Free-form context: source adapter name, human-readable note.

**Action Types:**

| Type | Fields | Purpose |
|------|--------|---------|
| `transfer` | `asset`, `to`, `amount` | ERC-20 token transfer |
| `transfer_native` | `to`, `amount` | Native ETH/gas token transfer |
| `approve` | `asset`, `spender`, `amount` | Grant ERC-20 spending allowance |
| `swap_exact_in` | `router`, `assetIn`, `assetOut`, `amountIn`, `minAmountOut`, `provider?` | DEX swap with exact input amount |
| `swap_exact_out` | `router`, `assetIn`, `assetOut`, `amountOut`, `maxAmountIn`, `provider?` | DEX swap with exact output amount |

The `provider` field on swap actions is optional and defaults to `"uniswap_v3"`. Setting it to `"1inch"` routes through the 1inch Swap API v6 when an API key is configured.

All amounts are strings representing wei values. All addresses are checksummed 0x-prefixed hex. The schema enforces `additionalProperties: false` at every level — no undocumented fields are accepted.

#### SkillManifest v1

The SkillManifest defines a packaged skill for registry submission.

- **version** — Always `"1"`.
- **name** — Lowercase alphanumeric with hyphens, 1-64 characters.
- **publisher** — Identity: `{ name, address (0x...), contact (email) }`.
- **permissions** — Declared capabilities: allowed action types, chain IDs, network access, filesystem access.
- **sandbox** — Resource limits: memory (1-512 MB), timeout (1-60 seconds), spawn permission.
- **files** — Array of `{ path, sha256 }` pairs. Every file in the skill is hash-verified at registration.
- **signature** — ECDSA signature over the manifest content (excluding the signature field itself). Verified against `publisher.address`.

#### PolicyConfig

The PolicyConfig controls what transactions are allowed, denied, or require approval.

- **maxValueWei** — Hard cap on transaction value. Default `"0"` (deny all).
- **maxApprovalAmount** — Hard cap on approval amounts.
- **contractAllowlist** — Contracts the system can interact with. Empty = allow all.
- **tokenAllowlist** — Tokens allowed for transfers/swaps. Empty = allow all.
- **allowedChains** — Chain IDs permitted. Default: `[1, 10, 42161, 8453]`.
- **recipientAllowlist** — Addresses that can receive transfers. Empty = allow all.
- **maxRiskScore** — Risk threshold (0-100). Transactions scoring above this require user approval.
- **requireApprovalAbove.valueWei** — Value threshold for mandatory approval.
- **maxTxPerHour** — Per-wallet rate limit. Default: 10.

### CLI Commands

The CLI provides key management operations for operators.

| Command | Input | Purpose |
|---------|-------|---------|
| `clavion-cli key import` | Private key via stdin | Import a raw private key into the encrypted keystore |
| `clavion-cli key import-mnemonic` | BIP-39 mnemonic via stdin | Derive and import key from mnemonic (configurable derivation path) |
| `clavion-cli key generate` | None | Generate a new random private key and store it |
| `clavion-cli key list` | None | List all addresses in the keystore |

All commands accept `--keystore-path` to override the default `~/.iscl/keystore` directory. Mnemonic import supports `--account-index` and `--address-index` for BIP-44 derivation path customization. Keys are encrypted with scrypt + AES-256-GCM using a passphrase prompted at runtime.

### Adapter Interfaces

All four adapters follow the same two-step pipeline pattern:

1. Call `POST /v1/tx/approve-request` with a TxIntent → receive approval token
2. Call `POST /v1/tx/sign-and-send` with the intent + token → receive signed transaction

Each adapter maps its native interface to this pattern:

- **OpenClaw:** Tool names (`safe_transfer`, `safe_swap_exact_in`, etc.) map to action types. Parameters like `walletAddress`, `to`, `amount` are assembled into a TxIntent.
- **MCP:** Tool schemas define typed parameters (`clavion_transfer`, `clavion_swap`, etc.) that Claude Desktop or Cursor can invoke.
- **Eliza:** Actions with NLP similes (`CLAVION_TRANSFER`, `CLAVION_SWAP`) extract parameters from natural language messages via LLM-guided JSON generation.
- **Telegram:** Bot commands (`/transfer`, `/swap`, `/balance`) collect parameters interactively and render inline approval keyboards.

---

## 4. Core Execution Flows

### Flow 1: ERC-20 Token Transfer

A user wants to send 100 USDC to an address via an AI agent.

**1. Intent Construction (Domain A):**
The adapter (any of the four) constructs a TxIntent with `action.type: "transfer"`, the USDC contract address as `asset.address`, the recipient as `to`, and `"100000000"` (6 decimals) as `amount`. The intent includes chain ID, wallet address, gas constraints, and a deadline.

**2. Approval Request (Domain B):**
The adapter calls `POST /v1/tx/approve-request`. ISCL Core processes this in sequence:

- **Policy evaluation:** Checks that the chain is allowed, USDC is on the token allowlist, the recipient is on the recipient allowlist (if configured), the value doesn't exceed `maxValueWei`, and the wallet hasn't exceeded its hourly rate limit. If any check fails, the request is denied with specific reasons.

- **Transaction build:** The transfer builder encodes an ERC-20 `transfer(to, amount)` call, producing a concrete `txRequest` with the USDC contract as `to` and the encoded calldata as `data`.

- **Preflight simulation:** The preflight service calls `rpc.call()` to simulate the transfer. It reads the sender's USDC balance before and after, estimates gas, and checks for reverts (e.g., insufficient balance). The risk scorer evaluates: is the contract on the allowlist (+0 or +40), is the value large relative to limits (+0 or +20), did simulation succeed (+0 or +50)?

- **Approval decision:** If the risk score exceeds `maxRiskScore` or the value exceeds `requireApprovalAbove.valueWei`, the system prompts the user. In web mode, the request is stored in `PendingApprovalStore` and the handler blocks until the user clicks Approve/Deny on the dashboard or Telegram bot. In CLI mode, a readline prompt appears.

- **Token issuance:** On approval, a single-use token is generated with a 300-second TTL, bound to this specific intent ID and transaction hash.

**3. Signing and Broadcast (Domain B):**
The adapter calls `POST /v1/tx/sign-and-send` with the intent and approval token. ISCL Core:

- Re-validates the policy decision (second gate)
- Validates the approval token: exists, not consumed, not expired, intent ID matches, transaction hash matches
- Consumes the token (it cannot be reused)
- Fetches nonce, gas price, and priority fee from the chain-specific RPC
- Signs with viem's `privateKeyToAccount().signTransaction()` (EIP-1559)
- Broadcasts via `eth_sendRawTransaction`
- Logs the signature event, broadcast result, and any errors to the audit trace

**4. Confirmation:**
The adapter can call `GET /v1/tx/:hash` to retrieve the transaction receipt once it's mined.

**Security guarantees enforced:** Policy allowlists, value limits, rate limits, simulation validation, user confirmation, single-use token, audit trail.

### Flow 2: DEX Swap via 1inch Aggregator

A user wants to swap 1 ETH for USDC using the best available DEX routing.

**1. Intent Construction:**
The adapter constructs a TxIntent with `action.type: "swap_exact_in"`, `provider: "1inch"`, the 1inch AggregationRouterV6 address as `router`, WETH as `assetIn`, USDC as `assetOut`, `amountIn: "1000000000000000000"`, and `minAmountOut` calculated from the desired slippage.

**2. Build with External API Call:**
The swap builder detects `provider: "1inch"` and delegates to the 1inch builder. This builder:

- Validates the router address against the known 1inch router for this chain (security check — prevents routing to a malicious contract)
- Calls the 1inch Swap API v6 with: source token, destination token, amount, slippage (converted from basis points to percentage), and the sender's address
- Receives optimized calldata that routes across multiple DEXs for the best price
- If the 1inch API fails (rate limit, network error, missing API key), falls back silently to the Uniswap V3 builder

**3. Same Pipeline:**
The rest of the flow (preflight, approval, signing, broadcast) proceeds identically to a standard transfer. The preflight simulator runs the 1inch calldata through `eth_call` to verify it doesn't revert and estimates the actual gas cost.

**Important constraint:** `swap_exact_out` is not supported by the 1inch API v6. If `provider: "1inch"` is specified with `swap_exact_out`, the system always falls back to Uniswap V3.

### Flow 3: Policy Denial

An agent attempts to send tokens to an address not on the recipient allowlist.

**1. Intent submitted** with a recipient not in `policyConfig.recipientAllowlist`.

**2. Policy engine evaluates** and finds the recipient missing from the allowlist. It returns `{ decision: "deny", reasons: ["recipient not in allowlist"] }`.

**3. The request is rejected** with HTTP 403. The denial reason is returned to the adapter. An audit event `policy_evaluated` is logged with the deny decision and specific reasons.

**4. No transaction is built.** No approval token is issued. No signing occurs. The pipeline halts at the first gate.

Other denial scenarios follow the same pattern: chain not allowed, token not allowlisted, value exceeds limit, rate limit exceeded. Each produces a specific, auditable reason.

### Flow 4: Sandbox Skill Execution

A third-party skill needs to run computation before constructing a TxIntent.

**1. Container setup:** The sandbox runner launches a Docker container with:
- `--network none` (no internet access)
- `--read-only` root filesystem
- `--cap-drop ALL` (no Linux capabilities)
- `--security-opt no-new-privileges`
- Memory and CPU limits from the skill manifest
- Only `ISCL_API_URL` and `ISCL_SKILL_NAME` as environment variables

**2. Skill execution:** The skill code runs inside the container. It can perform computation, parse data, and make decisions. When it needs to execute a transaction, it calls back to ISCL Core's API at the configured URL.

**3. API-mediated operations:** The skill's HTTP call to `/v1/tx/approve-request` goes through the full pipeline — policy, preflight, approval, signing — with no shortcuts. The sandbox has no way to bypass these checks because it has no direct access to the keystore, policy engine, or RPC.

**4. Audit and cleanup:** Sandbox start, completion, and any errors are logged. The container is destroyed after execution.

### Flow 5: Multi-Adapter Integration

An operator runs ISCL Core with web approval mode and connects multiple adapters simultaneously.

**1. Core server starts** with `ISCL_APPROVAL_MODE=web` and multiple `ISCL_RPC_URL_{chainId}` environment variables configured.

**2. Telegram bot connects** and a user sends `/transfer 100 USDC to 0x...`. The bot constructs a TxIntent and calls `POST /v1/tx/approve-request`. ISCL Core stores the pending approval in `PendingApprovalStore` and blocks the HTTP response.

**3. Meanwhile, a Claude Desktop session** (via MCP adapter) also submits a swap intent. It too blocks waiting for approval.

**4. The operator opens** `http://localhost:3100/approval-ui` in a browser. The dashboard shows both pending requests with risk scores, balance diffs, and action summaries. The operator approves the transfer but denies the swap.

**5. The Telegram bot receives** the approval, gets the token, calls `sign-and-send`, and reports success back to the user. The MCP adapter receives the denial and reports it to Claude Desktop.

This demonstrates how ISCL Core acts as a unified approval gateway regardless of which adapter submitted the request.

---

## 5. Operational Model

### Local Development Setup

**Prerequisites:** Node.js 20+, npm 9+. Docker is optional (needed for sandbox tests and the compose stack). Foundry/Anvil is optional (needed for E2E tests against a forked chain).

**Getting started:**

1. Install dependencies: `npm install` — this resolves all 14 workspace packages.
2. Build all packages: `npm run build` — runs `tsc -b` which compiles packages in dependency order via TypeScript project references.
3. Start the dev server: `npm run dev` — launches ISCL Core on `localhost:3100` with hot reload.

For preflight simulation and broadcast to work, at least one RPC URL must be configured via environment variables (`ISCL_RPC_URL_8453` or `BASE_RPC_URL` for Base chain).

### Starting the System

**Minimal (no RPC):**
```
npm run dev
```
The server starts and responds to `/v1/health`. Transaction builds and policy checks work, but preflight simulation and broadcast return errors due to missing RPC.

**With RPC:**
```
ISCL_RPC_URL_8453=https://mainnet.base.org npm run dev
```
Full functionality on Base chain. Add more `ISCL_RPC_URL_{chainId}` variables for multi-chain support.

**Docker Compose (full stack):**
```
docker compose -f docker/compose.yaml --profile demo up -d
```
Launches Anvil (local blockchain fork), ISCL Core, and OpenClaw agent. The demo profile pre-configures a test wallet and auto-approval mode.

### Approval Modes

The `ISCL_APPROVAL_MODE` environment variable controls how user confirmation works:

- **`cli`** (default) — Interactive readline prompt in the terminal. Suitable for development and CLI automation.
- **`web`** — Pending requests stored in memory; users approve via the web dashboard or external API calls. Required for Telegram bot and multi-user scenarios.
- **`auto`** — All requests auto-approved. For testing and demo environments only.

### Key Management

Keys must be imported or generated before signing works:

```
clavion-cli key generate --keystore-path ./my-keystore
clavion-cli key import --keystore-path ./my-keystore
clavion-cli key list --keystore-path ./my-keystore
```

In Docker, the keystore is a persistent volume at `/home/iscl/.iscl/keystore`.

### Testing Strategy

The project uses Vitest with four test tiers:

**Unit tests** (`npm run test:unit`, ~225 tests): Test individual functions and modules in isolation. Each package has its own `test/` directory. Mock RPC clients are used extensively — a standard mock factory provides all `RpcClient` methods with predictable return values. Test fixtures from `tools/fixtures/` provide valid and invalid TxIntents for each action type.

**Integration tests** (`npm run test:integration`, ~37 tests): Test cross-package flows by building a full `buildApp()` instance with temporary SQLite databases, mock RPC clients, and programmatic approval functions. These verify that policy → build → preflight → approve → sign flows work end-to-end within the process.

**Security tests** (`npm run test:security`, ~28 tests): Verify the six core security invariants from the threat model. These include: private key isolation, policy enforcement on every path, approval token single-use, rate limiting, unbounded approval denial, and replay attack prevention. Some require Docker for sandbox isolation verification.

**E2E tests** (`npm run test:e2e`, ~6 tests): Full pipeline tests against Anvil (a local Ethereum fork). These construct real TxIntents, build real transactions, sign with real keys, and broadcast to Anvil. They verify that tokens actually move on-chain.

**Running all tests:** `npm test` executes all tiers (~639 tests total).

**Fixture management:** When adding new action types or valid intents, run `npm run generate:hashes` to regenerate the canonical hash fixtures used by canonicalization tests.

### Common Troubleshooting

- **"no_rpc_client" errors:** No RPC URL configured for the requested chain. Set `ISCL_RPC_URL_{chainId}`.
- **Policy denies everything:** Default `maxValueWei: "0"` blocks all transactions. Configure a policy with appropriate limits.
- **Approval hangs in tests:** Tests using `requireApprovalAbove.valueWei: "0"` must pass a `promptFn` to `buildApp()` to avoid readline blocking.
- **CJS import errors:** Packages like `ajv-formats` and `canonicalize` require the `createRequire` pattern for Node16 ESM compatibility.

---

## 6. Developer Extension Points

### Writing a New Adapter

> **Full tutorial:** See the [Adapter Development Tutorial](development/adapter-tutorial.md) for a step-by-step guide with code examples.

To integrate a new agent framework with ISCL:

1. **Create a new package** under `packages/adapter-{name}/`.
2. **Copy the ISCLClient** from any existing adapter's `src/shared/iscl-client.ts`. This HTTP client provides typed methods for all ISCL API endpoints.
3. **Map your framework's interface** to the two-step pipeline:
   - Construct a TxIntent from your framework's native request format
   - Call `client.txApproveRequest(intent)` to get policy + approval
   - If approved, call `client.txSignAndSend({ intent, approvalTokenId })` to execute
4. **Handle errors** from each step: policy denials (403 — see [Error Catalog](api/errors.md)), RPC failures (502), token expiration.

The adapter never needs to understand EVM internals, policy rules, or signing — ISCL Core handles all of that. The adapter's only job is translating between its framework and TxIntent.

### Adding a New Action Type

1. **Define the type** in `packages/types/src/index.ts` — add a new interface to the `ActionObject` union.
2. **Add JSON schema** in `packages/types/src/schemas/txintent-schema.ts` — add a `$defs` entry and include it in the action discriminated union.
3. **Create a builder** in `packages/core/src/tx/builders/` — implement a function that takes a TxIntent with your action type and returns a `BuildPlan` (concrete EVM transaction).
4. **Register in the dispatcher** in `packages/core/src/tx/builders/index.ts` — add a case to the `switch` on `action.type`.
5. **Update policy engine** in `packages/policy/src/policy-engine.ts` if the new action has policy-relevant fields (value, contract, recipient).
6. **Update preflight** in `packages/preflight/src/preflight-service.ts` if the action produces balance diffs or allowance changes.
7. **Add fixtures** in `tools/fixtures/valid-intents.ts` and regenerate hashes.
8. **Update adapters** — add tool/action definitions in each adapter that should support the new action.

### Adding a New Chain

1. **Configure RPC:** Set `ISCL_RPC_URL_{chainId}` environment variable.
2. **Add chain to policy:** Include the chain ID in `allowedChains` in your PolicyConfig.
3. **Add router addresses** (for swaps): Add the chain's Uniswap V3 router to `UNISWAP_V3_ROUTERS` in `packages/core/src/tx/builders/swap-builder.ts`. The 1inch router is the same on all supported chains.
4. **Update types** if the chain ID should be included in default configurations.

### Custom Approval Modes

The approval system is pluggable via the `promptFn` option on `buildApp()`. A prompt function receives an `ApprovalSummary` (action description, risk score, balance diffs, warnings) and returns a `Promise<boolean>`. This allows:

- Slack/Discord approval bots
- Mobile push notification approval
- Multi-signature approval (external coordination)
- Automated approval based on custom logic

### Development Conventions

> **Full details:** See the [Contributing Guide](development/contributing.md) for coding standards, PR process, and security rules.

- All schemas use `additionalProperties: false` — no undocumented fields pass validation.
- CJS packages (`ajv-formats`, `canonicalize`) must use the `createRequire` pattern for Node16 ESM compatibility.
- Test fixtures live in `tools/fixtures/`. When adding valid fixtures, regenerate hashes.
- Amounts are always strings (arbitrary precision). Addresses are always `0x`-prefixed, 40 hex characters.
- The `buildFromIntent()` function is async (due to 1inch API calls). All call sites must await it.
- Audit events use the intent's UUID as a correlation key across the entire pipeline.

### Reference Documentation

The following dedicated reference docs complement the extension points above:

- [Configuration Reference](configuration.md) — all environment variables, policy config fields, `buildApp()` options
- [Error Catalog](api/errors.md) — HTTP error shapes per endpoint, recovery guidance
- [Risk Scoring Algorithm](security/risk-scoring.md) — 7-factor scoring with worked examples
- [Skill Registry Workflow](development/skill-registry.md) — manifest creation, signing, registration pipeline
- [Multi-Chain Operations](operations/multi-chain.md) — chain routing, RPC configuration, adding new chains
- [Glossary](glossary.md) — 70+ terms across 12 categories

---

## 7. Documentation Coverage Assessment

The project documentation now includes 51 Markdown files organized into 8 sections. All 14 gaps from the original analysis and all 9 gaps from the second analysis have been addressed.

### Coverage Summary

| Category | Files | Key Documents |
|----------|-------|---------------|
| **Architecture** | 12 | Overview, trust domains, engineering spec, whitepaper, threat model, stack decisions, PRD, ADR index, ADR-001 through ADR-004 |
| **API** | 4 | API reference (with curl examples), API cookbook (end-to-end workflows), error catalog (per-endpoint), schema specification |
| **Configuration** | 1 | Unified reference: env vars, PolicyConfig, AppOptions, policy evaluation rules |
| **Security** | 2 | Risk scoring algorithm (7 factors, worked examples), threat analysis |
| **Operations** | 8 | Commands & workflows, deployment guide, multi-chain operations, audit trail guide, observability, migration, performance tuning, incident runbook |
| **Development** | 9 | Quick start, dev setup, repo structure, testing, adapter tutorial, sandbox skill development, skill registry workflow, contributing guide, roadmap |
| **Integrations** | 6 | OpenClaw adapter, OpenClaw E2E runbook, Eliza adapter plan, Eliza setup guide, MCP setup guide, Telegram bot setup guide |
| **Reference** | 3 | Changelog (Keep a Changelog format), glossary (70+ terms), documentation snapshot |

### Previously Identified Gaps — Now Addressed

| # | Gap | Resolution |
|---|-----|------------|
| 1 | API error reference | [Error Catalog](api/errors.md) — 3 error shapes, per-endpoint reference, recovery guide |
| 2 | Configuration reference | [Configuration Reference](configuration.md) — all env vars, PolicyConfig, AppOptions, evaluation rules |
| 3 | Deployment guide | [Deployment Guide](operations/deployment.md) — Docker, security hardening, backup, monitoring |
| 4 | Multi-chain operations | [Multi-Chain Operations](operations/multi-chain.md) — RPC config, chain routing, adding chains |
| 5 | Risk scoring algorithm | [Risk Scoring](security/risk-scoring.md) — 7 factors with weights, constants, worked examples |
| 6 | Audit trail querying | [Audit Trail Guide](operations/audit-trail.md) — 14 event types, SQL queries, incident investigation |
| 7 | Skill registry workflow | [Skill Registry](development/skill-registry.md) — manifest creation, 6-step pipeline, static scanner |
| 8 | Adapter development tutorial | [Adapter Tutorial](development/adapter-tutorial.md) — step-by-step guide with code, security checklist |
| 9 | Contributing guide | [Contributing Guide](development/contributing.md) — PR process, standards, security invariants |
| 10 | Migration / upgrade path | [Migration Guide](operations/migration.md) — versioning strategy, upgrade procedure, rollback |
| 11 | Changelog | [CHANGELOG.md](CHANGELOG.md) — v0.1.0 release notes in Keep a Changelog format |
| 12 | Architecture Decision Records | [ADR index](architecture/adrs/README.md) + [ADR-001: Trust Domain Isolation](architecture/adrs/001-trust-domain-isolation.md) |
| 13 | Observability guide | [Observability](operations/observability.md) — pino config, health monitoring, metrics, log forwarding |
| 14 | Glossary | [Glossary](glossary.md) — 70+ terms across 12 categories |

### Second-Pass Gaps — Now Addressed

| # | Gap | Resolution |
|---|-----|------------|
| 15 | API Cookbook | [API Cookbook](api/cookbook.md) — 8 end-to-end curl recipes covering transfers, swaps, approvals, skill management |
| 16 | Sandbox development guide | [Sandbox Skill Development](development/sandbox-skill-development.md) — SkillInput/Output, Dockerfile, container restrictions, testing, debugging |
| 17 | Per-adapter: MCP setup | [MCP Adapter Setup](integrations/mcp-setup.md) — Claude Desktop config, Cursor config, tool parameters, approval modes |
| 18 | Per-adapter: Eliza setup | [Eliza Integration Guide](integrations/eliza-setup.md) — character config, plugin components, action examples, replacing plugin-evm |
| 19 | Per-adapter: Telegram setup | [Telegram Bot Setup](integrations/telegram-setup.md) — BotFather setup, commands, inline approval, Docker deployment |
| 20 | ADR-002: SQLite for Audit Trail | [ADR-002](architecture/adrs/002-sqlite-audit-trail.md) — WAL mode, schema design, access patterns, alternatives analysis |
| 21 | ADR-003: TxIntent Declarative Format | [ADR-003](architecture/adrs/003-txintent-declarative-format.md) — intent vs raw TX vs SDK, closed action set, security properties |
| 22 | ADR-004: Localhost-Only API | [ADR-004](architecture/adrs/004-localhost-only-api.md) — binding model, Docker networking, zero-config security |
| 23 | Incident runbook | [Incident Runbook](operations/incident-runbook.md) — 10 symptom-indexed scenarios with diagnosis SQL and resolution steps |
| 24 | Performance tuning | [Performance Tuning](operations/performance-tuning.md) — SQLite tuning, RPC optimization, memory management, Docker performance |

### Remaining Gaps

Based on re-analysis after the second documentation expansion, the following areas remain for future development:

#### Deferred (v0.2+)

1. **SDK documentation.** The `@clavion/sdk` package is currently a stub. Documentation will be written when the SDK is implemented in v0.2.

#### Structural (Non-Blocking)

2. **Versioned documentation.** As the project approaches v1.0, docs should support version switching (v0.1 vs v0.2 etc.) for users on different releases. This requires a static site generator (e.g., Docusaurus, VitePress).

3. **Search and navigation.** The `index.md` provides a categorized link list. A more structured navigation with sidebar categories and full-text search would improve discoverability as the doc count grows beyond 50 files.

---

*Updated from repository analysis on 2026-02-14. Documentation expanded from 40 to 51 files. All actionable gaps addressed. This document is a snapshot — refer to source code and the [documentation index](index.md) for current details.*
