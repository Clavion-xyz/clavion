import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EncryptedKeystore, deriveMnemonicKey } from "@clavion/signer";
import { FAST_SCRYPT, TEST_MNEMONIC_12 } from "../../../tools/fixtures/index.js";

const TEST_MNEMONIC = TEST_MNEMONIC_12;

describe("EncryptedKeystore.importMnemonic", () => {
  let keystorePath: string;
  let keystore: EncryptedKeystore;

  beforeEach(() => {
    keystorePath = mkdtempSync(join(tmpdir(), "iscl-mnemonic-test-"));
    keystore = new EncryptedKeystore(keystorePath, FAST_SCRYPT);
  });

  afterEach(() => {
    rmSync(keystorePath, { recursive: true, force: true });
  });

  test("imports mnemonic and returns address + derivation path", async () => {
    const result = await keystore.importMnemonic(TEST_MNEMONIC, "test-pass");
    expect(result.address).toMatch(/^0x[0-9a-f]{40}$/);
    expect(result.derivationPath).toBe("m/44'/60'/0'/0/0");
  });

  test("imported key can be unlocked and used", async () => {
    const { address } = await keystore.importMnemonic(
      TEST_MNEMONIC,
      "test-pass",
    );
    await keystore.unlock(address, "test-pass");
    expect(keystore.isUnlocked(address)).toBe(true);

    const key = keystore.getUnlockedKey(address);
    expect(key).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("imported key matches direct derivation", async () => {
    const expected = deriveMnemonicKey(TEST_MNEMONIC);
    const { address } = await keystore.importMnemonic(
      TEST_MNEMONIC,
      "test-pass",
    );
    expect(address).toBe(expected.address);

    await keystore.unlock(address, "test-pass");
    expect(keystore.getUnlockedKey(address)).toBe(expected.privateKey);
  });

  test("custom accountIndex produces different address", async () => {
    const result0 = await keystore.importMnemonic(TEST_MNEMONIC, "test-pass", {
      accountIndex: 0,
    });
    const result1 = await keystore.importMnemonic(TEST_MNEMONIC, "test-pass", {
      accountIndex: 1,
    });
    expect(result0.address).not.toBe(result1.address);
    expect(result1.derivationPath).toBe("m/44'/60'/1'/0/0");
  });

  test("duplicate address from mnemonic import throws", async () => {
    await keystore.importMnemonic(TEST_MNEMONIC, "test-pass");
    await expect(
      keystore.importMnemonic(TEST_MNEMONIC, "test-pass"),
    ).rejects.toThrow("already exists");
  });

  test("invalid mnemonic throws", async () => {
    await expect(
      keystore.importMnemonic("not valid mnemonic words here", "test-pass"),
    ).rejects.toThrow("Invalid BIP-39 mnemonic");
  });

  test("encrypted file does not contain mnemonic words", async () => {
    await keystore.importMnemonic(TEST_MNEMONIC, "test-pass");

    // Read all .enc files in keystore directory
    const files = readdirSync(keystorePath).filter((f) => f.endsWith(".enc"));
    expect(files.length).toBe(1);

    const content = readFileSync(join(keystorePath, files[0]!), "utf-8");

    // No mnemonic word should appear in the encrypted file
    // (checking "abandon" which appears 11 times)
    expect(content).not.toContain("abandon");
    expect(content).not.toContain("about");
  });
});
