# Clavion API Schema Specification v0.1

## TxIntent & SkillManifest

Version: 1.0  
Status: Canonical Schema Specification  
Audience: Backend engineers, SDK authors, skill developers  
Scope: Transaction intent model + skill packaging model

---

# 1. Overview

This document defines the canonical schemas used by Clavion v0.1:

- **TxIntent v1** — typed transaction intent model
    
- **SkillManifest v1** — signed skill package descriptor
    

These schemas are security-critical contracts between:

- agent skills
    
- Clavion Core
    
- SDKs
    
- test infrastructure
    

All schemas are versioned and strictly validated.

No undocumented fields are allowed.

---

# 2. Design Goals

The schemas are designed to provide:

deterministic transaction construction  
explicit security boundaries  
machine-verifiable validation  
human-readable intent representation  
forward compatibility  
auditability

Raw arbitrary transaction signing is forbidden.

All actions must be expressible through TxIntent.

---

# 3. TxIntent v1 Specification

## 3.1 Concept

TxIntent is a declarative description of what an agent wants to do.

It is not a transaction.

It is an intent that Clavion resolves into a concrete transaction.

This separation is critical for safety.

---

## 3.2 TxIntent Top-Level Structure

```json
{
  "version": "1",
  "id": "uuid",
  "timestamp": 1700000000,
  "chain": {...},
  "wallet": {...},
  "action": {...},
  "constraints": {...},
  "preferences": {...},
  "metadata": {...}
}
```

---

## 3.3 Field Definitions

### version

Type: string  
Value: "1"

Schema version identifier.

---

### id

Type: UUID string

Unique identifier for idempotency and audit tracing.

---

### timestamp

Type: integer (unix seconds)

Creation time of the intent.

Used for replay protection and logging.

---

## 3.4 Chain Object

```json
"chain": {
  "type": "evm",
  "chainId": 8453,
  "rpcHint": "base"
}
```

Fields:

type — currently only "evm"  
chainId — numeric chain identifier  
rpcHint — optional string for preferred RPC routing

---

## 3.5 Wallet Object

```json
"wallet": {
  "address": "0x...",
  "profile": "default"
}
```

Fields:

address — signer address  
profile — optional wallet profile name

Wallet must exist in local keystore.

---

## 3.6 Action Object

Action defines the requested operation.

Supported actions in v0.1:

transfer  
approve  
swap_exact_in  
swap_exact_out

---

### Transfer Action

```json
"action": {
  "type": "transfer",
  "asset": {
    "kind": "erc20",
    "address": "0x..."
  },
  "to": "0x...",
  "amount": "1000000"
}
```

Amount is integer string in base units.

---

### Approve Action

```json
"action": {
  "type": "approve",
  "asset": {...},
  "spender": "0x...",
  "amount": "1000000"
}
```

---

### Swap Exact In

```json
"action": {
  "type": "swap_exact_in",
  "router": "0x...",
  "assetIn": {...},
  "assetOut": {...},
  "amountIn": "1000000",
  "minAmountOut": "900000"
}
```

---

### Swap Exact Out

```json
"action": {
  "type": "swap_exact_out",
  "router": "0x...",
  "assetIn": {...},
  "assetOut": {...},
  "amountOut": "1000000",
  "maxAmountIn": "1200000"
}
```

---

## 3.7 Asset Object

```json
{
  "kind": "erc20",
  "address": "0x...",
  "symbol": "USDC",
  "decimals": 6
}
```

Symbol and decimals optional hints.

---

## 3.8 Constraints Object

Defines safety limits.

```json
"constraints": {
  "maxGasWei": "1000000000000000",
  "deadline": 1700003600,
  "maxSlippageBps": 100
}
```

Fields:

maxGasWei — gas cost cap  
deadline — expiration timestamp  
maxSlippageBps — slippage tolerance

---

## 3.9 Preferences Object

Hints to transaction builder.

```json
"preferences": {
  "speed": "normal",
  "privateRelay": false
}
```

Speed values:

slow  
normal  
fast

---

## 3.10 Metadata Object

Free-form non-security data.

```json
"metadata": {
  "source": "agent-name",
  "note": "rebalance portfolio"
}
```

Ignored by signing logic.

---

## 3.11 Canonicalization

TxIntent must be canonicalized using:

JSON Canonicalization Scheme (JCS)

Hash:

```
keccak256(canonical_json)
```

This hash is the intent fingerprint.

---

## 3.12 Validation Rules

Invalid if:

unknown fields present  
unsupported action type  
missing required fields  
amounts are non-numeric  
addresses invalid  
deadline expired

Strict validation is mandatory.

---

# 4. SkillManifest v1 Specification

## 4.1 Concept

SkillManifest describes a packaged agent skill.

It defines:

permissions  
dependencies  
sandbox requirements  
integrity hashes  
publisher signature

---

## 4.2 Top-Level Structure

```json
{
  "version": "1",
  "name": "skill-name",
  "publisher": {...},
  "permissions": {...},
  "sandbox": {...},
  "files": [...],
  "signature": "0x..."
}
```

---

## 4.3 Publisher Object

```json
"publisher": {
  "name": "Team Name",
  "address": "0x...",
  "contact": "email@example.com"
}
```

Address signs the manifest.

---

## 4.4 Permissions Object

Defines allowed capabilities.

```json
"permissions": {
  "txActions": ["transfer", "swap_exact_in"],
  "chains": [8453],
  "networkAccess": false,
  "filesystemAccess": false
}
```

Permissions enforced by sandbox.

---

## 4.5 Sandbox Object

```json
"sandbox": {
  "memoryMb": 128,
  "timeoutMs": 10000,
  "allowSpawn": false
}
```

Defines runtime limits.

---

## 4.6 Files Array

```json
"files": [
  {
    "path": "index.js",
    "sha256": "abc123..."
  }
]
```

All package files must be hashed.

---

## 4.7 Signature

Signature covers:

manifest minus signature field

```
keccak256(canonical(manifest_without_signature))
```

Signed by publisher key.

---

## 4.8 Validation Rules

Skill rejected if:

signature invalid  
file hash mismatch  
permissions exceed policy  
sandbox limits unsafe

---

# 5. Security Guarantees

TxIntent ensures:

no arbitrary calldata signing  
explicit transaction semantics  
policy enforcement compatibility

SkillManifest ensures:

supply chain integrity  
sandbox safety  
permission transparency

---

# 6. Versioning Strategy

Future schema versions must:

increment version string  
remain backward compatible when possible  
include migration tooling

---

# 7. Reference JSON Schemas (Simplified)

### TxIntent JSON Schema (excerpt)

```json
{
  "type": "object",
  "required": ["version", "id", "chain", "wallet", "action"],
  "properties": {
    "version": { "const": "1" },
    "id": { "type": "string", "format": "uuid" },
    "timestamp": { "type": "integer" }
  },
  "additionalProperties": false
}
```

---

### SkillManifest JSON Schema (excerpt)

```json
{
  "type": "object",
  "required": ["version", "name", "publisher", "files", "signature"],
  "properties": {
    "version": { "const": "1" },
    "name": { "type": "string" }
  },
  "additionalProperties": false
}
```

---

# 8. Developer Responsibilities

SDKs must:

validate schemas strictly  
canonicalize intents  
compute hashes correctly  
reject malformed inputs

Skills must:

declare permissions honestly  
sign manifests  
avoid dynamic code loading

---

# 9. Testing Requirements

Test suite must include:

valid intent fixtures  
malformed intent rejection  
signature verification tests  
canonicalization consistency tests

---

# 10. Conclusion

TxIntent and SkillManifest form the core safety contract of Clavion.

They enforce:

deterministic crypto behavior  
explicit permissions  
strong validation boundaries

No shortcuts allowed.

This document is normative.

---

End of Schema Specification