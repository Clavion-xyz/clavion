---
name: skill-manifest-schema
description: >
  SkillManifest v1 schema for ISCL skill packaging. Use when working on skill packaging,
  manifest validation, publisher signing, package integrity, the skill registry, or the
  static scanner. Triggers: SkillManifest, skill installation, package signing, manifest
  validation errors, supply chain security, curated registry work.
---

# SkillManifest v1 Schema

SkillManifest describes a packaged agent skill and enforces supply chain integrity.

## Top-Level Structure

```typescript
interface SkillManifest {
  version: "1";
  name: string;               // unique skill identifier
  publisher: PublisherObject;
  permissions: Permissions;
  sandbox: SandboxLimits;
  files: FileEntry[];
  signature: string;          // 0x-prefixed ECDSA sig
}
```

## Publisher Object

```typescript
interface PublisherObject {
  name: string;
  address: string;   // secp256k1 address that signs the manifest
  contact: string;   // email
}
```

## Permissions Object — Enforced by Sandbox

```typescript
interface Permissions {
  txActions: ActionType[];    // e.g., ["transfer", "swap_exact_in"]
  chains: number[];           // e.g., [8453]
  networkAccess: boolean;     // false = no outbound network
  filesystemAccess: boolean;  // false = no persistent FS
}
```

Skills cannot request permissions beyond what PolicyEngine allows. Excess → rejected at install.

## Sandbox Limits

```typescript
interface SandboxLimits {
  memoryMb: number;     // e.g., 128
  timeoutMs: number;    // e.g., 10000
  allowSpawn: boolean;  // false = no child processes
}
```

## Files Array — Integrity Hashes

```typescript
interface FileEntry {
  path: string;     // relative path, e.g., "index.js"
  sha256: string;   // hex hash of file contents
}
```

Every file in the package must be listed. Any mismatch → installation blocked.

## Signing

1. Remove `signature` field from manifest
2. Canonicalize remaining object with JCS
3. `manifestHash = keccak256(canonical_json)`
4. Sign with publisher's secp256k1 key (EVM-compatible ECDSA)
5. Attach signature to manifest

## Validation Rules — Reject If

- Signature invalid against publisher.address
- Any file sha256 mismatch
- Permissions exceed system policy limits
- Sandbox limits exceed safe thresholds
- Unknown fields present
- Missing required fields

## Working with the Skill Registry

```
Install flow:
1. Download package
2. Verify manifest signature
3. Verify all file hashes
4. Run static scanner (check for suspicious imports, dynamic eval, outbound URLs)
5. Display permissions to user
6. User confirms → install
7. Register in SkillRegistryService
```

## Static Scanner Checks

The scanner looks for:
- `eval()`, `Function()`, dynamic code loading
- Network calls to non-allowlisted domains
- Filesystem operations outside sandbox
- Suspicious process spawning (`child_process`, `exec`, `spawn`)
- Obfuscated code patterns
