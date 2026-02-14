import { randomUUID } from "node:crypto";
import type { ApprovalSummary } from "@clavion/types";

export interface PendingApproval {
  requestId: string;
  summary: ApprovalSummary;
  createdAt: number;
}

interface PendingEntry {
  summary: ApprovalSummary;
  resolve: (approved: boolean) => void;
  createdAt: number;
  decided: boolean;
}

export class PendingApprovalStore {
  private pending = new Map<string, PendingEntry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  public readonly ttlMs: number;

  constructor(ttlMs: number = 300_000) {
    this.ttlMs = ttlMs;
    this.cleanupTimer = setInterval(() => this.cleanup(), 30_000);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  add(summary: ApprovalSummary): Promise<boolean> {
    const requestId = randomUUID();
    return new Promise<boolean>((resolve) => {
      this.pending.set(requestId, {
        summary,
        resolve,
        createdAt: Date.now(),
        decided: false,
      });
    });
  }

  list(): PendingApproval[] {
    const now = Date.now();
    const result: PendingApproval[] = [];
    for (const [requestId, entry] of this.pending) {
      if (now - entry.createdAt <= this.ttlMs) {
        result.push({
          requestId,
          summary: entry.summary,
          createdAt: entry.createdAt,
        });
      }
    }
    return result;
  }

  get(requestId: string): PendingApproval | undefined {
    const entry = this.pending.get(requestId);
    if (!entry) return undefined;
    if (Date.now() - entry.createdAt > this.ttlMs) return undefined;
    return {
      requestId,
      summary: entry.summary,
      createdAt: entry.createdAt,
    };
  }

  decide(requestId: string, approved: boolean): boolean {
    const entry = this.pending.get(requestId);
    if (!entry) return false;
    if (entry.decided) return false;
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.pending.delete(requestId);
      return false;
    }
    entry.decided = true;
    entry.resolve(approved);
    this.pending.delete(requestId);
    return true;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [requestId, entry] of this.pending) {
      if (now - entry.createdAt > this.ttlMs) {
        if (entry.decided) continue;
        entry.decided = true;
        entry.resolve(false);
        this.pending.delete(requestId);
      }
    }
  }

  close(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    for (const [, entry] of this.pending) {
      entry.resolve(false);
    }
    this.pending.clear();
  }
}
