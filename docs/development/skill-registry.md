# Skill Registry Workflow

## Overview

The Skill Registry manages the full lifecycle of skill manifests -- from creation
through registration, validation, and revocation. It ensures that only verified,
integrity-checked, and statically scanned skills can execute against the ISCL Core.

Every skill that wants to interact with the ISCL API must first be registered.
Registration runs a 6-step validation pipeline that checks schema conformance,
cryptographic signature, file integrity, and static analysis before persisting
the skill in a SQLite database. Revoked skills are soft-deleted and excluded from
active listings but preserved for audit purposes.

**Key source files:**

| File | Purpose |
|------|---------|
| `packages/registry/src/skill-registry-service.ts` | 6-step registration pipeline, CRUD, SQLite persistence |
| `packages/registry/src/manifest-signer.ts` | JCS canonicalization, keccak256 hashing, ECDSA sign/verify |
| `packages/registry/src/manifest-validator.ts` | AJV schema validation against `SkillManifestSchema` |
| `packages/registry/src/file-hasher.ts` | SHA-256 file hashing and verification |
| `packages/registry/src/static-scanner.ts` | 5 pattern-based scan rules with severity levels |
| `packages/core/src/api/routes/skills.ts` | Fastify API routes for skill registration |

## SkillManifest v1 Schema

Every skill package includes a `SkillManifest` JSON document describing
its identity, permissions, sandbox constraints, and content-addressed files.

```typescript
interface SkillManifest {
  version: "1";                    // Schema version, always "1"
  name: string;                    // Unique identifier: lowercase, digits, hyphens
                                   // Pattern: ^[a-z0-9-]+$, max 64 chars
  publisher: {
    name: string;                  // Human-readable publisher name
    address: string;               // Ethereum address of signer (0x-prefixed, 40 hex chars)
    contact: string;               // Publisher email (validated as email format)
  };
  permissions: {
    txActions: Array<              // Requested transaction action types
      "transfer" | "approve" | "swap_exact_in" | "swap_exact_out"
    >;
    chains: number[];              // Chain IDs the skill operates on (e.g., [1, 8453])
    networkAccess: boolean;        // Whether the skill needs outbound network
    filesystemAccess: boolean;     // Whether the skill needs filesystem writes
  };
  sandbox: {
    memoryMb: number;              // Memory limit (1-512 MB)
    timeoutMs: number;             // Execution timeout (1000-60000 ms)
    allowSpawn: boolean;           // Whether child process spawning is permitted
  };
  files: Array<{
    path: string;                  // Relative path within skill package
    sha256: string;                // SHA-256 hash (lowercase hex, 64 chars)
  }>;                              // At least 1 file entry required
  signature: string;               // ECDSA signature (0x-prefixed hex)
}
```

**Schema enforcement:** The JSON Schema uses `additionalProperties: false` on all
objects. No undocumented fields are accepted. AJV runs in strict mode with all
errors reported.

## Creating a Manifest

Follow these steps to create a signed skill manifest ready for registration.

### Step 1: Define Skill Metadata

Choose a unique name (lowercase alphanumeric with hyphens), declare the publisher
identity, and specify the permissions your skill requires:

```json
{
  "version": "1",
  "name": "my-defi-skill",
  "publisher": {
    "name": "Acme DeFi",
    "address": "0x1234567890abcdef1234567890abcdef12345678",
    "contact": "dev@acme-defi.example"
  },
  "permissions": {
    "txActions": ["swap_exact_in", "transfer"],
    "chains": [1, 8453],
    "networkAccess": false,
    "filesystemAccess": false
  },
  "sandbox": {
    "memoryMb": 128,
    "timeoutMs": 30000,
    "allowSpawn": false
  }
}
```

### Step 2: Hash All Skill Files

Compute the SHA-256 hash of every source file in your skill package. Hashes must
be lowercase hex strings (64 characters, no `0x` prefix):

```bash
sha256sum src/run.mjs src/helpers.mjs
# Output:
# a1b2c3d4...  src/run.mjs
# e5f6a7b8...  src/helpers.mjs
```

### Step 3: Add File Entries to Manifest

Add each file with its relative path and computed hash:

```json
{
  "files": [
    { "path": "src/run.mjs", "sha256": "a1b2c3d4..." },
    { "path": "src/helpers.mjs", "sha256": "e5f6a7b8..." }
  ]
}
```

### Step 4: Sign the Manifest

Signing uses three operations in sequence:

1. **Remove** the `signature` field from the manifest object
2. **JCS canonicalize** the remaining object (RFC 8785 -- deterministic JSON serialization)
3. **keccak256** hash the canonical JSON bytes
4. **ECDSA sign** the hash with the publisher's private key

```typescript
import { signManifest } from "@clavion/registry";

const unsigned = {
  version: "1" as const,
  name: "my-defi-skill",
  publisher: { /* ... */ },
  permissions: { /* ... */ },
  sandbox: { /* ... */ },
  files: [ /* ... */ ],
};

const signed = await signManifest(unsigned, "0xYOUR_PRIVATE_KEY");
// signed.signature is now populated with a 0x-prefixed ECDSA signature
```

The `signManifest()` function handles the full pipeline: it strips the signature
field, JCS-canonicalizes the rest, computes `keccak256`, and signs using
`viem/accounts`. The resulting `SkillManifest` has the `signature` field populated.

## Registration Pipeline

When you submit a manifest to `POST /v1/skills/register`, the `SkillRegistryService`
runs a 6-step validation pipeline. Every step must pass for registration to succeed.
Failure at any step short-circuits the pipeline and returns an error response.

### Step 1: Schema Validation

```
validateManifest(manifest) → ValidationResult
```

Validates the manifest against `SkillManifestSchema` using AJV in strict mode with
`allErrors: true`. Checks required fields, types, patterns, value ranges, and
rejects any `additionalProperties`.

**Failure:** Returns `schema_validation_failed` with an array of `validationErrors`
(each containing `path` and `message`).

### Step 2: Signature Verification

```
verifyManifest(manifest) → boolean
```

Verifies the ECDSA signature matches the declared publisher address:

1. Remove the `signature` field from the manifest
2. JCS-canonicalize the remaining object
3. Compute `keccak256` of the canonical JSON
4. Recover the signer address from the signature using `viem.recoverAddress()`
5. Compare recovered address to `manifest.publisher.address` (case-insensitive)

**Failure:** Returns `signature_verification_failed`. This means the manifest was
either tampered with after signing or signed with a different key than the one
declared in `publisher.address`.

### Step 3: File Hash Verification

```
verifyFileHashes(basePath, manifest.files) → { valid, mismatches }
```

Reads each file from disk (resolved relative to `basePath`), computes its SHA-256
hash, and compares against the hash declared in the manifest. Files that cannot be
read are also treated as mismatches.

**Failure:** Returns `file_hash_mismatch` with a `hashMismatches` array listing
the paths that failed verification.

### Step 4: Static Analysis

```
scanFiles(basePath, filePaths) → ScanReport
```

Scans every file listed in the manifest for suspicious patterns. Each source file
is read line-by-line and tested against 5 scan rules. The scan **fails** if any
finding has `error` severity. Warnings are reported but do not block registration.

See [Static Scanner Rules](#static-scanner-rules) below for the full rule table.

**Failure:** Returns `static_scan_failed` with a `scanFindings` array containing
each finding's file, line number, rule ID, severity, and message.

### Step 5: Duplicate Check

```
isRegistered(name) → boolean
```

Checks if a skill with the same name is already registered and active in the
database. A previously revoked skill with the same name does **not** block
re-registration (the check queries `status = 'active'` only).

**Failure:** Returns `duplicate_skill` with HTTP 409 Conflict.

### Step 6: Database Insert

If all checks pass, the skill is persisted to SQLite:

```sql
INSERT INTO registered_skills
  (name, publisher_address, publisher_name, manifest, manifest_hash, status, registered_at)
VALUES (?, ?, ?, ?, ?, 'active', ?)
```

The `manifest_hash` is the `keccak256` of the JCS-canonicalized manifest (without
the signature field), computed by `computeManifestHash()`. The full manifest JSON
is stored in the `manifest` column for later retrieval.

An audit event `skill_registered` is logged with the skill name, manifest hash,
and publisher address.

## Database Schema

The registry uses a single SQLite table with WAL journal mode:

```sql
CREATE TABLE IF NOT EXISTS registered_skills (
  name             TEXT PRIMARY KEY,
  publisher_address TEXT NOT NULL,
  publisher_name   TEXT NOT NULL,
  manifest         TEXT NOT NULL,       -- Full SkillManifest as JSON
  manifest_hash    TEXT NOT NULL,       -- keccak256 of JCS-canonicalized manifest
  status           TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'revoked'
  registered_at    INTEGER NOT NULL,    -- Unix timestamp (ms)
  revoked_at       INTEGER             -- Unix timestamp (ms), null if active
);
```

## Static Scanner Rules

The static scanner runs 5 pattern-based rules against every source file. Each rule
has one or more regex patterns and a severity level.

| Rule ID | Severity | Patterns Detected | Description |
|---------|----------|-------------------|-------------|
| `dynamic_eval` | error | `eval()`, `new Function()` | Dynamic code execution -- allows arbitrary code injection |
| `child_process` | error | `child_process`, `exec()`, `spawn()`, `execFile()`, `execSync()`, `spawnSync()` | Process spawning -- could escape sandbox |
| `network_access` | error | `fetch()`, `require('http')`, `http.`, `https.`, `net.`, `dgram.`, `WebSocket`, `XMLHttpRequest` | Unauthorized network access -- skills must not make direct network calls |
| `fs_write` | warning | `writeFileSync`, `writeFile`, `mkdirSync`, `unlinkSync`, `rmSync` | Filesystem writes -- reported but does not block registration |
| `obfuscation` | warning | Hex escape sequences (`\x` chains), `atob()`, `Buffer.from(..., 'base64')` | Potentially obfuscated code -- reported for manual review |

**Pass/fail logic:** The scan passes if there are zero `error`-severity findings.
Warning-severity findings are included in the response but do not prevent registration.

Only the first matching pattern per rule per line is reported (avoids duplicate
findings when multiple patterns from the same rule match on one line).

## Registration Errors

| Error Code | HTTP Status | Condition | How to Fix |
|------------|-------------|-----------|------------|
| `schema_validation_failed` | 400 | Manifest does not conform to SkillManifest v1 schema | Check `validationErrors` in the response for specific field issues |
| `signature_verification_failed` | 400 | ECDSA signature does not match `publisher.address` | Re-sign with the correct private key matching `publisher.address` |
| `file_hash_mismatch` | 400 | SHA-256 of one or more files does not match manifest entries | Re-hash files and update `files` array, or re-sign after changes |
| `static_scan_failed` | 400 | Source files contain error-severity patterns | Remove flagged patterns (see `scanFindings` for file, line, and rule) |
| `duplicate_skill` | 409 | A skill with the same name is already active | Revoke the existing skill first, then re-register |

All registration failures are audit-logged as `skill_registration_failed` events
with the skill name and error reason. See [api/errors.md](../api/errors.md) for
the general error response format.

## API Endpoints

### POST /v1/skills/register

Register a new skill manifest. Runs the full 6-step validation pipeline.

**Request body:**

```json
{
  "manifest": {
    "version": "1",
    "name": "my-defi-skill",
    "publisher": { "name": "Acme DeFi", "address": "0x...", "contact": "dev@acme.example" },
    "permissions": { "txActions": ["transfer"], "chains": [8453], "networkAccess": false, "filesystemAccess": false },
    "sandbox": { "memoryMb": 128, "timeoutMs": 30000, "allowSpawn": false },
    "files": [{ "path": "src/run.mjs", "sha256": "a1b2c3..." }],
    "signature": "0xabcdef..."
  },
  "basePath": "/path/to/skill/package"
}
```

**Success response (200):**

```json
{
  "registered": true,
  "name": "my-defi-skill",
  "manifestHash": "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
}
```

**Error response (400 or 409):**

```json
{
  "registered": false,
  "name": "my-defi-skill",
  "manifestHash": "",
  "error": "static_scan_failed",
  "scanFindings": [
    { "file": "src/run.mjs", "line": 12, "rule": "network_access", "severity": "error", "message": "Network access detected" }
  ]
}
```

### GET /v1/skills

List all active (non-revoked) skills ordered by registration time.

**Response (200):**

```json
[
  {
    "name": "my-defi-skill",
    "publisherAddress": "0x1234...5678",
    "publisherName": "Acme DeFi",
    "manifest": { /* full SkillManifest */ },
    "manifestHash": "0x9f86d0...",
    "status": "active",
    "registeredAt": 1700000000000,
    "revokedAt": null
  }
]
```

### GET /v1/skills/:name

Get a single skill by name. Returns the full `RegisteredSkill` record including
the stored manifest and registration metadata.

**Response (200):** Single `RegisteredSkill` object (same shape as list items).

**Response (404):**

```json
{ "error": "skill_not_found", "name": "nonexistent-skill" }
```

### DELETE /v1/skills/:name

Revoke a skill (soft delete). Sets `status` to `"revoked"` and records `revoked_at`
timestamp. The skill is excluded from `GET /v1/skills` listings but remains in the
database for audit purposes.

**Response (200):**

```json
{ "revoked": true, "name": "my-defi-skill" }
```

**Response (404):** Returned if the skill does not exist or is already revoked.

An audit event `skill_revoked` is logged with the skill name.

## Skill Lifecycle

```
                  6-step pipeline
  Created  ───────────────────────>  Active  ───────>  Revoked
  (manifest JSON)                   (in DB)         (soft delete)
                                      |
                                      v
                              Listed in GET /v1/skills
                              Executable by sandbox
```

- **Created:** A signed manifest JSON exists but has not been submitted to the registry.
- **Active:** The manifest passed all 6 validation steps and is stored in the database.
  Active skills appear in `GET /v1/skills` and can be executed by the sandbox runner.
- **Revoked:** The skill was soft-deleted via `DELETE /v1/skills/:name`. It no longer
  appears in active listings but its record persists in the database. Revocation is
  audit-logged. A new skill with the same name can be registered after revocation.

## Worked Example

A complete end-to-end registration flow using curl.

### 1. Create the Skill Source

```bash
mkdir -p /tmp/my-skill/src
cat > /tmp/my-skill/src/run.mjs << 'SCRIPT'
// A simple skill that builds a transfer intent
export default async function run(api) {
  const result = await api.post("/v1/tx/build", {
    version: "1",
    action: {
      type: "transfer",
      token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      to: "0x000000000000000000000000000000000000dead",
      amount: "1000000"
    },
    from: "0x1234567890abcdef1234567890abcdef12345678",
    chainId: 1,
    deadline: "2099-01-01T00:00:00Z"
  });
  return result;
}
SCRIPT
```

### 2. Hash the Source Files

```bash
sha256sum /tmp/my-skill/src/run.mjs
# Example output: 7d865e959b2466918c9863afca942d0fb89d7c9ac0c99bafc3749504ded97730  /tmp/my-skill/src/run.mjs
```

### 3. Build and Sign the Manifest

```typescript
import { signManifest } from "@clavion/registry";

const manifest = await signManifest(
  {
    version: "1",
    name: "simple-transfer",
    publisher: {
      name: "Example Dev",
      address: "0x1234567890abcdef1234567890abcdef12345678",
      contact: "dev@example.com",
    },
    permissions: {
      txActions: ["transfer"],
      chains: [1],
      networkAccess: false,
      filesystemAccess: false,
    },
    sandbox: {
      memoryMb: 64,
      timeoutMs: 10000,
      allowSpawn: false,
    },
    files: [
      {
        path: "src/run.mjs",
        sha256: "7d865e959b2466918c9863afca942d0fb89d7c9ac0c99bafc3749504ded97730",
      },
    ],
  },
  "0xYOUR_PUBLISHER_PRIVATE_KEY",
);

// Write manifest to file for use with curl
import { writeFileSync } from "node:fs";
writeFileSync("/tmp/my-skill/manifest.json", JSON.stringify(manifest, null, 2));
```

### 4. Register the Skill

```bash
curl -s -X POST http://localhost:3000/v1/skills/register \
  -H "Content-Type: application/json" \
  -d "{
    \"manifest\": $(cat /tmp/my-skill/manifest.json),
    \"basePath\": \"/tmp/my-skill\"
  }" | jq .
```

**Expected output on success:**

```json
{
  "registered": true,
  "name": "simple-transfer",
  "manifestHash": "0x..."
}
```

### 5. Verify Registration

```bash
# Get the registered skill details
curl -s http://localhost:3000/v1/skills/simple-transfer | jq .

# List all active skills
curl -s http://localhost:3000/v1/skills | jq '.[].name'
```

### 6. Revoke (When Needed)

```bash
curl -s -X DELETE http://localhost:3000/v1/skills/simple-transfer | jq .
# { "revoked": true, "name": "simple-transfer" }

# Confirm it no longer appears in listings
curl -s http://localhost:3000/v1/skills | jq '.[].name'
# (empty)
```

## Security Considerations

The Skill Registry is a critical component of the ISCL trust model. It sits at the
boundary between Domain A (untrusted agent skills) and Domain B (trusted core).

- **Signature binding:** The ECDSA signature ties the manifest to a specific
  publisher Ethereum address. Tampering with any field (including file hashes)
  invalidates the signature at Step 2.
- **Content addressing:** SHA-256 file hashes ensure that the exact code reviewed
  during registration is the code that runs in the sandbox. Any modification after
  registration is detectable.
- **Static scanning:** The 5-rule scanner catches common sandbox escape patterns
  (eval, process spawning, direct network access). This is a defense-in-depth
  measure -- the sandbox itself also enforces isolation.
- **Audit trail:** All registration successes, failures, and revocations are
  logged to the append-only audit trace, correlated by skill name and manifest hash.

For risk scoring context during transaction execution, see
[security/risk-scoring.md](../security/risk-scoring.md).
