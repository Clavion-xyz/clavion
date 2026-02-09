import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { ApprovalToken } from "../types.js";

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS approval_tokens (
    id TEXT PRIMARY KEY,
    intent_id TEXT NOT NULL,
    tx_request_hash TEXT NOT NULL,
    issued_at INTEGER NOT NULL,
    ttl_seconds INTEGER NOT NULL,
    consumed INTEGER NOT NULL DEFAULT 0
  );
`;

const CREATE_INDEXES_SQL = [
  "CREATE INDEX IF NOT EXISTS idx_approval_intent ON approval_tokens(intent_id);",
  "CREATE INDEX IF NOT EXISTS idx_approval_issued ON approval_tokens(issued_at);",
];

interface TokenRow {
  id: string;
  intent_id: string;
  tx_request_hash: string;
  issued_at: number;
  ttl_seconds: number;
  consumed: number;
}

export class ApprovalTokenManager {
  private db: Database.Database;
  private issueStmt: Database.Statement;
  private findStmt: Database.Statement;
  private consumeStmt: Database.Statement;
  private cleanupStmt: Database.Statement;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(CREATE_TABLE_SQL);
    for (const sql of CREATE_INDEXES_SQL) {
      this.db.exec(sql);
    }
    this.issueStmt = this.db.prepare(
      "INSERT INTO approval_tokens (id, intent_id, tx_request_hash, issued_at, ttl_seconds) VALUES (?, ?, ?, ?, ?)",
    );
    this.findStmt = this.db.prepare("SELECT * FROM approval_tokens WHERE id = ?");
    this.consumeStmt = this.db.prepare("UPDATE approval_tokens SET consumed = 1 WHERE id = ?");
    this.cleanupStmt = this.db.prepare("DELETE FROM approval_tokens WHERE issued_at + ttl_seconds <= ?");
  }

  issue(intentId: string, txRequestHash: string, ttlSeconds: number = 300): ApprovalToken {
    const token: ApprovalToken = {
      id: randomUUID(),
      intentId,
      txRequestHash,
      issuedAt: Math.floor(Date.now() / 1000),
      ttlSeconds,
      consumed: false,
    };
    this.issueStmt.run(token.id, token.intentId, token.txRequestHash, token.issuedAt, token.ttlSeconds);
    return token;
  }

  get(tokenId: string): ApprovalToken | undefined {
    const row = this.findStmt.get(tokenId) as TokenRow | undefined;
    if (!row) return undefined;
    return {
      id: row.id,
      intentId: row.intent_id,
      txRequestHash: row.tx_request_hash,
      issuedAt: row.issued_at,
      ttlSeconds: row.ttl_seconds,
      consumed: row.consumed === 1,
    };
  }

  validate(tokenId: string, intentId: string, txRequestHash: string): boolean {
    const row = this.findStmt.get(tokenId) as TokenRow | undefined;
    if (!row) return false;

    const now = Math.floor(Date.now() / 1000);
    const expired = now >= row.issued_at + row.ttl_seconds;

    return (
      row.consumed === 0 && !expired && row.intent_id === intentId && row.tx_request_hash === txRequestHash
    );
  }

  consume(tokenId: string): void {
    this.consumeStmt.run(tokenId);
  }

  cleanup(): void {
    const now = Math.floor(Date.now() / 1000);
    this.cleanupStmt.run(now);
  }

  close(): void {
    this.db.close();
  }
}
