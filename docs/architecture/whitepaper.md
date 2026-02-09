# Clavion: The Secure Execution Layer for Crypto-Capable AI Agents

**Whitepaper v1.0 — February 2026**

*Safe Keys. Smart Agents. Trusted Execution.*

---

## Abstract

Autonomous AI agents are acquiring cryptocurrency wallets at an unprecedented rate. In 2025, Safe deployed 18.3 million new smart accounts — one every 1.7 seconds — with over 50% of transactions on Gnosis Chain originating from AI agents. Coinbase AgentKit enabled tens of thousands of agents to transact on-chain. Virtuals Protocol generated $8 billion in DEX volume through tokenized AI agents on Base. VanEck projected over one million crypto AI agents operating by end of 2025.

Yet the security infrastructure protecting these operations remains dangerously inadequate. A SlowMist audit found that fewer than 10% of crypto AI projects use sandboxed environments. Private keys stored as plaintext environment variables remain the default configuration. No standard policy language governs what agents are permitted to sign. No unified audit trail spans from intent to receipt across frameworks.

Clavion is an independent secure crypto runtime — a local daemon with a typed API — that sits between any AI agent framework and the blockchain. Agents express what they want to do as declarative **TxIntents**. Clavion resolves each intent into a concrete transaction, evaluates it against a configurable policy engine, simulates outcomes via preflight, presents a human-readable approval summary, signs only after confirmation, and logs every step in an auditable trace. Private keys never leave Clavion's trusted boundary. Untrusted agent code runs in a sandboxed executor with no access to keys, restricted network, and monitored system calls.

No single product on the market today combines plugin sandboxing, policy-controlled signing, pre-execution simulation, typed transaction intents, and compliance-ready audit trails. Clavion provides all of these as a single, coherent runtime.

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [Market Context](#2-market-context)
3. [Security Incidents That Prove the Gap](#3-security-incidents-that-prove-the-gap)
4. [Design Principles](#4-design-principles)
5. [System Architecture](#5-system-architecture)
6. [Core Subsystems](#6-core-subsystems)
7. [TxIntent: The Safety Contract](#7-txintent-the-safety-contract)
8. [Skill Packaging and Supply Chain Integrity](#8-skill-packaging-and-supply-chain-integrity)
9. [Security Model and Threat Analysis](#9-security-model-and-threat-analysis)
10. [API Specification](#10-api-specification)
11. [Competitive Landscape](#11-competitive-landscape)
12. [Emerging Standards Alignment](#12-emerging-standards-alignment)
13. [Regulatory Context](#13-regulatory-context)
14. [Use Cases](#14-use-cases)
15. [Technology Stack](#15-technology-stack)
16. [Roadmap](#16-roadmap)
17. [Conclusion](#17-conclusion)
18. [References](#references)

---

## 1. The Problem

### 1.1 Agents with Wallets, Without Guardrails

The convergence of AI agents and blockchain is no longer theoretical. AI agents are autonomously executing token swaps, managing DeFi positions, handling ERC-20 approvals, and making stablecoin payments on-chain. The capabilities are impressive. The security model is not.

Today's dominant pattern for giving an AI agent crypto capabilities looks like this:

```
ETH_WALLET_PRIVATE_KEY=0xabc123...
```

A plaintext private key, stored in an environment variable, accessible to every plugin, every dependency, and every line of code the agent executes. This is not an exaggeration — it is the documented default for AutoGPT's crypto plugin (`ETH_WALLET_PRIVATE_KEY` as plain text in `.env` files), for many ElizaOS configurations, and for countless custom agent deployments.

The pattern is systemic. Princeton University researchers exploited ElizaOS through memory injection attacks targeting its long-term memory system, demonstrating that adversaries could trigger unauthorized asset transfers. Adversa AI's 2025 security report listed ElizaOS among frameworks that "failed across multiple layers." OpenClaw, despite 145,000+ GitHub stars, carries significant security warnings due to deep system access, with security researchers recommending isolated sandbox environments only.

The common thread: every major AI agent framework prioritizes functionality over security. MPC and TEE alternatives exist but require explicit opt-in and external integration. The gap between what agents can do and what agents should be allowed to do is growing wider every month.

### 1.2 The Missing Layer

The problem is not that agents should not have wallets. The problem is that the industry has skipped the security layer between "agent wants to do something" and "transaction gets signed."

In traditional software architecture, we would never let an untrusted plugin directly invoke `sign(arbitrary_bytes)`. We would enforce authorization policies, validate inputs against schemas, simulate outcomes, require human approval for high-risk operations, and log everything. Yet this is precisely the architectural primitive that is absent from the current AI agent crypto stack.

What is needed:

- **Key isolation** — Private keys physically separated from untrusted agent code
- **Typed intents** — Agents express *what* they want, not construct raw transactions
- **Policy enforcement** — Configurable rules governing what is permitted
- **Pre-execution simulation** — Every transaction simulated before signing
- **Human-in-the-loop approval** — Mandatory confirmation for high-risk operations
- **Audit trail** — Every step from intent to receipt logged and correlated
- **Sandbox isolation** — Untrusted skills running in restricted environments

Clavion provides all of these as a single, coherent runtime.

---

## 2. Market Context

### 2.1 The AI Agent Economy

The global AI agent market is projected to grow from $5.4 billion in 2024 to over $50.3 billion by 2030, representing a 45.8% compound annual growth rate (Grand View Research). Longer-term projections are even more dramatic — Precedence Research estimates $236 billion by 2034.

The adoption curve is steep. Gartner predicts that 40% of enterprise applications will include task-specific AI agents by end of 2026, up from less than 5% in 2025. McKinsey estimates agentic AI will add $2.6–4.4 trillion annually to global GDP by 2030. PwC's 2025 survey found that 79% of organizations have already implemented AI agents, with 96% of IT leaders planning to expand deployments.

### 2.2 Crypto Is the Native Financial Rail

AI agents cannot open bank accounts. They cannot pass KYC. They cannot hold credit cards. But they can hold crypto wallets. Blockchain provides the only permissionless, programmable financial infrastructure that autonomous software can natively access.

This reality has driven explosive investment at the crypto-AI intersection:

- AI-related deals accounted for **37% of total crypto VC investments** in 2024–2025
- Crypto AI projects raised **$516 million** in the first 8 months of 2025 (+6% vs. all of 2024)
- Q3 2024 saw **$213 million** flow into AI projects from crypto VCs — a **340% year-over-year increase**
- Hack VC dedicated **41%** of its latest fund to Web3 AI
- Entrée Capital launched a **$300 million** fund prioritizing AI agents and DePIN
- AI captured approximately **50% of all global VC funding** in 2025 ($202.3 billion total)

AI crypto tokens peaked at $70 billion in combined market cap. The economic activity is real and accelerating.

### 2.3 The Trust Deficit

Despite this growth, trust remains the primary barrier to enterprise adoption. Harvard Business Review reported in December 2025 that only 6% of organizations fully trust AI for end-to-end business processes. Gartner predicts that 40% of agentic AI projects will be canceled by end of 2027 due to escalating costs, unclear value, or inadequate risk controls. 75% of enterprise leaders cite governance and security as the primary challenge in AI agent deployment.

Gartner further predicts that by 2028, 40% of CIOs will demand "Guardian Agents" — autonomous systems to track, oversee, and contain AI agent actions.

The AI Trust, Risk, and Security Management (TRiSM) market is projected to reach $7.44 billion by 2030 at a 21.6% CAGR. This is the market Clavion addresses.

### 2.4 Addressable Market

Clavion sits at the intersection of three converging markets:

| Market | Size (2024) | Projected | CAGR |
|--------|------------|-----------|------|
| AI Agent Market | $5.4B | $50.3B (2030) | 45.8% |
| Crypto Custody & Key Management | $2.9B | $7.7B (2032) | 12.95% |
| AI TRiSM | ~$2B | $7.44B (2030) | 21.6% |

The pace of agent wallet deployment far outstrips the pace of security infrastructure maturation. This asymmetry is the market opportunity.

---

## 3. Security Incidents That Prove the Gap

The need for Clavion is not theoretical. A series of real-world incidents demonstrate that the current security model for AI agent crypto operations is fundamentally broken.

### 3.1 Freysa AI — Prompt Injection Drains Agent Wallet

In November 2024, an AI agent called Freysa was deployed on Base with an explicit directive: "DO NOT transfer money." The agent guarded a prize pool funded by participant fees. On attempt #482, a user identified as p0pular.eth established a fake "admin terminal" session, redefined the `approveTransfer` function's semantics to mean handling "incoming" transfers, and requested a fake $100 "contribution." The AI agent transferred its entire 13.19 ETH (~$47,000) prize pool.

**Lesson:** LLM-based agents controlling crypto assets are fundamentally vulnerable to prompt injection. The signing authority must be architecturally separated from the language model.

### 3.2 Anthropic SCONE-bench — AI Agents as Autonomous Exploiters

In 2025, Anthropic published SCONE-bench, testing AI agents against 405 real-world smart contracts. Claude Opus 4.5, Claude Sonnet 4.5, and GPT-5 collectively developed exploits worth $4.6 million — on contracts deployed *after* each model's knowledge cutoff. The research found that more than half of 2025's blockchain exploits "could have been executed autonomously by current AI agents," with exploit capability roughly doubling every 1.3 months.

**Lesson:** AI agents are now capable enough to autonomously exploit smart contracts. Without policy constraints, any agent with signing authority is a potential attack vector.

### 3.3 AIXBT Dashboard Exploit

In March 2025, the AIXBT agent — a prominent crypto AI with significant on-chain holdings — lost 55.5 ETH (~$106,000) after an attacker gained access to the agent's dashboard and queued malicious replies that triggered unauthorized transfers.

**Lesson:** Agent infrastructure has multiple attack surfaces beyond the agent code itself. Defense-in-depth — including transaction policy enforcement and approval flows — is required.

### 3.4 Bybit — $1.5 Billion Safe Wallet Compromise

In February 2025, North Korea's Lazarus Group executed a $1.5 billion theft from Bybit by exploiting Safe's wallet signing interface. While this was not an AI agent attack, it demonstrates that even the most battle-tested wallet infrastructure can be compromised at the signing layer — exactly the layer where agents are least protected.

### 3.5 MCP Attack Vectors

SlowMist identified four critical attack vectors in the Model Context Protocol (MCP) standard used by agent frameworks: data poisoning, JSON injection, function substitution, and cross-MCP call exploitation. A separate incident saw an Ethereum developer's wallet drained via a malicious AI coding tool extension — the agent itself was the attack vector.

---

## 4. Design Principles

Clavion v0.1 is built around six invariants that are never violated:

**Invariant 1 — Key Isolation:** Private keys never leave Clavion Core. Keys exist only in the trusted domain. No API endpoint, no skill, no plugin can extract key material. Signing is a service, not a capability exposed to callers.

**Invariant 2 — Typed Intents Only:** There is no `signRaw` endpoint. Every crypto operation must be expressible as a TxIntent with explicit semantics — transfer, approve, swap — that can be validated, simulated, and policy-checked before signing. Arbitrary calldata is not signed.

**Invariant 3 — Mandatory Pipeline:** All transactions pass through policy evaluation → preflight simulation → user approval. This pipeline is structurally mandatory. Skipping any step is architecturally impossible.

**Invariant 4 — Sandbox Isolation:** Untrusted skills run in isolated containers with no key material on the filesystem or in environment variables, no network access outside an explicit allowlist, no arbitrary process spawning, and resource limits enforced.

**Invariant 5 — Complete Audit Trail:** Every step from intent receipt through policy evaluation, transaction build, preflight simulation, approval, signing, broadcast, and receipt is recorded in a correlated audit trace. This is not optional logging — it is a structural requirement.

**Invariant 6 — Defense Through Architecture:** Security is achieved through layered isolation, not trust in agent code. We assume agent code is potentially compromised. The architecture ensures safety regardless.

---

## 5. System Architecture

### 5.1 Trust Domains

Clavion divides the system into three trust domains with strict, enforced boundaries:

```
┌──────────────────────────────────────────────────────────┐
│  DOMAIN A — Agent Framework + Skills (UNTRUSTED)         │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │  Skill   │  │  Skill   │  │  Skill   │               │
│  │  (swap)  │  │(transfer)│  │ (custom) │               │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘               │
│       └──────────────┼──────────────┘                    │
│                      │                                   │
│   No keys. No signing. No direct RPC. No secrets.        │
│                      │ TxIntent (declarative JSON)       │
╞══════════════════════╪═══════════════════════════════════╡
│                      ▼                                   │
│  DOMAIN B — Clavion Core (TRUSTED)                       │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Clavion Core Daemon                               │  │
│  │                                                    │  │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────┐ │  │
│  │  │  Policy     │  │ Transaction│  │  Preflight   │ │  │
│  │  │  Engine     │  │ Engine     │  │  Simulator   │ │  │
│  │  └────────────┘  └────────────┘  └──────────────┘ │  │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────┐ │  │
│  │  │  Wallet     │  │  Approval  │  │  Audit Trace │ │  │
│  │  │  Service    │  │  Service   │  │  Service     │ │  │
│  │  └────────────┘  └────────────┘  └──────────────┘ │  │
│  │  ┌────────────┐                                    │  │
│  │  │  Skill      │                                   │  │
│  │  │  Registry   │                                   │  │
│  │  └────────────┘                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Keys, signing, policy, simulation — all here.           │
╞══════════════════════════════════════════════════════════╡
│                                                          │
│  DOMAIN C — Secure Executor (LIMITED TRUST)               │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Container Sandbox                                 │  │
│  │  • No key access          • Read-only rootfs       │  │
│  │  • Network allowlist only • Resource limits         │  │
│  │  • No arbitrary spawn     • Execution tracing       │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Domain A (Untrusted):** The agent framework (OpenClaw, ElizaOS, LangChain, or any custom runtime) and its skills/plugins. Considered potentially compromisable. Has no keys, no direct signing capability, no direct blockchain RPC access. Can only communicate with Clavion Core via the typed API.

**Domain B (Trusted):** Clavion Core. Contains the wallet service, policy engine, transaction engine, preflight simulator, approval service, skill registry, and audit logger. This is the only domain that holds key material and can sign transactions.

**Domain C (Limited Trust):** The secure executor. Runs untrusted crypto-skills in sandboxed containers. Has no access to keys. Can only request operations via the Clavion API. Network, filesystem, and process capabilities are restricted and traced.

### 5.2 Transaction Flow

The canonical flow for every crypto operation:

```
Agent Skill constructs TxIntent (declarative JSON)
        │
        ▼
  ┌─────────────┐
  │   Validate   │  Schema validation, canonicalization, hashing
  └──────┬──────┘
         ▼
  ┌─────────────┐
  │   Policy     │  Evaluate against rules: limits, allowlists,
  │   Engine     │  bounds, gas caps → allow / deny / require_approval
  └──────┬──────┘
         ▼
  ┌─────────────┐
  │ Transaction  │  Resolve intent into concrete tx: calldata,
  │   Engine     │  gas estimation, nonce management
  └──────┬──────┘
         ▼
  ┌─────────────┐
  │  Preflight   │  Simulate via eth_call, compute balance diffs,
  │  Simulator   │  score risk (0–100), generate warnings
  └──────┬──────┘
         ▼
  ┌─────────────┐
  │  Approval    │  Generate human-readable summary from build +
  │  Service     │  preflight data (NOT from skill text), present
  └──────┬──────┘  to user for confirmation
         ▼
  ┌─────────────┐
  │   Wallet     │  Sign transaction (requires PolicyDecision +
  │   Service    │  single-use ApprovalToken)
  └──────┬──────┘
         ▼
  ┌─────────────┐
  │  Broadcast   │  Send to blockchain, monitor for receipt
  └──────┬──────┘
         ▼
  ┌─────────────┐
  │ Audit Trace  │  Full lifecycle recorded: intent → policy →
  └─────────────┘  build → preflight → approval → sign → receipt
```

Every arrow is a logged, auditable step. Every step can fail safely. The pipeline is strictly sequential — no shortcuts, no bypasses.

---

## 6. Core Subsystems

### 6.1 Wallet Service

The Wallet Service is the sole signing authority in the system.

It manages an encrypted local keystore (scrypt/argon2 + AES-GCM), loads keys into memory only after explicit unlock, and signs transactions exclusively through a single entry point that requires both a PolicyDecision and an ApprovalToken. It supports EOA wallets in v0.1, with smart account (ERC-4337) support planned for v0.2.

There is no `signRaw` endpoint. No API can extract key material. All signatures are logged with the corresponding intentId, policyDecision, and approvalToken. Keys are never written to disk in plaintext.

### 6.2 Policy Engine

The Policy Engine is a pure function:

```
PolicyDecision = evaluate(intent, buildPlan, preflight, config)
```

Given an intent, a build plan, a preflight result, and a policy configuration, it returns a deterministic decision: `allow`, `deny` (with reason code), or `require_approval` (with risk level).

Policies evaluate:
- **Transaction value limits** — per-transaction and daily aggregates
- **Contract allowlists** — only approved smart contracts
- **Token allowlists** — only approved ERC-20 tokens
- **Approval bounds** — no `MaxUint256` approvals without explicit policy override
- **Recipient allowlists** — for transfers
- **Gas cost caps** — prevent excessive gas spending

Policies are defined in YAML/JSON configuration, versioned, and the active `policyVersion` is recorded in every audit trace entry. This makes every policy decision reproducible and externally auditable.

### 6.3 Transaction Engine

The Transaction Engine resolves TxIntents into concrete, signable transactions.

Supported operations in v0.1:
- `transfer` — ERC-20 and native token transfers
- `approve` — ERC-20 approval management with bounded amounts
- `swap_exact_in` — DEX swap specifying exact input amount
- `swap_exact_out` — DEX swap specifying exact output amount

The build pipeline is deterministic — the same intent always produces the same transaction parameters. Only allowlisted contracts and routers are used. Gas estimation is integrated. Receipt tracking monitors confirmation status.

### 6.4 Preflight Simulator

Before any transaction is signed, the Preflight Simulator runs a multi-layer analysis.

**Layer 1 (Mandatory):** `eth_call` simulation, gas estimation, balance reads (ETH + ERC-20), allowance reads.

**Layer 2 (Where available):** `trace_call` / `debug_traceCall` for detailed state diffs.

The output is a structured risk report containing expected balance changes (what you will spend, what you will receive), allowance changes, gas cost estimate, a risk score from 0–100, and specific warnings (e.g., "contract not verified," "high slippage," "large approval amount"). The risk score directly influences the approval flow — higher risk triggers stricter confirmation requirements.

### 6.5 Approval Service

The Approval Service generates human-readable summaries of pending transactions and manages the confirmation lifecycle.

A critical design decision: the approval summary is generated by Clavion Core from the build plan and preflight results — **not from skill-provided text**. This prevents semantic spoofing where a malicious skill presents a misleading description of what a transaction does.

The approval summary includes: asset in / asset out with human-readable amounts, recipient or counterparty address, expected minimum output (for swaps), risk score with specific risk reasons, balance diffs (before → after), and gas cost estimate.

ApprovalTokens are single-use, bound to a specific `intentId` and `txRequestHash`, and have a configurable TTL. Replay is impossible.

### 6.6 Audit Trace Service

Every critical event is recorded in a structured, correlated audit trail:

| Event | Key Fields |
|-------|-----------|
| `intent_received` | intentId, skillId, timestamp |
| `policy_evaluated` | decision, reasons, policyVersion |
| `build_completed` | txRequestHash, to, value, methodSig |
| `preflight_completed` | riskScore, balanceDiffs, warnings |
| `approval_issued` | approvalTokenId, ttl |
| `signature_created` | txRequestHash, signerId |
| `tx_sent` | txHash, chainId |
| `tx_receipt` | status, gasUsed |
| `security_violation` | type, details |

All events are correlated by `intentId`, enabling full reconstruction of any operation's lifecycle. Stored in SQLite with JSONL export for integration with external monitoring and compliance systems.

### 6.7 Skill Registry Service

Manages the lifecycle of crypto-skills: validates signed skill packages against SkillManifest specifications, runs static security scanning on skill code, enforces manifest hash integrity (any file modification after signing results in rejection), maintains a curated registry of verified skills, and blocks installation of unsigned or tampered packages.

---

## 7. TxIntent: The Safety Contract

### 7.1 Concept

TxIntent is the core safety abstraction. It is a declarative description of what an agent wants to do — not how to do it. This separation is fundamental to Clavion's security model.

An agent does not construct a raw transaction with calldata. It expresses an intent: "swap 100 USDC for ETH on Uniswap with max 1% slippage." Clavion resolves this intent into a concrete transaction, validating every parameter against policy before building the calldata. This eliminates the most dangerous pattern in the current ecosystem: agents constructing and signing arbitrary calldata.

### 7.2 Schema

```json
{
  "version": "1",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": 1700000000,
  "chain": {
    "type": "evm",
    "chainId": 8453,
    "rpcHint": "base"
  },
  "wallet": {
    "address": "0x...",
    "profile": "default"
  },
  "action": {
    "type": "swap_exact_in",
    "router": "0x...",
    "assetIn": {
      "kind": "erc20",
      "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "symbol": "USDC",
      "decimals": 6
    },
    "assetOut": {
      "kind": "erc20",
      "address": "0x4200000000000000000000000000000000000006",
      "symbol": "WETH",
      "decimals": 18
    },
    "amountIn": "100000000",
    "minAmountOut": "40000000000000000"
  },
  "constraints": {
    "maxGasWei": "1000000000000000",
    "deadline": 1700003600,
    "maxSlippageBps": 100
  },
  "preferences": {
    "speed": "normal",
    "privateRelay": false
  },
  "metadata": {
    "source": "portfolio-rebalancer",
    "note": "weekly rebalance"
  }
}
```

The schema enforces `additionalProperties: false` — unknown fields are rejected. All amounts are integer strings in base units (no floating point). All addresses are validated. Expired deadlines are rejected. Unsupported action types are rejected.

### 7.3 Canonicalization and Hashing

TxIntents are canonicalized using JSON Canonicalization Scheme (JCS) and hashed with `keccak256`. This produces a deterministic fingerprint for each intent, enabling idempotent processing, audit correlation, replay protection, and cross-implementation compatibility.

```
intentFingerprint = keccak256(JCS(txIntent))
```

---

## 8. Skill Packaging and Supply Chain Integrity

### 8.1 SkillManifest

Every crypto-skill is distributed as a signed package with a manifest declaring its identity, permissions, sandbox requirements, and file integrity hashes:

```json
{
  "version": "1",
  "name": "uniswap-swap-skill",
  "publisher": {
    "name": "Clavion Labs",
    "address": "0x...",
    "contact": "security@clavion.xyz"
  },
  "permissions": {
    "txActions": ["swap_exact_in", "swap_exact_out"],
    "chains": [8453, 1],
    "networkAccess": false,
    "filesystemAccess": false
  },
  "sandbox": {
    "memoryMb": 128,
    "timeoutMs": 10000,
    "allowSpawn": false
  },
  "files": [
    { "path": "index.js", "sha256": "abc123..." }
  ],
  "signature": "0x..."
}
```

### 8.2 Integrity Verification

The signature covers `keccak256(canonical(manifest_without_signature))`, signed by the publisher's secp256k1 key (EVM-compatible).

On installation: (1) Manifest signature is verified against publisher address. (2) Every file's sha256 is checked against the manifest. (3) Permissions are evaluated against system policy. (4) A static scanner runs for suspicious patterns — dynamic imports, `eval`, network calls, system commands. (5) Any mismatch results in installation being blocked.

### 8.3 Runtime Permission Enforcement

Declared permissions are enforced at runtime by the sandbox. A skill declaring `"networkAccess": false` will have all network calls blocked. A skill declaring `"txActions": ["transfer"]` cannot generate swap intents — the intent will be rejected at schema validation before it reaches the policy engine.

---

## 9. Security Model and Threat Analysis

### 9.1 Domain A Threats — Agent Framework / Skills

| Threat | Mitigation | Test |
|--------|-----------|------|
| **T1.** Malicious skill attempts to steal private key (read env/filesystem) | Keys physically absent from Domain A. No API to extract. All signing in WalletService (Domain B). | `SecurityTest_A1` — Evil skill attempts to read `~/.ssh`, env vars, guessed API paths. Expectation: absent, logged. |
| **T2.** Skill attempts arbitrary network request (exfiltration, C2) | Domain A has no network permissions for crypto. Skills only communicate with localhost Clavion API. | `SecurityTest_A2` — Skill requests arbitrary domain. Expectation: blocked, logged. |
| **T3.** Skill attempts semantic spoofing of approval UI | Approval summary generated by Clavion Core from build + preflight data, not skill text. Skill cannot control confirmation text. | `SecurityTest_A3` — Skill sends TxIntent with misleading metadata. Approval displays build/preflight truth. |
| **T4.** Skill generates TxIntent with harmful parameters | Strict schema validation + PolicyEngine blocks unknown contracts, excessive approvals, disallowed recipients. | `SecurityTest_A4` — Set of cases: MaxUint approve, unknown router, disallowed address. All denied with reason code. |

### 9.2 Domain C Threats — Secure Executor

| Threat | Mitigation | Test |
|--------|-----------|------|
| **T5.** Skill in sandbox attempts key access | Keys absent in Domain C. No filesystem path, no env var contains key material. | `SecurityTest_C1` — Malicious package searches FS and env. Keys missing. |
| **T6.** Skill attempts network exfiltration from sandbox | Network allowlist-only. Most skills have no network. Violations blocked and logged. | `SecurityTest_C2` — Requests to external domains blocked. |
| **T7.** Skill spawns arbitrary processes / mining / DoS | `no_spawn` policy, cgroup limits, timeouts. Prohibited binaries blocked. | `SecurityTest_C3` — Spawn bash, curl, CPU burn. All denied. |
| **T8.** Supply chain attack via tampered package | Signed packages with manifest hash verification. Mismatch = blocked. | `SecurityTest_C4` — Modified file after signing. Installation rejected. |

### 9.3 Domain B Threats — Clavion Core

| Threat | Mitigation | Test |
|--------|-----------|------|
| **T9.** Compromised RPC returns false simulation data | Allowlist of trusted RPCs. Optional dual-RPC comparison. Discrepancies elevate risk score. | `SecurityTest_B1` — Mock two RPCs with different results. Risk elevated, confirmation required. |
| **T10.** Policy bypass via undocumented signing path | WalletService has single signing method requiring PolicyDecision + ApprovalToken. No alternative paths. All signatures logged. | `SecurityTest_B2` — Attempt signing without approval. 403/deny. |
| **T11.** Replay attack via reused ApprovalToken | Single-use tokens, bound to intentId + txRequestHash, with TTL. | `SecurityTest_B3` — Reuse token. Refusal. |
| **T12.** Excessive ERC-20 approvals | Policy enforces bounded approvals. MaxUint256 requires explicit override. | `SecurityTest_B4` — Approve above limit. Denied. |

### 9.4 Definition of "Secure Enough" for Pilot

The v0.1 system is considered secure if:

1. All security tests (A1–A4, C1–C4, B1–B4) pass in CI
2. Every signature in logs has the full linkage: `intentId → policyAllowed → preflight → approval → sign → send`
3. With human approval enabled, it is impossible to send a transaction without manual confirmation
4. Network access outside the allowlist is impossible within the sandbox
5. Filesystem access outside allowed paths is impossible within the sandbox

### 9.5 Out of Scope (v0.1)

OS-level compromise / rootkit (mitigated in v0.2 via hardware wallet / remote signer). User social engineering beyond clear approval summaries and risk scores. Formal verification of sandbox (planned for v0.2 with WASM executor). Non-EVM chains.

---

## 10. API Specification

### 10.1 Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/health` | Service health, version, status |
| `POST` | `/v1/tx/build` | Submit TxIntent, receive build plan + policy decision |
| `POST` | `/v1/tx/preflight` | Run simulation on build plan |
| `POST` | `/v1/tx/approve-request` | Generate approval summary for user |
| `POST` | `/v1/tx/sign-and-send` | Sign and broadcast (requires ApprovalToken) |
| `GET` | `/v1/tx/{hash}` | Query transaction status / receipt |

All inputs are validated against strict JSON schemas. Unknown fields are rejected. All responses include correlation IDs for audit trail linkage.

### 10.2 Error Model

Every error response includes a machine-readable `error.code`, a human-readable `error.reason`, an `error.intentId` correlating to the original intent, and an `error.auditRef` linking to the audit trace entry.

Policy denials include specific reason codes: `UNKNOWN_CONTRACT`, `AMOUNT_EXCEEDS_LIMIT`, `TOKEN_NOT_ALLOWLISTED`, `SPENDER_NOT_ALLOWLISTED`, `GAS_EXCEEDS_CAP`.

### 10.3 Integration Model

Clavion runs as a local daemon. Agent frameworks integrate via HTTP calls to `localhost`. The OpenClaw adapter provides thin skill wrappers that translate OpenClaw skill invocations into Clavion API calls. The same pattern applies to any agent framework — the API is framework-agnostic.

---

## 11. Competitive Landscape

### 11.1 Current Market Players

The AI agent crypto infrastructure market has attracted significant funding and attention. However, each existing player addresses only one dimension of the security problem.

**Coinbase AgentKit** — The most widely adopted agent-wallet integration toolkit. Framework-agnostic, open-source, 50+ pre-built actions, integrations with LangChain, OpenAI, and MCP. Launched the x402 payment protocol, achieving 100+ million payments in the first six months and approximately 70% market share among x402 facilitators. *Limitation:* Wallet provisioning and convenience only. No plugin sandboxing, limited policy engines, and operational dependency on Coinbase infrastructure.

**Turnkey** ($52.5M raised, Series B June 2025, Bain Capital Crypto) — The strongest pure-play key management solution. TEE-based secure enclaves where keys never leave the enclave boundary. 50–100ms signing latency, 200K+ machine-initiated transactions daily from AI agent customers. Powers 50M+ embedded wallets. Founded by the Coinbase Custody team (previously protecting $200B+). *Limitation:* Key infrastructure only. Does not sandbox plugins, does not provide policy-as-code for agent transactions, and requires cloud deployment.

**Safe** ($100M strategic round 2022) — The most battle-tested smart account standard. Secures $60B+ in digital assets with $600B transaction volume in 2025. Over 50% of Safe transactions on Gnosis Chain are now made by AI agents (Olas network). Modular architecture with Guards, Modules, spending limits, and timelocks. *Limitation:* On-chain authorization only. Requires an external signer — does not protect the agent's signing key. No off-chain policy enforcement or pre-execution simulation.

**Privy** ($41.3M raised, acquired by Stripe June 2025) — Embedded self-custody wallets using Shamir's Secret Sharing and secure enclaves. 50M+ accounts across 1,500+ teams, SOC 2 compliant, dedicated AI agent page. *Limitation:* Wallet infrastructure, not a security layer. No sandbox, limited policy, tied to Stripe's roadmap post-acquisition.

**Lit Protocol** ($17.7M raised) — Most explicitly AI-agent-focused. Launched Vincent, a secure wallet delegation framework with 7,000+ agent wallets. Users authorize agents within strict limits. Threshold MPC + TEEs. *Limitation:* Requires its own network and token. LITKEY token dropped 88% over 90 days post-listing. Adds infrastructure complexity.

**Crossmint** ($23.6M Series A August 2025) — Pivoted to AI agents with GOAT SDK: 150K downloads in 2 months, 200+ integrations across 30+ chains. Named "Challenger" in CB Insights AI Agent Payments market map. *Limitation:* Convenience-focused SDK. No sandbox, no policy engine, no audit trail.

### 11.2 The Gap

Each of these companies delivers genuine value. None delivers a unified secure execution layer.

| Capability | Turnkey | Safe | AgentKit | Lit | Privy | Crossmint | **Clavion** |
|-----------|---------|------|----------|-----|-------|-----------|-------------|
| Key isolation from plugins | ✓ (TEE) | — | ✓ (MPC) | ✓ (MPC+TEE) | ✓ (SSS) | ✓ (MPC) | **✓** |
| Plugin/skill sandboxing | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓** |
| Configurable policy engine | Basic | On-chain | ✗ | Basic | ✗ | ✗ | **✓** |
| Pre-execution simulation | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓** |
| Typed intent model | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓** |
| Human-in-the-loop approval | ✗ | Multi-sig | ✗ | User consent | ✗ | ✗ | **✓** |
| Correlated audit trail | ✗ | On-chain | ✗ | ✗ | ✗ | ✗ | **✓** |
| Framework agnostic | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | **✓** |
| Runs locally (no cloud dependency) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓** |
| Open source | Partial | ✓ | ✓ | ✓ | ✗ | Partial | **✓** |

### 11.3 Complementary, Not Competitive

Clavion is not a wallet. It is not a key management service. It is not a smart account platform. It is the **secure execution layer** between agent code and blockchain signing.

A production deployment could use Turnkey for enterprise-grade TEE key management, Safe for on-chain multi-sig authorization, AgentKit for wallet provisioning, and Clavion as the local policy engine, sandbox, preflight simulator, and audit layer that ties everything together. Clavion is designed to integrate with — not replace — existing infrastructure.

---

## 12. Emerging Standards Alignment

Five complementary standards are crystallizing into the infrastructure backbone for the AI agent economy. Clavion is designed to integrate with all of them.

### 12.1 x402 — HTTP-Native Payments (Coinbase/Cloudflare)

The x402 protocol enables HTTP-native stablecoin micropayments. A server returns HTTP 402 with a price, token, and address; the agent signs via EIP-712 and resends with payment proof. Near-zero costs (as low as $0.001 per request). Version 2 launched December 2025 with multi-chain support. Over 100 million payments processed in six months, 500K+ weekly transactions by October 2025.

**Clavion integration:** Acts as the secure signing layer for x402 payment flows, ensuring that agent payment authorizations pass through policy evaluation before signing EIP-712 messages.

### 12.2 ERC-8004 — On-Chain Agent Identity

Launched on mainnet January 29, 2026, by MetaMask, Ethereum Foundation, Google, and Coinbase. Provides three lightweight registries for on-chain agent identity, reputation, and validation. 24,000+ agents registered. Endorsements from ENS, EigenLayer, The Graph, and Taiko.

**Clavion integration:** Audit traces can feed into ERC-8004 attestations, providing verifiable evidence of agent behavior and policy compliance.

### 12.3 MCP — Model Context Protocol (Anthropic → Linux Foundation)

Standardizes agent-tool integration. Adopted by OpenAI, Google DeepMind, and Microsoft. Platinum members include Amazon, Bloomberg, and Cloudflare. Coinbase's Payments MCP enables Claude, Gemini, and Codex to access wallets and payments.

**Clavion integration:** Exposes its API as an MCP server, enabling any MCP-compatible agent to access secure crypto operations.

### 12.4 A2A — Agent-to-Agent Protocol (Google → Linux Foundation)

Inter-agent communication standard with 150+ supporting organizations. Version 0.3 added gRPC support and signed security cards.

**Clavion integration:** Policy engine can evaluate and authorize cross-agent crypto requests, ensuring that agent-to-agent financial interactions are governed by explicit rules.

### 12.5 AP2 — Agent Payments Protocol (Google)

Platform-agnostic trust layer for agent payments with 60+ partners including Mastercard, PayPal, Visa, and American Express. Uses cryptographically-signed "Digital Mandates" for authorization.

**Clavion integration:** Approval flow and digital mandate support aligns with AP2's cryptographically-signed authorization model.

### 12.6 Strategic Position

These five protocols create the communications, identity, and payments layers for the agent economy. They deliberately do not address secure execution. Clavion fills the gap: the enforcement layer that sits between agent communication (MCP/A2A) and on-chain settlement (x402/ERC-8004), ensuring that every operation is policy-checked, simulated, approved, and audited.

---

## 13. Regulatory Context

### 13.1 Current Landscape

No jurisdiction has enacted AI-agent-specific financial regulations, but existing frameworks are being stretched to cover agent activity:

**United States:** The SEC established an AI Task Force in August 2025 and designated a Chief AI Officer. FINRA's 2026 Regulatory Oversight Report flags "AI agents acting autonomously without human validation and approval" as a key concern. The CFPB's early-2026 ruling erased the distinction between human employees and AI agents — AI systems acting as loan officers must be registered, and banks face strict liability for autonomous errors.

**European Union:** The AI Act entered force August 2024, with high-risk AI system obligations (including financial sector applications) taking effect August 2026. Agentic AI's autonomous nature may push it into "high-risk" or potentially "prohibited" categories. GDPR Article 22 — the right not to be subject to solely automated decisions with legal effects — creates direct friction with fully autonomous financial agents.

### 13.2 Know Your Agent (KYA)

"Know Your Agent" is emerging as the next compliance primitive. Non-human identities now outnumber human employees 96-to-1, yet these identities remain largely unverifiable. Trulioo launched a Digital Agent Passport partnering with Worldpay ($2.5T volume) and Google AP2. Skyfire's KYAPay protocol uses JWT-based agent identity. ERC-8004 provides on-chain agent registries with 24,000+ agents.

### 13.3 Clavion's Regulatory Readiness

Clavion's architecture is inherently compliance-friendly:

- **Audit trails** provide the reconstructable history that regulators require
- **Policy enforcement** implements configurable compliance rules
- **Human-in-the-loop approval** satisfies "human validation" requirements flagged by FINRA
- **Risk scoring and simulation** demonstrate due diligence before execution
- **Event correlation** from intent to receipt enables investigation and reporting

As regulatory frameworks mature, these capabilities will transition from differentiators to requirements.

---

## 14. Use Cases

### 14.1 Safe Swap via Agent Skill

A portfolio rebalancing agent running in OpenClaw wants to swap 100 USDC for ETH on Base.

1. Agent skill constructs a TxIntent: `swap_exact_in`, 100 USDC → WETH, max 1% slippage
2. Clavion validates the intent against schema
3. Policy Engine checks: Is this router allowlisted? Is USDC/WETH approved? Is 100 USDC within the daily limit?
4. Transaction Engine builds the concrete swap calldata
5. Preflight Simulator runs `eth_call`, computes balance diffs: −100 USDC, +0.040 WETH, gas ~$0.02
6. Approval Service presents summary: "Swap 100 USDC → ~0.040 WETH (min 0.039). Risk: Low. Gas: ~$0.02"
7. User confirms in CLI/UI
8. Wallet Service signs and broadcasts
9. Audit Trace records every step with `intentId` correlation

### 14.2 Blocking a Malicious Skill

A compromised skill attempts to execute an unlimited ERC-20 approval to an unknown spender:

1. Skill submits TxIntent: `approve`, MaxUint256 amount, unknown spender
2. Schema validation passes (structurally correct)
3. **Policy Engine: DENY** — spender not in allowlist, amount exceeds `maxApprovalAmount`
4. Audit Trace records: `policy_denied`, reasons: `SPENDER_NOT_ALLOWLISTED`, `AMOUNT_EXCEEDS_LIMIT`
5. Transaction is never built, never signed, never sent
6. The key was never at risk because the skill never had access to it

### 14.3 Enterprise DeFi Treasury

A corporate treasury team uses an AI agent to manage yield across DeFi protocols:

1. Policy configured: max $50K per transaction, only Aave/Compound/Uniswap, only USDC/ETH/WBTC, human approval for anything over $10K
2. Agent operates autonomously for sub-$10K rebalancing
3. Every operation logged with full correlation
4. Compliance team queries: "All transactions over $5K in the last 30 days with policy evaluations and approval records"
5. Regulatory audit: complete reconstructable history from intent to receipt

### 14.4 x402 Payment Agent

An AI agent subscribes to paid APIs using x402 micropayments:

1. Agent encounters HTTP 402 response with payment terms
2. Agent constructs TxIntent: `transfer`, 0.01 USDC to payment address
3. Policy Engine validates: payment within micropayment budget, recipient domain in approved list
4. Preflight confirms balance sufficiency
5. Auto-approved (below human-approval threshold per policy)
6. Transaction signed and payment proof attached to retry request
7. Audit Trail records payment for cost tracking

---

## 15. Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Language | TypeScript (Node 20+) | Mature EVM ecosystem (viem), rapid development, strong typing |
| API Framework | Fastify | High performance, native JSON schema validation |
| EVM SDK | viem | Strict TypeScript interfaces, modern ABI handling |
| Schema Validation | AJV | Industry-standard JSON schema validator |
| Database | SQLite | Local, zero-config, append-only audit logs |
| Logging | pino | Structured, high-performance logging |
| Sandbox (v0.1) | Docker | Container isolation, rootless upgrade path |
| Sandbox (v0.2) | Wasmtime / WASM | Memory-safe, capability-restricted |
| Canonicalization | JCS | Deterministic hashing, cross-language compatibility |
| Signing | secp256k1 (via viem) | EVM-native, compatible with skill publisher keys |
| CI | GitHub Actions | Unit, integration, e2e, and security tests |
| Observability | pino + OpenTelemetry | Structured logs + distributed tracing |

TypeScript was chosen for v0.1 to prioritize time-to-market and ecosystem maturity. The architecture is designed so that security-critical components (WalletService, PolicyEngine) can be extracted into hardened Rust services in v0.2+ without changing the API contract.

---

## 16. Roadmap

### 16.1 v0.1 — Production Beta (Current Phase)

**Timeline:** 8–10 weeks to beta with 2.5 FTE, ~46 man-weeks core effort + 5 man-weeks risk buffer.

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 0 | Architecture freeze, spec lock, repo scaffolding | 2 mw |
| Phase 1 | Core API skeleton, schemas, validation, canonicalization | 4 mw |
| Phase 2 | Wallet service, policy engine, signing pipeline, approval CLI | 6 mw |
| Phase 3 | Transaction engine (transfer/approve/swap), preflight, risk scoring | 8 mw |
| Phase 4 | Sandbox executor, network/FS/process isolation | 6 mw |
| Phase 5 | Skill packaging, signing, static scanner, registry | 6 mw |
| Phase 6 | Agent framework integration (OpenClaw adapter) | 5 mw |
| Phase 7 | E2E testing, security test suite, failure injection | 6 mw |
| Phase 8 | Release candidate, documentation, demo environment | 3 mw |

**Critical path:** Wallet → Policy → Swap Engine → Preflight → Approval → E2E

### 16.2 v0.2 — Hardened Runtime

- WASM-based sandbox (Wasmtime) replacing Docker for stricter, formally verifiable isolation
- Smart account support (ERC-4337) with session keys
- Multi-RPC consensus for simulation integrity
- Hardware wallet / remote signer integration (Turnkey, hardware wallets)
- MCP server for native agent framework integration
- Multi-chain support (additional EVM chains)

### 16.3 v0.3 — Enterprise and Standards

- ERC-8004 attestation integration
- x402 payment signing support
- Role-based access control for team deployments
- Compliance reporting templates
- Reputation layer based on audit trace history
- Non-EVM chain support (Solana, Sui)

### 16.4 Long-Term Vision

Clavion's trajectory is to become the standard secure execution layer for the agent economy. As autonomous agents scale from thousands to millions, the demand for security infrastructure that can be deployed independently, configured per-user, and verified through open-source audit will compound. The agent economy's trust deficit is not a bug to be patched. It is the market opportunity itself.

---

## 17. Conclusion

The AI agent economy is arriving faster than its security infrastructure. Billions of dollars flow through agent-controlled wallets today, protected by environment variables and hope. The market needs a new architectural primitive: a secure execution layer that sits between agent code and blockchain signing, enforcing policies, simulating outcomes, requiring approval, and logging everything.

Clavion is that layer.

By isolating keys from untrusted code, replacing raw signing with typed intents, enforcing configurable policies, simulating before signing, and maintaining complete audit trails, Clavion makes agent crypto operations safe by construction — not by convention.

The architecture is open. The API is typed and versioned. The security model is documented and testable. The roadmap is concrete.

We are building the trust infrastructure that the agent economy requires.

---

## References

1. Grand View Research. "AI Agents Market Size, Share & Trends Analysis Report." 2025.
2. Precedence Research. "AI Agents Market to Reach $236 Billion by 2034." 2025.
3. Gartner. "40% of Enterprise Apps Will Feature Task-Specific AI Agents by 2026." August 2025.
4. Gartner. "Over 40% of Agentic AI Projects Will Be Canceled by End of 2027." June 2025.
5. Gartner. "40% of CIOs Will Demand Guardian Agents by 2028." 2025.
6. McKinsey & Company. "Agentic AI: $2.6–4.4 Trillion Annual GDP Impact by 2030." 2025.
7. PwC. "2025 Global AI Survey: 79% of Organizations Have Implemented AI Agents." 2025.
8. Harvard Business Review. "Only 6% of Organizations Fully Trust AI for End-to-End Processes." December 2025.
9. FINRA. "2026 Annual Regulatory Oversight Report." 2026.
10. Anthropic. "SCONE-bench: AI Agent Smart Contract Exploitation Benchmarks." 2025.
11. Adversa AI. "2025 AI Security Incidents Report." 2025.
12. SlowMist. "Fewer Than 10% of Crypto AI Projects Use Sandboxed Environments." 2025.
13. a16z crypto. "AI Agents in Crypto: Trends and Infrastructure." 2025–2026.
14. Safe Global. "2025 Annual Report: $600B Transaction Volume, 18.3M New Smart Accounts." 2025.
15. DL News. "AI Crypto Projects Raise $516M in 2025." 2025.
16. Chainstack. "The Agentic Payments Landscape: x402, AP2, ERC-8004." 2025.
17. Chainalysis. "The Convergence of AI and Cryptocurrency." 2025.
18. VanEck. "Crypto Predictions 2025: 1M+ AI Agents." 2025.

---

## Appendix A: Glossary

| Term | Definition |
|------|-----------|
| **TxIntent** | A typed, declarative description of a desired crypto operation — not a raw transaction |
| **Preflight** | Pre-execution simulation to determine outcomes, risk score, and balance diffs |
| **PolicyEngine** | Rule-based evaluator returning allow/deny/require_approval for each operation |
| **ApprovalToken** | Single-use, time-bound, intent-specific token authorizing a transaction to be signed |
| **AuditTrace** | Correlated log of all events in an operation's lifecycle (intent → receipt) |
| **SkillManifest** | Signed descriptor declaring a skill package's permissions, integrity, and sandbox requirements |
| **Domain A/B/C** | Trust domains: untrusted agent code, trusted core, sandboxed executor |
| **JCS** | JSON Canonicalization Scheme — deterministic JSON serialization for consistent hashing |
| **ERC-4337** | Account abstraction standard enabling smart accounts with programmable validation |
| **x402** | HTTP-native stablecoin payment protocol using HTTP 402 status codes |
| **ERC-8004** | On-chain agent identity, reputation, and validation standard |
| **MCP** | Model Context Protocol — standard for agent-tool integration |

## Appendix B: Component Naming

| Component | Name |
|-----------|------|
| CLI | clavion-cli |
| Core Daemon | Clavion Core |
| API | Clavion API |
| Sandbox | Clavion Cell |
| Skill Registry | Clavion Catalog |
| OpenClaw Adapter | Clavion ClawBridge |
| Approval UI | Clavion Prompt |
| Audit Log DB | Clavion Ledger |
| Test Suite | Clavion Guard Tests |

## Appendix C: Links

- **Website:** [clavion.xyz](https://clavion.xyz)
- **GitHub:** [github.com/clavion](https://github.com/clavion)
- **Twitter:** [@clavion_xyz](https://twitter.com/clavion_xyz)

---

*© 2026 Clavion Labs. This document is provided for informational purposes. Architecture and specifications are subject to change as the project evolves toward production.*
