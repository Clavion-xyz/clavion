# ISCL Operations Guide — Commands, Structure & Workflows

> **Version:** 0.1.0-beta · **Last updated:** 2026-02-07

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Running the ISCL Daemon](#2-running-the-iscl-daemon)
3. [Environment Variables](#3-environment-variables)
4. [NPM Scripts Reference](#4-npm-scripts-reference)
5. [API Endpoints](#5-api-endpoints)
6. [OpenClaw Adapter & Skill Wrappers](#6-openclaw-adapter--skill-wrappers)
7. [Docker & Docker Compose](#7-docker--docker-compose)
8. [Testing](#8-testing)
9. [Demo Scripts](#9-demo-scripts)
10. [Sandbox Executor (Domain C)](#10-sandbox-executor-domain-c)
11. [Repository Structure](#11-repository-structure)
12. [Data Flow (End-to-End)](#12-data-flow-end-to-end)
13. [CI/CD Pipeline](#13-cicd-pipeline)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Quick Start

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | ≥ 20.0.0 | Runtime |
| npm | ≥ 9 | Package manager |
| Docker | ≥ 24 | Sandbox execution, container builds |
| Anvil (Foundry) | latest | Local Base fork for E2E testing |

### Install & Run (3 commands)

```bash
npm install
npm run dev                           # starts ISCL daemon at http://127.0.0.1:3100
curl http://localhost:3100/v1/health  # → { "status": "ok", "version": "0.1.0" }
```

### Install Foundry / Anvil (for E2E)

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
anvil --version
```

---

## 2. Running the ISCL Daemon

### Development Mode (hot-reload via tsx)

```bash
npm run dev
```

Starts the Fastify server at `http://127.0.0.1:3100` using `tsx core/main.ts`.

### Production Mode (compiled)

```bash
npm run build      # TypeScript → dist/
npm start          # node dist/core/main.js
```

### With RPC Client (enables preflight simulation)

```bash
BASE_RPC_URL=https://mainnet.base.org npm run dev
```

### With Custom Port & Host

```bash
ISCL_PORT=3200 ISCL_HOST=0.0.0.0 npm run dev
```

### Startup Flow

```
core/main.ts
  ├── read env vars (ISCL_PORT, ISCL_HOST, BASE_RPC_URL, ISCL_AUDIT_DB, ISCL_KEYSTORE_PATH)
  ├── create ViemRpcClient (if BASE_RPC_URL set)
  ├── buildApp({ logger, rpcClient, auditDbPath, keystorePath })
  │     ├── AuditTraceService  → SQLite append-only event log
  │     ├── ApprovalTokenManager → TTL-based single-use tokens
  │     ├── EncryptedKeystore  → scrypt + AES-256-GCM
  │     ├── WalletService      → signing pipeline
  │     ├── PolicyEngine       → intent evaluation
  │     ├── PreflightService   → RPC simulation + risk scoring (optional)
  │     ├── register healthRoute  → GET /v1/health
  │     └── register txRoutes     → POST /v1/tx/*
  └── app.listen({ port: 3100, host: "127.0.0.1" })
```

---

## 3. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ISCL_PORT` | `3100` | HTTP server port |
| `ISCL_HOST` | `127.0.0.1` | Bind address (`0.0.0.0` in Docker) |
| `BASE_RPC_URL` | — | Base chain RPC endpoint. Enables preflight simulation. Omit to run without RPC. |
| `ISCL_AUDIT_DB` | `./iscl-audit.sqlite` | Path to SQLite audit database |
| `ISCL_KEYSTORE_PATH` | `~/.iscl/keystore` | Directory for encrypted key files |
| `ISCL_API_URL` | `http://127.0.0.1:3000` | Used by adapter/ISCLClient (not the daemon itself) |
| `BASE_FORK_RPC_URL` | `https://mainnet.base.org` | Used by docker-compose for Anvil fork URL |

---

## 4. NPM Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `tsx core/main.ts` | Development server with hot reload |
| `npm run build` | `tsc` | Compile TypeScript → `dist/` |
| `npm start` | `node dist/core/main.js` | Start compiled production server |
| `npm test` | `vitest run` | Run all tests |
| `npm run test:unit` | `vitest run tests/unit` | Unit tests only (~208 tests) |
| `npm run test:integration` | `vitest run tests/integration` | Integration tests (~33 tests) |
| `npm run test:security` | `vitest run tests/security` | Security tests (~28 tests, some need Docker) |
| `npm run test:e2e` | `vitest run tests/e2e` | E2E tests (requires Anvil + `BASE_RPC_URL`) |
| `npm run test:watch` | `vitest` | Watch mode |
| `npm run lint` | `eslint .` | Lint all files |
| `npm run format` | `prettier --write '**/*.{ts,json,md,yaml}'` | Auto-format |
| `npm run format:check` | `prettier --check '**/*.{ts,json,md,yaml}'` | Check formatting (CI) |
| `npm run generate:hashes` | `tsx spec/fixtures/generate-hashes.ts` | Regenerate manifest file hashes |

---

## 5. API Endpoints

Base URL: `http://127.0.0.1:3100`

### GET /v1/health

Health check + version info.

```bash
curl http://localhost:3100/v1/health
```

```json
{ "status": "ok", "version": "0.1.0", "uptime": 42.123 }
```

### POST /v1/tx/build

Build an EVM transaction from a TxIntent. Runs policy evaluation.

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
      "asset": {
        "kind": "erc20",
        "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "symbol": "USDC",
        "decimals": 6
      },
      "to": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      "amount": "1000000"
    },
    "constraints": {
      "maxGasWei": "1000000000000000",
      "deadline": 1700003600,
      "maxSlippageBps": 100
    }
  }'
```

**Response 200:** `{ intentId, txRequestHash, description, txRequest, policyDecision }`
**Response 400:** Schema validation failed
**Response 403:** `{ error: "policy_denied", decision, reasons }`

### POST /v1/tx/preflight

Simulate transaction on-chain + compute risk score.

```bash
curl -X POST http://localhost:3100/v1/tx/preflight \
  -H "Content-Type: application/json" \
  -d '{ ... TxIntent ... }'
```

**Response 200:** `{ intentId, simulationSuccess, gasEstimate, balanceDiffs, riskScore, riskReasons, warnings }`
**Response 502:** RPC client not configured

### POST /v1/tx/approve-request

Generate an approval summary with policy decision and risk score.

```bash
curl -X POST http://localhost:3100/v1/tx/approve-request \
  -H "Content-Type: application/json" \
  -d '{ ... TxIntent ... }'
```

**Response 200:** `{ intentId, txRequestHash, description, policyDecision, riskScore, riskReasons, warnings }`

### POST /v1/tx/sign-and-send

Sign and broadcast. Requires unlocked key; requires approval token if policy says `require_approval`.

```bash
curl -X POST http://localhost:3100/v1/tx/sign-and-send \
  -H "Content-Type: application/json" \
  -d '{
    "intent": { ... TxIntent ... },
    "approvalTokenId": "optional-uuid"
  }'
```

**Response 200:** `{ signedTx, txHash, intentId }`
**Response 403:** `{ error: "approval_required" }` or `{ error: "signing_failed" }`

### GET /v1/tx/:hash

Transaction status lookup (stub — not yet implemented).

**Response 501:** `{ error: "not_implemented" }`

---

## 6. OpenClaw Adapter & Skill Wrappers

The adapter layer (Domain A, untrusted) communicates with ISCL Core (Domain B) **exclusively over HTTP**. No direct access to keys, signing, or RPC.

### ISCLClient

```
adapter/shared/iscl-client.ts
```

HTTP client that wraps all ISCL API calls:

```typescript
import { ISCLClient } from "./adapter/shared/iscl-client.js";

const client = new ISCLClient({ baseUrl: "http://127.0.0.1:3100" });

await client.health();                          // GET /v1/health
await client.txBuild(intent);                   // POST /v1/tx/build
await client.txPreflight(intent);               // POST /v1/tx/preflight
await client.txApproveRequest(intent);          // POST /v1/tx/approve-request
await client.txSignAndSend({ intent, approvalTokenId });  // POST /v1/tx/sign-and-send
```

### Intent Builder

```
adapter/skills/intent-builder.ts
```

Constructs a valid TxIntent with sensible defaults:

```typescript
import { buildIntent } from "./adapter/skills/intent-builder.js";

const intent = buildIntent({
  walletAddress: "0x1234...",
  action: {
    type: "transfer",
    asset: { kind: "erc20", address: "0x833589...", symbol: "USDC", decimals: 6 },
    to: "0xabcd...",
    amount: "1000000",
  },
  // defaults: chainId=8453, maxGasWei="1000000000000000", deadline=now+600, slippageBps=100
});
```

### Skill Wrappers (4 Skills)

Each wrapper constructs an intent, calls the appropriate ISCL endpoint, and returns a `SkillResult`.

| Skill | File | Function | Action |
|-------|------|----------|--------|
| **Transfer** | `adapter/skills/clavion-transfer/index.ts` | `handleTransfer(params, client)` | ERC-20 transfer |
| **Approve** | `adapter/skills/clavion-approve/index.ts` | `handleApprove(params, client)` | ERC-20 approval |
| **Swap** | `adapter/skills/clavion-swap/index.ts` | `handleSwap(params, client)` | Uniswap V3 exact-in swap |
| **Balance** | `adapter/skills/clavion-balance/index.ts` | `handleBalance(params, client)` | (stub — not yet implemented) |

#### Transfer Example

```typescript
import { handleTransfer } from "./adapter/skills/clavion-transfer/index.js";
import { ISCLClient } from "./adapter/shared/iscl-client.js";

const client = new ISCLClient({ baseUrl: "http://127.0.0.1:3100" });

const result = await handleTransfer({
  walletAddress: "0x1234...",
  asset: { kind: "erc20", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 },
  to: "0xabcd...",
  amount: "1000000",
}, client);

// result: { success: true, intentId: "...", description: "Transfer 1000000 USDC to 0xabcd..." }
```

### Installation Verification

```
adapter/install.ts
```

```typescript
import { verifyInstallation } from "./adapter/install.js";

const { ok, errors } = await verifyInstallation("http://127.0.0.1:3100");
// ok: true/false, errors: string[]
```

---

## 7. Docker & Docker Compose

### Build the Docker Image

```bash
docker build -t iscl-core:0.1.0-beta .
```

Multi-stage build: `node:20-alpine` builder → `node:20-alpine` runtime.
Non-root user `iscl`, exposed port 3100.

### Run Standalone

```bash
docker run -p 3100:3100 iscl-core:0.1.0-beta
```

### Run with RPC & Persistent Keystore

```bash
docker run -p 3100:3100 \
  -e BASE_RPC_URL=https://mainnet.base.org \
  -v iscl-keystore:/home/iscl/.iscl/keystore \
  -v iscl-data:/home/iscl/.iscl/data \
  iscl-core:0.1.0-beta
```

### Docker Compose (Full Stack: ISCL + Anvil)

```bash
# Start both services
docker compose up

# ISCL Core:  http://127.0.0.1:3100
# Anvil Fork: http://127.0.0.1:8545 (Base mainnet fork)
```

```bash
# With custom fork RPC
BASE_FORK_RPC_URL=https://your-base-rpc.url docker compose up
```

**Compose stack:**

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `iscl-core` | Built from `./Dockerfile` | 3100 | ISCL daemon |
| `anvil` | `ghcr.io/foundry-rs/foundry:latest` | 8545 | Local Base mainnet fork |

The `iscl-core` service connects to Anvil at `http://anvil:8545` and uses a named volume `keystore-data` for persistent key storage.

---

## 8. Testing

### Test Matrix (275 total)

| Category | Count | Command | Requirements |
|----------|-------|---------|-------------|
| Unit | ~208 | `npm run test:unit` | None |
| Integration | ~33 | `npm run test:integration` | None |
| Security | ~28 | `npm run test:security` | Docker (some tests skip if unavailable) |
| E2E | ~6 | `npm run test:e2e` | Anvil + `BASE_RPC_URL` |

### Running Tests

```bash
# All tests
npm test

# By category
npm run test:unit
npm run test:integration
npm run test:security
npm run test:e2e

# Watch mode
npm run test:watch

# E2E with RPC
BASE_RPC_URL=https://mainnet.base.org npm run test:e2e
```

### Test Directory Structure

```
tests/
├── unit/                            # Schema, policy, wallet, builders, risk, etc.
│   ├── schema-validation.test.ts
│   ├── policy-engine.test.ts
│   ├── wallet-service.test.ts
│   ├── keystore.test.ts
│   ├── canonicalization.test.ts
│   ├── transfer-builder.test.ts
│   ├── approve-builder.test.ts
│   ├── swap-builder.test.ts
│   ├── risk-scorer.test.ts
│   ├── preflight-service.test.ts
│   ├── manifest-validator.test.ts
│   ├── manifest-signer.test.ts
│   ├── static-scanner.test.ts
│   ├── iscl-client.test.ts
│   └── ...
├── integration/                     # HTTP API, adapter client, skill wrappers
│   ├── health.test.ts
│   ├── tx-build-validation.test.ts
│   ├── adapter-client.test.ts
│   └── adapter-skills.test.ts
├── security/                        # Trust domain isolation, sandbox escape, tampered packages
│   ├── domain-a-isolation.test.ts   # Domain A can't access keys/RPC
│   ├── domain-b-integrity.test.ts   # Domain B enforces policy/approval
│   ├── domain-c-tampered-package.test.ts  # Tampered manifest detection
│   └── sandbox-isolation.test.ts    # Docker sandbox constraints
├── e2e/
│   └── full-flow.test.ts           # Anvil fork: build → preflight → approve → sign → broadcast
└── helpers/
    └── anvil-fork.ts               # Anvil process management + USDC funding
```

### Fixtures

```
spec/fixtures/
├── valid-intents.ts        # Valid TxIntent per action type
├── invalid-intents.ts      # Edge cases & malformed intents
├── skill-manifests.ts      # Skill manifest examples
├── generate-hashes.ts      # Regenerate file hashes
└── index.ts                # Re-exports all fixtures
```

---

## 9. Demo Scripts

### demo-transfer.ts — Simple Transfer

```bash
# Requires: ISCL daemon running at :3100
npx tsx scripts/demo-transfer.ts
```

Calls health → build → preflight → approve-request → sign-and-send for a USDC transfer.

### demo-swap.ts — Uniswap V3 Swap

```bash
npx tsx scripts/demo-swap.ts
```

Same flow but with a USDC → WETH swap via SwapRouter02.

### demo-full-flow.ts — End-to-End with Anvil

```bash
# Requires: Anvil installed, BASE_RPC_URL set
BASE_RPC_URL=https://mainnet.base.org npx tsx scripts/demo-full-flow.ts
```

This is the comprehensive demo. It:

1. Starts an Anvil Base fork (port 18546)
2. Imports a test wallet (Anvil default account #0)
3. Boots ISCL Core in-process (not as a separate daemon)
4. Funds the wallet with 100 USDC via `anvil_setStorageAt`
5. Runs 3 transaction flows:
   - Transfer 1 USDC
   - Approve 50 USDC for Uniswap
   - Swap 5 USDC → WETH
6. Displays the audit trail
7. Demonstrates a policy denial (wrong chain)
8. Cleans up temp files

---

## 10. Sandbox Executor (Domain C)

The sandbox runs untrusted skill code in an isolated Docker container.

### Docker Flags Applied

```
--rm                              # Auto-cleanup on exit
--network none                    # No network access
--read-only                       # Read-only root filesystem
--cap-drop ALL                    # Drop all Linux capabilities
--security-opt no-new-privileges  # No privilege escalation
--memory <from manifest>          # Memory limit
--cpus 0.5                        # CPU quota
--tmpfs /tmp:noexec               # Writable temp (no exec)
--security-opt seccomp=...        # Seccomp profile (if !allowSpawn)
```

### Seccomp Profile (sandbox/seccomp-no-spawn.json)

Blocks all process creation syscalls:

```json
{
  "defaultAction": "SCMP_ACT_ALLOW",
  "syscalls": [{
    "names": ["clone", "clone3", "fork", "vfork", "execve", "execveat"],
    "action": "SCMP_ACT_ERRNO",
    "errnoRet": 1
  }]
}
```

### Audit Events

- `sandbox_started` — Container launched
- `sandbox_completed` — Skill finished successfully
- `sandbox_error` — Failure or timeout
- `security_violation` — Attempted sandbox escape

---

## 11. Repository Structure

```
Clavion_project/
│
├── core/                          # Domain B (Trusted) — ISCL Core
│   ├── main.ts                    # Entry point
│   ├── types.ts                   # Shared type definitions
│   ├── api/
│   │   ├── app.ts                 # Fastify app builder
│   │   └── routes/
│   │       ├── health.ts          # GET /v1/health
│   │       └── tx.ts              # POST /v1/tx/*
│   ├── wallet/
│   │   ├── keystore.ts            # EncryptedKeystore (scrypt + AES-256-GCM)
│   │   └── wallet-service.ts      # Signing pipeline
│   ├── policy/
│   │   ├── policy-engine.ts       # Intent → allow/deny/require_approval
│   │   └── policy-config.ts       # Config schema & loader
│   ├── approval/
│   │   ├── approval-service.ts    # User confirmation prompt
│   │   └── approval-token-manager.ts  # Single-use TTL tokens
│   ├── audit/
│   │   └── audit-trace-service.ts # Append-only SQLite event log
│   ├── tx/builders/
│   │   ├── index.ts               # Action type → builder dispatcher
│   │   ├── transfer-builder.ts    # ERC-20 transfer calldata
│   │   ├── approve-builder.ts     # ERC-20 approve calldata
│   │   └── swap-builder.ts        # UniswapV3 SwapRouter02 calldata
│   ├── preflight/
│   │   ├── preflight-service.ts   # eth_call simulation + risk
│   │   └── risk-scorer.ts         # 7 additive rules, capped at 100
│   ├── rpc/
│   │   ├── rpc-client.ts          # Interface
│   │   └── viem-rpc-client.ts     # Viem implementation
│   ├── skill/
│   │   ├── manifest-validator.ts  # SkillManifest schema check
│   │   ├── manifest-signer.ts     # ECDSA sign/verify (viem)
│   │   ├── file-hasher.ts         # SHA-256 file integrity
│   │   └── static-scanner.ts      # 5 rule categories for code analysis
│   ├── canonicalize/
│   │   └── intent-hash.ts         # JCS + keccak256
│   └── schemas/
│       └── validator.ts           # AJV strict-mode validator
│
├── adapter/                       # Domain A (Untrusted) — OpenClaw Adapter
│   ├── shared/
│   │   └── iscl-client.ts         # HTTP client for ISCL Core
│   ├── skills/
│   │   ├── clavion-transfer/      # Transfer skill wrapper
│   │   ├── clavion-approve/       # Approve skill wrapper
│   │   ├── clavion-swap/          # Swap skill wrapper
│   │   ├── clavion-balance/       # Balance skill wrapper (stub)
│   │   ├── intent-builder.ts      # TxIntent constructor with defaults
│   │   └── types.ts               # Adapter-side type definitions
│   └── install.ts                 # Installation verification
│
├── sandbox/                       # Domain C (Limited Trust)
│   ├── sandbox-runner.ts          # Docker-based skill executor
│   └── seccomp-no-spawn.json      # Syscall filter profile
│
├── spec/                          # Schemas & Fixtures
│   ├── schemas/
│   │   ├── txintent-schema.ts     # TxIntent v1 JSON Schema
│   │   └── skill-manifest-schema.ts  # SkillManifest v1 JSON Schema
│   └── fixtures/                  # Test data (valid, invalid, edge cases)
│
├── tests/                         # All tests (unit/integration/security/e2e)
│
├── scripts/                       # Demo & utility scripts
│   ├── demo-transfer.ts
│   ├── demo-swap.ts
│   └── demo-full-flow.ts
│
├── doc/                           # Documentation & specs
│   ├── SETUP.md
│   ├── API_REFERENCE.md
│   ├── ADAPTER_GUIDE.md
│   └── ... (engineering spec, security blueprint, PRD, roadmap)
│
├── iscl-claude-code-skills/       # 12 Claude Code skill packages (dev guidance)
│
├── .github/workflows/test.yml     # CI pipeline
├── Dockerfile                     # Multi-stage Docker build
├── docker-compose.yml             # ISCL + Anvil stack
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.mjs
├── .prettierrc
└── CLAUDE.md                      # Codebase instructions for Claude Code
```

---

## 12. Data Flow (End-to-End)

```
┌──────────────────────────────────────────────────────────────────┐
│ Domain A (Untrusted)                                             │
│                                                                  │
│  AI Agent  →  Skill Wrapper  →  ISCLClient  ── HTTP ──┐         │
│  (OpenClaw)   (clavion-transfer)  (fetch)              │         │
└────────────────────────────────────────────────────────┼─────────┘
                                                         │
                                               localhost:3100
                                                         │
┌────────────────────────────────────────────────────────┼─────────┐
│ Domain B (Trusted) — ISCL Core                         ▼         │
│                                                                  │
│  Fastify Router                                                  │
│    │                                                             │
│    ├── POST /v1/tx/build                                         │
│    │     ├── Validate TxIntent (AJV)                             │
│    │     ├── PolicyEngine.evaluate(intent)                       │
│    │     │     → allow / deny / require_approval                 │
│    │     ├── TxBuilder.build(intent)                             │
│    │     │     → { to, data, value, chainId } (EVM tx)           │
│    │     ├── IntentHash (JCS + keccak256)                        │
│    │     ├── AuditTrace.log("tx_built", ...)                     │
│    │     └── Response: { intentId, txRequest, policyDecision }   │
│    │                                                             │
│    ├── POST /v1/tx/preflight                                     │
│    │     ├── Build tx (same as /build)                           │
│    │     ├── PreflightService.simulate(intent, plan)             │
│    │     │     ├── eth_call simulation via ViemRpcClient          │
│    │     │     ├── Balance diffs calculation                     │
│    │     │     └── RiskScorer.score(intent, simResult)           │
│    │     │           → 7 additive rules, capped at 100           │
│    │     └── Response: { riskScore, gasEstimate, balanceDiffs }  │
│    │                                                             │
│    ├── POST /v1/tx/approve-request                               │
│    │     ├── Build + Policy + Preflight                          │
│    │     └── Response: { description, policyDecision, riskScore }│
│    │                                                             │
│    └── POST /v1/tx/sign-and-send                                 │
│          ├── Build + Policy check                                │
│          ├── Validate approval token (if require_approval)       │
│          │     └── ApprovalTokenManager.consume(tokenId)         │
│          ├── WalletService.sign(txRequest)                       │
│          │     └── EncryptedKeystore.sign() (key must be unlocked)│
│          ├── Broadcast via RPC (if available)                    │
│          ├── AuditTrace.log("tx_signed", ...)                    │
│          └── Response: { signedTx, txHash, intentId }            │
│                                                                  │
│  ViemRpcClient ──── HTTPS ────→  Base RPC (mainnet.base.org)    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Domain C (Limited Trust) — Sandbox                               │
│                                                                  │
│  DockerSandboxRunner                                             │
│    ├── docker run --rm --network none --read-only --cap-drop ALL │
│    ├── Seccomp: no clone/fork/exec                               │
│    ├── Memory + CPU limits from SkillManifest                    │
│    └── Communicates with Core via API only                       │
└──────────────────────────────────────────────────────────────────┘
```

### Typical Skill Call Sequence

```
1. Agent calls handleTransfer({ walletAddress, asset, to, amount }, client)
2. Skill wrapper calls buildIntent() → TxIntent
3. client.txBuild(intent)           → POST /v1/tx/build  → { txRequest, policyDecision }
4. client.txPreflight(intent)       → POST /v1/tx/preflight → { riskScore, gasEstimate }
5. client.txApproveRequest(intent)  → POST /v1/tx/approve-request → { description, riskScore }
6. (User reviews and approves)
7. client.txSignAndSend({ intent, approvalTokenId }) → POST /v1/tx/sign-and-send → { txHash }
```

---

## 13. CI/CD Pipeline

### GitHub Actions (.github/workflows/test.yml)

**Triggers:** Push to `main`/`develop`, PR to `main`

**Matrix:** Node 20 + Node 22

**Steps:**
```
checkout → setup-node → npm ci → build → lint → format:check → test:unit → test:integration
```

Security tests and E2E are not run in CI (require Docker/Anvil runtime).

---

## 14. Troubleshooting

### Port already in use

```bash
ISCL_PORT=3200 npm run dev
```

### Preflight returns 502 (no RPC)

```bash
BASE_RPC_URL=https://mainnet.base.org npm run dev
```

### E2E tests fail (no Anvil)

```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup
BASE_RPC_URL=https://mainnet.base.org npm run test:e2e
```

### Docker build fails

```bash
docker build --no-cache -t iscl-core:0.1.0-beta .
```

### Security tests skipped

Security tests that require Docker will auto-skip with `describe.skipIf(!dockerAvailable)`. Install and start Docker to run them.

### Test RPC connectivity

```bash
curl -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```
