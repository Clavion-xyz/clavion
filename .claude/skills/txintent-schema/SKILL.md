---
name: txintent-schema
description: >
  TxIntent v1 schema specification for ISCL. Use when creating, validating, modifying, or
  debugging transaction intents. Triggers: TxIntent construction, schema validation errors,
  adding new action types, canonicalization, intent hashing, fixture creation, any work with
  /tx/build or /tx/preflight endpoints.
---

# TxIntent v1 Schema

TxIntent is a **declarative description of what an agent wants to do** — not a transaction.
ISCL Core resolves it into a concrete transaction. This separation is the foundation of safety.

## Top-Level Structure

```typescript
interface TxIntent {
  version: "1";              // schema version, always "1"
  id: string;                // UUID, idempotency + audit tracing
  timestamp: number;         // unix seconds, replay protection
  chain: ChainObject;
  wallet: WalletObject;
  action: ActionObject;      // the requested operation
  constraints: Constraints;  // safety limits
  preferences?: Preferences; // hints to tx builder
  metadata?: Metadata;       // non-security free-form data
}
```

## Action Types (v0.1)

Only these four are supported. Reject anything else.

| Type | Required Fields |
|---|---|
| `transfer` | asset, to, amount |
| `approve` | asset, spender, amount |
| `swap_exact_in` | router, assetIn, assetOut, amountIn, minAmountOut |
| `swap_exact_out` | router, assetIn, assetOut, amountOut, maxAmountIn |

All `amount` fields are **integer strings in base units** (e.g., `"1000000"` for 1 USDC).

## Asset Object

```typescript
interface Asset {
  kind: "erc20";       // only erc20 in v0.1
  address: string;     // checksummed 0x address
  symbol?: string;     // hint only
  decimals?: number;   // hint only
}
```

## Constraints Object

```typescript
interface Constraints {
  maxGasWei: string;      // gas cost cap, integer string
  deadline: number;       // unix timestamp expiration
  maxSlippageBps: number; // basis points (100 = 1%)
}
```

## Canonicalization & Hashing

1. Serialize intent using **JCS (JSON Canonicalization Scheme)**
2. Hash: `keccak256(canonical_json)` → intent fingerprint
3. This fingerprint is used for idempotency, approval binding, and audit correlation

## Strict Validation Rules

Reject the intent if ANY of these apply:
- Unknown fields present (`additionalProperties: false`)
- Unsupported action type
- Missing required fields
- Amounts are non-numeric strings
- Addresses are invalid (not checksummed 0x)
- Deadline already expired
- version ≠ "1"

Use AJV with strict mode. See `references/txintent-json-schema.md` for the full JSON Schema.

## Adding a New Action Type

1. Define the action interface in `/spec/schemas/`
2. Add to the AJV schema with `additionalProperties: false`
3. Create builder in TxEngine (`/core/tx-engine/builders/`)
4. Add policy rules in PolicyEngine
5. Add preflight simulation logic
6. Create fixtures in `/spec/fixtures/`
7. Write tests: valid intent, invalid variations, policy interaction
