# Product Requirements Document (PRD)

## ISCL v0.1 — Independent Secure Crypto Layer compatible with OpenClaw

### 1. Executive Summary

ISCL v0.1 is an independent secure crypto layer for AI agents, compatible with OpenClaw. Its mission is to ensure the safe execution of cryptocurrency operations (transaction signing, swaps, transfers, approvals) through a strict sandbox architecture, policy engine, and human-in-the-loop confirmation.

ISCL does not replace OpenClaw. It acts as an external secure runtime + wallet service that OpenClaw skills access via a stable API.

The core value of v0.1:

*   Secure transaction signing
*   Curated crypto-skills
*   Isolation from malicious skills
*   Simulation and risk assessment before signing
*   Full audit trace of operations

v0.1 is a production-ready pilot for early OpenClaw users.

---

### 2. Goals & Success Criteria

#### 2.1 Goals

*   Create a minimal production-ready secure crypto runtime
*   Integrate with OpenClaw without forking the core
*   Ensure key isolation from skills
*   Implement deterministic crypto workflows
*   Release a curated crypto skill pack
*   Ensure compatibility during OpenClaw updates

#### 2.2 Success Criteria

*   User can safely perform a swap via an OpenClaw skill
*   No skill has access to the private key
*   All transactions pass policy + preflight + approval
*   Sandbox blocks unauthorized network/fs/process operations
*   CI compatibility tests pass on the pinned OpenClaw version
*   All audit events are logged

---

### 3. Non-Goals (v0.1)

*   No support for non-EVM networks
*   No P2P agent economy
*   No on-chain reputation system
*   No multi-sig orchestration
*   No formal verification of the sandbox
*   No full protection against OS-level compromise

---

### 4. System Architecture

#### 4.1 Trust Domains

*   **Domain A:** OpenClaw + skills (untrusted)
*   **Domain B:** ISCL Core (trusted)
*   **Domain C:** Secure Executor (limited trust)

#### 4.2 Core Components

**ISCL Core:**

*   WalletService
*   PolicyEngine
*   TxEngine
*   PreflightService
*   ApprovalService
*   AuditTraceService
*   SkillRegistryService

**Secure Executor:**

*   Sandbox Runner (container-based)
*   Optional Nanoclaw executor (future)

**OpenClaw Adapter:**

*   Thin skills clients
*   Installation tooling
*   Compatibility layer

---

### 5. Functional Requirements

#### 5.1 Wallet Management

*   System must store keys in an encrypted keystore
*   Keys are unavailable to skills
*   Support for EOA wallets
*   Human approval required before signing
*   Signing policies based on limits and allowlists

#### 5.2 Transaction Engine

*   Support for:
    *   transfer
    *   approve
    *   swap_exact_in
    *   swap_exact_out
*   Only allowlisted contracts
*   Deterministic build pipeline
*   Preflight simulation
*   Risk scoring

#### 5.3 Sandbox Execution

*   Container isolation of skills
*   Network allowlist
*   Filesystem restrictions
*   No arbitrary process spawn
*   Resource limits
*   Execution trace logging

#### 5.4 Skill Packaging

*   Signed skill packages
*   Manifest validation
*   Static security scanner
*   Curated skill registry

#### 5.5 API Layer

*   ISCL API v1:
    *   `/health`
    *   `/tx/build`
    *   `/tx/preflight`
    *   `/tx/approve-request`
    *   `/tx/sign-and-send`
    *   `/tx/status`
*   Strict JSON schema validation

#### 5.6 OpenClaw Integration

*   Thin skill wrappers
*   Local API calls to ISCL
*   Approval UI integration (CLI/web fallback)
*   Pinned compatibility version

---

### 6. Security Requirements

*   Private keys never exposed outside ISCL Core
*   All signatures require policy evaluation
*   Approval tokens are single-use
*   RPC endpoints allowlisted
*   All critical steps logged
*   Sandbox violations logged and blocked
*   Security blueprint tests must pass

---

### 7. User Flows

#### 7.1 Safe Swap Flow

1.  User invokes OpenClaw swap skill
2.  Skill generates TxIntent
3.  ISCL builds transaction
4.  Preflight simulation runs
5.  Approval request shown
6.  User confirms
7.  Transaction signed and sent
8.  Receipt logged

#### 7.2 Skill Installation Flow

1.  User installs signed crypto skill
2.  Manifest verified
3.  Scanner runs
4.  Permissions shown
5.  User confirms installation

---

### 8. Milestones & Timeline

#### Milestone 1 — Core API & Schemas (Week 1–2)

*   ISCL API skeleton
*   TxIntent schema
*   Validation pipeline

#### Milestone 2 — Wallet & Policy Engine (Week 2–3)

*   Secure keystore
*   Signing policies
*   Approval CLI

#### Milestone 3 — Transaction Engine (Week 3–5)

*   Swap support
*   Preflight simulation
*   Risk scoring

#### Milestone 4 — Sandbox Runtime (Week 4–6)

*   Container isolation
*   Network/fs policies
*   Trace logging

#### Milestone 5 — Skill Packaging (Week 5–6)

*   Signed packages
*   Scanner
*   Registry

#### Milestone 6 — OpenClaw Integration (Week 6–7)

*   Thin skills
*   Installation workflow
*   Compatibility tests

#### Milestone 7 — Release Candidate (Week 8)

*   Security audit pass
*   Documentation
*   Public beta

---

### 9. Acceptance Criteria

*   All security tests pass
*   Swap works end-to-end on testnet
*   No direct key access from skills
*   Sandbox blocks unauthorized actions
*   Approval flow mandatory
*   Audit logs complete
*   Compatibility CI green

---

### 10. Risks

*   OpenClaw API instability
*   Sandbox escape vulnerabilities
*   User UX friction from approvals
*   RPC reliability issues

**Mitigation:** compatibility tests, minimal integration surface, fallback UI, multi-RPC option.

---

### 11. Future Extensions (Post v0.1)

*   Smart accounts
*   Session keys
*   Multi-chain support
*   Nanoclaw executor integration
*   Reputation layer
*   On-chain attestations

---

### 12. Deliverables

*   ISCL Core service
*   Sandbox executor
*   Skill registry
*   OpenClaw adapter
*   Documentation
*   Security test suite
*   Demo crypto skills