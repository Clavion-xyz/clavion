import { describe, test, expect } from "vitest";
import { validateManifest } from "../../core/skill/manifest-validator.js";
import {
  validManifest,
  invalidManifests,
} from "../../spec/fixtures/skill-manifests.js";

describe("validateManifest", () => {
  test("valid manifest passes validation", () => {
    const result = validateManifest(validManifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeNull();
  });

  test("missing required field (name) rejects", () => {
    const result = validateManifest(invalidManifests.missingName);
    expect(result.valid).toBe(false);
    expect(result.errors).not.toBeNull();
  });

  test("bad publisher address pattern rejects", () => {
    const result = validateManifest(invalidManifests.badAddress);
    expect(result.valid).toBe(false);
    expect(result.errors!.some((e) => e.path.includes("address"))).toBe(true);
  });

  test("unknown action type in permissions rejects", () => {
    const result = validateManifest(invalidManifests.unknownPermission);
    expect(result.valid).toBe(false);
  });

  test("sandbox memoryMb exceeding max rejects", () => {
    const result = validateManifest(invalidManifests.exceededSandboxMemory);
    expect(result.valid).toBe(false);
    expect(result.errors!.some((e) => e.path.includes("memoryMb"))).toBe(true);
  });

  test("sandbox timeoutMs exceeding max rejects", () => {
    const result = validateManifest(invalidManifests.exceededSandboxTimeout);
    expect(result.valid).toBe(false);
    expect(result.errors!.some((e) => e.path.includes("timeoutMs"))).toBe(true);
  });

  test("empty files array rejects", () => {
    const result = validateManifest(invalidManifests.emptyFiles);
    expect(result.valid).toBe(false);
  });

  test("missing signature rejects", () => {
    const result = validateManifest(invalidManifests.missingSignature);
    expect(result.valid).toBe(false);
  });

  test("unknown top-level field rejects", () => {
    const result = validateManifest(invalidManifests.unknownField);
    expect(result.valid).toBe(false);
  });

  test("bad file hash pattern rejects", () => {
    const result = validateManifest(invalidManifests.badFileHash);
    expect(result.valid).toBe(false);
  });

  test("bad name pattern rejects", () => {
    const result = validateManifest(invalidManifests.badNamePattern);
    expect(result.valid).toBe(false);
    expect(result.errors!.some((e) => e.path.includes("name"))).toBe(true);
  });
});
