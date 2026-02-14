import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EncryptedKeystore } from "@clavion/signer";
import { AuditTraceService } from "@clavion/audit";

const FAST_SCRYPT = { scryptN: 1024 };

const TEST_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

describe("SecurityTest: Key import audit safety", () => {
  let basePath: string;
  let keystorePath: string;
  let auditDbPath: string;

  beforeEach(() => {
    basePath = mkdtempSync(join(tmpdir(), "iscl-security-keyimport-"));
    keystorePath = join(basePath, "keystore");
    auditDbPath = join(basePath, "audit.db");
  });

  afterEach(() => {
    rmSync(basePath, { recursive: true, force: true });
  });

  test("key_imported audit event does not contain private key", async () => {
    const keystore = new EncryptedKeystore(keystorePath, FAST_SCRYPT);
    const address = await keystore.importKey(TEST_PRIVATE_KEY as `0x${string}`, "test-pass");

    const audit = new AuditTraceService(auditDbPath);
    try {
      audit.log("key_imported", {
        intentId: "system",
        address,
        source: "private_key",
      });

      // Read the audit DB and verify no key material
      const events = audit.getTrail("system");
      for (const event of events) {
        const serialized = JSON.stringify(event);
        // Raw key without 0x prefix
        const rawKey = TEST_PRIVATE_KEY.slice(2);
        expect(serialized).not.toContain(rawKey);
        expect(serialized).not.toContain(TEST_PRIVATE_KEY);
      }
    } finally {
      audit.close();
    }
  });

  test("key_imported audit event does not contain mnemonic words", async () => {
    const keystore = new EncryptedKeystore(keystorePath, FAST_SCRYPT);
    const { address, derivationPath } = await keystore.importMnemonic(
      TEST_MNEMONIC,
      "test-pass",
    );

    const audit = new AuditTraceService(auditDbPath);
    try {
      audit.log("key_imported", {
        intentId: "system",
        address,
        source: "mnemonic",
        derivationPath,
      });

      const events = audit.getTrail("system");
      for (const event of events) {
        const serialized = JSON.stringify(event);
        // No mnemonic words should appear
        expect(serialized).not.toContain("abandon");
        expect(serialized).not.toContain(TEST_MNEMONIC);
      }
    } finally {
      audit.close();
    }
  });

  test("encrypted keystore file does not contain mnemonic", async () => {
    const keystore = new EncryptedKeystore(keystorePath, FAST_SCRYPT);
    await keystore.importMnemonic(TEST_MNEMONIC, "test-pass");

    const files = readdirSync(keystorePath);
    for (const file of files) {
      const content = readFileSync(join(keystorePath, file), "utf-8");
      expect(content).not.toContain("abandon");
      expect(content).not.toContain(TEST_MNEMONIC);
    }
  });

  test("mnemonic is not recoverable from keystore — only derived key exists", async () => {
    const keystore = new EncryptedKeystore(keystorePath, FAST_SCRYPT);
    const { address } = await keystore.importMnemonic(
      TEST_MNEMONIC,
      "test-pass",
    );

    // Unlock and verify the key works
    await keystore.unlock(address, "test-pass");
    const key = keystore.getUnlockedKey(address);
    expect(key).toMatch(/^0x[0-9a-f]{64}$/);

    // The stored key should match the derivation, proving only the key is stored
    const { deriveMnemonicKey } = await import("@clavion/signer");
    const derived = deriveMnemonicKey(TEST_MNEMONIC);
    expect(key).toBe(derived.privateKey);

    // Scan all files in the keystore directory
    const files = readdirSync(keystorePath);
    const allContent = files
      .map((f) => readFileSync(join(keystorePath, f), "utf-8"))
      .join("\n");

    // The raw private key (hex without 0x) should NOT appear in plaintext
    expect(allContent).not.toContain(key.slice(2));
  });
});
