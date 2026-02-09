import { describe, test, expect } from "vitest";
import { privateKeyToAddress } from "viem/accounts";
import {
  computeManifestHash,
  signManifest,
  verifyManifest,
} from "../../core/skill/manifest-signer.js";
import { hashFile, verifyFileHashes } from "../../core/skill/file-hasher.js";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SkillManifest } from "../../core/types.js";

// Deterministic test key — NEVER use in production
const TEST_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const TEST_ADDRESS = privateKeyToAddress(TEST_PRIVATE_KEY);

function baseManifest(): Omit<SkillManifest, "signature"> {
  return {
    version: "1",
    name: "test-skill",
    publisher: {
      name: "Test Publisher",
      address: TEST_ADDRESS,
      contact: "test@example.com",
    },
    permissions: {
      txActions: ["transfer"],
      chains: [8453],
      networkAccess: false,
      filesystemAccess: false,
    },
    sandbox: {
      memoryMb: 128,
      timeoutMs: 10000,
      allowSpawn: false,
    },
    files: [
      {
        path: "index.js",
        sha256: "a".repeat(64),
      },
    ],
  };
}

describe("computeManifestHash", () => {
  test("returns deterministic hash", () => {
    const manifest = { ...baseManifest(), signature: "0xaabb" } as SkillManifest;
    const hash1 = computeManifestHash(manifest);
    const hash2 = computeManifestHash(manifest);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("hash changes when manifest content changes", () => {
    const manifest1 = { ...baseManifest(), signature: "0xaabb" } as SkillManifest;
    const manifest2 = {
      ...baseManifest(),
      name: "different-skill",
      signature: "0xaabb",
    } as SkillManifest;
    expect(computeManifestHash(manifest1)).not.toBe(
      computeManifestHash(manifest2),
    );
  });

  test("hash ignores signature field", () => {
    const manifest1 = { ...baseManifest(), signature: "0xaabb" } as SkillManifest;
    const manifest2 = { ...baseManifest(), signature: "0xccdd" } as SkillManifest;
    expect(computeManifestHash(manifest1)).toBe(
      computeManifestHash(manifest2),
    );
  });
});

describe("signManifest + verifyManifest", () => {
  test("sign and verify round-trip succeeds", async () => {
    const unsigned = baseManifest();
    const signed = await signManifest(unsigned, TEST_PRIVATE_KEY);

    expect(signed.signature).toMatch(/^0x[0-9a-f]+$/);
    expect(await verifyManifest(signed)).toBe(true);
  });

  test("tampered manifest fails verification", async () => {
    const signed = await signManifest(baseManifest(), TEST_PRIVATE_KEY);

    // Tamper with the name
    const tampered = { ...signed, name: "tampered-skill" };
    expect(await verifyManifest(tampered)).toBe(false);
  });

  test("wrong publisher address fails verification", async () => {
    const signed = await signManifest(baseManifest(), TEST_PRIVATE_KEY);

    // Change publisher address to a different one
    const wrongPublisher = {
      ...signed,
      publisher: {
        ...signed.publisher,
        address: "0x0000000000000000000000000000000000000001",
      },
    };
    expect(await verifyManifest(wrongPublisher)).toBe(false);
  });

  test("signature has correct hex format", async () => {
    const signed = await signManifest(baseManifest(), TEST_PRIVATE_KEY);
    expect(signed.signature).toMatch(/^0x[0-9a-f]+$/);
    // ECDSA signature is 65 bytes = 130 hex chars + 0x prefix
    expect(signed.signature.length).toBe(132);
  });
});

describe("hashFile", () => {
  let tempDir: string;

  test("computes correct SHA-256 hash", () => {
    tempDir = mkdtempSync(join(tmpdir(), "iscl-hash-"));
    const filePath = join(tempDir, "test.txt");
    writeFileSync(filePath, "hello world");

    const hash = hashFile(filePath);
    // Known SHA-256 of "hello world"
    expect(hash).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );
    rmSync(tempDir, { recursive: true, force: true });
  });
});

describe("verifyFileHashes", () => {
  let tempDir: string;

  test("valid hashes pass verification", () => {
    tempDir = mkdtempSync(join(tmpdir(), "iscl-verify-"));
    const filePath = join(tempDir, "index.js");
    writeFileSync(filePath, "console.log('hi')");

    const hash = hashFile(filePath);
    const result = verifyFileHashes(tempDir, [
      { path: "index.js", sha256: hash },
    ]);
    expect(result.valid).toBe(true);
    expect(result.mismatches).toHaveLength(0);
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("mismatched hash fails verification", () => {
    tempDir = mkdtempSync(join(tmpdir(), "iscl-verify-"));
    writeFileSync(join(tempDir, "index.js"), "console.log('hi')");

    const result = verifyFileHashes(tempDir, [
      { path: "index.js", sha256: "0".repeat(64) },
    ]);
    expect(result.valid).toBe(false);
    expect(result.mismatches).toContain("index.js");
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("missing file fails verification", () => {
    tempDir = mkdtempSync(join(tmpdir(), "iscl-verify-"));

    const result = verifyFileHashes(tempDir, [
      { path: "missing.js", sha256: "a".repeat(64) },
    ]);
    expect(result.valid).toBe(false);
    expect(result.mismatches).toContain("missing.js");
    rmSync(tempDir, { recursive: true, force: true });
  });
});
