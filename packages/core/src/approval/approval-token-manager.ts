import Database from "better-sqlite3";
import { randomUUID, timingSafeEqual } from "node:crypto";
import type { ApprovalToken } from "@clavion/types";

export type TokenValidationReason =
  | "not_found"
  | "expired"
  | "consumed"
  | "intent_mismatch"
  | "hash_mismatch";

export interface TokenValidationResult {
  valid: boolean;
  reason?: TokenValidationReason;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

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

  validate(tokenId: string, intentId: string, txRequestHash: string): TokenValidationResult {
    const row = this.findStmt.get(tokenId) as TokenRow | undefined;
    if (!row) return { valid: false, reason: "not_found" };

    const now = Math.floor(Date.now() / 1000);
    if (row.consumed !== 0) return { valid: false, reason: "consumed" };
    if (now >= row.issued_at + row.ttl_seconds) return { valid: false, reason: "expired" };
    if (!safeEqual(row.intent_id, intentId)) return { valid: false, reason: "intent_mismatch" };
    if (!safeEqual(row.tx_request_hash, txRequestHash)) return { valid: false, reason: "hash_mismatch" };

    return { valid: true };
  }

  consume(tokenId: string): void {
    this.consumeStmt.run(tokenId);
  }

  validateAndConsume(tokenId: string, intentId: string, txRequestHash: string): TokenValidationResult {
    const txn = this.db.transaction(() => {
      const row = this.findStmt.get(tokenId) as TokenRow | undefined;
      if (!row) return { valid: false, reason: "not_found" } as TokenValidationResult;

      const now = Math.floor(Date.now() / 1000);
      if (row.consumed !== 0) return { valid: false, reason: "consumed" } as TokenValidationResult;
      if (now >= row.issued_at + row.ttl_seconds) return { valid: false, reason: "expired" } as TokenValidationResult;
      if (!safeEqual(row.intent_id, intentId)) return { valid: false, reason: "intent_mismatch" } as TokenValidationResult;
      if (!safeEqual(row.tx_request_hash, txRequestHash)) return { valid: false, reason: "hash_mismatch" } as TokenValidationResult;

      this.consumeStmt.run(tokenId);
      return { valid: true } as TokenValidationResult;
    });
    return txn();
  }

  cleanup(): void {
    const now = Math.floor(Date.now() / 1000);
    this.cleanupStmt.run(now);
  }

  close(): void {
    this.db.close();
  }
}
