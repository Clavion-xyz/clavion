---
name: audit-logging
description: >
  ISCL AuditTrace service — append-only event logging and correlation. Use when adding new
  audit events, querying the audit trail, debugging event correlation, or working with the
  SQLite audit store. Triggers: AuditTrace, audit log, event logging, correlation chain,
  intentId tracing, security_violation events, audit export.
---

# Audit Logging

Every critical operation in ISCL is logged to AuditTrace. This is non-negotiable — if a
signing happens without a trace, that's a bug.

## Mandatory Events

| Event | When | Key Fields |
|---|---|---|
| `intent_received` | TxIntent arrives at API | intentId, skillId, createdAt |
| `policy_evaluated` | PolicyEngine returns decision | intentId, decision, reasons, policyVersion |
| `build_completed` | TxEngine produces tx | intentId, txRequestHash, to, value, methodSig |
| `preflight_completed` | Simulation finishes | intentId, riskScore, balanceDiffs, warnings |
| `approval_issued` | Approval token created | intentId, approvalTokenId, ttl |
| `signature_created` | WalletService signs | intentId, txRequestHash, signerId |
| `tx_sent` | Broadcast to network | intentId, txHash, chainId |
| `tx_receipt` | Receipt confirmed | intentId, txHash, status, gasUsed |
| `security_violation` | Sandbox/policy violation | type, details, skillId |

## Correlation Chain

Every event carries `intentId` as the correlation key. A complete audit trail for one
transaction looks like:

```
intentId: "abc-123"
  → intent_received
  → policy_evaluated (allow)
  → build_completed (txRequestHash: "0x...")
  → preflight_completed (riskScore: 45)
  → approval_issued (tokenId: "tok-456", ttl: 300)
  → signature_created (signer: "0x...")
  → tx_sent (txHash: "0x...")
  → tx_receipt (status: 1, gasUsed: 150000)
```

If any link is missing, the audit is incomplete → flag for investigation.

## Implementation

```typescript
interface AuditEvent {
  id: string;          // event UUID
  timestamp: number;   // unix ms
  intentId: string;    // correlation key
  event: string;       // event type
  data: Record<string, unknown>; // event-specific fields
}

class AuditTraceService {
  constructor(private db: SQLiteDatabase) {}

  async log(event: string, data: AuditEventData): Promise<void> {
    await this.db.insert("audit_events", {
      id: randomUUID(),
      timestamp: Date.now(),
      intentId: data.intentId,
      event,
      data: JSON.stringify(data),
    });
  }

  async getTrail(intentId: string): Promise<AuditEvent[]> {
    return this.db.query(
      "SELECT * FROM audit_events WHERE intentId = ? ORDER BY timestamp ASC",
      [intentId]
    );
  }
}
```

## Storage

- **Primary:** SQLite — good for queries and correlation
- **Export:** JSONL for external analysis and archival
- **Retention:** Keep locally, no auto-deletion in v0.1

## SQLite Schema

```sql
CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  intent_id TEXT NOT NULL,
  event TEXT NOT NULL,
  data TEXT NOT NULL,  -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_intent_id ON audit_events(intent_id);
CREATE INDEX idx_event ON audit_events(event);
CREATE INDEX idx_timestamp ON audit_events(timestamp);
```

## Adding a New Audit Event

1. Add event name to the mandatory events table above
2. Define the `data` fields relevant to the event
3. Add `auditTrace.log(...)` call at the appropriate point in the code
4. Ensure `intentId` is always included for correlation
5. Write a test verifying the event appears in the trail after the action
6. Update JSONL export if the event has special serialization needs

## Rules

- **Never skip logging** — even on error paths, log the failure
- **Never log key material** — no private keys, no passphrases
- **Always include intentId** — the correlation chain must be unbroken
- Security violations get their own event type with `type` and `details`
