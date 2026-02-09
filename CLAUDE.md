# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Clavion / ISCL (Independent Secure Crypto Layer)** — a local secure runtime that enables AI agents to safely perform crypto operations (signing, swaps, approvals, transfers) while isolating private keys from untrusted agent code. Integrates with OpenClaw as a compatible execution backend but is architecturally independent.

This repository currently contains **specifications, design docs, and Claude Code skills** — the implementation codebase is built following these specs.

## Repository Structure

```
/doc/       — Specifications, whitepapers, PRD, security blueprint, roadmap
/iscl-claude-code-skills/  — 12 Claude Code skill packages for development guidance
```

### Planned Implementation Layout

```
/core      — ISCL Core services (API, wallet, policy, tx, preflight, audit)
/sandbox   — Container runner and isolation policies
/adapter   — OpenClaw thin skills + installer
/spec      — Schemas, fixtures, canonicalization rules
/tests     — unit/integration/e2e/security
/docs      — Generated docs
```

## Architecture: Three Trust Domains

Every line of code belongs to exactly one trust domain. Never blur these boundaries.

- **Domain A (Untrusted):** OpenClaw + agent skills. No keys, no direct RPC, no signing.
- **Domain B (Trusted):** ISCL Core. Keys, policy, signing, audit, RPC access.
- **Domain C (Limited Trust):** Secure Executor / sandbox. No keys, API-only communication with Core.

### Component Map

```
ISCL Core (Domain B)
├── API Server (Fastify)
├── WalletService        — encrypted keystore, signing
├── PolicyEngine         — evaluate intent against rules
├── TxEngine             — deterministic tx building
├── PreflightService     — simulation, risk scoring
├── ApprovalService      — human confirmation flow
├── AuditTraceService    — append-only event log (SQLite)
└── SkillRegistryService — manifest validation, scanner

Secure Executor (Domain C)
└── Sandbox Runner       — container isolation, trace logging

OpenClaw Adapter (Domain A)
└── Thin skill wrappers  — call ISCL API over localhost
```

### Canonical Data Flow

```
Agent Skill → TxIntent → ISCL /tx/build → Preflight Simulation
→ Approval Request → User Confirmation → WalletService.sign
→ Broadcast → Receipt → AuditTrace
```

## Security Invariants (Non-Negotiable)

1. Private keys exist only in Domain B — never in Domain A (skills) or C (sandbox)
2. Every signature passes PolicyEngine + Preflight — no bypass paths
3. Skills have no direct RPC access — only ISCL Core contacts blockchain
4. All fund-affecting operations use TxIntent v1 — no arbitrary calldata signing
5. All critical steps are audit logged — correlated by `intentId`
6. Approval tokens are single-use with TTL — no replay

## Tech Stack

- **Language:** TypeScript (Node 20+)
- **API:** Fastify + OpenAPI/JSON Schema
- **EVM:** viem (preferred over ethers)
- **Validation:** AJV (strict mode, no additionalProperties)
- **Database:** SQLite (audit trace + idempotency)
- **Logging:** pino (structured)
- **Sandbox:** Docker (rootless planned for v0.2+)
- **Canonicalization:** JCS + keccak256
- **Encryption:** scrypt + AES-256-GCM (keystore)
- **Test runner:** vitest

## Build & Test Commands (Planned)

```bash
# Tests
npx vitest run tests/unit          # Unit tests (schemas, policy, canonicalization)
npx vitest run tests/integration   # Integration tests (API → policy → wallet)
npx vitest run tests/security      # Security tests (requires Docker)
npx vitest run tests/e2e           # E2E tests (requires testnet/fork)

# CI pipeline
# - Unit + Integration: every push
# - Security tests: every push (require Docker)
# - E2E: on PR merge to main
# - OpenClaw compatibility: matrix of pinned + latest stable
```

## API Endpoints

```
GET  /v1/health                    — Version + status
POST /v1/tx/build                  — Build transaction from TxIntent
POST /v1/tx/preflight              — Simulate & score risk
POST /v1/tx/approve-request        — Prompt user, issue approval token
POST /v1/tx/sign-and-send          — Sign & broadcast (requires valid approval token)
GET  /v1/tx/:hash                  — Get transaction receipt
GET  /v1/balance/:token/:account   — ERC-20 balance lookup
```

## Key Schemas

**TxIntent v1** — typed transaction intent (not a raw transaction). Fields: `version`, `id` (UUID), `timestamp`, `chain` (type/chainId/rpcHint), `wallet` (address/profile), `action` (transfer/approve/swap_exact_in/swap_exact_out), `constraints` (maxGasWei/deadline/maxSlippageBps), `preferences`, `metadata`.

**SkillManifest v1** — signed skill package descriptor with permissions, sandbox limits, file hashes, and ECDSA signature.

**Policy Config** (YAML) — defines maxValueWei, contract/token allowlists, allowedChains, maxRiskScore, approval thresholds, rate limits.

Full schemas: see `iscl-claude-code-skills/txintent-schema/` and `iscl-claude-code-skills/skill-manifest-schema/`.

## Claude Code Skills

The `/iscl-claude-code-skills/` directory contains 12 skill packages providing implementation guidance:

| Skill | When to Use |
|---|---|
| `iscl-architecture` | Architectural decisions, component placement, trust boundaries |
| `txintent-schema` | TxIntent validation, schema changes, fixture creation |
| `skill-manifest-schema` | Skill packaging, signing, supply chain integrity |
| `policy-engine` | Policy rules, evaluation logic, config schema |
| `wallet-service` | Key management, signing pipeline, keystore |
| `security-invariants` | Security tests, threat model (A1-A4, B1-B4, C1-C4) |
| `sandbox-executor` | Container isolation, Domain C design |
| `preflight-simulation` | Risk scoring, transaction simulation |
| `audit-logging` | Event logging, correlation by intentId |
| `iscl-api-endpoints` | Fastify API patterns, route implementation |
| `testing-patterns` | Test infrastructure, fixtures, mock RPC |
| `openclaw-adapter` | OpenClaw integration, thin skill wrappers |

## Key Design Rules

- New crypto logic → Domain B only, inside the appropriate service
- New skill-facing functionality → expose via ISCL API, never direct access
- New external network calls → must go through RPC allowlist in Domain B
- Sandbox code → Domain C, no key access, no unrestricted network
- Cross-domain communication → always via ISCL Core API (localhost HTTP)
- All schemas use `additionalProperties: false` — no undocumented fields
- Test fixtures live in `/spec/fixtures/` — one valid fixture per action type plus invalid/edge cases

## Key Specification Documents

- `doc/ISCL Engineering Specification v0.1.md` — master technical spec
- `doc/Clavion API Schema Specification v0.1.md` — TxIntent & SkillManifest schemas
- `doc/ISCL Security Blueprint v0.1_eng.md` — threat model & security analysis
- `doc/Stack Decision Document — ISCL v0.1.md` — tech stack rationale
- `doc/Engineering Task Breakdown — ISCL v0.1.md` — epic/ticket breakdown
- `doc/Product Requirements Document (PRD)_eng.md` — functional requirements
