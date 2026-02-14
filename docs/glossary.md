# Glossary

Key terms and concepts used throughout the ISCL/Clavion project, grouped by category and alphabetized within each section.

---

## Core Concepts

- **BuildPlan** -- Concrete EIP-1559 transaction built from a TxIntent by Domain B. Contains the serialized `txRequest`, its `txRequestHash` (keccak256), and a human-readable `description`. See `packages/types/src/index.ts`.

- **Clavion** -- Project name for the ISCL implementation. Used as the npm scope (`@clavion/*`) and CLI prefix (`clavion-cli`).

- **Domain A (Untrusted)** -- Agent frameworks and skills. Adapters (`adapter-openclaw`, `adapter-mcp`, `plugin-eliza`, `adapter-telegram`) live here. Cannot access private keys, sign transactions, or call blockchain RPCs directly.

- **Domain B (Trusted)** -- ISCL Core and its supporting packages (`core`, `signer`, `audit`, `policy`, `preflight`, `registry`). The only domain with key material, signing capability, and direct blockchain RPC access.

- **Domain C (Limited Trust)** -- Secure Executor (`sandbox`). Runs untrusted skill code in Docker containers with no key access. Communicates with Domain B only via the ISCL Core HTTP API.

- **ISCL** -- Independent Secure Crypto Layer. A local secure runtime that enables AI agents to safely perform crypto operations (signing, swaps, approvals, transfers) while isolating private keys from untrusted agent code.

- **Trust Domain** -- One of three isolation zones (A, B, C) with distinct trust levels and capabilities. Every line of code belongs to exactly one domain. See `docs/architecture/engineering-spec.md`.

- **TxIntent** -- Declarative JSON document (version `"1"`) describing a desired blockchain operation. Contains `chain`, `wallet`, `action`, `constraints`, and optional `preferences`/`metadata`. Supports 5 action types. Never contains raw calldata or ABI-encoded data.

---

## Action Types

- **approve** -- ERC-20 spending allowance approval. Sets the allowance for a `spender` contract to spend up to `amount` of the specified `asset` on behalf of the wallet.

- **swap_exact_in** -- DEX swap specifying an exact input amount (`amountIn`) with a minimum acceptable output (`minAmountOut`). Supports `uniswap_v3` (default) and `1inch` providers.

- **swap_exact_out** -- DEX swap specifying an exact desired output amount (`amountOut`) with a maximum input (`maxAmountIn`). Always uses Uniswap V3 (1inch does not support exact-output swaps).

- **transfer** -- ERC-20 token transfer. Sends `amount` of an ERC-20 `asset` to a recipient address (`to`).

- **transfer_native** -- Native currency transfer (ETH on Ethereum, or the chain's native token). Sends `amount` wei to a recipient address (`to`). No `asset` field required.

---

## Security Terms

- **Approval Summary** -- Human-readable summary of a pending transaction presented to the user for approval. Includes `action`, `expectedOutcome`, `balanceDiffs`, `riskScore`, `riskReasons`, `warnings`, and `gasEstimateEth`. See `ApprovalSummary` in `packages/types/src/index.ts`.

- **Approval Token** -- Single-use, TTL-bound (300 seconds) credential linking a user's approval decision to a specific intent and transaction hash. Fields: `id`, `intentId`, `txRequestHash`, `issuedAt`, `ttlSeconds`, `consumed`. Consumed on first use; replay is impossible.

- **ApprovalResult** -- Response from the approval flow: `{ approved: boolean, token?: ApprovalToken }`. Returned by `ApprovalService.requestApproval()`.

- **PolicyConfig** -- Configuration object (version `"1"`) with 10 fields controlling transaction limits and security rules: `maxValueWei`, `maxApprovalAmount`, `contractAllowlist`, `tokenAllowlist`, `allowedChains`, `recipientAllowlist`, `maxRiskScore`, `requireApprovalAbove`, `maxTxPerHour`. Validated by AJV in strict mode.

- **PolicyDecision** -- Result of policy evaluation: `{ decision, reasons, policyVersion }`. The `decision` field is one of `"allow"`, `"deny"`, or `"require_approval"`.

- **PolicyEngine** -- Evaluates TxIntents against PolicyConfig rules. Returns a `PolicyDecision`. Enforces allowlists, value limits, chain restrictions, rate limits, and approval thresholds. See `packages/policy/src/policy-engine.ts`.

- **PreflightResult** -- Output of transaction simulation: `simulationSuccess`, `revertReason`, `gasEstimate`, `balanceDiffs`, `allowanceChanges`, `riskScore`, `riskReasons`, and `warnings`.

- **PreflightService** -- Simulates transactions via RPC (`eth_call` + `eth_estimateGas`), computes balance diffs and allowance changes, then delegates to the risk scorer. Accepts an optional `rpcOverride` for multi-chain routing. See `packages/preflight/src/preflight-service.ts`.

- **Risk Score** -- Integer from 0 to 100 quantifying transaction risk. Computed from 7 weighted factors: contract not in allowlist (+40), token not in allowlist (+20), high slippage (+15), large value relative to limit (+20), unbounded approval (+25), simulation revert (+50), abnormal gas (+10). Capped at 100.

- **RiskContext** -- Input to the risk scorer containing boolean and numeric fields: `contractInAllowlist`, `tokenInAllowlist`, `slippageBps`, `simulationReverted`, `gasEstimate`, and optional `approvalAmount`, `maxApprovalAmount`, `valueWei`, `maxValueWei`.

---

## Architecture Terms

- **Adapter** -- Domain A component that bridges an external AI framework to ISCL Core via HTTP. Examples: `adapter-openclaw` (OpenClaw skills), `adapter-mcp` (Claude Desktop / Cursor), `adapter-telegram` (Telegram bot), `plugin-eliza` (ElizaOS).

- **AuditTraceService** -- Append-only audit log backed by SQLite (WAL mode). Records all fund-affecting operations correlated by `intentId`. Also provides rate-limiting counters. See `packages/audit/src/audit-trace-service.ts`.

- **Canonical Data Flow** -- The fixed pipeline every transaction follows: Agent Skill -> TxIntent -> `/tx/build` -> Preflight Simulation -> Approval Request -> User Confirmation -> `WalletService.sign` -> Broadcast -> Receipt -> AuditTrace.

- **ISCLClient** -- Shared HTTP client class used by all adapters to call ISCL Core API endpoints. Each adapter package contains its own copy at `src/shared/iscl-client.ts`.

- **Skill** -- A packaged unit of agent functionality with a signed manifest describing its permissions, sandbox constraints, and file hashes. Registered and managed through the Skill Registry.

- **SkillManifest** -- Signed package descriptor (version `"1"`): `publisher` (name, address, contact), `permissions` (allowed action types, chains, network/filesystem access), `sandbox` config (memory, timeout, spawn), `files` (paths + SHA-256 hashes), and an ECDSA `signature`.

- **Skill Registry** -- Service managing skill lifecycle: registration (with manifest validation, hash verification, and static scanning), listing, lookup, and revocation. Persisted to SQLite. See `packages/registry/src/skill-registry-service.ts`.

- **Static Scanner** -- Analyzes skill source code for dangerous patterns before registration. Detects: `eval`/`Function` usage, `child_process` imports, network access, filesystem writes, and obfuscation. Returns a `ScanReport` with `passed` status and `ScanFinding[]`.

---

## Crypto & Wallet Terms

- **AllowanceChange** -- Record of an ERC-20 allowance modification detected during preflight: `token`, `spender`, `before`, `after`.

- **BalanceDiff** -- Projected balance change from a transaction: `asset`, `delta`, and optional `usdValue`, `before`, `after`.

- **EncryptedKey** -- JSON format for a stored private key: `address`, `profile`, `cipher` (`aes-256-gcm`), `kdf` (`scrypt`), `kdfParams` (n, r, p, salt), `ciphertext`, `iv`, `authTag`. Follows the Ethereum keystore standard.

- **EncryptedKeystore** -- Class managing encrypted key storage on disk. Supports key generation, import (raw hex or BIP-39 mnemonic), unlock/lock, and listing. Keys are encrypted with AES-256-GCM using a scrypt-derived key. See `packages/signer/src/keystore.ts`.

- **RpcClient** -- Interface for blockchain communication. Methods: `readBalance`, `readNativeBalance`, `readAllowance`, `call`, `estimateGas`, `broadcastTx`. Implemented by `ViemRpcClient` using the viem library.

- **RpcRouter** -- Multi-chain RPC dispatcher implementing the `RpcClient` interface. Routes calls to chain-specific `RpcClient` instances based on `chainId`. Built from `ISCL_RPC_URL_{chainId}` environment variables. See `packages/core/src/rpc/rpc-router.ts`.

- **SignRequest** -- Input to `WalletService.sign()`: `intentId`, `walletAddress`, `txRequest` (EIP-1559), `txRequestHash`, `policyDecision`, and optional `approvalToken`.

- **SignedTransaction** -- Output of signing: `signedTx` (RLP-encoded hex) and `txHash` (keccak256 of the signed transaction).

- **WalletService** -- Signing pipeline in Domain B. Validates the approval token, unlocks the key from the keystore, signs the EIP-1559 transaction, and writes an audit log entry. See `packages/signer/src/wallet-service.ts`.

---

## Infrastructure Terms

- **AJV** -- JSON Schema validator. Used in strict mode with `additionalProperties: false` throughout the project for schema enforcement. CJS package requiring `createRequire` for ESM compatibility.

- **Anvil** -- Local EVM fork from the Foundry toolchain. Used for E2E testing to simulate blockchain state without real funds.

- **better-sqlite3** -- Synchronous SQLite library for Node.js. Backs the audit trail (`AuditTraceService`) and skill registry persistence. Uses WAL journal mode.

- **Fastify** -- HTTP framework for the ISCL Core API server. Configured with custom AJV for strict JSON Schema validation. See `packages/core/src/api/app.ts`.

- **grammY** -- Telegram Bot framework used by `@clavion/adapter-telegram`. Provides middleware, session management, and inline keyboard support.

- **JCS** -- JSON Canonicalization Scheme (RFC 8785). Produces a deterministic byte-level representation of JSON for consistent hashing of manifests and intents. Used with keccak256.

- **pino** -- Structured JSON logger integrated with Fastify. Provides request-scoped logging with correlation IDs.

- **viem** -- TypeScript library for EVM interaction. Used for transaction building (EIP-1559 serialization), ABI encoding, RPC calls, and address derivation. Preferred over ethers.js.

---

## API Terms

- **Endpoint prefix** -- All API endpoints use the `/v1/` prefix for versioning (e.g., `/v1/tx/build`, `/v1/balance/:token/:account`). See `CLAUDE.md` for the full endpoint listing.

- **intentId** -- UUID v4 correlation identifier assigned to every TxIntent. Links all audit events, approval tokens, preflight results, and signed transactions for a single operation. Enables end-to-end traceability.

- **ISCLError** -- Client-side error class wrapping HTTP errors from ISCL Core. Contains `status` (HTTP status code) and `body` (parsed error response). Thrown by `ISCLClient` on non-2xx responses.

- **PendingApprovalStore** -- In-memory store (`Map`) for web-based approval flow. Holds deferred promises keyed by `requestId`. Entries expire after 300 seconds. Cleaned up on a 30-second interval. See `packages/core/src/approval/pending-approval-store.ts`.

- **PromptFn** -- Function type `(summary: ApprovalSummary) => Promise<boolean>` used by `ApprovalService`. Configurable per approval mode: CLI (readline), web (deferred via `PendingApprovalStore`), or custom (tests).

- **txRequestHash** -- keccak256 hash of the serialized EIP-1559 transaction. Binds approval tokens to a specific transaction, preventing token reuse across different transactions.

---

## Multi-Chain Terms

- **Allowed Chains** -- List of supported EVM chain IDs in `PolicyConfig.allowedChains`. Default: Ethereum (1), Optimism (10), Arbitrum (42161), Base (8453).

- **ChainObject** -- TxIntent field specifying the target blockchain: `{ type: "evm", chainId: number, rpcHint?: string }`.

- **parseRpcEnv** -- Utility function that reads `ISCL_RPC_URL_{chainId}` environment variables and constructs an `RpcRouter`. Also supports `BASE_RPC_URL` as a fallback for chain 8453.

- **resolveRpc** -- Helper that selects the correct `RpcClient` for a given `chainId`: extracts a chain-specific client from an `RpcRouter`, or returns a plain `RpcClient` as-is.

---

## DEX Aggregator Terms

- **1inch Integration** -- Optional DEX aggregation via the 1inch Swap API v6. Enabled by setting the `ONEINCH_API_KEY` environment variable. Falls back to Uniswap V3 on failure or when the API key is absent.

- **AggregationRouterV6** -- The 1inch router contract at address `0x111111125421cA6dc452d289314280a0f8842A65`. Same address on all four supported chains.

- **maxSlippageBps** -- Maximum acceptable slippage in basis points (1 bps = 0.01%). Defined in `TxIntent.constraints`. Converted to a percentage string for the 1inch API (`bps / 100`).

- **OneInchClient** -- HTTP client for the 1inch Swap API v6. Uses Node built-in `fetch` with `AbortController` for timeouts. Zero additional npm dependencies. See `packages/core/src/aggregator/oneinch-client.ts`.

- **provider** -- Optional field on swap actions: `"uniswap_v3"` (default) or `"1inch"`. Controls which DEX aggregator builds the swap transaction.

---

## Sandbox Terms

- **SandboxConfig** -- Container configuration for skill execution: `image`, `networkMode` (`none` or `allowlist`), `allowedHosts`, `readOnlyRootfs`, `memoryLimitMb`, `cpuQuota`, `timeoutMs`, `noSpawn`, `env`.

- **SandboxRunner** -- Domain C executor that runs skill code in isolated Docker containers. Enforces memory limits, CPU quotas, network restrictions, and read-only filesystems. See `packages/sandbox/src/sandbox-runner.ts`.

- **SkillInput** -- Data passed into a sandboxed skill execution: `skillName`, `manifest`, and `apiUrl` (ISCL Core endpoint for the skill to call).

- **SkillOutput** -- Result of a sandboxed skill execution: `success`, `exitCode`, `stdout`, `stderr`, `durationMs`.

---

## CLI Terms

- **clavion-cli** -- Command-line tool for key management. Subcommands: `key import` (raw hex from stdin), `key import-mnemonic` (BIP-39 phrase from stdin), `key generate` (random key), `key list` (show addresses). See `packages/cli/src/main.ts`.

- **MnemonicImportOptions** -- Options for BIP-39 mnemonic import: `accountIndex` and `addressIndex` for HD path derivation (`m/44'/60'/{account}'/0/{address}`).

---

## Audit & Observability Terms

- **AuditEvent** -- Single audit log entry: `id` (UUID), `timestamp`, `intentId`, `event` (string tag), `data` (arbitrary JSON). Stored in SQLite and queryable by `intentId` or recency.

- **Audit Trail** -- The ordered sequence of `AuditEvent` records for a given `intentId`. Provides a complete, tamper-evident record of every step in the transaction lifecycle.

- **Rate Limiting** -- Per-wallet transaction throttling enforced by `PolicyEngine` using counters in `AuditTraceService`. Configured via `PolicyConfig.maxTxPerHour`. Events are recorded in a separate `rate_limit_events` SQLite table.
