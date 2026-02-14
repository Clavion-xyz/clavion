import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { AuditEvent } from "@clavion/types";

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    intent_id TEXT NOT NULL,
    event TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

const CREATE_INDEXES_SQL = [
  "CREATE INDEX IF NOT EXISTS idx_intent_id ON audit_events(intent_id);",
  "CREATE INDEX IF NOT EXISTS idx_event ON audit_events(event);",
  "CREATE INDEX IF NOT EXISTS idx_timestamp ON audit_events(timestamp);",
];

const CREATE_RATE_LIMIT_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS rate_limit_events (
    wallet_address TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  );
`;

const CREATE_RATE_LIMIT_INDEX_SQL =
  "CREATE INDEX IF NOT EXISTS idx_rate_wallet_ts ON rate_limit_events(wallet_address, timestamp);";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const MAX_RECENT_EVENTS_LIMIT = 1000;

interface AuditRow {
  id: string;
  timestamp: number;
  intent_id: string;
  event: string;
  data: string;
}

export class AuditTraceService {
  public readonly db: Database.Database;
  private insertStmt: Database.Statement;
  private selectByIntentStmt: Database.Statement;
  private selectRecentStmt: Database.Statement;
  private rateLimitInsertStmt: Database.Statement;
  private rateLimitCountStmt: Database.Statement;
  private rateLimitCleanupStmt: Database.Statement;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(CREATE_TABLE_SQL);
    for (const sql of CREATE_INDEXES_SQL) {
      this.db.exec(sql);
    }
    this.db.exec(CREATE_RATE_LIMIT_TABLE_SQL);
    this.db.exec(CREATE_RATE_LIMIT_INDEX_SQL);
    this.insertStmt = this.db.prepare(
      "INSERT INTO audit_events (id, timestamp, intent_id, event, data) VALUES (?, ?, ?, ?, ?)",
    );
    this.selectByIntentStmt = this.db.prepare(
      "SELECT * FROM audit_events WHERE intent_id = ? ORDER BY timestamp ASC",
    );
    this.selectRecentStmt = this.db.prepare(
      "SELECT * FROM audit_events ORDER BY timestamp DESC LIMIT ?",
    );
    this.rateLimitInsertStmt = this.db.prepare(
      "INSERT INTO rate_limit_events (wallet_address, timestamp) VALUES (?, ?)",
    );
    this.rateLimitCountStmt = this.db.prepare(
      "SELECT COUNT(*) AS count FROM rate_limit_events WHERE wallet_address = ? AND timestamp > ?",
    );
    this.rateLimitCleanupStmt = this.db.prepare(
      "DELETE FROM rate_limit_events WHERE timestamp <= ?",
    );
  }

  log(event: string, data: { intentId: string; [key: string]: unknown }): void {
    const id = randomUUID();
    const timestamp = Date.now();
    this.insertStmt.run(id, timestamp, data.intentId, event, JSON.stringify(data));
  }

  getTrail(intentId: string): AuditEvent[] {
    const rows = this.selectByIntentStmt.all(intentId) as AuditRow[];
    return rows.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      intentId: row.intent_id,
      event: row.event,
      data: JSON.parse(row.data) as Record<string, unknown>,
    }));
  }

  getRecentEvents(limit: number = 20): AuditEvent[] {
    const effectiveLimit = Math.min(Math.max(1, limit), MAX_RECENT_EVENTS_LIMIT);
    const rows = this.selectRecentStmt.all(effectiveLimit) as AuditRow[];
    return rows.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      intentId: row.intent_id,
      event: row.event,
      data: JSON.parse(row.data) as Record<string, unknown>,
    }));
  }

  recordRateLimitTick(walletAddress: string): void {
    if (!ADDRESS_RE.test(walletAddress)) {
      throw new Error(`Invalid wallet address: ${walletAddress}`);
    }
    this.rateLimitInsertStmt.run(walletAddress, Date.now());
  }

  countRecentTxByWallet(walletAddress: string, windowMs: number): number {
    const since = Date.now() - windowMs;
    const row = this.rateLimitCountStmt.get(walletAddress, since) as { count: number };
    return row.count;
  }

  cleanupRateLimitEvents(windowMs: number): number {
    const cutoff = Date.now() - windowMs;
    const result = this.rateLimitCleanupStmt.run(cutoff);
    return result.changes;
  }

  close(): void {
    this.db.close();
  }
}
