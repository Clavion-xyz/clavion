import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { ApprovalTokenManager } from "@clavion/core";

describe("ApprovalTokenManager", () => {
  let manager: ApprovalTokenManager;

  beforeEach(() => {
    manager = new ApprovalTokenManager(":memory:");
  });

  afterEach(() => {
    manager.close();
  });

  const intentId = "550e8400-e29b-41d4-a716-446655440000";
  const txRequestHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

  test("issue() creates a valid token with correct fields", () => {
    const token = manager.issue(intentId, txRequestHash);
    expect(token.id).toBeDefined();
    expect(token.intentId).toBe(intentId);
    expect(token.txRequestHash).toBe(txRequestHash);
    expect(token.ttlSeconds).toBe(300);
    expect(token.consumed).toBe(false);
    expect(token.issuedAt).toBeGreaterThan(0);
  });

  test("issue() accepts custom TTL", () => {
    const token = manager.issue(intentId, txRequestHash, 60);
    expect(token.ttlSeconds).toBe(60);
  });

  test("validate() succeeds with matching parameters", () => {
    const token = manager.issue(intentId, txRequestHash);
    expect(manager.validate(token.id, intentId, txRequestHash)).toEqual({ valid: true });
  });

  test("validate() fails for non-existent token", () => {
    expect(manager.validate("non-existent-id", intentId, txRequestHash)).toEqual({ valid: false, reason: "not_found" });
  });

  test("validate() fails with wrong intentId", () => {
    const token = manager.issue(intentId, txRequestHash);
    expect(manager.validate(token.id, "wrong-intent-id", txRequestHash)).toEqual({ valid: false, reason: "intent_mismatch" });
  });

  test("validate() fails with wrong txRequestHash", () => {
    const token = manager.issue(intentId, txRequestHash);
    expect(manager.validate(token.id, intentId, "0xwronghash")).toEqual({ valid: false, reason: "hash_mismatch" });
  });

  test("validate() fails for consumed token", () => {
    const token = manager.issue(intentId, txRequestHash);
    manager.consume(token.id);
    expect(manager.validate(token.id, intentId, txRequestHash)).toEqual({ valid: false, reason: "consumed" });
  });

  test("validate() fails for expired token", () => {
    // Issue with 0 TTL — already expired
    const token = manager.issue(intentId, txRequestHash, 0);
    expect(manager.validate(token.id, intentId, txRequestHash)).toEqual({ valid: false, reason: "expired" });
  });

  test("consume() marks token as used", () => {
    const token = manager.issue(intentId, txRequestHash);
    expect(manager.validate(token.id, intentId, txRequestHash)).toEqual({ valid: true });
    manager.consume(token.id);
    expect(manager.validate(token.id, intentId, txRequestHash)).toEqual({ valid: false, reason: "consumed" });
  });

  test("cleanup() removes expired tokens", () => {
    // Issue a token with 0 TTL (already expired)
    const expired = manager.issue(intentId, txRequestHash, 0);
    // Issue a token with long TTL
    const valid = manager.issue("other-intent", txRequestHash, 3600);

    manager.cleanup();

    // Expired token should be gone (cleanup deletes the row)
    expect(manager.validate(expired.id, intentId, txRequestHash)).toEqual({ valid: false, reason: "not_found" });
    // Valid token should still exist
    expect(manager.validate(valid.id, "other-intent", txRequestHash)).toEqual({ valid: true });
  });
});
