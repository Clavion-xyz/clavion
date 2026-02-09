# ISCL Engineering Specification v0.1

## Independent Secure Crypto Layer compatible with OpenClaw

Version: 1.0  
Status: Engineering Master Spec  
Audience: Core engineering team  
Language: English

---

# 1. Overview

ISCL (Independent Secure Crypto Layer) is a local secure runtime that enables AI agents to safely perform crypto operations (transaction signing, swaps, approvals, transfers) while isolating private keys from untrusted agent code.

ISCL integrates with OpenClaw as a compatible execution backend but is architecturally independent. OpenClaw is treated as an orchestration environment; ISCL is the security and crypto execution layer.

ISCL v0.1 is designed as a production-ready beta focused on:

secure transaction signing  
sandboxed skill execution  
policy-controlled crypto workflows  
human approval flows  
auditability  
compatibility stability

---

# 2. Design Principles

ISCL v0.1 is built around the following invariants:

Private keys never leave ISCL Core  
All crypto actions are expressed as typed intents  
No raw signing endpoints exist  
All transactions pass policy + preflight + approval  
Sandboxed code cannot access keys or unrestricted network  
All critical actions are audit logged  
OpenClaw integration is via stable API only

Security is achieved through layered isolation, not trust in agent code.

---

# 3. System Architecture

## 3.1 Trust Domains

Domain A — OpenClaw + agent skills  
Untrusted. No key access. No direct blockchain RPC.

Domain B — ISCL Core  
Trusted. Contains wallet, policy engine, signing logic.

Domain C — Secure Executor  
Partially trusted. Sandboxed execution environment.

---

## 3.2 Component Architecture

ISCL Desktop App  
→ UI shell + approval interface

ISCL Core Daemon  
→ API server  
→ Wallet Service  
→ Policy Engine  
→ Transaction Engine  
→ Preflight Simulator  
→ Audit Logger  
→ Skill Registry

Secure Executor  
→ Container sandbox runner

OpenClaw Adapter  
→ Thin client skills calling ISCL API

---

## 3.3 Data Flow

Agent Skill  
→ TxIntent  
→ ISCL Build  
→ Preflight Simulation  
→ Approval Request  
→ User Confirmation  
→ Wallet Signing  
→ Transaction Broadcast  
→ Receipt Logging

---

# 4. Core Subsystems

## 4.1 Wallet Service

Responsibilities:

secure encrypted keystore  
key isolation  
transaction signing  
approval token enforcement

Requirements:

local encrypted storage  
keys never exposed to sandbox  
single signing entrypoint  
support EOA wallets

---

## 4.2 Policy Engine

Evaluates:

transaction limits  
contract allowlists  
token allowlists  
approval bounds

Outputs:

allow  
deny  
require approval

Policies are configuration-driven and versioned.

---

## 4.3 Transaction Engine

Supports:

transfer  
approve  
swap_exact_in  
swap_exact_out

Responsibilities:

deterministic transaction building  
DEX routing (single router v0.1)  
gas estimation  
receipt tracking

---

## 4.4 Preflight Simulator

Performs:

eth_call simulation  
balance diffs  
allowance inspection  
risk scoring

Outputs structured risk report.

---

## 4.5 Sandbox Executor

Provides:

container isolation  
network allowlist  
filesystem restrictions  
process restrictions  
execution tracing

No key access permitted.

---

## 4.6 Skill Registry

Handles:

signed skill packages  
manifest validation  
static scanning  
curated registry

Rejects tampered packages.

---

# 5. API Specification

## 5.1 Endpoints

GET /v1/health  
POST /v1/tx/build  
POST /v1/tx/preflight  
POST /v1/tx/approve-request  
POST /v1/tx/sign-and-send  
GET /v1/tx/{hash}

All inputs validated by JSON schemas.

---

## 5.2 TxIntent Schema

TxIntent v1 defines typed transaction intents.  
It includes:

chain  
wallet  
action  
limits  
preferences  
metadata

All canonicalized and hashed.

---

## 5.3 SkillManifest Schema

Defines:

permissions  
publisher signature  
package hashes  
sandbox requirements

Enforces supply chain integrity.

---

# 6. Security Model

## 6.1 Threat Model

Protect against:

malicious skills  
key exfiltration  
arbitrary signing  
network abuse  
package tampering  
replay attacks

Out of scope:

OS compromise  
user social engineering

---

## 6.2 Security Mechanisms

policy enforcement  
single signing path  
sandbox isolation  
approval tokens  
audit tracing  
package signing

---

## 6.3 Audit Logging

All critical events recorded:

intent received  
policy decision  
build complete  
preflight result  
approval issued  
signature created  
transaction sent  
receipt received

Stored in SQLite + exportable logs.

---

# 7. Installation Architecture

User installs:

ISCL Desktop App  
ISCL Core Runtime  
Bundled OpenClaw runtime  
Sandbox engine

All packaged in a single installer.

Local directory structure:

ISCL app directory  
user config directory (~/.iscl)

---

# 8. Technology Stack

Language: TypeScript (Node 20+)  
API Framework: Fastify  
EVM SDK: viem  
Schema validation: AJV  
Database: SQLite  
Logging: pino  
Sandbox: Docker (v0.1)

JSON canonicalization: JCS

---

# 9. Implementation Roadmap

## Phase 0 — Architecture Freeze

Specs finalized

## Phase 1 — Core API

Server + schemas

## Phase 2 — Wallet & Policy

Secure signing

## Phase 3 — Transaction Engine

Swap workflows

## Phase 4 — Sandbox Executor

Isolation runtime

## Phase 5 — Skill Packaging

Signed registry

## Phase 6 — OpenClaw Integration

Adapter skills

## Phase 7 — E2E Hardening

Security tests

## Phase 8 — Release Candidate

Documentation + beta

Total effort: ~50 man-weeks

---

# 10. Acceptance Criteria

End-to-end swap works on testnet  
Keys inaccessible to skills  
Sandbox blocks unauthorized actions  
Policy enforcement active  
Approval required  
Audit logs complete  
Compatibility tests pass

---

# 11. Non-Goals (v0.1)

Multi-chain support  
On-chain reputation  
P2P agent economy  
Formal verification  
Advanced smart accounts

---

# 12. Future Extensions

Rust hardened signer  
Nanoclaw executor integration  
Smart accounts  
Session keys  
Multi-RPC consensus  
Reputation layer

---

# 13. Repository Structure

/core  
/sandbox  
/adapter  
/spec  
/tests  
/docs

---

# 14. Development Workflow

Engineers must:

run unit tests  
run security tests  
run integration demos  
pass schema validation  
complete code review checklist

---

# 15. Release Process

Beta release after Phase 8  
Public announcement  
Community onboarding  
Feedback loop

---

# 16. Conclusion

ISCL v0.1 establishes a secure foundation for crypto-capable AI agents.

The architecture prioritizes:

isolation  
determinism  
auditability  
compatibility  
developer ergonomics

This document is the canonical engineering reference.

---

End of Specification