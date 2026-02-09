import { describe, test, expect } from "vitest";
import { validateTxIntent } from "../../core/schemas/validator.js";
import { validFixtures, invalidFixtures } from "../../spec/fixtures/index.js";

describe("TxIntent schema validation", () => {
  describe("valid intents are accepted", () => {
    for (const [name, fixture] of Object.entries(validFixtures)) {
      test(`accepts valid: ${name}`, () => {
        const result = validateTxIntent(fixture);
        expect(result.valid).toBe(true);
        expect(result.errors).toBeNull();
      });
    }
  });

  describe("invalid intents are rejected", () => {
    for (const [name, fixture] of Object.entries(invalidFixtures)) {
      test(`rejects invalid: ${name}`, () => {
        const result = validateTxIntent(fixture);
        expect(result.valid).toBe(false);
        expect(result.errors).not.toBeNull();
        expect(result.errors!.length).toBeGreaterThan(0);
      });
    }
  });

  test("rejects completely empty object", () => {
    const result = validateTxIntent({});
    expect(result.valid).toBe(false);
  });

  test("rejects null", () => {
    const result = validateTxIntent(null);
    expect(result.valid).toBe(false);
  });

  test("rejects string", () => {
    const result = validateTxIntent("not an object");
    expect(result.valid).toBe(false);
  });
});
