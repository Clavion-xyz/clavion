# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Clavion / ISCL (Independent Secure Crypto Layer)** — a local secure runtime that enables AI agents to safely perform crypto operations (signing, swaps, approvals, transfers) while isolating private keys from untrusted agent code. Integrates with OpenClaw as a compatible execution backend but is architecturally independent.

## Repository Structure

```
packages/
├── types/              @clavion/types      — Shared interfaces, schemas, RPC types
├── audit/              @clavion/audit      — Append-only audit trace (SQLite)
├── policy/             @clavion/policy     — Policy engine & config validation
├── signer/             @clavion/signer     — Encrypted keystore & signing
├── preflight/          @clavion/preflight  — Risk scoring & simulation
├── registry/           @clavion/registry   — Skill manifest validation & registry
├── sandbox/            @clavion/sandbox    — Container isolation runner
├── core/               @clavion/core       — API server, tx builders, approval
├── adapter-openclaw/   @clavion/adapter-openclaw — OpenClaw thin skill wrappers
├── sdk/                @clavion/sdk        — SDK interface (stub, v0.2)
└── cli/                @clavion/cli        — Operational CLI (stub, v0.2)

tests/                  Cross-package integration, security, and e2e tests
tools/                  Fixture generation, hash utilities
examples/               Example scripts and policy configs
docs/                   Architecture docs, API reference, guides
docker/                 Dockerfile and compose configuration
```

## Architecture: Three Trust Domains

Every line of code belongs to exactly one trust domain. Never blur these boundaries.

- **Domain A (Untrusted):** OpenClaw + agent skills (`@clavion/adapter-openclaw`). No keys, no direct RPC, no signing.
- **Domain B (Trusted):** ISCL Core (`@clavion/core`, `@clavion/signer`, `@clavion/audit`, `@clavion/policy`, `@clavion/preflight`, `@clavion/registry`). Keys, policy, signing, audit, RPC access.
- **Domain C (Limited Trust):** Secure Executor (`@clavion/sandbox`). No keys, API-only communication with Core.

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

- **Language:** TypeScript (Node 20+), ESM with Node16 module resolution
- **Monorepo:** npm workspaces, TypeScript project references
- **API:** Fastify + OpenAPI/JSON Schema
- **EVM:** viem (preferred over ethers)
- **Validation:** AJV (strict mode, no additionalProperties)
- **Database:** SQLite via better-sqlite3 (audit trace + idempotency)
- **Logging:** pino (structured)
- **Sandbox:** Docker (rootless planned for v0.2+)
- **Canonicalization:** JCS + keccak256
- **Encryption:** scrypt + AES-256-GCM (keystore)
- **Test runner:** vitest

## Build & Test Commands

```bash
npm run build                          # tsc -b (all packages in dependency order)
npm run test                           # All tests
npm run test:unit                      # Per-package unit tests
npm run test:integration               # Cross-package integration tests
npm run test:security                  # Security tests (requires Docker)
npm run test:e2e                       # E2E tests (requires Anvil)
npm run lint                           # ESLint
npm run format:check                   # Prettier check
npm run generate:hashes                # Regenerate fixture hashes
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
POST /v1/skills/register           — Register a skill manifest
GET  /v1/skills                    — List registered skills
GET  /v1/skills/:name              — Get skill details
DELETE /v1/skills/:name            — Revoke a skill
```

## Key Package Paths

| Package | Key Files |
|---------|-----------|
| `@clavion/types` | `packages/types/src/index.ts` (interfaces), `packages/types/src/schemas/` (JSON schemas) |
| `@clavion/audit` | `packages/audit/src/audit-trace-service.ts` |
| `@clavion/policy` | `packages/policy/src/policy-engine.ts`, `packages/policy/src/policy-config.ts` |
| `@clavion/signer` | `packages/signer/src/keystore.ts`, `packages/signer/src/wallet-service.ts` |
| `@clavion/preflight` | `packages/preflight/src/preflight-service.ts`, `packages/preflight/src/risk-scorer.ts` |
| `@clavion/registry` | `packages/registry/src/skill-registry-service.ts`, `packages/registry/src/manifest-signer.ts` |
| `@clavion/sandbox` | `packages/sandbox/src/sandbox-runner.ts` |
| `@clavion/core` | `packages/core/src/api/app.ts`, `packages/core/src/api/routes/tx.ts`, `packages/core/src/tx/builders/` |
| `@clavion/adapter-openclaw` | `packages/adapter-openclaw/src/shared/iscl-client.ts`, `packages/adapter-openclaw/src/skills/` |

## Key Design Rules

- New crypto logic → Domain B only, inside the appropriate package
- New skill-facing functionality → expose via ISCL API, never direct access
- New external network calls → must go through RPC allowlist in Domain B
- Sandbox code → Domain C, no key access, no unrestricted network
- Cross-domain communication → always via ISCL Core API (localhost HTTP)
- All schemas use `additionalProperties: false` — no undocumented fields
- Test fixtures live in `tools/fixtures/` — one valid fixture per action type plus invalid/edge cases
- CJS packages (ajv-formats, canonicalize) must use `createRequire` pattern for Node16 ESM compat

## Docker

```bash
# Build
docker build -f docker/Dockerfile.core -t clavion-core .

# Demo stack (Anvil + ISCL Core + OpenClaw)
docker compose -f docker/compose.yaml --profile demo up -d
```

## Key Specification Documents

- `docs/architecture/engineering-spec.md` — master technical spec
- `docs/architecture/threat-model.md` — threat model & security analysis
- `docs/architecture/stack-decisions.md` — tech stack rationale
- `docs/api/schemas.md` — TxIntent & SkillManifest schemas
- `docs/development/dev-setup.md` — development setup guide
