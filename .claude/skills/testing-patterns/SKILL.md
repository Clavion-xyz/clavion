---
name: testing-patterns
description: >
  ISCL testing strategy — unit, integration, security, and e2e tests. Use when writing new
  tests, setting up test infrastructure, mocking RPC, creating fixtures, or running the test
  suite. Triggers: writing tests, vitest/jest, test fixtures, mock RPC, security tests,
  e2e tests, testnet, CI test pipeline, test coverage.
---

# Testing Patterns

## Test Categories

| Category | Location | Runner | Purpose |
|---|---|---|---|
| Unit | `/tests/unit/` | vitest | Pure logic: schemas, policy, canonicalization |
| Integration | `/tests/integration/` | vitest | Service interactions: API → policy → wallet |
| Security | `/tests/security/` | vitest + Docker | Threat model validation (A1–A4, B1–B4, C1–C4) |
| E2E | `/tests/e2e/` | vitest + testnet | Full swap flow on testnet/fork |

## Unit Test Patterns

### Schema Validation

```typescript
import { validateTxIntent } from "../spec/schemas/txintent.js";
import { validFixtures, invalidFixtures } from "../spec/fixtures/index.js";

describe("TxIntent validation", () => {
  for (const [name, fixture] of Object.entries(validFixtures)) {
    test(`accepts valid: ${name}`, () => {
      expect(validateTxIntent(fixture).valid).toBe(true);
    });
  }

  for (const [name, fixture] of Object.entries(invalidFixtures)) {
    test(`rejects invalid: ${name}`, () => {
      expect(validateTxIntent(fixture).valid).toBe(false);
    });
  }
});
```

### Policy Engine (property-based)

```typescript
test("deny always has reasons", () => {
  const result = evaluate(intent, buildPlan, preflight, config);
  if (result.decision === "deny") {
    expect(result.reasons.length).toBeGreaterThan(0);
  }
});

test("unknown action type always denied", () => {
  const result = evaluate({ ...intent, action: { type: "unknown" } }, bp, pf, config);
  expect(result.decision).toBe("deny");
});
```

### Canonicalization

```typescript
test("JCS + keccak256 matches fixture", () => {
  const hash = computeIntentHash(fixtures.swapExactIn);
  expect(hash).toBe(fixtures.swapExactIn_expectedHash);
});
```

## Integration Test Patterns

### Mocking RPC

```typescript
import { createMockRpcServer } from "../helpers/mock-rpc.js";

const mockRpc = createMockRpcServer({
  eth_call: () => "0x...",
  eth_estimateGas: () => "0x5208",
  eth_getBalance: () => "0xde0b6b3a7640000",
});

beforeAll(() => mockRpc.listen());
afterAll(() => mockRpc.close());
```

### API Route Testing

```typescript
import { buildApp } from "../../core/api/app.js";

const app = await buildApp({ rpcUrl: mockRpc.url, policyConfig: testPolicy });

test("POST /v1/tx/build — valid intent", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/v1/tx/build",
    payload: fixtures.validSwapIntent,
  });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toHaveProperty("txRequestHash");
});

test("POST /v1/tx/build — policy denied", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/v1/tx/build",
    payload: fixtures.unknownRouterSwapIntent,
  });
  expect(res.statusCode).toBe(403);
  expect(res.json().error).toBe("policy_denied");
});
```

## Security Tests

Each maps to the Security Blueprint threat model. See `security-invariants` skill for IDs.

```typescript
// SecurityTest_A1: Evil skill tries to read keys
test("skill cannot access keystore paths", async () => {
  const result = await runSkillInSandbox("evil-key-reader");
  expect(result.exitCode).not.toBe(0);
  expect(auditLog).toContainEvent("security_violation");
});

// SecurityTest_B3: Approval token replay
test("approval token cannot be reused", async () => {
  const token = await getApprovalToken(intent);
  await signAndSend(intent, token); // first use — success
  await expect(signAndSend(intent, token)).rejects.toThrow(); // replay — fail
});
```

## E2E Tests

Use a local fork (Hardhat/Anvil) or public testnet.

```typescript
test("full swap flow on Base fork", async () => {
  // 1. Create TxIntent for swap
  // 2. POST /tx/build
  // 3. POST /tx/preflight — check risk score
  // 4. POST /tx/approve-request
  // 5. Simulate user approval
  // 6. POST /tx/sign-and-send
  // 7. GET /tx/:hash — verify receipt
  // 8. Verify audit trace has all events
});
```

## CI Configuration

```yaml
# .github/workflows/test.yml
- Unit + Integration: every push
- Security tests: every push (require Docker)
- E2E: on PR merge to main
- OpenClaw compatibility: matrix of pinned + latest stable
```

## Fixture Management

All fixtures live in `/spec/fixtures/`. Include:
- Valid intents (one per action type)
- Invalid intents (missing fields, bad types, expired deadline, unknown action)
- Edge cases (zero amount, maximum values, boundary slippage)
- Expected hashes for canonicalization tests
