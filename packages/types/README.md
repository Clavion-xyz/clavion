# @clavion/types

Shared TypeScript types and JSON schemas for the Clavion ecosystem. Used by all
other packages.

## Key Type Exports

`TxIntent`, `ActionObject`, `BuildPlan`, `PolicyConfig`, `PolicyDecision`,
`ApprovalSummary`, `ApprovalToken`, `Asset`, `PreflightResult`, `SkillManifest`,
`RegisteredSkill`, `SandboxConfig`, `SignRequest`, `SignedTransaction`,
`EncryptedKey`, `AuditEvent`.

## RPC Types

Import from `@clavion/types/rpc`:

`RpcClient`, `CallParams`, `CallResult`, `TransactionReceipt`.

## JSON Schemas

Import from `@clavion/types/schemas`:

`TxIntentSchema`, `SkillManifestSchema`, `ErrorResponseSchema`.

These are plain objects suitable for use with AJV.

## Usage

```typescript
import type { TxIntent, PolicyConfig } from "@clavion/types";
import type { RpcClient } from "@clavion/types/rpc";
import { TxIntentSchema } from "@clavion/types/schemas";
```

## Project Root

[Back to main README](../../README.md)
