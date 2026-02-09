import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { scanFiles } from "@clavion/registry";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("scanFiles", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "iscl-scan-"));
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeSkillFile(name: string, content: string): void {
    const dir = join(tempDir, "skill");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, name), content);
  }

  test("clean file passes scan", () => {
    writeSkillFile("clean.js", 'const x = 1;\nconsole.log("hello");\n');
    const report = scanFiles(join(tempDir, "skill"), ["clean.js"]);
    expect(report.passed).toBe(true);
    expect(report.findings).toHaveLength(0);
  });

  test("detects eval()", () => {
    writeSkillFile("evil-eval.js", 'const result = eval("1+1");\n');
    const report = scanFiles(join(tempDir, "skill"), ["evil-eval.js"]);
    expect(report.passed).toBe(false);
    expect(report.findings.some((f) => f.rule === "dynamic_eval")).toBe(true);
  });

  test("detects child_process import", () => {
    writeSkillFile(
      "spawner.js",
      'const cp = require("child_process");\ncp.exec("ls");\n',
    );
    const report = scanFiles(join(tempDir, "skill"), ["spawner.js"]);
    expect(report.passed).toBe(false);
    expect(report.findings.some((f) => f.rule === "child_process")).toBe(true);
  });

  test("detects fetch() network access", () => {
    writeSkillFile(
      "network.js",
      'const resp = await fetch("https://evil.com");\n',
    );
    const report = scanFiles(join(tempDir, "skill"), ["network.js"]);
    expect(report.passed).toBe(false);
    expect(report.findings.some((f) => f.rule === "network_access")).toBe(true);
  });

  test("detects WebSocket usage", () => {
    writeSkillFile(
      "ws.js",
      'const ws = new WebSocket("ws://localhost:8080");\n',
    );
    const report = scanFiles(join(tempDir, "skill"), ["ws.js"]);
    expect(report.passed).toBe(false);
    expect(report.findings.some((f) => f.rule === "network_access")).toBe(true);
  });

  test("detects obfuscation patterns", () => {
    writeSkillFile(
      "obfuscated.js",
      'const data = Buffer.from("aGVsbG8=", "base64");\n',
    );
    const report = scanFiles(join(tempDir, "skill"), ["obfuscated.js"]);
    // Obfuscation is a warning, not an error
    expect(report.passed).toBe(true);
    expect(report.findings.some((f) => f.rule === "obfuscation")).toBe(true);
    expect(report.findings.every((f) => f.severity === "warning")).toBe(true);
  });

  test("warnings do not fail the scan", () => {
    writeSkillFile(
      "writer.js",
      'const fs = require("fs");\nfs.writeFileSync("/tmp/out", "data");\n',
    );
    const report = scanFiles(join(tempDir, "skill"), ["writer.js"]);
    expect(report.passed).toBe(true);
    expect(report.findings.some((f) => f.rule === "fs_write")).toBe(true);
  });

  test("error findings fail the scan", () => {
    writeSkillFile("mixed.js", 'eval("bad");\nwriteFileSync("ok");\n');
    const report = scanFiles(join(tempDir, "skill"), ["mixed.js"]);
    expect(report.passed).toBe(false);
    expect(report.findings.some((f) => f.severity === "error")).toBe(true);
  });

  test("multiple findings per file", () => {
    writeSkillFile(
      "multi.js",
      'eval("x");\nconst cp = require("child_process");\nfetch("http://evil.com");\n',
    );
    const report = scanFiles(join(tempDir, "skill"), ["multi.js"]);
    expect(report.passed).toBe(false);
    // At least 3 findings (one per line)
    expect(report.findings.length).toBeGreaterThanOrEqual(3);
  });

  test("missing file reports error finding", () => {
    const report = scanFiles(join(tempDir, "skill"), ["nonexistent.js"]);
    expect(report.passed).toBe(false);
    expect(report.findings.some((f) => f.rule === "file_read_error")).toBe(
      true,
    );
  });
});
