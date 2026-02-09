import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { AuditTraceService } from "../../core/audit/audit-trace-service.js";
import { randomUUID } from "node:crypto";

describe("AuditTraceService", () => {
  let audit: AuditTraceService;

  beforeEach(() => {
    // Use in-memory SQLite for tests
    audit = new AuditTraceService(":memory:");
  });

  afterEach(() => {
    audit.close();
  });

  test("log() and getTrail() round-trip", () => {
    const intentId = randomUUID();
    audit.log("intent_received", { intentId, source: "test-skill" });
    audit.log("policy_evaluated", { intentId, decision: "allow" });

    const trail = audit.getTrail(intentId);
    expect(trail).toHaveLength(2);
    expect(trail[0]!.event).toBe("intent_received");
    expect(trail[1]!.event).toBe("policy_evaluated");
  });

  test("trail is ordered by timestamp", () => {
    const intentId = randomUUID();
    audit.log("event_a", { intentId });
    audit.log("event_b", { intentId });
    audit.log("event_c", { intentId });

    const trail = audit.getTrail(intentId);
    for (let i = 1; i < trail.length; i++) {
      expect(trail[i]!.timestamp).toBeGreaterThanOrEqual(trail[i - 1]!.timestamp);
    }
  });

  test("trails are isolated by intentId", () => {
    const id1 = randomUUID();
    const id2 = randomUUID();
    audit.log("event_for_1", { intentId: id1 });
    audit.log("event_for_2", { intentId: id2 });

    expect(audit.getTrail(id1)).toHaveLength(1);
    expect(audit.getTrail(id2)).toHaveLength(1);
  });

  test("event data is preserved through JSON round-trip", () => {
    const intentId = randomUUID();
    audit.log("build_completed", {
      intentId,
      txRequestHash: "0xabcdef",
      to: "0x1234",
      value: "1000000",
    });

    const trail = audit.getTrail(intentId);
    expect(trail[0]!.data).toHaveProperty("txRequestHash", "0xabcdef");
  });

  test("empty trail for unknown intentId", () => {
    const trail = audit.getTrail("nonexistent-id");
    expect(trail).toHaveLength(0);
  });
});
