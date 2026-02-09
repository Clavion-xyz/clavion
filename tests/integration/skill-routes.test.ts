import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { privateKeyToAddress } from "viem/accounts";
import { buildApp } from "@clavion/core";
import { signManifest, hashFile } from "@clavion/registry";
import type { FastifyInstance } from "fastify";
import type { SkillManifest } from "@clavion/types";

const TEST_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const TEST_ADDRESS = privateKeyToAddress(TEST_PRIVATE_KEY);

async function createValidSkillPackage(
  name = "test-skill",
): Promise<{ manifest: SkillManifest; basePath: string; tempDir: string }> {
  const tempDir = mkdtempSync(join(tmpdir(), "iscl-skill-route-"));
  const filePath = join(tempDir, "index.js");
  writeFileSync(filePath, "// valid skill\nconsole.log('hello');\n");

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

describe("Skill routes — integration", () => {
  let app: FastifyInstance;
  let tempKeystorePath: string;
  const tempDirs: string[] = [];

  beforeAll(async () => {
    tempKeystorePath = mkdtempSync(join(tmpdir(), "iscl-skill-ks-"));
    app = await buildApp({
      logger: false,
      auditDbPath: ":memory:",
      keystorePath: tempKeystorePath,
      skillRegistryDbPath: ":memory:",
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    rmSync(tempKeystorePath, { recursive: true, force: true });
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("POST /v1/skills/register returns 200 with valid skill", async () => {
    const { manifest, basePath, tempDir } = await createValidSkillPackage("route-skill-a");
    tempDirs.push(tempDir);

    const res = await app.inject({
      method: "POST",
      url: "/v1/skills/register",
      payload: { manifest, basePath },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.registered).toBe(true);
    expect(body.name).toBe("route-skill-a");
    expect(body.manifestHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("POST /v1/skills/register returns 400 for invalid manifest", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/skills/register",
      payload: { manifest: { version: "1", name: "bad" }, basePath: "/tmp" },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.registered).toBe(false);
    expect(body.error).toBe("schema_validation_failed");
  });

  test("POST /v1/skills/register returns 409 for duplicate name", async () => {
    const { manifest, basePath, tempDir } = await createValidSkillPackage("route-skill-dup");
    tempDirs.push(tempDir);

    // First registration succeeds
    const res1 = await app.inject({
      method: "POST",
      url: "/v1/skills/register",
      payload: { manifest, basePath },
    });
    expect(res1.statusCode).toBe(200);

    // Second registration fails with 409
    const res2 = await app.inject({
      method: "POST",
      url: "/v1/skills/register",
      payload: { manifest, basePath },
    });
    expect(res2.statusCode).toBe(409);
    expect(res2.json().error).toBe("duplicate_skill");
  });

  test("GET /v1/skills returns skill list", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/skills",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ name: string }>;
    expect(Array.isArray(body)).toBe(true);
    // At least the skills registered in earlier tests
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  test("GET /v1/skills/:name returns specific skill", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/skills/route-skill-a",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe("route-skill-a");
    expect(body.status).toBe("active");
    expect(body.publisherAddress).toBe(TEST_ADDRESS);
  });

  test("GET /v1/skills/:name returns 404 for unknown", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/skills/nonexistent-skill",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("skill_not_found");
  });

  test("DELETE /v1/skills/:name revokes skill", async () => {
    const { manifest, basePath, tempDir } = await createValidSkillPackage("to-revoke");
    tempDirs.push(tempDir);

    await app.inject({
      method: "POST",
      url: "/v1/skills/register",
      payload: { manifest, basePath },
    });

    const res = await app.inject({
      method: "DELETE",
      url: "/v1/skills/to-revoke",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().revoked).toBe(true);

    // Verify it's no longer in the list
    const listRes = await app.inject({ method: "GET", url: "/v1/skills" });
    const skills = listRes.json() as Array<{ name: string }>;
    expect(skills.some((s) => s.name === "to-revoke")).toBe(false);
  });

  test("DELETE /v1/skills/:name returns 404 for unknown", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/v1/skills/nonexistent-skill",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("skill_not_found");
  });
});
