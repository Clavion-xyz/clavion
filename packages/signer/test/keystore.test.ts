import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EncryptedKeystore } from "@clavion/signer";
import { privateKeyToAddress } from "viem/accounts";
import { TEST_PRIVATE_KEY, FAST_SCRYPT } from "../../../tools/fixtures/index.js";

const TEST_ADDRESS = privateKeyToAddress(TEST_PRIVATE_KEY).toLowerCase();

describe("EncryptedKeystore", () => {
  let keystorePath: string;
  let keystore: EncryptedKeystore;

  beforeEach(() => {
    keystorePath = mkdtempSync(join(tmpdir(), "iscl-keystore-test-"));
    keystore = new EncryptedKeystore(keystorePath, FAST_SCRYPT);
  });

  afterEach(() => {
    rmSync(keystorePath, { recursive: true, force: true });
  });

  test("generate() creates a new key and returns an address", async () => {
    const address = await keystore.generate("test-pass");
    expect(address).toMatch(/^0x[0-9a-f]{40}$/);
  });

  test("importKey() stores a key and returns its address", async () => {
    const address = await keystore.importKey(TEST_PRIVATE_KEY, "test-pass");
    expect(address).toBe(TEST_ADDRESS);
  });

  test("listAddresses() returns imported addresses", async () => {
    await keystore.importKey(TEST_PRIVATE_KEY, "test-pass");
    const addresses = keystore.listAddresses();
    expect(addresses).toContain(TEST_ADDRESS);
  });

  test("unlock() with correct passphrase succeeds", async () => {
    await keystore.importKey(TEST_PRIVATE_KEY, "test-pass");
    await keystore.unlock(TEST_ADDRESS, "test-pass");
    expect(keystore.isUnlocked(TEST_ADDRESS)).toBe(true);
  });

  test("unlock() with wrong passphrase throws", async () => {
    await keystore.importKey(TEST_PRIVATE_KEY, "test-pass");
    await expect(keystore.unlock(TEST_ADDRESS, "wrong-pass")).rejects.toThrow(
      "Invalid passphrase or corrupted key file",
    );
  });

  test("getUnlockedKey() returns key after unlock", async () => {
    await keystore.importKey(TEST_PRIVATE_KEY, "test-pass");
    await keystore.unlock(TEST_ADDRESS, "test-pass");
    const key = keystore.getUnlockedKey(TEST_ADDRESS);
    expect(key).toBe(TEST_PRIVATE_KEY);
  });

  test("getUnlockedKey() throws if locked", async () => {
    await keystore.importKey(TEST_PRIVATE_KEY, "test-pass");
    expect(() => keystore.getUnlockedKey(TEST_ADDRESS)).toThrow("is not unlocked");
  });

  test("lock() removes key from memory", async () => {
    await keystore.importKey(TEST_PRIVATE_KEY, "test-pass");
    await keystore.unlock(TEST_ADDRESS, "test-pass");
    expect(keystore.isUnlocked(TEST_ADDRESS)).toBe(true);
    keystore.lock(TEST_ADDRESS);
    expect(keystore.isUnlocked(TEST_ADDRESS)).toBe(false);
    expect(() => keystore.getUnlockedKey(TEST_ADDRESS)).toThrow("is not unlocked");
  });

  test("duplicate importKey() throws", async () => {
    await keystore.importKey(TEST_PRIVATE_KEY, "test-pass");
    await expect(keystore.importKey(TEST_PRIVATE_KEY, "test-pass", "other")).rejects.toThrow(
      "already exists",
    );
  });

  test("metadata persists across keystore instances", async () => {
    await keystore.importKey(TEST_PRIVATE_KEY, "test-pass", "myprofile");

    // Create new keystore instance pointing to same path
    const keystore2 = new EncryptedKeystore(keystorePath, FAST_SCRYPT);
    const addresses = keystore2.listAddresses();
    expect(addresses).toContain(TEST_ADDRESS);

    // Can unlock from new instance
    await keystore2.unlock(TEST_ADDRESS, "test-pass");
    expect(keystore2.getUnlockedKey(TEST_ADDRESS)).toBe(TEST_PRIVATE_KEY);
  });

  test("encrypted file contains no plaintext key material", async () => {
    await keystore.importKey(TEST_PRIVATE_KEY, "test-pass");

    // Read the metadata to find the encrypted file
    const metadata = JSON.parse(readFileSync(join(keystorePath, "keystore.json"), "utf-8"));
    const encFile = readFileSync(join(keystorePath, metadata.keys[0].file), "utf-8");

    // The raw private key (without 0x) should NOT appear in the file
    const rawKey = TEST_PRIVATE_KEY.slice(2);
    expect(encFile).not.toContain(rawKey);
  });

  test("unlock() with unknown address throws", async () => {
    await expect(keystore.unlock("0x0000000000000000000000000000000000000000", "test-pass")).rejects.toThrow(
      "No key found for address",
    );
  });

  test("address comparison is case-insensitive", async () => {
    await keystore.importKey(TEST_PRIVATE_KEY, "test-pass");
    const upperAddress = TEST_ADDRESS.slice(0, 2) + TEST_ADDRESS.slice(2).toUpperCase();
    await keystore.unlock(upperAddress, "test-pass");
    expect(keystore.isUnlocked(upperAddress)).toBe(true);
    expect(keystore.getUnlockedKey(upperAddress)).toBe(TEST_PRIVATE_KEY);
  });
});
