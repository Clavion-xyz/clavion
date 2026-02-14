# Changelog

All notable changes to the Clavion / ISCL project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- Rootless Podman support for the sandbox executor (`@clavion/sandbox`)
- CI/CD pipeline via GitHub Actions
- SDK package (`@clavion/sdk`) -- currently a stub placeholder

## [0.1.0] - 2025-02-10

Initial release of the ISCL (Independent Secure Crypto Layer) runtime.
15 packages across 3 trust domains, 639+ tests passing, full transaction
pipeline verified end-to-end with Anvil fork.

### Added

#### Core Runtime (`@clavion/core`)

- Fastify-based HTTP API server with 14 endpoints under `/v1/`
- JSON Schema validation via AJV in strict mode (`additionalProperties: false`)
- Structured logging with pino
- Health endpoint (`GET /v1/health`) reporting version, uptime, and status
- `X-ISCL-Version` response header on all API responses
- Demo boot script for local development (`demo-boot.ts`)

#### Transaction Engine

- TxIntent v1 schema supporting 5 action types: `transfer`, `transfer_native`,
  `approve`, `swap_exact_in`, `swap_exact_out`
- Transaction builders for all 5 action types with per-action validation
- JCS canonicalization + keccak256 hashing for intent integrity verification
- Uniswap V3 swap routing with per-chain router addresses
- 1inch DEX Aggregator integration (optional, enabled via `ONEINCH_API_KEY`)
  - 1inch Swap API v6 for optimized multi-DEX routing
  - Automatic silent fallback to Uniswap V3 on 1inch failure
  - `swap_exact_out` always routed through Uniswap V3 (1inch API v6 limitation)
  - Router address validation per chain before API calls
  - Slippage conversion from basis points to percentage for 1inch API
- Transaction broadcast with receipt tracking via `GET /v1/tx/:hash`
- Async `buildFromIntent()` supporting both Uniswap and 1inch builders

#### Types & Schemas (`@clavion/types`)

- Shared TypeScript interfaces for TxIntent, TxPlan, PolicyDecision,
  ApprovalToken, SkillManifest, AuditEvent, and RPC types
- JSON Schema definitions for all API request/response payloads
- TxIntent schema with `$defs`/`$ref` for composable action validation

#### Encrypted Keystore & Signing (`@clavion/signer`)

- AES-256-GCM encrypted keystore with scrypt key derivation
- WalletService for transaction signing (viem-based)
- BIP-39 mnemonic import with configurable account and address indices
- Random key generation

#### Policy Engine (`@clavion/policy`)

- PolicyEngine with 8 configurable evaluation rules:
  - Allowed chains whitelist
  - Allowed tokens whitelist
  - Allowed contracts whitelist
  - Maximum transaction value threshold
  - Approval-required-above value threshold
  - Recipient allowlist/denylist
  - Risk score ceiling
  - Rate limiting (sliding window, configurable `maxTxPerHour`)
- Policy configuration validation with sensible defaults

#### Preflight Simulation (`@clavion/preflight`)

- `eth_call` simulation against live or forked RPC
- Gas estimation for built transactions
- Balance diff tracking (before/after simulation)
- Token allowance change detection
- Risk scoring algorithm with 7 weighted factors (0--100 scale)
- Chain-scoped RPC override support for multi-chain simulation

#### Approval System

- Three approval modes controlled by `ISCL_APPROVAL_MODE` env var:
  - `cli` -- readline-based terminal approval
  - `web` -- browser-based approval dashboard
  - `auto` -- automatic approval (testing/demos only)
- `promptFn` option override for programmatic control in tests
- Approval tokens: single-use, TTL-bound (300 seconds), intent-bound
- `PendingApprovalStore`: in-memory store with deferred Promises and TTL cleanup
- Web approval UI (`GET /approval-ui`): dark theme, zero external dependencies,
  1-second pending poll, 5-second history poll, risk color coding
- Approval API: `GET /v1/approvals/pending`, `POST /v1/approvals/:id/decide`,
  `GET /v1/approvals/history`

#### Audit Trail (`@clavion/audit`)

- Append-only SQLite audit log with WAL journal mode
- 14 event types with `intentId` correlation across the full pipeline
- Rate limit tracking in a dedicated table
- Queryable recent events via `getRecentEvents(limit)` (API and direct access)

#### Skill Registry (`@clavion/registry`)

- SkillManifest v1 with ECDSA signing (JCS + keccak256)
- 6-step registration pipeline: schema validation, signature verification,
  hash verification, static code scan, duplicate check, insert
- Static scanner with 5 pattern rules: `eval`, `child_process`, network access,
  filesystem writes, obfuscation detection
- CRUD API: `POST /v1/skills/register`, `GET /v1/skills`,
  `GET /v1/skills/:name`, `DELETE /v1/skills/:name`

#### Sandbox Executor (`@clavion/sandbox`)

- Docker-based container isolation runner
- API-only communication with ISCL Core (no key access, no unrestricted network)
- Domain C trust boundary enforcement

#### Multi-Chain Support

- 4 supported chains: Ethereum (1), Optimism (10), Arbitrum (42161), Base (8453)
- `RpcRouter` implementing `RpcClient` interface with per-chain dispatch
- `ISCL_RPC_URL_{chainId}` env vars with `BASE_RPC_URL` legacy fallback
- Chain-scoped balance queries via `GET /v1/balance/:token/:account?chainId=N`
- Single-URL backward compatibility (plain `ViemRpcClient` when one URL provided)

#### CLI (`@clavion/cli`)

- `clavion-cli key import` -- import private key from stdin
- `clavion-cli key import-mnemonic` -- import from BIP-39 mnemonic via stdin
- `clavion-cli key generate` -- generate a new random keypair
- `clavion-cli key list` -- list all keystore addresses
- Options: `--keystore-path`, `--account-index`, `--address-index`

#### OpenClaw Adapter (`@clavion/adapter-openclaw`)

- Thin skill wrappers for OpenClaw execution backend
- ISCLClient for HTTP communication with ISCL Core API
- Skill types: `clavion-swap`, `clavion-transfer`, and others

#### MCP Adapter (`@clavion/adapter-mcp`)

- Model Context Protocol server for AI-native tool integration
- Compatible with Claude Desktop, Cursor, and other MCP-enabled IDEs
- Tool definitions for transfer, swap, balance, and approval operations

#### Eliza Plugin (`@clavion/plugin-eliza`)

- ElizaOS (ai16z) plugin with 5 actions
- Service layer wrapping ISCLClient for ElizaOS runtime
- `moduleResolution: "Bundler"` compatibility for `@elizaos/core`

#### Telegram Bot (`@clavion/adapter-telegram`)

- grammy-based Telegram bot with same-chat agent and approval flow
- 7 commands: `/transfer`, `/send`, `/swap`, `/approve`, `/balance`,
  `/status`, `/help`
- InlineKeyboard approval with callback query handling
- `ActiveTransactionStore` for tracking in-flight approvals
- Chat authorization via `ISCL_TELEGRAM_ALLOWED_CHATS` env var
- Same-sender verification for approval callbacks
- HTML parse mode for Ethereum address formatting

#### Docker & Deployment

- Multi-stage `Dockerfile.core` with non-root `iscl` user
- Docker Compose with 3-service stack: Anvil, ISCL Core, OpenClaw
- `demo` profile for full integration demonstration

#### Testing

- 639+ unit and integration tests via vitest
- 6 end-to-end tests with Anvil Base fork (tokens actually move on-chain)
- 8 sandbox security tests requiring Docker
- Security test suite verifying all 3 trust domain boundaries
- Full pipeline verified: OpenClaw skill -> ISCL API -> policy -> preflight
  -> approval -> sign -> broadcast -> Anvil receipt
- Test fixture infrastructure in `tools/fixtures/` with hash generation
- One valid fixture per action type plus invalid and edge-case variants

#### Documentation

- Architecture engineering spec (`docs/architecture/engineering-spec.md`)
- Threat model and security analysis (`docs/architecture/threat-model.md`)
- Tech stack decision rationale (`docs/architecture/stack-decisions.md`)
- TxIntent and SkillManifest schema reference (`docs/api/schemas.md`)
- API overview (`docs/api/overview.md`)
- Development setup guide (`docs/development/dev-setup.md`)
- Repository structure guide (`docs/development/repo-structure.md`)
- Quickstart guide (`docs/quickstart.md`)
- Integration guides for Eliza and Telegram adapters

### Security

- Three trust domain architecture enforced across all packages:
  - Domain A (Untrusted): adapters and agent skills -- no keys, no RPC, no signing
  - Domain B (Trusted): core, signer, audit, policy, preflight, registry -- keys
    and blockchain access
  - Domain C (Limited Trust): sandbox -- no keys, API-only communication
- Private keys never leave Domain B (verified by security tests)
- No `signRaw` or arbitrary calldata signing -- all operations use TxIntent v1
- All signing requires both a PolicyDecision and a valid ApprovalToken
- Tampered package detection in the skill registry static scanner
- Domain boundary integrity tests in `tests/security/`
- Approval tokens are cryptographically bound to specific intents
- Rate limiting prevents transaction flooding per wallet address
