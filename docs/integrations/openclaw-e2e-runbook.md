# Clavion × OpenClaw End-to-End Integration Runbook (Developer Alpha)

**Version:** v0.1.0-beta (skill registry + rate limiting + native ETH + TX broadcast — tokens move on-chain)
**Last updated:** 2026-02-07
**Status:** 349 tests passing (321 unit+integration, 28 security) + full broadcast verified on Anvil
**Goal:** Run an OpenClaw crypto agent that executes on-chain actions via Clavion/ISCL with **policy enforcement, rate limiting, skill registry, preflight simulation, human approval tokens, sandbox isolation, and audit logging**.

ISCL Operations Guide — Command…

---

## 1) Mental Model (What runs where)

### Trust domains

- **Domain A (Untrusted):** OpenClaw + agent skills. Must not see keys; must not sign; must not talk to blockchain RPC directly.
    
- **Domain B (Trusted):** Clavion/ISCL Core daemon. Holds encrypted keystore, enforces policy (including per-wallet rate limiting), performs preflight simulation (optional RPC), issues approval tokens, signs & broadcasts tx, and writes audit trail.
    
    ISCL Operations Guide — Command…
    
- **Domain C (Constrained):** Sandbox executor for untrusted skill code (Docker in v0.1), enforcing network/filesystem/process restrictions and logging sandbox events into audit.
    
    ISCL Operations Guide — Command…
    
    Engineering Task Breakdown — IS…
    

### Core principle

OpenClaw skills do **HTTP calls only** to Clavion Core. They never receive private keys, never sign, and (in your model) should not need raw RPC access.

ISCL Operations Guide — Command…

---

## 2) Prerequisites (Local Dev / Alpha)

You require these tools for the current workflow:

- Node.js ≥ 20
    
- npm ≥ 9
    
- Docker ≥ 24 (sandbox + compose stack)
    
- Foundry/Anvil (for forked E2E)
    
    ISCL Operations Guide — Command…
    

Install Anvil:

`curl -L https://foundry.paradigm.xyz | bash foundryup anvil --version`

ISCL Operations Guide — Command…

---

## 3) Repository Structure (High-level)

Your repo layout is explicitly designed around trust domains:

- `core/` — Domain B (trusted Core daemon)
    
- `adapter/` — Domain A (OpenClaw adapter + skill wrappers + ISCLClient)
    
- `sandbox/` — Domain C (Docker sandbox runner + seccomp profile)
    
- `spec/` — schemas + fixtures
    
- `tests/` — unit/integration/security/e2e test suites
    
- `scripts/` — demo scripts (transfer/swap/full-flow)

- `openclaw-skills/` — OpenClaw skill packages (SKILL.md + runner scripts)

    ISCL Operations Guide — Command…

    ISCL Operations Guide — Command…
    

---

## 4) Running Clavion/ISCL Core (Domain B)

### 4.1 Quick start (local dev)

`npm install npm run dev curl http://localhost:3100/v1/health`

Expected:

`{ "status": "ok", "version": "0.1.0", "uptime": 42.123 }`

Core listens on **[http://127.0.0.1:3100](http://127.0.0.1:3100)** by default.

ISCL Operations Guide — Command…

ISCL Operations Guide — Command…

### 4.2 Enable preflight simulation (recommended)

Preflight needs a Base RPC:

`BASE_RPC_URL=https://mainnet.base.org npm run dev`

If RPC is missing, preflight can return a **502** “no RPC”.

ISCL Operations Guide — Command…

### 4.3 Key environment variables

Core runtime reads: `ISCL_PORT`, `ISCL_HOST`, `BASE_RPC_URL`, `ISCL_AUDIT_DB`, `ISCL_KEYSTORE_PATH`.

ISCL Operations Guide — Command…

The adapter uses `ISCL_API_URL` (defaults to a client base URL).

ISCL Operations Guide — Command…

---

## 5) Running the Full Stack with Docker Compose

### 5.1 Core + Anvil (development)

`docker compose up`

This starts:

- ISCL Core: `http://127.0.0.1:3100`
- Anvil fork: `http://127.0.0.1:8545` (Base mainnet fork)

### 5.2 Full demo stack with OpenClaw (3-service stack)

`docker compose --profile demo up -d`

This starts all three services:

- **Anvil** — Base mainnet fork at `http://127.0.0.1:8545`
- **ISCL Core** — API at `http://127.0.0.1:3100` (demo-boot: auto-approve + wallet unlock)
- **OpenClaw** — AI agent + Control UI at `http://127.0.0.1:18789`

The `demo` profile uses `core/demo-boot.ts` which:
1. Unlocks all keystore wallets with `ISCL_DEMO_PASSPHRASE`
2. Enables auto-approve mode (`ISCL_AUTO_APPROVE=true`) so the agent can complete transactions without manual operator approval

**First-time OpenClaw setup:**

```bash
# 1. Fix volume ownership (OpenClaw runs as uid 1000)
docker run --rm -v clavion_project_openclaw-config:/data alpine chown -R 1000:1000 /data

# 2. Run onboarding (interactive — choose QuickStart, Anthropic provider, paste setup-token)
docker compose --profile demo run --rm openclaw node dist/index.js onboard

# 3. Set gateway bind to 'lan' (required for Docker port forwarding)
docker compose --profile demo exec openclaw node dist/index.js config set gateway.bind lan

# 4. Approve device pairing (after connecting from browser)
docker compose --profile demo exec openclaw node dist/index.js devices list
docker compose --profile demo exec openclaw node dist/index.js devices approve <request-id>
```

**Wallet setup on Anvil fork** (fund a test wallet with ETH + USDC):

The demo-boot script unlocks wallets automatically, but you must first generate a keystore entry and fund it on Anvil. See `scripts/` for setup helpers or use `anvil_setBalance` / `anvil_setStorageAt` RPC calls.

**Sending agent commands programmatically:**

```bash
docker compose --profile demo exec openclaw node dist/index.js agent \
  --session-id demo-1 \
  --message "Check USDC balance for wallet 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" \
  --json --timeout 60
```

To override fork RPC source:

`BASE_FORK_RPC_URL=https://your-base-rpc.url docker compose --profile demo up -d`

---

## 6) Core HTTP API (What OpenClaw calls)

Base URL: `http://127.0.0.1:3100`

ISCL Operations Guide — Command…

Endpoints:

- ✅ `GET /v1/health`

- ✅ `POST /v1/tx/build`

- ✅ `POST /v1/tx/preflight`

- ✅ `POST /v1/tx/approve-request` — now prompts operator in terminal when policy requires approval; returns `approvalTokenId`

- ✅ `POST /v1/tx/sign-and-send`

- ✅ `GET /v1/tx/:hash` — returns transaction receipt (status, block, gas used, logs)

- ✅ `GET /v1/balance/:token/:account` — ERC-20 balance lookup

- ✅ `POST /v1/skills/register` — register a signed skill package (schema + signature + hash + scan validation)

- ✅ `GET /v1/skills` — list all active registered skills

- ✅ `GET /v1/skills/:name` — get specific skill details

- ✅ `DELETE /v1/skills/:name` — revoke a registered skill



### Canonical call sequence (the "secure pipeline")

1. ✅ build intent → **policy evaluated + rate limit checked**

2. ✅ preflight → **simulation + risk scoring**

3. ✅ approve-request → **human-readable summary rendered in Core terminal; operator prompted via readline; approval token issued if approved; rate limit checked**

4. ✅ sign-and-send → **requires approval token if policy says require_approval; rate limit checked; broadcasts tx on-chain if RPC available**

The approve-request endpoint now returns `approvalRequired` (bool), `approved` (bool), and `approvalTokenId` (UUID, present when approved). When policy decision is `allow`, no prompt occurs and no token is needed for sign-and-send.

The sign-and-send endpoint now:
- Fetches nonce, gas limit, and EIP-1559 fee data from RPC before signing
- Broadcasts the signed transaction via `eth_sendRawTransaction`
- Returns `broadcast: true/false` and optional `broadcastError` in the response
- Logs `tx_broadcast` or `broadcast_failed` audit events
- Gracefully degrades to sign-only mode when no RPC client is configured



---

## 7) OpenClaw Adapter (Domain A) — How integration works

### 7.1 ISCLClient (HTTP only)

The adapter includes `adapter/shared/iscl-client.ts`, wrapping all API calls:

ISCL Operations Guide — Command…

`import { ISCLClient } from "./adapter/shared/iscl-client.js";  const client = new ISCLClient({ baseUrl: "http://127.0.0.1:3100" });  await client.health();                          await client.txBuild(intent);                   await client.txPreflight(intent);               await client.txApproveRequest(intent);          await client.txSignAndSend({ intent, approvalTokenId });  await client.balance(tokenAddress, accountAddress);  await client.txReceipt(txHash);`

### 7.2 Intent builder (safe defaults)

`adapter/skills/intent-builder.ts` builds a valid TxIntent with defaults (chainId=8453, maxGasWei, deadline=now+600, slippageBps=100).

ISCL Operations Guide — Command…

### 7.3 Skill wrappers (your “OpenClaw tools”)

You already have wrappers mapping tool calls → intents → ISCL endpoints:

ISCL Operations Guide — Command…

- ✅ `clavion-transfer` → `handleTransfer(params, client)`

- ✅ `clavion-transfer-native` → `handleTransferNative(params, client)` (native ETH, no asset param)

- ✅ `clavion-approve` → `handleApprove(params, client)`

- ✅ `clavion-swap` → `handleSwap(params, client)` (Uniswap V3 exact-in swap)

- ✅ `clavion-balance` → `handleBalance(params, client)` (ERC-20 balance via Core RPC)
    

Example usage:

`import { handleTransfer } from "./adapter/skills/clavion-transfer/index.js"; import { ISCLClient } from "./adapter/shared/iscl-client.js";  const client = new ISCLClient({ baseUrl: "http://127.0.0.1:3100" });  const result = await handleTransfer({   walletAddress: "0x1234...",   asset: { kind: "erc20", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 },   to: "0xabcd...",   amount: "1000000" }, client);`

ISCL Operations Guide — Command…

### 7.4 Installation verification

Use `adapter/install.ts`:

`import { verifyInstallation } from "./adapter/install.js"; const { ok, errors } = await verifyInstallation("http://127.0.0.1:3100");`

ISCL Operations Guide — Command…

---

## 8) The “Crypto Agent” in OpenClaw (What to build)

### 8.1 Agent behavior contract (must-follow rules)

The agent must:

- use Clavion tools for any on-chain action
    
- never attempt to sign or hold keys
    
- always run the secure pipeline: build → preflight → approval → sign-and-send
    

### 8.2 OpenClaw skill package (live)

The `openclaw-skills/clavion-crypto/` directory contains a complete OpenClaw skill:

- **`SKILL.md`** — Skill definition with YAML frontmatter. Teaches the agent about all 5 operations (transfer, transfer_native, approve, swap, balance check), token addresses, amount conventions, and security rules. Loaded automatically when OpenClaw starts.
- **`run.mjs`** — Standalone Node.js runner (no project imports, only built-in `fetch`). Communicates with ISCL Core over HTTP. CLI: `node run.mjs <tool_name> '<json_args>'`

The skill is mounted read-only into the OpenClaw container (`./openclaw-skills:/home/node/.openclaw/skills:ro`), maintaining Domain A isolation.

### 8.3 TypeScript adapter toolset (for programmatic use)

The OpenClaw agent is also implemented in `adapter/openclaw-agent.ts`. It exports:

- `openclawTools` — array of 5 tool definitions with JSON Schema parameters, ready for OpenClaw's tool registry
- `executeOpenClawTool(toolName, args)` — dispatcher that runs the full secure pipeline

Registered tools:

- ✅ `safe_transfer` — ERC-20 token transfer
- ✅ `safe_transfer_native` — native ETH transfer (no ERC-20 asset, just recipient + wei amount)
- ✅ `safe_approve` — ERC-20 allowance approval
- ✅ `safe_swap_exact_in` — Uniswap V3 exact-in swap
- ✅ `check_balance` — read-only ERC-20 balance lookup

For fund-affecting tools, `executeOpenClawTool` runs:

1. Build TxIntent from tool args
2. `POST /v1/tx/approve-request` — policy check + operator prompt
3. If approved: `POST /v1/tx/sign-and-send` with approval token — signs **and broadcasts** on-chain
4. Return tx hash + broadcast status

For `check_balance`, only a `GET /v1/balance/:token/:account` call is made.

Usage:

`import { openclawTools, executeOpenClawTool } from "./adapter/openclaw-agent.js";  // Register tools with OpenClaw agent registry  // Execute a tool:  const result = await executeOpenClawTool("safe_transfer", { walletAddress: "0x...", asset: { kind: "erc20", address: "0x833589...", symbol: "USDC", decimals: 6 }, to: "0xabcd...", amount: "1000000" });`

### 8.4 Human approval: non-negotiable (implemented)

The **approval token must be issued and consumed by Core** and cannot be fabricated by the agent. Security tests explicitly cover:

- signing without token when required → 403
- replaying token → 403 consumed
- expired token → 403

**Approval UX (CLI prompt):** When the `/v1/tx/approve-request` endpoint evaluates policy as `require_approval`, the Core daemon renders a human-readable transaction summary to the terminal and prompts via readline (`Approve this transaction? (yes/no)`). If the operator approves, a single-use approval token is issued and returned in the response. The `promptFn` is injectable for test automation.

The approval summary includes: action type, recipient/spender, expected outcome, balance diffs, gas estimate, risk score, risk factors, and warnings.

---

## 9) End-to-End Demo Workflows (Smoke tests you should run)

### 9.1 Demo: transfer

Requires daemon running at :3100

`npx tsx scripts/demo-transfer.ts`

This executes the full secure pipeline (health → build → preflight → approve-request → sign-and-send).

ISCL Operations Guide — Command…

### 9.2 Demo: swap (USDC → WETH)

`npx tsx scripts/demo-swap.ts`

Same pipeline, but Uniswap V3 swap via SwapRouter02.

ISCL Operations Guide — Command…

### 9.3 Full-flow demo with Anvil fork (recommended)

`BASE_RPC_URL=https://mainnet.base.org npx tsx scripts/demo-full-flow.ts`

What it does:

- starts Anvil Base fork (your doc notes port **18546** for this script-run fork)
    
- imports test wallet (Anvil default account #0)
    
- boots Core in-process
    
- funds wallet with 100 USDC via `anvil_setStorageAt`
    
- runs transfer, approve, swap
    
- prints audit trail
    
- demonstrates a policy denial (wrong chain)
    
    ISCL Operations Guide — Command…
    

This demo is the best “known good” reference for OpenClaw integration behavior.

---

## 10) Security Features You Must Preserve (Non-regression list)

### 10.1 Domain A isolation (agent code is untrusted)

Your security suite checks that:

- Domain A cannot read keystore paths (KEYS_ABSENT)
    
- Domain A cannot use network (NETWORK_BLOCKED)
    
- Policy denies malicious intents (unknown chain/token/contract/value bomb)
    
    Engineering Task Breakdown — IS…
    

### 10.2 Domain B integrity (Core enforces truth)

Your suite checks that:

- policy-denied intent cannot be signed
    
- signing without approval when required is denied
    
- approval tokens are single-use + TTL enforced
    
- max approval and MaxUint approvals are denied
    
    Engineering Task Breakdown — IS…
    

### 10.3 Domain C sandbox enforcement (Docker hardened)

Sandbox must run with:

- `--network none`
    
- `--read-only`
    
- `--cap-drop ALL`
    
- `--security-opt no-new-privileges`
    
- `--tmpfs /tmp:noexec`
    
- seccomp profile that blocks spawn syscalls when `noSpawn` is true
    
    ISCL Operations Guide — Command…
    

Your security tests verify network/fs/spawn/memory limits and audit events.

Engineering Task Breakdown — IS…

---

## 11) How to Verify Everything Works with OpenClaw (Acceptance Run)

**All steps below have been verified on 2026-02-07.**

### Step A — Start full stack ✅

```bash
docker compose --profile demo up -d
curl http://localhost:3100/v1/health
# → {"status":"ok","version":"0.1.0","uptime":...}
```

### Step B — Verify balance check (read-only) ✅

```bash
docker compose --profile demo exec openclaw node dist/index.js agent \
  --session-id test-balance \
  --message "Check USDC balance for wallet 0x0000000000000000000000000000000000000001 on Base" \
  --json --timeout 60
```

**Result:** Agent returned `39.773161 USDC` — confirmed live Anvil fork data flowing through the full pipeline (OpenClaw → run.mjs → ISCL Core → Anvil RPC).

### Step C — Execute transfer (full secure pipeline) ✅

```bash
docker compose --profile demo exec openclaw node dist/index.js agent \
  --session-id test-transfer \
  --message "Transfer 1 USDC from wallet 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 to 0x000000000000000000000000000000000000dEaD on Base. USDC address: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, decimals: 6, amount: 1000000 base units." \
  --json --timeout 120
```

**Result:** Transaction signed and **broadcast on-chain**. Full pipeline: build intent → approve-request (auto-approved in demo) → sign-and-send with approval token → broadcast → receipt confirmed.

### Step C2 — Verify broadcast moved tokens on-chain ✅

After the transfer, verify the balance actually changed:

```bash
docker compose --profile demo exec openclaw node dist/index.js agent \
  --session-id test-balance-after \
  --message "Check USDC balance for wallet 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 on Base" \
  --json --timeout 60
```

**Result:** Balance decreased from 1,000,000 USDC to 999,999 USDC — tokens actually moved on Anvil fork. Receipt shows `status: "success"`, gas used: 62,159.

### Step D — Confirm audit trail ✅

Query the SQLite audit trail inside the container:

```bash
docker compose --profile demo exec iscl-core node -e "
  const Database=require('better-sqlite3');
  const db=new Database('/home/iscl/.iscl/data/audit.sqlite',{readonly:true});
  const rows=db.prepare('SELECT event, intent_id, created_at FROM audit_events ORDER BY timestamp DESC LIMIT 10').all();
  console.log(JSON.stringify(rows,null,2));
"
```

**Verified events for the transfer intent (correlated by `intentId`):**

1. `approve_request_created` — policy decision: `require_approval`, risk score: 0
2. `approval_granted` — approval token issued
3. `signature_created` — signed by wallet, tx hash returned
4. `tx_broadcast` — transaction broadcast to network, confirmed on-chain

### Step E — Run security tests (non-negotiable) ✅

```bash
npx vitest run tests/security
# → 4 files, 28 tests passed
```

All 28 security tests pass: domain-a isolation (8), domain-b integrity (8), domain-c tampered (4), sandbox isolation (8).

### Step F — Run full test suite ✅

```bash
npx vitest run tests/unit tests/integration
# → 31 files, 298 tests passed
```

---

## 12) Sandbox Executor (Domain C) — Operational Notes

- Sandbox runs untrusted skills in Docker container.
    
- Seccomp profile: `sandbox/seccomp-no-spawn.json` blocks `clone`, `fork`, `execve`, etc.
    
    ISCL Operations Guide — Command…
    
- Audit events include:
    
    - `sandbox_started`
        
    - `sandbox_completed`
        
    - `sandbox_error`
        
    - `security_violation`
        
        ISCL Operations Guide — Command…
        

---

## 13) Testing Matrix (What to run before sharing with community)

349+ tests total (321 unit+integration + 28 security + 6 E2E with Anvil fork).

Recommended alpha "release gate":

1. `npx vitest run tests/unit tests/integration` — 321 tests, 33 files
2. `npx vitest run tests/security` — 28 tests, 4 files (requires Docker)
3. `BASE_RPC_URL=... npx vitest run tests/e2e` — 6 tests (requires Anvil)
4. OpenClaw live demo — balance check + transfer + verify balance changed via `docker compose --profile demo`
    

---

## 14) Troubleshooting (Common issues)

### Port conflict

`ISCL_PORT=3200 npm run dev`

ISCL Operations Guide — Command…

### Preflight returns 502 (no RPC)

Set Base RPC:

`BASE_RPC_URL=https://mainnet.base.org npm run dev`

ISCL Operations Guide — Command…

### E2E fails (Anvil missing)

Install Foundry/Anvil and retry:

`curl -L https://foundry.paradigm.xyz | bash && foundryup BASE_RPC_URL=https://mainnet.base.org npm run test:e2e`

ISCL Operations Guide — Command…

### Security tests skip

Docker-required tests use skipIf. Install/start Docker to execute them.

ISCL Operations Guide — Command…

---

## 15) Implementation status

### Completed (v0.1.0-beta)

- ✅ All 7 engineering epics implemented
- ✅ `GET /v1/balance/:token/:account` route + adapter `balance()` method + real `handleBalance` skill wrapper
- ✅ `GET /v1/tx/:hash` — returns full transaction receipt via `ViemRpcClient`
- ✅ Approval UX — CLI readline prompt wired into `/v1/tx/approve-request`; renders summary; issues single-use approval token
- ✅ OpenClaw agent integration — `adapter/openclaw-agent.ts` exports `openclawTools` (5 tool defs) + `executeOpenClawTool()` pipeline
- ✅ OpenClaw skill package — `openclaw-skills/clavion-crypto/` with `SKILL.md` + `run.mjs` standalone runner (5 tools)
- ✅ Docker Compose 3-service stack — Anvil + ISCL Core + OpenClaw (`demo` profile)
- ✅ Demo boot script — `core/demo-boot.ts` auto-unlocks wallet + auto-approves for demo
- ✅ **Live E2E verified:** OpenClaw agent → balance check → USDC transfer → audit trail confirmed
- ✅ Transaction broadcast — `sendRawTransaction` + nonce/gas/fee population from RPC; sign-only fallback when no RPC
- ✅ **Tokens move on-chain:** Transfer 1 USDC → balance decreased from 1,000,000 to 999,999 USDC on Anvil fork
- ✅ Broadcast audit events — `tx_broadcast` on success, `broadcast_failed` on error
- ✅ **Native ETH transfers** — new `transfer_native` action type through full pipeline (schema → builder → policy → preflight → routes → adapter → OpenClaw skill)
- ✅ `readNativeBalance` RPC method — viem `getBalance()` for preflight ETH balance diffs
- ✅ Policy handles `transfer_native` — skips token/contract allowlist (no token), enforces value limits + recipient allowlist
- ✅ **Rate limiting** — `maxTxPerHour` policy field enforced via dedicated `rate_limit_events` table in audit DB
- ✅ Per-wallet sliding window (1 hour) — denied requests don't count toward limit
- ✅ All 3 fund-affecting endpoints rate-limited (`/build`, `/approve-request`, `/sign-and-send`)
- ✅ **Skill Registry** — `SkillRegistryService` orchestrates manifest validation → signature verification → file hash check → static scan → SQLite registration
- ✅ CRUD API: register, list, get, revoke skills with audit logging (`skill_registered`, `skill_registration_failed`, `skill_revoked`)
- ✅ Scanner warnings don't block registration; only errors do. Duplicate names rejected with 409.

### What remains for post-alpha (v0.2)

- Rootless Podman — replace Docker sandbox
- Approval web UI — optional browser-based approval (alternative to CLI)
- OpenClaw sandbox mode — run `run.mjs` inside OpenClaw's built-in sandbox
- CI/CD pipeline — GitHub Actions for automated test gates

---

## 16) Minimal "Community Demo" recipe (recommended)

For a first public alpha video and onboarding:

```bash
# 1. Start full stack
docker compose --profile demo up -d

# 2. Fund test wallet (Anvil account #0) with ETH + USDC
#    (Use setup-wallet.mjs or anvil_setBalance/anvil_setStorageAt)

# 3. Balance check — read-only, no approval needed
docker compose --profile demo exec openclaw node dist/index.js agent \
  --session-id demo --json --timeout 60 \
  --message "Check USDC balance for 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

# 4. Transfer — full secure pipeline (policy → approval → sign)
docker compose --profile demo exec openclaw node dist/index.js agent \
  --session-id demo --json --timeout 120 \
  --message "Transfer 1 USDC to 0x000000000000000000000000000000000000dEaD"

# 5. Audit trail
docker compose --profile demo exec iscl-core node -e "
  const Database=require('better-sqlite3');
  const db=new Database('/home/iscl/.iscl/data/audit.sqlite',{readonly:true});
  console.log(JSON.stringify(db.prepare('SELECT event,intent_id,created_at FROM audit_events ORDER BY timestamp DESC LIMIT 10').all(),null,2));
"
```

```bash
# 6. Verify balance changed (tokens actually moved!)
docker compose --profile demo exec openclaw node dist/index.js agent \
  --session-id demo --json --timeout 60 \
  --message "Check USDC balance for 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
# → Balance should be 1 USDC less than step 3
```

Show:
- Agent uses natural language → skill maps to ISCL API calls
- Policy evaluated, approval token issued and consumed
- Transaction signed, **broadcast on-chain**, receipt confirmed
- **Balance actually changes** — tokens move on Anvil fork
- Audit trail with full event correlation by intentId (including `tx_broadcast`)
- Agent **never** touches keys — Domain A isolation enforced

This demonstrates the entire value proposition in 60–90 seconds.

You can also open the OpenClaw Control UI at `http://127.0.0.1:18789` and interact via browser for a more visual demo.