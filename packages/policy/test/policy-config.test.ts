import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getDefaultConfig,
  loadPolicyConfig,
  PolicyConfigSchema,
} from "@clavion/policy";
import { Ajv } from "ajv";

const ajv = new Ajv({ strict: true, allErrors: true });
const validate = ajv.compile(PolicyConfigSchema);

function makePermissiveConfig() {
  return {
    version: "1" as const,
    maxValueWei: "1000000000000000000000",
    maxApprovalAmount: "1000000000000000000000",
    contractAllowlist: ["0x2626664c2603336E57B271c5C0b26F421741e481"],
    tokenAllowlist: [
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "0x4200000000000000000000000000000000000006",
    ],
    allowedChains: [8453],
    recipientAllowlist: [],
    maxRiskScore: 70,
    requireApprovalAbove: { valueWei: "100000000000000000" },
    maxTxPerHour: 100,
  };
}

describe("PolicyConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "iscl-policy-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("getDefaultConfig() returns valid PolicyConfig", () => {
    const config = getDefaultConfig();
    expect(validate(config)).toBe(true);
  });

  test("getDefaultConfig() has conservative defaults", () => {
    const config = getDefaultConfig();
    expect(config.maxValueWei).toBe("0");
    expect(config.maxApprovalAmount).toBe("0");
    expect(config.contractAllowlist).toEqual([]);
    expect(config.tokenAllowlist).toEqual([]);
    expect(config.requireApprovalAbove.valueWei).toBe("0");
  });

  test("loadPolicyConfig() loads valid JSON config file", () => {
    const configPath = join(tempDir, "policy.json");
    const expected = makePermissiveConfig();
    writeFileSync(configPath, JSON.stringify(expected));

    const loaded = loadPolicyConfig(configPath);
    expect(loaded).toEqual(expected);
  });

  test("loadPolicyConfig() returns default for missing file", () => {
    const loaded = loadPolicyConfig(join(tempDir, "nonexistent.json"));
    expect(loaded).toEqual(getDefaultConfig());
  });

  test("loadPolicyConfig() throws for malformed JSON", () => {
    const configPath = join(tempDir, "bad.json");
    writeFileSync(configPath, "not json at all {{{");

    expect(() => loadPolicyConfig(configPath)).toThrow("Invalid JSON");
  });

  test("loadPolicyConfig() throws for config with unknown fields", () => {
    const configPath = join(tempDir, "extra.json");
    const config = { ...makePermissiveConfig(), extraField: true };
    writeFileSync(configPath, JSON.stringify(config));

    expect(() => loadPolicyConfig(configPath)).toThrow("Invalid policy config");
  });

  test("loadPolicyConfig() throws for config missing required field", () => {
    const configPath = join(tempDir, "missing.json");
    const { maxValueWei: _, ...incomplete } = makePermissiveConfig();
    writeFileSync(configPath, JSON.stringify(incomplete));

    expect(() => loadPolicyConfig(configPath)).toThrow("Invalid policy config");
  });

  test("loadPolicyConfig() throws for invalid maxRiskScore", () => {
    const configPath = join(tempDir, "badrisk.json");
    const config = { ...makePermissiveConfig(), maxRiskScore: 150 };
    writeFileSync(configPath, JSON.stringify(config));

    expect(() => loadPolicyConfig(configPath)).toThrow("Invalid policy config");
  });

  test("loadPolicyConfig() throws for invalid address in allowlist", () => {
    const configPath = join(tempDir, "badaddr.json");
    const config = { ...makePermissiveConfig(), tokenAllowlist: ["not-an-address"] };
    writeFileSync(configPath, JSON.stringify(config));

    expect(() => loadPolicyConfig(configPath)).toThrow("Invalid policy config");
  });
});
