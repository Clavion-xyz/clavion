# ADR-002: SQLite for Audit Trail

**Status:** Accepted
**Date:** 2025-02-01
**Deciders:** Architecture team

## Context

ISCL requires an append-only audit trail that records every security-relevant step in the transaction lifecycle: intent receipt, policy evaluation, preflight simulation, approval decisions, signing events, broadcast results, and errors. This trail serves three purposes:

1. **Incident forensics.** When something goes wrong -- a transaction is unexpectedly approved, a policy bypass is suspected, or funds move to an unrecognized address -- operators need a complete, tamper-evident record of every step that led to the outcome, correlated by a single intent ID.

2. **Compliance and accountability.** Each audit event captures who requested what, which policy rules were applied, what risk score was calculated, whether the user approved, and when the signature was produced. This provides a provable chain of custody for every signing operation.

3. **Rate limiting.** The policy engine enforces per-wallet transaction rate limits (e.g., 10 transactions per hour). This requires durable, queryable state that survives process restarts -- counting recent transactions by wallet address within a sliding time window.

The audit store needs to satisfy these requirements:

- **Append-only writes.** Events are inserted but never updated or deleted. This prevents retroactive tampering with the audit record.
- **Correlation queries.** Retrieve all events for a given intent ID to reconstruct the full lifecycle of a single operation.
- **Time-ordered retrieval.** List recent events across all intents for dashboard display and monitoring.
- **Rate limit queries.** Count events per wallet within a time window, with efficient indexed lookups.
- **Zero external dependencies.** ISCL is a local runtime -- it should not require a database server, connection pool, or network-accessible data store.
- **Durability.** Events must survive process crashes without data loss.
- **Low latency.** Audit logging is in the critical path of every transaction. Inserts must not block the pipeline.

Alternatives considered:

1. **PostgreSQL / MySQL** -- Full-featured relational databases. Satisfy all query requirements but introduce an external server dependency, connection management, schema migrations, and operational overhead (backups, user management, network configuration). Dramatically overweight for a local single-user runtime.

2. **Flat-file JSON / JSONL** -- Simple append-only writing. No dependencies. But queries require scanning the entire file. Rate limit counts and correlation queries become O(n) as the log grows. No indexing, no transactions, no crash safety guarantees.

3. **LevelDB / RocksDB** -- Embedded key-value stores. Low overhead, no external dependencies. But key-value semantics are awkward for the access patterns needed: range queries over timestamps, filtering by intent ID, counting by wallet address within a window. Would require building a secondary index layer on top.

4. **In-memory only** -- Fastest option. But all audit data is lost on process restart. Unacceptable for forensics, compliance, and rate limiting that must survive restarts.

## Decision

Use SQLite via `better-sqlite3` as the audit trail storage engine, with WAL (Write-Ahead Logging) mode enabled.

### Schema Design

Two tables serve distinct purposes:

**`audit_events`** -- The primary audit trail. Each row is an immutable event.

```sql
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,           -- UUID, generated per event
  timestamp INTEGER NOT NULL,    -- Unix milliseconds (Date.now())
  intent_id TEXT NOT NULL,       -- Correlation key linking all events for one intent
  event TEXT NOT NULL,           -- Event type (e.g. "policy_evaluated", "signed")
  data TEXT NOT NULL,            -- JSON payload with event-specific details
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_intent_id ON audit_events(intent_id);
CREATE INDEX idx_event ON audit_events(event);
CREATE INDEX idx_timestamp ON audit_events(timestamp);
```

**`rate_limit_events`** -- Lightweight table for per-wallet rate counting.

```sql
CREATE TABLE IF NOT EXISTS rate_limit_events (
  wallet_address TEXT NOT NULL,  -- Checksummed 0x address
  timestamp INTEGER NOT NULL     -- Unix milliseconds
);

CREATE INDEX idx_rate_wallet_ts ON rate_limit_events(wallet_address, timestamp);
```

Rate limit events are periodically cleaned up (rows older than the rate limit window are deleted) to prevent unbounded growth.

### Access Patterns

The `AuditTraceService` class provides five operations:

| Method | Query | Purpose |
|--------|-------|---------|
| `log(event, data)` | `INSERT INTO audit_events` | Append an audit event |
| `getTrail(intentId)` | `WHERE intent_id = ? ORDER BY timestamp ASC` | Reconstruct an intent's lifecycle |
| `getRecentEvents(limit)` | `ORDER BY timestamp DESC LIMIT ?` | Dashboard and monitoring display |
| `recordRateLimitTick(wallet)` | `INSERT INTO rate_limit_events` | Record a transaction for rate counting |
| `countRecentTxByWallet(wallet, windowMs)` | `WHERE wallet_address = ? AND timestamp > ?` | Count recent transactions for rate limiting |

All queries use prepared statements, created once at initialization and reused for every call. This eliminates SQL parsing overhead on the hot path.

### WAL Mode

WAL (Write-Ahead Logging) is enabled at initialization via `PRAGMA journal_mode = WAL`. This provides:

- **Concurrent reads during writes.** The audit trail can be queried (e.g., for the web dashboard) while new events are being written without blocking.
- **Better write performance.** WAL batches writes to a separate log file before merging, reducing filesystem synchronization overhead.
- **Crash safety.** WAL ensures that committed transactions survive process crashes. An incomplete write during a crash is automatically rolled back on next open.

### Synchronous Writes

`better-sqlite3` is chosen specifically because it provides synchronous, blocking operations. In the ISCL audit context, this is a feature:

- Audit writes complete before the pipeline proceeds to the next step. There is no risk of "audit gap" where a signing event occurs but the corresponding audit record is lost due to an async write queue.
- The synchronous API simplifies error handling -- a failed write throws immediately in the calling context.
- Latency of SQLite inserts (with WAL, on SSD) is typically 10-50 microseconds. This is negligible compared to RPC calls (~50-500ms) and blockchain confirmation (~2-12 seconds) in the same pipeline.

## Consequences

### Positive

- **Zero deployment dependencies.** SQLite is embedded in the process. No database server to install, configure, monitor, or secure. The audit trail is a single file on disk.
- **Natural correlation model.** SQL queries make it trivial to reconstruct an intent's lifecycle (`WHERE intent_id = ?`), count events in a window (`WHERE timestamp > ?`), or analyze patterns (`GROUP BY event`).
- **Crash-safe durability.** WAL mode guarantees that committed events survive unexpected process termination. This is essential for an audit trail that must be tamper-evident.
- **Fast enough for the hot path.** Prepared statement inserts with WAL mode add microseconds of latency per audit event. Given that each transaction pipeline includes multiple RPC calls (50-500ms each), audit logging is never the bottleneck.
- **Portable.** The audit database is a single `.sqlite` file. It can be backed up with a file copy, moved between machines, or inspected with any SQLite client (`sqlite3` CLI, DB Browser for SQLite, DBeaver).
- **Rate limiting survives restarts.** Because rate limit state is persisted to SQLite, restarting ISCL Core does not reset the transaction counter. An attacker cannot bypass rate limits by triggering a process restart.

### Negative

- **Single-machine storage.** SQLite is not a networked database. If ISCL were to support distributed deployments (multiple Core instances sharing one audit trail), SQLite would need to be replaced or fronted by a replication layer. This is not a concern for v0.1's localhost-only model.
- **No built-in replication or high availability.** If the disk fails, the audit trail is lost (unless backed up). Operators should configure regular file backups for production deployments.
- **Schema changes require migration logic.** Adding new columns or indexes to the audit table requires explicit migration code. The current implementation uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`, which handles initial setup but not column alterations.
- **Data column is opaque JSON.** The `data` column stores event payloads as serialized JSON strings. This means queries that filter on payload fields (e.g., "find all events where risk score > 80") require `json_extract()` in SQLite, which is functional but slower than dedicated columns.

### Neutral

- **WAL mode creates additional files.** SQLite in WAL mode maintains `-wal` and `-shm` files alongside the main database. These are normal and managed automatically, but operators should be aware they exist when backing up (copy all three files, or use `.backup` command).
- **`better-sqlite3` is a native addon.** It requires compilation during `npm install` (via `prebuild`). This adds a build step but provides the synchronous API that makes audit writes deterministic. The package is widely used (>700K weekly downloads) and provides prebuilt binaries for all major platforms.
- **Event types are not enforced by schema.** The `event` column is free-text. Event type consistency is enforced by the `AuditTraceService` API and calling code, not by database constraints. This allows adding new event types without schema migration.

## References

- [Audit Trail Guide](../../operations/audit-trail.md) -- Event types, querying patterns, incident investigation
- [Observability Guide](../../operations/observability.md) -- Log forwarding, monitoring, alerting
- [ADR-001: Trust Domain Isolation](001-trust-domain-isolation.md) -- Audit trail as a security enforcement layer
- [better-sqlite3 documentation](https://github.com/WiseLibs/better-sqlite3) -- Synchronous SQLite bindings for Node.js
