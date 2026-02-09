---
name: iscl-architecture
description: >
  ISCL project architecture reference. Use when making architectural decisions, adding new
  components, modifying data flow, working across trust domain boundaries, or when context
  about the system structure is needed. Triggers: component interactions, trust boundaries,
  domain A/B/C references, data flow questions, "where does X live", module placement decisions.
---

# ISCL Architecture

## Trust Domains — The Core Invariant

Every line of code belongs to exactly one trust domain. Never blur these boundaries.

**Domain A (Untrusted):** OpenClaw + agent skills. No keys, no direct RPC, no signing.
**Domain B (Trusted):** ISCL Core. Keys, policy, signing, audit, RPC access.
**Domain C (Limited Trust):** Secure Executor / sandbox. No keys, API-only communication with Core.

## Component Map

```
ISCL Core (Domain B)
├── API Server (Fastify)
├── WalletService        — encrypted keystore, signing
├── PolicyEngine         — evaluate intent against rules
├── TxEngine             — deterministic tx building
├── PreflightService     — simulation, risk scoring
├── ApprovalService      — human confirmation flow
├── AuditTraceService    — append-only event log
└── SkillRegistryService — manifest validation, scanner

Secure Executor (Domain C)
└── Sandbox Runner       — container isolation, trace logging

OpenClaw Adapter (Domain A)
└── Thin skill wrappers  — call ISCL API over localhost
```

## Canonical Data Flow

```
Agent Skill → TxIntent → ISCL /tx/build → Preflight Simulation
→ Approval Request → User Confirmation → WalletService.sign
→ Broadcast → Receipt → AuditTrace
```

## Key Rules When Adding Code

- New crypto logic → Domain B only, inside appropriate service
- New skill-facing functionality → expose via ISCL API, never direct access
- New external network calls → must go through RPC allowlist in Domain B
- Sandbox code → Domain C, no key access, no unrestricted network
- Cross-domain communication → always via ISCL Core API (localhost HTTP)

## Repo Layout

```
/core      — ISCL Core services (API, wallet, policy, tx, preflight, audit)
/sandbox   — runner and isolation policies
/adapter   — OpenClaw thin skills + installer
/spec      — schemas, fixtures, canonicalization rules
/tests     — unit/integration/e2e/security
/docs      — PRD, security blueprint, stack decision
```

## Tech Stack Quick Reference

- Language: TypeScript (Node 20+)
- API: Fastify + OpenAPI/JSON Schema
- EVM: viem
- Validation: AJV (strict, no additionalProperties)
- DB: SQLite (audit trace + idempotency)
- Logging: pino (structured)
- Sandbox: Docker (rootless planned)
- Canonicalization: JCS + keccak256
