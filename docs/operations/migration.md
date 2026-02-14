# Migration / Upgrade Guide

## Overview

This guide covers how to upgrade Clavion/ISCL between versions safely. The current release is **v0.1.0**. All upgrade procedures prioritize backward compatibility, data safety, and zero-downtime patterns where possible.

Clavion uses three schema version fields, a `/v1/` API prefix, and semantic versioning for the project itself. Within the v0.x release series, upgrades are designed to be non-destructive: existing databases, keystore files, and policy configurations remain valid across minor and patch updates.

## Versioning Strategy

Clavion tracks versions at three levels:

**Schema versions** -- embedded in data structures and validated at runtime:

- `TxIntent.version: "1"` -- transaction intent format used by all five action types
- `PolicyConfig.version: "1"` -- policy configuration format with 10 required fields
- `SkillManifest.version: "1"` -- skill registration manifest format

**API versioning** -- all HTTP endpoints use the `/v1/` prefix. A major version bump to `/v2/` would indicate breaking changes to the request/response format.

**Project versioning** -- follows semantic versioning (`MAJOR.MINOR.PATCH`):

- `MAJOR` -- breaking schema or API changes
- `MINOR` -- new features, new optional fields, new endpoints
- `PATCH` -- bug fixes, documentation, internal refactoring

## Current Schema Summary

| Schema | Version | Key Fields | Reference |
|--------|---------|------------|-----------|
| TxIntent | `"1"` | `id`, `chain`, `wallet`, `action` (5 types: `transfer`, `approve`, `swap_exact_in`, `swap_exact_out`, `transfer_native`), `constraints` | `packages/types/src/index.ts` |
| PolicyConfig | `"1"` | `maxValueWei`, `maxApprovalAmount`, `contractAllowlist`, `tokenAllowlist`, `allowedChains`, `recipientAllowlist`, `maxRiskScore`, `requireApprovalAbove`, `maxTxPerHour` | `packages/policy/src/policy-config.ts` |
| SkillManifest | `"1"` | `name`, `publisher` (name, address, contact), `permissions` (txActions, chains, networkAccess, filesystemAccess), `sandbox` (memoryMb, timeoutMs, allowSpawn), `files` (path, sha256), `signature` | `packages/types/src/index.ts` |

For full schema definitions, see [Schema Specification](../api/schemas.md).

## Backward Compatibility Policy

These rules govern how schemas evolve within and across major versions:

- **New optional fields** can be added within a major version without breaking existing clients. For example, `TxIntent.preferences` and `TxIntent.metadata` are optional and were added without a version bump.
- **`additionalProperties: false`** is enforced on all schemas via AJV strict mode. Clients must not send fields that are not in the schema -- unknown properties cause validation errors, not silent acceptance.
- **v1 schemas are supported** throughout the entire 0.x release series. A TxIntent with `version: "1"` will remain valid until at least v1.0.0.
- **Breaking changes** (removing a field, changing a field type, changing validation rules) require a major version bump and will be documented with migration instructions in [CHANGELOG](../CHANGELOG.md).

## Upgrade Procedure

### 1. Code Update

Pull the latest code, install dependencies, rebuild, and verify:

```bash
git pull origin main
npm install
npm run build
npm test
```

If tests pass, the upgrade is safe to proceed. If any test fails, do not deploy -- check the release notes for known issues or breaking changes.

### 2. Database Migration

The SQLite audit database uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` patterns. This means:

- **New tables** (e.g., `rate_limit_events`) are created automatically on first startup after an upgrade.
- **New indexes** (e.g., `idx_rate_wallet_ts`) are added automatically without manual intervention.
- **Existing data** is never deleted or altered by schema changes. All DDL operations in v0.x are additive.
- The database uses WAL journal mode (`journal_mode = WAL`) for concurrent read access during writes.

**No manual migration scripts are required** for any v0.x update. Simply restart the ISCL Core process and the database schema will be updated on initialization.

If you need to verify the current database schema after an upgrade:

```bash
sqlite3 /path/to/audit.db ".schema"
```

### 3. Policy Configuration

Policy configuration files are validated against `PolicyConfigSchema` on load:

- The `getDefaultConfig()` function provides sensible defaults for all 10 required fields. If no policy file exists at the configured path, these defaults are used automatically.
- Existing policy JSON files remain valid as long as they conform to the current `PolicyConfigSchema`. No fields have been removed in v0.x.
- If a future version adds a new required field, the AJV validation error message will indicate exactly which field is missing and what format it expects. For example: `"/: must have required property 'newFieldName'"`.
- To check your policy file against the current schema without starting the server, run the test suite: `npm run test:unit`.

### 4. Keystore Files

The encrypted keystore uses a stable format that does not change between v0.x releases:

- **Encryption**: AES-256-GCM with scrypt key derivation (N=262144, r=8, p=1)
- **Metadata file**: `keystore.json` with `version: "1"` tracks all key entries
- **Key files**: Individual `.enc` files per address, named `{address_prefix}-{profile}.enc`

Keystore files are portable across versions. The `EncryptedKeystore` class reads the `kdfParams` from each key file at unlock time, so even if scrypt parameters change in a future version, existing key files will continue to work with their original parameters.

**Never delete keystore files during an upgrade.** Back up the entire keystore directory before any upgrade:

```bash
cp -r /path/to/keystore /path/to/keystore.backup.$(date +%Y%m%d)
```

### 5. Docker Update

For Docker-based deployments, rebuild and restart:

```bash
# Stop running containers
docker compose -f docker/compose.yaml down

# Rebuild with latest code
docker build -f docker/Dockerfile.core -t clavion-core .

# Restart the stack
docker compose -f docker/compose.yaml up -d
```

Named volumes persist SQLite data and keystore files across container rebuilds. Verify that your `compose.yaml` volume mounts point to the correct host paths before restarting.

To tag the current image before upgrading (for rollback):

```bash
docker tag clavion-core clavion-core:v0.1.0
```

## Breaking Change Policy

When breaking changes are unavoidable, the following process applies:

1. **Deprecation notice** in a minor version release, logged as a warning at startup.
2. **Migration guide** published alongside the breaking release, with before/after examples.
3. **Major version bump** for any change that breaks existing schemas, API contracts, or data formats.
4. **Per-change instructions** in the CHANGELOG explaining exactly what to update and in what order.

Examples of changes that would require a major version bump:

- Removing a required field from `PolicyConfig`
- Changing `TxIntent.version` from `"1"` to `"2"`
- Altering the API response format for `/v1/tx/build`
- Changing the keystore encryption scheme (old files would still be readable)

Examples of changes that would NOT require a major version bump:

- Adding a new optional field to `TxIntent.metadata`
- Adding a new action type (e.g., `"bridge"`) to `ActionObject`
- Adding a new API endpoint under `/v1/`
- Adding a new index to the audit database

## Rollback

If an upgrade causes issues, roll back with these steps:

**Docker rollback:**

```bash
docker compose -f docker/compose.yaml down
docker tag clavion-core:v0.1.0 clavion-core:latest
docker compose -f docker/compose.yaml up -d
```

**Source rollback:**

```bash
git checkout v0.1.0
npm install
npm run build
```

**Data compatibility during rollback:**

- **SQLite**: Backward compatible. New tables and columns added by a newer version are silently ignored by older code. The `CREATE TABLE IF NOT EXISTS` pattern means older code will not fail on encountering tables it does not use.
- **Policy config**: Files work across versions within the same major version. A policy file valid for v0.1.0 will also be valid for v0.2.0 and vice versa, as long as both are in the v0.x series.
- **Keystore files**: Always backward compatible. The encryption format is versioned independently and has not changed.

## Troubleshooting

Common issues encountered during upgrades:

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Invalid policy config: /: must have required property 'X'` | A new required field was added to `PolicyConfig` in this version | Add the missing field to your policy JSON. Check `getDefaultConfig()` in `packages/policy/src/policy-config.ts` for the default value. |
| `must NOT have additional properties` from AJV | Your request or config contains a field not in the schema | Remove the unrecognized field. All schemas use `additionalProperties: false`. |
| `Cannot find module '@clavion/...'` | Dependencies not rebuilt after code update | Run `npm install && npm run build` to rebuild all packages in dependency order. |
| `SQLITE_BUSY: database is locked` | Another ISCL process is still running | Stop all ISCL processes before upgrading: `docker compose down` or kill the Node process. |
| `Invalid passphrase or corrupted key file` | Keystore file damaged or wrong passphrase | Restore from backup. Keystore files should be backed up before every upgrade. |
| Fastify route not found (404) | Stale build artifacts | Run `npm run build` to rebuild. Delete `dist/` directories if the issue persists. |
| `ERR_MODULE_NOT_FOUND` for CJS packages | ESM/CJS interop issue after dependency update | Verify that `ajv-formats` and `canonicalize` still use the `createRequire` import pattern. |

## Pre-Upgrade Checklist

Use this checklist before every upgrade:

```
[ ] Back up keystore directory
[ ] Back up SQLite audit database
[ ] Note current Docker image tag (if applicable)
[ ] Read release notes / CHANGELOG for the target version
[ ] Run `npm test` after build to verify
[ ] Confirm policy config is valid against new schema
[ ] Verify keystore unlock works after upgrade
```

## References

- [Configuration Reference](../configuration.md)
- [Deployment Guide](deployment.md)
- [Schema Specification](../api/schemas.md)
- [CHANGELOG](../CHANGELOG.md)
- [Development Setup](../development/dev-setup.md)
