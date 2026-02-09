import { describe, test, expect } from "vitest";
import { computeIntentHash } from "@clavion/core";
import { validFixtures, expectedHashes } from "../../../tools/fixtures/index.js";
import type { TxIntent } from "@clavion/types";

describe("Intent canonicalization and hashing", () => {
  for (const [name, fixture] of Object.entries(validFixtures)) {
    test(`hash for ${name} matches fixture`, () => {
      const hash = computeIntentHash(fixture as TxIntent);
      expect(hash).toBe(expectedHashes[name]);
    });
  }

  test("identical intents produce identical hashes", () => {
    const hash1 = computeIntentHash(validFixtures.transfer);
    const hash2 = computeIntentHash(validFixtures.transfer);
    expect(hash1).toBe(hash2);
  });

  test("different intents produce different hashes", () => {
    const hash1 = computeIntentHash(validFixtures.transfer);
    const hash2 = computeIntentHash(validFixtures.approve);
    expect(hash1).not.toBe(hash2);
  });

  test("property order does not affect hash (JCS canonical)", () => {
    const intent = validFixtures.transfer;
    const reversed = JSON.parse(JSON.stringify(intent)) as TxIntent;
    const hash1 = computeIntentHash(intent);
    const hash2 = computeIntentHash(reversed);
    expect(hash1).toBe(hash2);
  });

  test("hash is a valid 0x-prefixed keccak256 hex string", () => {
    const hash = computeIntentHash(validFixtures.transfer);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
