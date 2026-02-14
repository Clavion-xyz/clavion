# Clavion / ISCL

**Secure crypto runtime for autonomous agents**

<!-- Badges: build status, coverage, license, npm version -->
<!-- [![Build Status](...)](#) [![Coverage](...)](#) [![License: MIT](...)](#) -->

---

## What is Clavion?

AI agents increasingly need to perform on-chain operations -- token transfers, swaps, approvals, and contract interactions. But giving an agent direct access to private keys is a fundamental security risk. A single prompt injection, a malicious skill, or a compromised dependency could drain a wallet in seconds. The industry needs a way to let agents operate on-chain without ever touching keys.

**Clavion** (also known as **ISCL -- Independent Secure Crypto Layer**) solves this by introducing a local secure runtime that sits between the agent and the blockchain. It enforces a strict three-domain trust architecture: agent code runs in an untrusted sandbox with no key access, all transactions pass through a policy engine and risk scorer before signing, and every operation is audit-logged with human approval gates for high-value actions.

The result is a system where agents can express *intent* (e.g., "transfer 100 USDC to 0x...") without ever constructing raw transactions or accessing private keys. ISCL validates the intent against configurable policies, simulates it for risk, prompts for human approval when required, and only then signs and broadcasts. This architecture is compatible with OpenClaw and other agent frameworks as an execution backend.

## Architecture

Clavion enforces three strict trust domains. Every component belongs to exactly one domain, and no component may cross boundaries.

```
+------------------------------------------------------------------+
|                    Domain A (Untrusted)                           |
|                                                                  |
|   OpenClaw Agent / External Agent Framework                      |
|   +---------------------------+                                  |
|   | Skill Wrappers            |  No keys, no RPC, no signing    |
|   | (adapter-openclaw)        |  Communicates via localhost HTTP |
|   +---------------------------+                                  |
|               | TxIntent (JSON)                                  |
+---------------|--------------------------------------------------+
                v
+------------------------------------------------------------------+
|                    Domain B (Trusted)                             |
|                                                                  |
|   ISCL Core                                                      |
|   +-----------+  +-----------+  +-----------+  +-------------+  |
|   | API       |  | Policy    |  | Preflight |  | Approval    |  |
|   | Server    |  | Engine    |  | Simulator |  | Service     |  |
|   | (Fastify) |  |           |  | + Risk    |  |             |  |
|   +-----------+  +-----------+  +-----------+  +-------------+  |
|   +-----------+  +-----------+  +-----------+  +-------------+  |
|   | Wallet    |  | Tx        |  | Audit     |  | Skill       |  |
|   | Service   |  | Builders  |  | Trace     |  | Registry    |  |
|   | (Keystore)|  |           |  | (SQLite)  |  |             |  |
|   +-----------+  +-----------+  +-----------+  +-------------+  |
|                                                                  |
+------------------------------------------------------------------+
                |
                v
+------------------------------------------------------------------+
|                    Domain C (Limited Trust)                       |
|                                                                  |
|   Sandbox Runner (Docker)                                        |
|   +---------------------------+                                  |
|   | Container Isolation       |  No keys, no network             |
|   | Read-only filesystem      |  API-only communication          |
|   | Seccomp + cap-drop ALL    |  with Domain B                   |
|   +---------------------------+                                  |
|                                                                  |
+------------------------------------------------------------------+
```

**Data flow:**

```
Agent Skill -> TxIntent -> /tx/build -> Preflight Simulation
-> Approval Request -> User Confirmation -> WalletService.sign
-> Broadcast -> Receipt -> AuditTrace
```

## Key Features

- **Encrypted Keystore** -- Private keys stored with scrypt + AES-256-GCM encryption, never exposed outside Domain B
- **Policy Engine** -- Configurable rules for value limits, contract/token allowlists, chain restrictions, and rate limiting
- **Transaction Builders** -- Deterministic construction of transfer, approve, and swap transactions from typed intents
- **Preflight Simulation** -- Transaction simulation with risk scoring (7 additive rules, 0-100 scale) before signing
- **Human Approval Gates** -- Single-use approval tokens with TTL for fund-affecting operations above configurable thresholds
- **Append-Only Audit Trail** -- Every critical step logged to SQLite, correlated by `intentId`
- **Skill Registry** -- Manifest validation, ECDSA signature verification, file hash integrity, and static analysis scanning
- **Docker Sandbox** -- Container isolation with network disabled, read-only filesystem, seccomp profiles, and all capabilities dropped
- **Native ETH and ERC-20 Support** -- Transfer, approve, and swap operations for both native ETH and ERC-20 tokens
- **Multi-Chain Support** -- Ethereum, Optimism, Arbitrum, and Base with per-chain RPC routing
- **Web Approval Dashboard** -- Browser-based approval UI with risk visualization, balance diffs, and transaction history
- **DEX Aggregation** -- Uniswap V3 built-in, 1inch Swap API v6 optional with automatic fallback
- **Agent Integrations** -- MCP server (Claude Desktop, Cursor), ElizaOS plugin, Telegram bot, OpenClaw adapter
- **Rate Limiting** -- Per-wallet transaction rate limits enforced across all fund-affecting endpoints

## Package Structure

Clavion is organized as a monorepo with the following packages:

| Package | Name | Description |
|---|---|---|
| `packages/types` | `@clavion/types` | Shared TypeScript types, TxIntent and SkillManifest schemas |
| `packages/audit` | `@clavion/audit` | Append-only audit trace service (SQLite) |
| `packages/policy` | `@clavion/policy` | Policy engine, config schema, rule evaluation |
| `packages/signer` | `@clavion/signer` | Wallet service, encrypted keystore, signing pipeline |
| `packages/preflight` | `@clavion/preflight` | Transaction simulation, risk scoring |
| `packages/registry` | `@clavion/registry` | Skill manifest validation, signing, static scanning |
| `packages/sandbox` | `@clavion/sandbox` | Docker-based container isolation runner |
| `packages/core` | `@clavion/core` | Fastify API server, route handlers, service wiring |
| `packages/adapter-openclaw` | `@clavion/adapter-openclaw` | OpenClaw skill wrappers and ISCL client |
| `packages/adapter-mcp` | `@clavion/adapter-mcp` | MCP server for Claude Desktop, Cursor, and IDEs |
| `packages/plugin-eliza` | `@clavion/plugin-eliza` | ElizaOS (ai16z) plugin with 5 secure actions |
| `packages/adapter-telegram` | `@clavion/adapter-telegram` | Telegram bot with inline approval UI |
| `packages/cli` | `@clavion/cli` | Key management CLI (import, generate, list) |
| `packages/sdk` | `@clavion/sdk` | SDK for external integrations |

## Quick Start

### One-Line Install

```bash
curl -fsSL https://clavion.xyz/install.sh | bash
```

### Or with Docker

```bash
docker compose up -d clavion
```

### From Source

Prerequisites: Node.js 20+, Docker (for sandbox and security tests)

```bash
git clone https://github.com/clavion-xyz/clavion.git
cd clavion
npm install
npm run build
```

### Run Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Security tests (requires Docker)
npm run test:security

# E2E tests (requires testnet or Anvil fork)
npm run test:e2e
```

### Run Development Server

```bash
# Start the ISCL Core API server (development)
npm run dev

# Start from compiled output (production)
npm start
```

### Docker Compose (Demo)

```bash
# Start all services: Anvil fork, ISCL Core, OpenClaw
docker compose --profile demo up -d
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/v1/health` | Version and status check |
| `POST` | `/v1/tx/build` | Build transaction from TxIntent |
| `POST` | `/v1/tx/preflight` | Simulate transaction and score risk |
| `POST` | `/v1/tx/approve-request` | Request human approval, issue token |
| `POST` | `/v1/tx/sign-and-send` | Sign and broadcast (requires approval token) |
| `GET` | `/v1/tx/:hash` | Get transaction receipt |
| `GET` | `/v1/balance/:token/:account` | ERC-20 or native balance lookup |
| `GET` | `/v1/approvals/pending` | List pending web approval requests |
| `POST` | `/v1/approvals/:id/decide` | Submit approve/deny decision |
| `GET` | `/v1/approvals/history` | Recent audit events |
| `GET` | `/approval-ui` | Web approval dashboard (HTML) |
| `POST` | `/v1/skills/register` | Register a skill manifest |
| `GET` | `/v1/skills` | List registered skills |
| `GET` | `/v1/skills/:name` | Get skill by name |
| `DELETE` | `/v1/skills/:name` | Revoke a registered skill |

## Documentation

Detailed documentation is available in the `docs/` directory:

- **[Quick Start](docs/quickstart.md)** -- Get running in 5 minutes
- **[Setup Guide](docs/development/dev-setup.md)** -- Environment variables, policy, Docker
- **[API Reference](docs/api/overview.md)** -- All endpoints with examples
- **[Architecture](docs/architecture/overview.md)** -- Three-domain trust model
- **[Engineering Spec](docs/architecture/engineering-spec.md)** -- Master technical specification
- **[Threat Model](docs/architecture/threat-model.md)** -- Security analysis and mitigations
- **[Whitepaper](docs/architecture/whitepaper.md)** -- Project vision and design rationale
- **[Integration Roadmap](docs/alpha-integrations.md)** -- MCP, Telegram, ElizaOS, 1inch, and more
- **[Use Cases](docs/use-cases.md)** -- Real-world scenarios and examples
- **[Testing Guide](docs/development/testing.md)** -- How to run each test category

## Security

Clavion is designed with security as a core architectural constraint. The three-domain trust model ensures that private keys never leave Domain B, all transactions pass through policy evaluation and preflight simulation, and sandbox execution is fully isolated.

For details on reporting vulnerabilities and the project's security model, see **[SECURITY.md](SECURITY.md)**.

## Contributing

Contributions are welcome. Please read **[CONTRIBUTING.md](CONTRIBUTING.md)** for guidelines on code style, testing requirements, and the pull request process.

See also: **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** and **[GOVERNANCE.md](GOVERNANCE.md)**.

## License

MIT -- see **[LICENSE](LICENSE)** for details.

Copyright (c) 2024-2026 Clavion Contributors
