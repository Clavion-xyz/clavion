# Engineering Task Breakdown — ISCL v0.1

## Decisions & Constraints

| Decision | Value | Rationale |
|---|---|---|
| Target chain | Base (chainId 8453) | Low fees, growing DeFi ecosystem |
| DEX router | Uniswap V3 on Base | Dominant liquidity, well-documented ABI |
| Test RPC | Anvil local fork only | Deterministic, free, CI-friendly |
| Production RPC | Config parameter (`rpcUrl`) | Operator chooses provider |
| Module resolution | Node16 (ESM) | Strict `.js` imports, `createRequire` for CJS deps |
| Schema validation | AJV strict, `additionalProperties: false` | No undocumented fields |
| Keystore encryption | scrypt + AES-256-GCM | Industry standard, same as Ethereum keystores |
| Approval tokens | Single-use, TTL-bound, intent-pinned | Prevents replay and reuse |
| Sandbox (v0.1) | Docker, `--network none`, read-only rootfs | Minimal attack surface |

---

## Cross-Epic Dependency Graph

```
Epic 1 (DONE) ──→ Epic 2 (DONE) ──→ Epic 3 (DONE) ──→ Epic 7
                                        │
                                   Epic 4 (DONE) ──→ Epic 7
                                        │
                                   Epic 5 (DONE) ──→ Epic 6 (DONE) ──→ Epic 7
```

- **Epic 1** (Core API & Schemas) — prerequisite for everything
- **Epic 2** (Wallet & Policy) — requires schema validation from Epic 1
- **Epic 3** (Transaction Engine) — requires wallet signing + policy from Epic 2
- **Epic 4** (Sandbox) — can start in parallel with late Epic 3, needs API from Epic 1
- **Epic 5** (Skill Packaging) — can start in parallel with Epic 3/4
- **Epic 6** (OpenClaw Adapter) — requires working API from Epic 3 + manifests from Epic 5
- **Epic 7** (Release) — requires all other epics complete

---

## Phase 0 — Project Scaffolding ✅ COMPLETE

- ✅ Repository init (git, `.gitignore`)
- ✅ `package.json` (ESM, Node 20+, all dependencies)
- ✅ `tsconfig.json` (strict, ES2022, Node16 module resolution)
- ✅ `vitest.config.ts` (test runner configuration)
- ✅ `eslint.config.mjs` + `.prettierrc` (linting & formatting)
- ✅ `.github/workflows/test.yml` (CI: lint + typecheck + unit/integration tests)
- ✅ Directory structure: `core/`, `spec/`, `tests/`, `sandbox/`, `adapter/`, `doc/`
- ✅ TypeScript types: `core/types.ts` — TxIntent, ActionObject, PolicyDecision, AuditEvent (113 lines)
- ✅ Error response schema: `spec/schemas/error-response-schema.ts`

---

## Epic 1 — Core API & Schemas ✅ COMPLETE

### Ticket 1.1 — Implement TxIntent schema validation ✅

- ✅ JSON schema validator (AJV strict mode + formats) — `spec/schemas/txintent-schema.ts` (128 lines)
- ✅ Validator wrapper — `core/schemas/validator.ts` (29 lines, `createRequire` pattern for CJS interop)
- ✅ Fixtures: 4 valid (`spec/fixtures/valid-intents.ts`) — transfer, approve, swap_exact_in, swap_exact_out
- ✅ Fixtures: 8 invalid (`spec/fixtures/invalid-intents.ts`) — missingAction, unknownField, wrongVersion, badAddress, nonNumericAmount, negativeDeadline, unknownActionType, extraActionField
- ✅ Fixture index with barrel exports (`spec/fixtures/index.ts`)
- ✅ Unit tests: 15 schema tests passing (`tests/unit/schema-validation.test.ts`)
  **DoD:** ✅ All fixtures validate correctly, 15 schema tests pass

### Ticket 1.2 — Implement ISCL API skeleton ✅

- ✅ HTTP server scaffold (Fastify 5) — `core/api/app.ts` with custom AJV, X-ISCL-Version header
- ✅ Versioned routing (`/v1/`)
- ✅ Health endpoint — `core/api/routes/health.ts` returns `{ status, version, uptime }`
- ✅ Stub routes for all `/v1/tx/*` endpoints (return 501) — `core/api/routes/tx.ts` (build, preflight, approve-request, sign-and-send, tx/:hash)
- ✅ Server entry point — `core/main.ts` (localhost:3100, configurable via ISCL_PORT/ISCL_HOST)
- ✅ AuditTraceService — `core/audit/audit-trace-service.ts` (SQLite, WAL mode, indexed, 71 lines)
- ✅ PolicyEngine stub — `core/policy/policy-engine.ts` (always returns `require_approval`)
- ✅ Integration tests: 2 health tests (`tests/integration/health.test.ts`)
- ✅ Integration tests: 5 tx validation tests (`tests/integration/tx-build-validation.test.ts`)
- ✅ Unit tests: 5 audit trace tests (`tests/unit/audit-trace.test.ts`)
- ✅ Unit tests: 4 policy stub tests (`tests/unit/policy-engine.test.ts`)
  **DoD:** ✅ `/health` returns version + status, stubs return 501

### Ticket 1.3 — Canonical JSON hashing ✅

- ✅ JCS + keccak256 canonicalizer — `core/canonicalize/intent-hash.ts` (21 lines, `createRequire` for CJS)
- ✅ Hash test vectors for all 4 action types — `spec/fixtures/hash-fixtures.ts` (pre-computed)
- ✅ Hash generator script — `spec/fixtures/generate-hashes.ts`
- ✅ Unit tests: 8 canonicalization tests (`tests/unit/canonicalization.test.ts`) — hash matches, determinism, collision resistance, format
  **DoD:** ✅ Hashes match pre-computed fixtures, 8 canonicalization tests pass

**Status:** ✅ 39 tests passing (15 schema + 8 hash + 5 audit + 4 policy + 2 health + 5 tx validation). Phase 0 + Epic 1 complete.

---

## Epic 2 — Wallet & Policy Engine ✅ COMPLETE

**Depends on:** Epic 1 (schema validation, API skeleton)

### Ticket 2.1 — Encrypted keystore ✅

Create the persistent encrypted key storage layer.

**Subtasks:**
- ✅ Create `core/wallet/keystore.ts` with `EncryptedKeystore` class
- ✅ Implement scrypt KDF + AES-256-GCM encrypt/decrypt cycle
- ✅ Store encrypted keys at `~/.iscl/keystore/` (configurable path via `basePath`)
- ✅ Implement `keystore.json` metadata file (addresses, profiles — no secrets)
- ✅ Add key generation: `generateKey(passphrase, profile) → address`
- ✅ Add key import: `importKey(privateKey, passphrase, profile) → address`
- ✅ Add unlock/lock lifecycle: `unlock(address, passphrase)` / `lock(address)`
- ✅ Unlocked keys held in memory only, never written to disk unencrypted
- Add wipe-on-process-exit safety (clear key material from memory) — deferred to hardening

**Key interfaces:**
```typescript
interface EncryptedKey {
  address: string;
  profile: string;
  cipher: "aes-256-gcm";
  kdf: "scrypt";
  kdfParams: { n: number; r: number; p: number; salt: string };
  ciphertext: string;  // hex
  iv: string;          // hex
  mac: string;         // hex
}

class EncryptedKeystore {
  constructor(basePath: string);
  async generate(passphrase: string, profile?: string): Promise<string>; // returns address
  async importKey(privateKey: `0x${string}`, passphrase: string, profile?: string): Promise<string>;
  async unlock(address: string, passphrase: string): Promise<void>;
  lock(address: string): void;
  getUnlockedKey(address: string): `0x${string}`; // throws if locked
  listAddresses(): string[];
}
```

**Dependencies:** None (Epic 1 complete)

**DoD:**
- ✅ Keys persist across restarts and decrypt correctly
- ✅ Wrong passphrase throws clear error
- ✅ Unlocked key is usable for signing (viem `privateKeyToAccount`)
- ✅ Key material never appears in logs or API responses
- ✅ Unit tests: 13 tests passing (`tests/unit/keystore.test.ts`) — generate, import, unlock/lock, wrong passphrase, list addresses, duplicate import, persistence across reload

---

### Ticket 2.2 — WalletService signing pipeline ✅

Single entry point for all signing operations with mandatory policy + approval checks.

**Subtasks:**
- ✅ Create `core/wallet/wallet-service.ts` with `WalletService` class
- ✅ Implement single `sign(request: SignRequest): Promise<SignedTransaction>` method
- ✅ Enforce: every call requires a `PolicyDecision` (no bypass path)
- ✅ Enforce: if decision is `require_approval`, valid `ApprovalToken` required
- ✅ Consume approval token on use (delegate to ApprovalTokenManager)
- ✅ Use viem `signTransaction` with unlocked key from keystore
- ✅ Log `signature_created` audit event with intentId, txRequestHash, signerAddress
- ✅ Log `signing_denied` audit event if policy/approval check fails
- ✅ No `signRaw` or `signArbitrary` methods — only typed TxIntent-derived transactions

**Key interfaces:**
```typescript
interface SignRequest {
  intentId: string;
  walletAddress: string;
  txRequest: TransactionRequest;     // viem TransactionRequest
  txRequestHash: string;
  policyDecision: PolicyDecision;
  approvalToken?: ApprovalToken;
}

interface SignedTransaction {
  signedTx: `0x${string}`;
  txHash: `0x${string}`;
}

class WalletService {
  constructor(keystore: EncryptedKeystore, approvalTokenManager: ApprovalTokenManager, audit: AuditTraceService);
  async sign(request: SignRequest): Promise<SignedTransaction>;
}
```

**Dependencies:** Ticket 2.1 (keystore), Ticket 2.4 (ApprovalTokenManager)

**DoD:**
- ✅ Signing succeeds with valid policy decision + approval token
- ✅ Signing throws without PolicyDecision
- ✅ Signing throws with `deny` PolicyDecision
- ✅ Signing throws with expired/consumed ApprovalToken
- ✅ `signature_created` event appears in audit trail
- ✅ SecurityTest_B2: no path exists to call sign without PolicyDecision
- ✅ Unit tests: 12 tests passing (`tests/unit/wallet-service.test.ts`)

---

### Ticket 2.3 — Approval CLI ✅

Human confirmation flow that displays transaction summary and collects explicit user consent.

**Subtasks:**
- ✅ Create `core/approval/approval-service.ts` with `ApprovalService` class
- ✅ Implement `requestApproval(summary: ApprovalSummary): Promise<ApprovalResult>` method
- ✅ Build summary renderer: human-readable text from ApprovalSummary (action, amounts, risk, warnings)
- ✅ Display: action description, balance diffs, risk score + reasons, gas estimate, warnings
- ✅ Collect explicit confirmation (injectable `promptFn` for testability, readline for production)
- ✅ On approval: issue ApprovalToken via ApprovalTokenManager
- ✅ On rejection: log `approval_rejected` audit event, return rejection
- ✅ Log `approval_granted` audit event with intentId

**Key interfaces:**
```typescript
interface ApprovalSummary {
  intentId: string;
  action: string;              // "Swap 100 USDC → WETH via Uniswap V3"
  recipient?: string;          // for transfers
  spender?: string;            // for approvals
  expectedOutcome: string;     // "Receive ≥ 0.05 WETH"
  balanceDiffs: BalanceDiff[];
  riskScore: number;
  riskReasons: string[];
  warnings: string[];
  gasEstimateEth: string;      // human-readable gas cost
}

class ApprovalService {
  constructor(tokenManager: ApprovalTokenManager, audit: AuditTraceService);
  async requestApproval(summary: ApprovalSummary): Promise<{ approved: boolean; token?: ApprovalToken }>;
}
```

**Dependencies:** Ticket 2.4 (ApprovalTokenManager), Ticket 3.6 (PreflightService — for summary data)

**DoD:**
- ✅ Approval summary renders correctly (action, balance diffs, risk, warnings, gas)
- ✅ User confirmation issues a valid ApprovalToken
- ✅ User rejection logs `approval_rejected` event
- ✅ Signing blocked without approval (integration with WalletService)
- SecurityTest_A3: approval text comes from ISCL build+preflight, not from skill — deferred to Epic 3
- ✅ Unit tests: 9 tests passing (`tests/unit/approval-service.test.ts`)

---

### Ticket 2.4 — ApprovalTokenManager ✅

Issue, validate, and consume single-use approval tokens with TTL.

**Subtasks:**
- ✅ Create `core/approval/approval-token-manager.ts`
- ✅ Implement `issue(intentId, txRequestHash, ttlSeconds): ApprovalToken`
- ✅ Implement `validate(tokenId, intentId, txRequestHash): boolean`
- ✅ Implement `consume(tokenId): void` — marks as consumed, cannot be reused
- ✅ Store tokens in SQLite (own DB connection, WAL mode)
- ✅ Enforce TTL: reject expired tokens
- ✅ Enforce single-use: reject consumed tokens
- ✅ Enforce binding: token must match intentId + txRequestHash
- ✅ Add periodic cleanup of expired tokens

**Key interfaces:**
```typescript
interface ApprovalToken {
  id: string;            // UUID
  intentId: string;      // bound to specific intent
  txRequestHash: string; // bound to specific built tx
  issuedAt: number;      // unix timestamp
  ttlSeconds: number;    // default 300 (5 minutes)
  consumed: boolean;
}

class ApprovalTokenManager {
  constructor(db: Database);
  issue(intentId: string, txRequestHash: string, ttlSeconds?: number): ApprovalToken;
  validate(token: ApprovalToken, intentId: string, txRequestHash: string): boolean;
  consume(tokenId: string): void;
  cleanup(): void; // remove expired tokens
}
```

**Dependencies:** AuditTraceService (from Epic 1, for DB access pattern)

**DoD:**
- ✅ Token issue → validate → consume lifecycle works
- ✅ Expired token rejected
- ✅ Consumed token rejected (no replay)
- ✅ Token bound to wrong intentId rejected
- ✅ Token bound to wrong txRequestHash rejected
- ✅ SecurityTest_B3: approval token cannot be reused
- ✅ Unit tests: 10 tests passing (`tests/unit/approval-token-manager.test.ts`)

---

## Epic 3 — Transaction Engine & Preflight ✅ COMPLETE

**Depends on:** Epic 2 (wallet signing, policy engine, approval tokens)

### Ticket 3.1 — PolicyEngine full implementation ✅

Replace the Phase 1 stub with a real rule-based policy evaluator.

**Subtasks:**
- ✅ Refactor `core/policy/policy-engine.ts` from stub to full implementation (~170 lines)
- ✅ Implement check matrix: value limits, approval amount limits, contract allowlist, token allowlist, chain restriction, recipient restriction, risk score threshold
- Rate limiting — deferred (needs stateful counter)
- ✅ Every check returns a reason string if triggered
- ✅ Unknown action types → `deny` by default
- ✅ Missing config fields → conservative defaults (deny-by-default)
- ✅ `evaluate()` is a pure function: takes intent + config + options, returns decision
- ✅ Log `policy_evaluated` audit event with decision, reasons, policyVersion

**Key interfaces:**
```typescript
// Already exists in core/types.ts:
interface PolicyDecision {
  decision: "allow" | "deny" | "require_approval";
  reasons: string[];
  policyVersion: string;
}

// New: full evaluate signature
function evaluate(
  intent: TxIntent,
  config: PolicyConfig
): PolicyDecision;
```

**Policy check matrix:**

| Check | Config Key | Failure → |
|---|---|---|
| Value exceeds limit | `maxValueWei` | deny |
| MaxUint approval | `maxApprovalAmount` | deny |
| Unknown contract | `contractAllowlist` | deny |
| Unknown token | `tokenAllowlist` | deny |
| Disallowed chain | `allowedChains` | deny |
| Unknown recipient | `recipientAllowlist` | deny (if list non-empty) |
| Risk score above max | `maxRiskScore` | require_approval |
| Rate limit exceeded | `maxTxPerHour` | deny |
| Value above threshold | `requireApprovalAbove.valueWei` | require_approval |

**Dependencies:** Epic 1 (TxIntent types)

**DoD:**
- ✅ Each policy check has unit tests (allow + deny cases) — 16 tests
- ✅ `deny` decisions always have non-empty `reasons`
- Unknown action type → deny — deferred (all known types handled)
- ✅ Missing config → conservative defaults
- ✅ SecurityTest_A4: policy denies bad intents
- ✅ SecurityTest_B4: bounded approval amounts enforced

---

### Ticket 3.2 — Policy config loader ✅

Load, validate, and provide policy configuration from JSON file.

**Subtasks:**
- ✅ Create `core/policy/policy-config.ts` (~95 lines)
- ✅ Define `PolicyConfig` TypeScript interface (in `core/types.ts`)
- ✅ Define AJV schema for policy JSON (strict, no additionalProperties)
- ✅ Implement `loadPolicyConfig(path): PolicyConfig` — reads + validates JSON
- ✅ Implement `getDefaultConfig(): PolicyConfig` — conservative defaults for missing file
- ✅ Conservative defaults: maxValueWei "0", empty allowlists (deny-all), approval required for everything
- Support config reload without restart — deferred to v0.2
- Config path: configurable via `policyConfigPath` in AppOptions

**Key interfaces:**
```typescript
interface PolicyConfig {
  version: "1";
  maxValueWei: string;                     // numeric string, e.g. "1000000000000000000"
  maxApprovalAmount: string;               // bounded, deny MaxUint
  contractAllowlist: string[];             // 0x-prefixed addresses
  tokenAllowlist: string[];                // 0x-prefixed addresses
  allowedChains: number[];                 // e.g. [8453]
  recipientAllowlist?: string[];           // optional, if empty = allow all
  maxRiskScore: number;                    // 0-100
  requireApprovalAbove: {
    valueWei: string;
  };
  maxTxPerHour: number;
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
}
```

**Dependencies:** None (standalone module)

**DoD:**
- ✅ Valid JSON loads and returns typed config
- ✅ Invalid JSON returns validation errors
- ✅ Missing file returns conservative defaults
- ✅ Unknown fields rejected (additionalProperties: false)
- ✅ Unit tests: 9 tests (`tests/unit/policy-config.test.ts`)

---

### Ticket 3.3 — Transfer builder ✅

Build ERC20 transfer transactions using viem for Base chain.

**Subtasks:**
- ✅ Create `core/tx/builders/transfer-builder.ts` (~45 lines)
- ✅ Accept TxIntent with `action.type === "transfer"`
- ✅ Build viem `TransactionRequest` for ERC20 `transfer(to, amount)` call
- Handle native ETH transfers (if `asset.kind === "native"`) — deferred (ERC20 only for v0.1)
- ✅ Encode calldata using viem `encodeFunctionData` with ERC20 ABI
- ✅ Return `BuildPlan` with populated tx fields (to, data, value, chainId)
- ✅ Shared utility `computeTxRequestHash()` in `core/tx/builders/build-utils.ts`

**Key interfaces:**
```typescript
interface BuildPlan {
  intentId: string;
  txRequest: {
    to: `0x${string}`;
    data?: `0x${string}`;
    value?: bigint;
    chainId: number;
    gas?: bigint;
  };
  txRequestHash: string;    // keccak256 of canonical txRequest
  description: string;      // "Transfer 1000000 USDC to 0xabc..."
}

function buildTransfer(intent: TxIntent): BuildPlan;
```

**Dependencies:** Epic 1 (TxIntent types, canonicalization)

**DoD:**
- ✅ ERC20 transfer calldata matches expected encoding (selector `0xa9059cbb`)
- Native ETH transfer — deferred to v0.2
- ✅ Throws for wrong action type
- ✅ Unit tests: 7 tests (`tests/unit/transfer-builder.test.ts`)

---

### Ticket 3.4 — Approve builder ✅

Build ERC20 approve transactions with bounded approval policy enforcement.

**Subtasks:**
- ✅ Create `core/tx/builders/approve-builder.ts` (~50 lines)
- ✅ Accept TxIntent with `action.type === "approve"`
- ✅ Build viem `TransactionRequest` for ERC20 `approve(spender, amount)` call
- ✅ MaxUint256 detection → "UNLIMITED" in description
- ✅ Return `BuildPlan` with description: "Approve {amount} {token} for {spender}"

**Key interfaces:**
```typescript
function buildApprove(intent: TxIntent): BuildPlan;
```

**Dependencies:** Ticket 3.3 (shared BuildPlan interface), Epic 1

**DoD:**
- ✅ Approve calldata matches expected encoding (selector `0x095ea7b3`)
- ✅ MaxUint256 approval detected and flagged
- ✅ Bounded approval amount encoded correctly
- ✅ Unit tests: 5 tests (`tests/unit/approve-builder.test.ts`)
- ✅ SecurityTest_B4: MaxUint approval denied by default policy

---

### Ticket 3.5 — Swap builder (Uniswap V3 on Base) ✅

Build swap transactions targeting Uniswap V3 SwapRouter on Base.

**Subtasks:**
- ✅ Create `core/tx/builders/swap-builder.ts` (~110 lines)
- ✅ Accept TxIntent with `action.type === "swap_exact_in"` or `"swap_exact_out"`
- ✅ Encode Uniswap V3 `exactInputSingle` / `exactOutputSingle` calldata (SwapRouter02 ABI)
- ✅ Hard-code Uniswap V3 SwapRouter02 address for Base (`0x2626...e481`)
- ✅ Validate: router matches known address
- ✅ Use `minAmountOut` / `maxAmountIn` from intent directly (slippage pre-computed by caller)
- Deadline via multicall — deferred to v0.2 (SwapRouter02 struct has no deadline field)
- ✅ Fee tier hardcoded at 3000 (0.3%) for v0.1
- ✅ Return `BuildPlan` with description: "Swap {amountIn} {tokenIn} → {tokenOut} via Uniswap V3"

**Key interfaces:**
```typescript
function buildSwap(intent: TxIntent): BuildPlan;

// Constants
const UNISWAP_V3_ROUTER_BASE = "0x2626664c2603336E57B271c5C0b26F421741e481";
const KNOWN_ROUTERS: Record<string, string> = {
  uniswapV3Base: UNISWAP_V3_ROUTER_BASE,
};
```

**Dependencies:** Ticket 3.3 (shared BuildPlan), Epic 1

**DoD:**
- ✅ `exactInputSingle` calldata matches expected ABI encoding (selector `0x04e45aaf`)
- ✅ `exactOutputSingle` calldata matches expected ABI encoding (selector `0x5023b4df`)
- ✅ Unknown router address rejected
- ✅ Unit tests: 8 tests (`tests/unit/swap-builder.test.ts`)

---

### Ticket 3.6 — PreflightService ✅

Simulate transactions and compute balance diffs, gas estimates, and detect reverts.

**Subtasks:**
- ✅ Create `core/preflight/preflight-service.ts` (~180 lines)
- ✅ Implement multi-layer simulation:
  1. Balance reads: `readBalance` before
  2. Allowance reads: `readAllowance` before/after
  3. Gas estimate: `estimateGas`
  4. Simulation: `call` with full tx to detect reverts
- ✅ Create `RpcClient` interface (`core/rpc/rpc-client.ts`) — interface only, real viem client deferred to Epic 7
- ✅ Tests use mock `RpcClient` with predetermined responses
- ✅ Return `PreflightResult` with balanceDiffs, gasEstimate, simulationSuccess, revertReason
- ✅ Risk score computed via `computeRiskScore()` integration

**Key interfaces:**
```typescript
interface PreflightResult {
  intentId: string;
  simulationSuccess: boolean;
  revertReason?: string;
  gasEstimate: string;
  balanceDiffs: BalanceDiff[];
  allowanceChanges: AllowanceChange[];
  riskScore: number;
  riskReasons: string[];
  warnings: string[];
  rpcSource: string;
}

interface BalanceDiff {
  token: string;       // address or "ETH"
  symbol?: string;
  before: string;
  after: string;
  delta: string;       // signed
}

interface AllowanceChange {
  token: string;
  spender: string;
  before: string;
  after: string;
}

class PreflightService {
  constructor(rpcClient: RpcClient, audit: AuditTraceService);
  async simulate(intent: TxIntent, buildPlan: BuildPlan): Promise<PreflightResult>;
}
```

**Dependencies:** Ticket 3.3–3.5 (BuildPlan from builders), Epic 1

**DoD:**
- ✅ Balance diffs computed correctly for transfers
- ✅ Gas estimate returned for valid transactions
- ✅ Reverted transactions detected with reason string
- ✅ Unit tests: 11 tests (`tests/unit/preflight-service.test.ts`) — mock RPC
- Audit event `preflight_completed` — logged in route handler (Ticket 3.8)

---

### Ticket 3.7 — Risk scoring algorithm ✅

Rule-based risk scorer that produces a 0–100 score with human-readable reasons.

**Subtasks:**
- ✅ Create `core/preflight/risk-scorer.ts` (~65 lines)
- ✅ Implement additive scoring rules:
  - Contract not in allowlist: +40
  - Token not in allowlist: +20
  - High slippage (> 300 bps): +15
  - Large value relative to limit (> 50% of maxValueWei): +20
  - Unbounded approval (MaxUint or > 10x max): +25
  - Simulation reverted: +50
  - Abnormal gas estimate (> 400,000): +10
- ✅ Cap at 100
- ✅ Return score + array of reason strings for each triggered rule

**Key interfaces:**
```typescript
interface RiskContext {
  contractNotInAllowlist: boolean;
  tokenNotInAllowlist: boolean;
  highSlippage: boolean;
  largeValueRelativeToBalance: boolean;
  approvalIsUnbounded: boolean;
  simulationReverted: boolean;
  gasEstimateAbnormal: boolean;
}

function computeRiskScore(context: RiskContext): { score: number; reasons: string[] };
```

**Dependencies:** Ticket 3.6 (PreflightResult data feeds into risk context)

**DoD:**
- ✅ Each rule triggers at correct threshold
- ✅ Score capped at 100
- ✅ Every non-zero contribution has a corresponding reason string
- ✅ Zero-risk context → score 0, empty reasons
- ✅ Unit tests: 11 tests (`tests/unit/risk-scorer.test.ts`)

---

### Ticket 3.8 — Wire up API routes ✅

Replace stub 501 responses with real transaction engine flow.

**Subtasks:**
- ✅ Rewrite `core/api/routes/tx.ts` with `createTxRoutes(services)` closure pattern
- ✅ Create `core/tx/builders/index.ts` — builder dispatcher (`buildFromIntent`)
- ✅ `POST /v1/tx/build`: validate intent → policy check → build → 200 BuildPlan / 403 deny
- ✅ `POST /v1/tx/preflight`: build → simulate → 200 PreflightResult / 502 (no RPC)
- ✅ `POST /v1/tx/approve-request`: build → preflight (if available) → policy → 200 summary / 403 deny
- ✅ `POST /v1/tx/sign-and-send`: validate → policy → resolve token → sign → 200 signed / 403 error
- `GET /v1/tx/:hash`: 501 stub — deferred (needs RPC for receipt lookup)
- ✅ Update `core/api/app.ts` with `policyConfig`, `policyConfigPath`, `rpcClient` options
- ✅ `serializeBuildPlan()` helper for BigInt → string JSON serialization
- ✅ Hoist TxIntentSchema `$defs` to wrapper root for sign-and-send nested schema
- ✅ Error responses: 400 (validation), 403 (policy denied), 502 (no RPC)
- ✅ Audit events: `policy_evaluated`, `tx_built`, `preflight_completed`, `approve_request_created`

**Dependencies:** Tickets 3.1–3.7 (all engine components), Epic 2 (wallet + approval)

**DoD:**
- ✅ 4 of 5 routes return real responses (`GET /tx/:hash` remains 501)
- ✅ Valid swap intent → 200 with BuildPlan from `/tx/build`
- ✅ Policy-denied intent → 403 from `/tx/build`
- ✅ Invalid intent → 400 from `/tx/build`
- ✅ Integration tests: 13 tests (`tests/integration/tx-build-validation.test.ts` + `health.test.ts`)
- Full E2E flow (build → preflight → approve → sign) — deferred to Epic 7 (needs RPC)

**Status:** ✅ 152 tests passing (139 unit + 13 integration). Phase 0 + Epic 1 + Epic 2 + Epic 3 complete.

---

## Epic 4 — Sandbox Executor ✅ COMPLETE

**Depends on:** Epic 1 (API server for sandbox → Core communication)

### Ticket 4.1 — SandboxRunner interface + Docker implementation ✅

Container lifecycle management for running untrusted skill code.

**Subtasks:**
- ✅ Create `sandbox/sandbox-runner.ts` with `SandboxRunner` interface + `DockerSandboxRunner` class (~120 lines)
- ✅ Implement `run(input: SkillInput): Promise<SkillOutput>` via `child_process.execFile("docker", [...])`
- ✅ Implement `isAvailable(): Promise<boolean>` — checks Docker via `docker info`
- ✅ Docker run flags: `--rm`, `--network none`, `--read-only`, `--memory`, `--cpus 0.5`, `--tmpfs /tmp:rw,noexec,size=64m`, `--security-opt no-new-privileges`, `--cap-drop ALL`
- ✅ Pass `ISCL_API_URL` + `ISCL_SKILL_NAME` as only env vars — never mount key material
- ✅ Enforce timeout: kill container via `process.kill()` after `manifest.sandbox.timeoutMs`
- ✅ Capture stdout/stderr from container, return structured `SkillOutput`
- ✅ Create `sandbox/index.ts` barrel export

**Key interfaces:**
```typescript
interface SandboxConfig {
  image: string;
  networkMode: "none" | "allowlist";
  allowedHosts?: string[];
  readOnlyRootfs: true;
  memoryLimitMb: number;
  cpuQuota: number;
  timeoutMs: number;
  noSpawn: boolean;
  env: Record<string, string>;   // NEVER includes key material
}

interface SkillInput {
  action: string;
  params: Record<string, unknown>;
}

interface SkillOutput {
  success: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
}

class SandboxRunner {
  constructor(audit: AuditTraceService);
  async run(manifest: SkillManifest, input: SkillInput): Promise<SkillOutput>;
}
```

**Dependencies:** Epic 1 (API server), Docker runtime available

**DoD:**
- ✅ Container starts, executes skill code, returns output
- ✅ Container destroyed after completion (`--rm`)
- ✅ Timeout enforced: long-running container killed
- ✅ `sandbox_started` / `sandbox_completed` / `sandbox_error` audit events logged

---

### Ticket 4.2 — Network + filesystem + process isolation enforcement ✅

Harden container security beyond basic Docker defaults.

**Subtasks:**
- ✅ Network: `--network none` by default
- ✅ Filesystem: read-only rootfs, ephemeral `/tmp` only (noexec)
- ✅ Process: `no_spawn` enforcement — seccomp profile `sandbox/seccomp-no-spawn.json` blocks `clone`/`clone3`/`fork`/`vfork`/`execve`/`execveat`
- ✅ Resources: cgroup limits from `manifest.sandbox.memoryMb` and CPU quota (0.5 CPUs)
- ✅ No new privileges: `--security-opt no-new-privileges`
- ✅ Drop all capabilities: `--cap-drop ALL`

**Dependencies:** Ticket 4.1 (SandboxRunner)

**DoD:**
- ✅ Container has no network access (verified: C1 test)
- ✅ Filesystem is read-only (verified: C2 test)
- ✅ Process spawn blocked when `noSpawn` is true (seccomp: C3 test)
- ✅ Memory limit enforced (cgroup limits: C4 test)

---

### Ticket 4.3 — Execution tracing (sandbox events → AuditTrace) ✅

Log all sandbox activity to the audit trail for forensic analysis.

**Subtasks:**
- ✅ Log `sandbox_started` event (skillName, memoryMb, networkMode)
- ✅ Log `sandbox_completed` event (exitCode, durationMs)
- ✅ Log `sandbox_error` event (error message, exitCode) for non-zero exit or timeout
- ✅ Log `security_violation` for detected escape attempts
- ✅ All events correlated by `intentId: "sandbox"` + `skillName`
- `sandbox_api_call` middleware — deferred to Epic 7 (needs API-level tracing)

**Dependencies:** Ticket 4.1, AuditTraceService (Epic 1)

**DoD:**
- ✅ Full sandbox lifecycle visible in audit trail
- ✅ Abnormal termination (timeout, error) logged with details
- ✅ Verified via security tests (audit trail assertions)

---

### Ticket 4.4 — Sandbox security tests ✅

Implement Domain C security tests from the threat model.

**Subtasks:**
- ✅ Create `tests/helpers/docker-check.ts` — `isDockerAvailable()` utility
- ✅ Create `tests/security/sandbox-isolation.test.ts` — 8 tests with `describe.skipIf(!dockerAvailable)`
- ✅ `C1: Network isolation` — Skill tries `curl` → `--network none` blocks outbound
- ✅ `C2: Filesystem read-only` — Skill tries `touch /test-write` → `--read-only` blocks writes
- ✅ `C3: No spawn` — Seccomp blocks fork/exec syscalls
- ✅ `C4: Memory limit` — Container runs with enforced memory cgroup limit
- ✅ `Timeout enforcement` — Container killed after timeoutMs
- ✅ `Clean exit` — stdout/stderr captured, exitCode 0
- ✅ `Audit trail` — sandbox events recorded
- ✅ Create 3 test Dockerfiles: `Dockerfile.network-test`, `Dockerfile.fs-test`, `Dockerfile.spawn-test`

**Dependencies:** Tickets 4.1–4.3 (full sandbox implementation)

**DoD:**
- ✅ All 8 security tests implemented (skip gracefully when Docker unavailable)
- ✅ Each test verifies the attack vector is blocked
- ✅ Tests run in CI when Docker is available

---

## Epic 5 — Skill Packaging ✅ COMPLETE

**Depends on:** Epic 1 (canonicalization for manifest signing)

### Ticket 5.1 — SkillManifest v1 schema + validator ✅

Define and validate skill package descriptors.

**Subtasks:**
- ✅ Create `spec/schemas/skill-manifest-schema.ts` with AJV schema (~80 lines)
- ✅ Schema enforces: `additionalProperties: false` on all objects, `version` const `"1"`, `name` pattern `^[a-z0-9-]+$`, publisher `address` pattern `^0x[0-9a-fA-F]{40}$`, `contact` format `email`, `txActions` enum, sandbox limits (memoryMb 1–512, timeoutMs 1000–60000), files minItems 1, `sha256` pattern `^[0-9a-f]{64}$`
- ✅ Create `core/skill/manifest-validator.ts` with `validateManifest()` function (~30 lines)
- ✅ Create `spec/fixtures/skill-manifests.ts` — validManifest + 10 invalidManifests
- ✅ Add SkillManifest + SandboxConfig + SkillInput/Output + ScanFinding/ScanReport types to `core/types.ts`
- ✅ Update `spec/fixtures/index.ts` with manifest fixture exports

**Dependencies:** Epic 1 (AJV patterns)

**DoD:**
- ✅ Valid manifests pass validation
- ✅ Missing/extra fields rejected
- ✅ Permission values validated (known action types only)
- ✅ Sandbox limits within safe thresholds enforced
- ✅ Unit tests: 11 tests (`tests/unit/manifest-validator.test.ts`)

---

### Ticket 5.2 — Manifest signing and verification ✅

ECDSA signing and verification for skill package integrity.

**Subtasks:**
- ✅ Create `core/skill/manifest-signer.ts` (~65 lines)
- ✅ Implement `computeManifestHash()`: remove `signature` field → JCS canonicalize → keccak256
- ✅ Implement `signManifest()`: compute hash → ECDSA sign with `sign()` from `viem/accounts` → attach signature
- ✅ Implement `verifyManifest()`: compute hash → `recoverAddress()` from `viem` → compare to `publisher.address`
- ✅ Create `core/skill/file-hasher.ts` (~30 lines): `hashFile()` (SHA-256, node:crypto) + `verifyFileHashes()` (batch verify)
- ✅ Reuses JCS + keccak256 pattern from `core/tx/builders/build-utils.ts`

**Dependencies:** Ticket 5.1 (manifest schema), Epic 1 (canonicalization)

**DoD:**
- ✅ Sign → verify round-trip succeeds
- ✅ Tampered manifest → verification fails
- ✅ Wrong publisher address → verification fails
- ✅ File hash mismatch detected and reported
- ✅ Hash deterministic, signature format correct (0x-prefixed, 132 chars)
- ✅ Unit tests: 11 tests (`tests/unit/manifest-signer.test.ts`)

---

### Ticket 5.3 — Static scanner ✅

Analyze skill code for suspicious patterns before installation.

**Subtasks:**
- ✅ Create `core/skill/static-scanner.ts` (~100 lines)
- ✅ Implement `scanFiles(basePath, filePaths): ScanReport` — line-by-line regex matching
- ✅ 5 rule categories:
  - `dynamic_eval` (error): `eval()`, `new Function()`
  - `child_process` (error): `child_process`, `exec()`, `spawn()`, `execFile()`, `execSync()`, `spawnSync()`
  - `network_access` (error): `fetch()`, `http.`, `https.`, `net.`, `dgram.`, `WebSocket`, `XMLHttpRequest`
  - `fs_write` (warning): `writeFileSync`, `writeFile`, `mkdirSync`, `unlinkSync`, `rmSync`
  - `obfuscation` (warning): hex escape sequences, `atob()`, `Buffer.from(base64)`
- ✅ `passed = true` only if zero error-severity findings; warnings don't fail
- ✅ Create `core/skill/index.ts` barrel export

**Dependencies:** Ticket 5.1 (manifest for permission context)

**DoD:**
- ✅ `eval()` in skill code → error finding (scan fails)
- ✅ `child_process` import → error finding (scan fails)
- ✅ Clean skill code → passed report
- ✅ Findings include file path, line number, rule, severity, message
- ✅ Unit tests: 10 tests (`tests/unit/static-scanner.test.ts`)

**Status:** ✅ Phase 0 + Epics 1–5 complete. 184 tests passing (171 unit + 13 integration) + 8 security tests (skipped without Docker).

---

---

## Epic 6 — OpenClaw Integration ✅ COMPLETE

**Depends on:** Epic 3 (working API), Epic 5 (skill manifests)

### Ticket 6.1 — ISCLClient HTTP library ✅

Shared HTTP client for adapter skills to communicate with ISCL Core.

**Subtasks:**
- ✅ Create `adapter/shared/iscl-client.ts` (~130 lines)
- ✅ Implement methods: `health()`, `txBuild(intent)`, `txPreflight(intent)`, `txApproveRequest(intent)`, `txSignAndSend(payload)`
- ✅ Use Node built-in `fetch` — no extra HTTP dependencies
- ✅ Base URL from `process.env["ISCL_API_URL"]` (bracket notation for `noUncheckedIndexedAccess`), default `http://127.0.0.1:3000`
- ✅ Error handling: throw `ISCLError` with status code + parsed response body
- ✅ Timeout via `AbortController` (configurable, default 10s)
- ✅ No caching of sensitive data, no credential storage
- ✅ Response types defined in adapter domain (not imported from `core/types.ts`) — maintains Domain A/B boundary
- ✅ `ISCLClientOptions` interface for constructor (`baseUrl?`, `timeoutMs?`)
- ✅ Private `get(path)` and `post(path, body)` methods with shared timeout logic
- ✅ Create `adapter/shared/index.ts` barrel export

**Dependencies:** Epic 3 (API routes must return real responses)

**DoD:**
- ✅ Client successfully calls all 5 ISCL endpoints
- ✅ Error responses converted to typed `ISCLError` (status + body)
- ✅ Timeout enforced via AbortController
- ✅ Integration tests against real Fastify app on ephemeral port: 10 tests (`tests/integration/adapter-client.test.ts`)
- ✅ Unit tests: 14 tests (`tests/unit/iscl-client.test.ts`) — constructor defaults, env var fallback, mocked fetch for all 5 methods, ISCLError properties
- ✅ No sensitive data cached or logged

---

### Ticket 6.2 — Thin skill wrappers (4 adapter skills) ✅

OpenClaw-compatible skill wrappers that delegate to ISCL Core.

**Subtasks:**
- ✅ Create `adapter/skills/types.ts` (~50 lines) — `AssetParam`, `BaseSkillParams`, `TransferParams`, `ApproveParams`, `SwapParams`, `BalanceParams`, `SkillResult`
- ✅ Create `adapter/skills/intent-builder.ts` (~40 lines) — `buildIntent()` helper with sensible defaults (chainId=8453, maxGasWei="1000000000000000", deadline=now+600, slippageBps=100, source="openclaw-adapter")
- ✅ Create 4 adapter skills:
  - `adapter/skills/clavion-transfer/index.ts` — `handleTransfer()`: builds `TransferAction`, calls `client.txBuild()`, returns `SkillResult`
  - `adapter/skills/clavion-approve/index.ts` — `handleApprove()`: builds `ApproveAction`, calls `client.txBuild()`, returns `SkillResult`
  - `adapter/skills/clavion-swap/index.ts` — `handleSwap()`: builds `SwapExactInAction`, calls `client.txBuild()`, returns `SkillResult`
  - `adapter/skills/clavion-balance/index.ts` — `handleBalance()`: stub, returns `{ success: false, error: "balance_not_implemented" }` (needs RPC, deferred to v0.2)
- ✅ Each skill: parse params → construct action → `buildIntent()` → `ISCLClient.txBuild()` → return `SkillResult`
- ✅ `ISCLError` caught and returned as `{ success: false, error: err.message }` — no swallowed errors
- ✅ `buildIntent()` imports `TxIntent` type from core (type-only import, no runtime Domain B code)
- ✅ Create `adapter/skills/index.ts` barrel export
- Create SkillManifest v1 for each skill — deferred (requires signed publisher key)

**Dependencies:** Ticket 6.1 (ISCLClient), Epic 5 (manifest schema)

**DoD:**
- ✅ Each skill constructs valid TxIntent from adapter parameters (validated against AJV schema)
- ✅ Error propagation: ISCL 403 → skill returns `{ success: false, error }` to caller
- ✅ Unit tests: 23 tests (`tests/unit/intent-builder.test.ts`) — defaults, custom values, action mapping, AJV schema validation
- ✅ Integration tests: 10 tests (`tests/integration/adapter-skills.test.ts`) — all 4 skills against real Fastify app, error cases, custom options

---

### Ticket 6.3 — Installer + compatibility CI ✅

Automated installation verification.

**Subtasks:**
- ✅ Create `adapter/install.ts` (~30 lines) — `verifyInstallation(baseUrl?)` function
- ✅ Health check: calls `client.health()` to verify ISCL Core is reachable
- ✅ Module resolution: dynamic `import()` of all 4 skill modules to verify they resolve
- ✅ Returns `{ ok: boolean, errors: string[] }` — clear error reporting
- ✅ Create `adapter/index.ts` top-level barrel export (ISCLClient, ISCLError, all handlers, all types, verifyInstallation)
- OpenClaw compatibility CI job — deferred to Epic 7 (requires OpenClaw dependency)
- Matrix testing against pinned + latest OpenClaw — deferred to Epic 7

**Dependencies:** Ticket 6.2 (adapter skills)

**DoD:**
- ✅ Installer verifies ISCL connectivity via health check
- ✅ Installer verifies all skill modules resolve
- ✅ Fails gracefully with descriptive errors if ISCL Core not running
- ✅ Integration test: `verifyInstallation()` succeeds against running server

**Status:** ✅ Phase 0 + Epics 1–6 complete. 241 tests passing (208 unit + 33 integration) + 8 security tests (skipped without Docker).

---

## Epic 7 — Release Engineering ✅ COMPLETE

**Depends on:** All other epics

### Ticket 7.1 — E2E test suite ✅

Full end-to-end flows on Anvil Base fork.

**Subtasks:**
- ✅ Create `tests/e2e/` test directory
- ✅ Create `tests/helpers/anvil-fork.ts` — Anvil fork lifecycle management (`isAnvilAvailable`, `startAnvilFork`, `stop`)
- ✅ Create `core/rpc/viem-rpc-client.ts` — real `RpcClient` implementation using viem `PublicClient` (~90 lines)
- ✅ Wire `ViemRpcClient` in `core/main.ts` from `BASE_RPC_URL` env var
- ✅ Set up Anvil fork of Base mainnet as test fixture (beforeAll: start fork on port 18545, afterAll: stop)
- ✅ Fund test account with USDC via `anvil_setStorageAt` (slot 9, keccak256-hashed storage key)
- ✅ Import + unlock test key (Anvil account 0: `0xac0974bec...`)
- ✅ E2E flow: TxIntent → POST /tx/build → POST /tx/preflight → POST /tx/approve-request → POST /tx/sign-and-send
- ✅ Test 3 action types: transfer, approve, swap_exact_in (on real Anvil Base fork state)
- ✅ Verify audit trail completeness: all lifecycle events present for full flow
- ✅ Test failure paths: policy denial (wrong chain), insufficient balance (preflight detects)
- ✅ Skip mechanism: `describe.skipIf(!anvilAvailable || !baseRpcUrl)` — tests skip gracefully without Anvil/RPC

**Dependencies:** Epics 2, 3 (full transaction engine)

**DoD:**
- ✅ Transfer E2E: build → preflight (simulationSuccess: true) → approve → sign → 200
- ✅ Approve E2E: build → preflight → sign → 200
- ✅ Swap E2E: swap USDC → WETH via Uniswap V3 on forked state → 200
- ✅ Failure E2E: policy denial (wrong chain) → 403
- ✅ Failure E2E: insufficient balance → preflight detects
- ✅ Audit trail: full event chain verified (policy_evaluated → tx_built → preflight_completed → approve_request_created → signature_created)
- ✅ 6 E2E tests passing on Anvil Base fork (`tests/e2e/full-flow.test.ts`)

---

### Ticket 7.2 — Security test suite ✅

Comprehensive security tests covering all 12 threat model scenarios.

**Subtasks:**
- ✅ Create `tests/security/` test directory with 3 test files
- ✅ Implement all 12 security tests from the threat model:

**Domain A (Skill isolation) — `tests/security/domain-a-isolation.test.ts` (8 tests):**
- ✅ `SecurityTest_A1`: Container tries to read keystore paths → `KEYS_ABSENT` (Docker, skipIf)
- ✅ `SecurityTest_A2`: Container tries network request → `NETWORK_BLOCKED` (Docker, skipIf)
- ✅ `SecurityTest_A3`: Approval summary generated by ISCL Core, not skill metadata → verified attacker text absent
- ✅ `SecurityTest_A4`: Policy denies malicious intents — 4 sub-cases: unknown chain, unknown token, unknown contract, value bomb → all 403

**Domain B (Core integrity) — `tests/security/domain-b-integrity.test.ts` (8 tests):**
- ✅ `SecurityTest_B1`: Simulation revert → risk score ≥ 50 (mock RpcClient)
- ✅ `SecurityTest_B1b`: Contract not in allowlist → risk +40
- ✅ `SecurityTest_B2`: POST sign-and-send with policy-denied intent (wrong chain) → 403
- ✅ `SecurityTest_B2b`: POST sign-and-send without approval token when required → 403
- ✅ `SecurityTest_B3`: Full approval token replay test — issue → sign (200) → replay same token → 403 consumed
- ✅ `SecurityTest_B3b`: Expired approval token → 403 rejected
- ✅ `SecurityTest_B4`: MaxUint256 approval amount → 403 policy denied
- ✅ `SecurityTest_B4b`: Excessive approval (> maxApprovalAmount) → 403 policy denied

**Domain C (Sandbox enforcement) — existing + `tests/security/domain-c-tampered-package.test.ts` (4 tests):**
- ✅ `SecurityTest_C1`: Network isolation (existing `sandbox-isolation.test.ts`, Docker skipIf)
- ✅ `SecurityTest_C2`: Filesystem read-only (existing `sandbox-isolation.test.ts`, Docker skipIf)
- ✅ `SecurityTest_C3`: Process spawn blocked via seccomp (existing `sandbox-isolation.test.ts`, Docker skipIf)
- ✅ `SecurityTest_C4`: Tampered file hash → `verifyFileHashes()` returns `valid: false` with mismatch details

**Supporting files:**
- ✅ `tests/security/dockerfiles/Dockerfile.keystore-test` — Alpine container that checks for keystore files

**Dependencies:** All epics (security tests exercise the full system)

**DoD:**
- ✅ All 12 security tests implemented (20 total test cases across 3 files + existing sandbox tests)
- ✅ Each test verifies the attack vector is blocked
- ✅ Tests organized by domain (A/B/C) in separate files
- ✅ Domain B tests always run, Domain A/C Docker tests skip gracefully without Docker
- ✅ `npm run test:security` runs all security tests

---

### Ticket 7.3 — Packaging and documentation ✅

Prepare for release candidate distribution.

**Subtasks:**
- ✅ Create production Docker image — `Dockerfile` (multi-stage: Node 20 Alpine builder → runtime with non-root `iscl` user)
- ✅ Create `.dockerignore` (excludes node_modules, dist, .git, tests, *.sqlite*)
- ✅ Add `docker-compose.yml` — ISCL Core + Anvil Base fork (2 services, configurable `BASE_FORK_RPC_URL`)
- ✅ Wire `ISCL_AUDIT_DB` + `ISCL_KEYSTORE_PATH` env vars in `core/main.ts` for Docker compatibility
- ✅ Write `doc/SETUP.md` — prerequisites, quick start (local + Docker), env vars, policy config, test commands
- ✅ Write `doc/API_REFERENCE.md` — all 5 endpoints with curl examples, request/response schemas, error codes
- ✅ Write `doc/ADAPTER_GUIDE.md` — ISCLClient usage, skill wrappers, custom skill development
- ✅ Create `scripts/demo-transfer.ts` — full USDC transfer flow via `npx tsx`
- ✅ Create `scripts/demo-swap.ts` — full USDC → WETH swap flow via `npx tsx`
- ✅ Add `test:security` and `test:e2e` scripts to `package.json`
- Version tag `v0.1.0-beta` — pending (Step 14)

**Dependencies:** Tickets 7.1, 7.2 (all tests passing)

**DoD:**
- ✅ `docker build -t iscl-core:0.1.0-beta .` produces working image
- ✅ Container starts and `curl http://localhost:3100/v1/health` returns `{"status":"ok","version":"0.1.0"}`
- ✅ `docker-compose up` starts ISCL Core + Anvil fork
- ✅ Demo: `npx tsx scripts/demo-swap.ts` runs full swap flow
- ✅ Setup guide covers zero-to-running in < 15 minutes
- ✅ API reference covers all 5 endpoints with examples
- Git tag `v0.1.0-beta` — pending

---

## Summary

| Phase/Epic | Tickets | Status |
|---|---|---|
| Phase 0 — Project Scaffolding | — | ✅ COMPLETE |
| Epic 1 — Core API & Schemas | 1.1 ✅, 1.2 ✅, 1.3 ✅ | ✅ COMPLETE |
| Epic 2 — Wallet & Policy Engine | 2.1 ✅, 2.2 ✅, 2.3 ✅, 2.4 ✅ | ✅ COMPLETE |
| Epic 3 — Transaction Engine & Preflight | 3.1 ✅, 3.2 ✅, 3.3 ✅, 3.4 ✅, 3.5 ✅, 3.6 ✅, 3.7 ✅, 3.8 ✅ | ✅ COMPLETE |
| Epic 4 — Sandbox Executor | 4.1 ✅, 4.2 ✅, 4.3 ✅, 4.4 ✅ | ✅ COMPLETE |
| Epic 5 — Skill Packaging | 5.1 ✅, 5.2 ✅, 5.3 ✅ | ✅ COMPLETE |
| Epic 6 — OpenClaw Integration | 6.1 ✅, 6.2 ✅, 6.3 ✅ | ✅ COMPLETE |
| Epic 7 — Release Engineering | 7.1 ✅, 7.2 ✅, 7.3 ✅ | ✅ COMPLETE |

**Total: 7 epics, 28 tickets — ALL COMPLETE**
**Tests: 275 passing across 27 test files**
- **208 unit tests** (schemas, policy, builders, preflight, risk scorer, keystore, wallet, approval, manifest, scanner, client, intent-builder)
- **33 integration tests** (health, tx build/preflight/approve/sign, adapter client, adapter skills, installer)
- **28 security tests** (Domain A: 8, Domain B: 8, Domain C: 12 — A1/A2/C1-C3 require Docker)
- **6 E2E tests** (Anvil Base fork — require `BASE_RPC_URL` env var + Anvil installed)
