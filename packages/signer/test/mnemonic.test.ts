import { describe, test, expect } from "vitest";
import { isValidMnemonic, deriveMnemonicKey } from "@clavion/signer";
import { privateKeyToAddress } from "viem/accounts";
import { TEST_MNEMONIC_12, TEST_MNEMONIC_24 } from "../../../tools/fixtures/index.js";

describe("isValidMnemonic", () => {
  test("accepts valid 12-word mnemonic", () => {
    expect(isValidMnemonic(TEST_MNEMONIC_12)).toBe(true);
  });

  test("accepts valid 24-word mnemonic", () => {
    expect(isValidMnemonic(TEST_MNEMONIC_24)).toBe(true);
  });

  test("rejects 11-word mnemonic", () => {
    const words = TEST_MNEMONIC_12.split(" ").slice(0, 11).join(" ");
    expect(isValidMnemonic(words)).toBe(false);
  });

  test("rejects mnemonic with invalid word", () => {
    const invalid = TEST_MNEMONIC_12.replace("about", "zzzzz");
    expect(isValidMnemonic(invalid)).toBe(false);
  });

  test("rejects empty string", () => {
    expect(isValidMnemonic("")).toBe(false);
  });

  test("rejects bad checksum", () => {
    // Replace last word with a valid BIP-39 word but wrong checksum
    const badChecksum = TEST_MNEMONIC_12.replace("about", "abandon");
    expect(isValidMnemonic(badChecksum)).toBe(false);
  });

  test("handles extra whitespace", () => {
    const padded = `  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  about  `;
    expect(isValidMnemonic(padded)).toBe(true);
  });

  test("handles uppercase input", () => {
    expect(isValidMnemonic(TEST_MNEMONIC_12.toUpperCase())).toBe(true);
  });
});

describe("deriveMnemonicKey", () => {
  test("derives a valid hex private key", () => {
    const result = deriveMnemonicKey(TEST_MNEMONIC_12);
    expect(result.privateKey).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("derived address matches viem derivation", () => {
    const result = deriveMnemonicKey(TEST_MNEMONIC_12);
    const expectedAddress = privateKeyToAddress(result.privateKey).toLowerCase();
    expect(result.address).toBe(expectedAddress);
  });

  test("default derivation path is m/44'/60'/0'/0/0", () => {
    const result = deriveMnemonicKey(TEST_MNEMONIC_12);
    expect(result.derivationPath).toBe("m/44'/60'/0'/0/0");
  });

  test("accountIndex changes derived address", () => {
    const result0 = deriveMnemonicKey(TEST_MNEMONIC_12, { accountIndex: 0 });
    const result1 = deriveMnemonicKey(TEST_MNEMONIC_12, { accountIndex: 1 });
    expect(result0.address).not.toBe(result1.address);
    expect(result1.derivationPath).toBe("m/44'/60'/1'/0/0");
  });

  test("addressIndex changes derived address", () => {
    const result0 = deriveMnemonicKey(TEST_MNEMONIC_12, { addressIndex: 0 });
    const result1 = deriveMnemonicKey(TEST_MNEMONIC_12, { addressIndex: 1 });
    expect(result0.address).not.toBe(result1.address);
    expect(result1.derivationPath).toBe("m/44'/60'/0'/0/1");
  });

  test("same mnemonic + same options = deterministic result", () => {
    const a = deriveMnemonicKey(TEST_MNEMONIC_12);
    const b = deriveMnemonicKey(TEST_MNEMONIC_12);
    expect(a.privateKey).toBe(b.privateKey);
    expect(a.address).toBe(b.address);
  });

  test("throws for invalid mnemonic", () => {
    expect(() => deriveMnemonicKey("not a valid mnemonic")).toThrow();
  });

  test("24-word mnemonic derives different address than 12-word", () => {
    const result12 = deriveMnemonicKey(TEST_MNEMONIC_12);
    const result24 = deriveMnemonicKey(TEST_MNEMONIC_24);
    expect(result12.address).not.toBe(result24.address);
  });

  test("hdPassphrase changes derived address", () => {
    const withoutPass = deriveMnemonicKey(TEST_MNEMONIC_12);
    const withPass = deriveMnemonicKey(TEST_MNEMONIC_12, {
      hdPassphrase: "my secret",
    });
    expect(withoutPass.address).not.toBe(withPass.address);
  });
});
