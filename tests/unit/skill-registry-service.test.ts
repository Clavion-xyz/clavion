import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { privateKeyToAddress } from "viem/accounts";
import { SkillRegistryService } from "../../core/skill/skill-registry-service.js";
import { signManifest } from "../../core/skill/manifest-signer.js";
import { hashFile } from "../../core/skill/file-hasher.js";
import type { SkillManifest } from "../../core/types.js";

// Deterministic test key — NEVER use in production
const TEST_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const TEST_ADDRESS = privateKeyToAddress(TEST_PRIVATE_KEY);

/** Create a temp directory with a valid skill file and return signed manifest + basePath. */
async function createValidSkillPackage(
  name = "test-skill",
): Promise<{ manifest: SkillManifest; basePath: string; tempDir: string }> {
  const tempDir = mkdtempSync(join(tmpdir(), "iscl-reg-"));
  const filePath = join(tempDir, "index.js");
  writeFileSync(filePath, "// valid skill code\nconsole.log('hello');\n");

  const fileHash = hashFile(filePath);

  const unsigned = {
    version: "1" as const,
    name,
    publisher: {
      name: "Test Publisher",
      address: TEST_ADDRESS,
      contact: "test@example.com",
    },
    permissions: {
      txActions: ["transfer" as const],
      chains: [8453],
      networkAccess: false,
      filesystemAccess: false,
    },
    sandbox: {
      memoryMb: 128,
      timeoutMs: 10000,
      allowSpawn: false,
    },
    files: [{ path: "index.js", sha256: fileHash }],
  };

  const manifest = await signManifest(unsigned, TEST_PRIVATE_KEY);
  return { manifest, basePath: tempDir, tempDir };
}

describe("SkillRegistryService", () => {
  let registry: SkillRegistryService;
  const tempDirs: string[] = [];

  beforeEach(() => {
    registry = new SkillRegistryService(":memory:");
  });

  afterEach(() => {
    registry.close();
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  test("registers a valid skill successfully", async () => {
    const { manifest, basePath, tempDir } = await createValidSkillPackage();
    tempDirs.push(tempDir);

    const result = await registry.register(manifest, basePath);
    expect(result.registered).toBe(true);
    expect(result.name).toBe("test-skill");
    expect(result.manifestHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("rejects invalid manifest (schema validation)", async () => {
    const { tempDir } = await createValidSkillPackage();
    tempDirs.push(tempDir);

    const invalidManifest = { version: "1", name: "bad" } as unknown as SkillManifest;
    const result = await registry.register(invalidManifest, tempDir);
    expect(result.registered).toBe(false);
    expect(result.error).toBe("schema_validation_failed");
    expect(result.validationErrors).toBeDefined();
    expect(result.validationErrors!.length).toBeGreaterThan(0);
  });

  test("rejects unsigned/tampered manifest (bad signature)", async () => {
    const { manifest, basePath, tempDir } = await createValidSkillPackage();
    tempDirs.push(tempDir);

    // Tamper with the name after signing
    const tampered = { ...manifest, name: "tampered-name" };
    const result = await registry.register(tampered, basePath);
    expect(result.registered).toBe(false);
    expect(result.error).toBe("signature_verification_failed");
  });

  test("rejects manifest with mismatched file hashes", async () => {
    const { manifest, basePath, tempDir } = await createValidSkillPackage();
    tempDirs.push(tempDir);

    // Modify the file after hashing
    writeFileSync(join(basePath, "index.js"), "// tampered content");
    const result = await registry.register(manifest, basePath);
    expect(result.registered).toBe(false);
    expect(result.error).toBe("file_hash_mismatch");
    expect(result.hashMismatches).toContain("index.js");
  });

  test("rejects skill with scanner errors (eval)", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "iscl-reg-scan-"));
    tempDirs.push(tempDir);
    const filePath = join(tempDir, "index.js");
    writeFileSync(filePath, "const x = eval('1+1');\n");

    const fileHash = hashFile(filePath);
    const unsigned = {
      version: "1" as const,
      name: "evil-skill",
      publisher: {
        name: "Test Publisher",
        address: TEST_ADDRESS,
        contact: "test@example.com",
      },
      permissions: {
        txActions: ["transfer" as const],
        chains: [8453],
        networkAccess: false,
        filesystemAccess: false,
      },
      sandbox: {
        memoryMb: 128,
        timeoutMs: 10000,
        allowSpawn: false,
      },
      files: [{ path: "index.js", sha256: fileHash }],
    };
    const manifest = await signManifest(unsigned, TEST_PRIVATE_KEY);

    const result = await registry.register(manifest, tempDir);
    expect(result.registered).toBe(false);
    expect(result.error).toBe("static_scan_failed");
    expect(result.scanFindings).toBeDefined();
    expect(result.scanFindings!.some((f) => f.rule === "dynamic_eval")).toBe(true);
  });

  test("accepts skill with scanner warnings only (fs_write)", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "iscl-reg-warn-"));
    tempDirs.push(tempDir);
    const filePath = join(tempDir, "index.js");
    // fs_write is a warning, not an error
    writeFileSync(filePath, "const fs = { writeFileSync: true };\n");

    const fileHash = hashFile(filePath);
    const unsigned = {
      version: "1" as const,
      name: "warning-skill",
      publisher: {
        name: "Test Publisher",
        address: TEST_ADDRESS,
        contact: "test@example.com",
      },
      permissions: {
        txActions: ["transfer" as const],
        chains: [8453],
        networkAccess: false,
        filesystemAccess: false,
      },
      sandbox: {
        memoryMb: 128,
        timeoutMs: 10000,
        allowSpawn: false,
      },
      files: [{ path: "index.js", sha256: fileHash }],
    };
    const manifest = await signManifest(unsigned, TEST_PRIVATE_KEY);

    const result = await registry.register(manifest, tempDir);
    expect(result.registered).toBe(true);
  });

  test("rejects duplicate skill name", async () => {
    const { manifest, basePath, tempDir } = await createValidSkillPackage();
    tempDirs.push(tempDir);

    const result1 = await registry.register(manifest, basePath);
    expect(result1.registered).toBe(true);

    const result2 = await registry.register(manifest, basePath);
    expect(result2.registered).toBe(false);
    expect(result2.error).toBe("duplicate_skill");
  });

  test("get() returns registered skill", async () => {
    const { manifest, basePath, tempDir } = await createValidSkillPackage();
    tempDirs.push(tempDir);

    await registry.register(manifest, basePath);
    const skill = registry.get("test-skill");
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe("test-skill");
    expect(skill!.publisherAddress).toBe(TEST_ADDRESS);
    expect(skill!.publisherName).toBe("Test Publisher");
    expect(skill!.status).toBe("active");
    expect(skill!.manifest.version).toBe("1");
    expect(skill!.revokedAt).toBeNull();
  });

  test("get() returns null for unknown name", () => {
    const skill = registry.get("nonexistent");
    expect(skill).toBeNull();
  });

  test("list() returns only active skills", async () => {
    const pkg1 = await createValidSkillPackage("skill-a");
    const pkg2 = await createValidSkillPackage("skill-b");
    tempDirs.push(pkg1.tempDir, pkg2.tempDir);

    await registry.register(pkg1.manifest, pkg1.basePath);
    await registry.register(pkg2.manifest, pkg2.basePath);

    const all = registry.list();
    expect(all).toHaveLength(2);
    expect(all.map((s) => s.name)).toEqual(["skill-a", "skill-b"]);
  });

  test("revoke() sets status to revoked", async () => {
    const { manifest, basePath, tempDir } = await createValidSkillPackage();
    tempDirs.push(tempDir);

    await registry.register(manifest, basePath);
    const revoked = registry.revoke("test-skill");
    expect(revoked).toBe(true);

    // Get returns the revoked skill (not filtered by status)
    const skill = registry.get("test-skill");
    expect(skill).not.toBeNull();
    expect(skill!.status).toBe("revoked");
    expect(skill!.revokedAt).toBeTypeOf("number");
  });

  test("revoked skill not returned by list()", async () => {
    const pkg1 = await createValidSkillPackage("skill-a");
    const pkg2 = await createValidSkillPackage("skill-b");
    tempDirs.push(pkg1.tempDir, pkg2.tempDir);

    await registry.register(pkg1.manifest, pkg1.basePath);
    await registry.register(pkg2.manifest, pkg2.basePath);

    registry.revoke("skill-a");
    const active = registry.list();
    expect(active).toHaveLength(1);
    expect(active[0]!.name).toBe("skill-b");
  });

  test("revoke() returns false for unknown name", () => {
    expect(registry.revoke("nonexistent")).toBe(false);
  });

  test("isRegistered() returns true for active skill", async () => {
    const { manifest, basePath, tempDir } = await createValidSkillPackage();
    tempDirs.push(tempDir);

    await registry.register(manifest, basePath);
    expect(registry.isRegistered("test-skill")).toBe(true);
  });

  test("isRegistered() returns false after revocation", async () => {
    const { manifest, basePath, tempDir } = await createValidSkillPackage();
    tempDirs.push(tempDir);

    await registry.register(manifest, basePath);
    registry.revoke("test-skill");
    expect(registry.isRegistered("test-skill")).toBe(false);
  });
});
