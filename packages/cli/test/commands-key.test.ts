import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  handleKeyImport,
  handleKeyImportMnemonic,
  handleKeyGenerate,
  handleKeyList,
  handleKeyCommand,
  parseKeyOptions,
  type IOProvider,
} from "@clavion/cli";
import {
  FAST_SCRYPT,
  TEST_PRIVATE_KEY,
  TEST_MNEMONIC_12,
} from "../../../tools/fixtures/index.js";

const TEST_MNEMONIC = TEST_MNEMONIC_12;

function createMockIO(overrides?: {
  secretLine?: string;
  passphrase?: string;
}): IOProvider & { logs: string[]; errors: string[] } {
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    logs,
    errors,
    readSecretLine: async () => overrides?.secretLine ?? "",
    readPassphrase: async () => overrides?.passphrase ?? "test-pass",
    readPassphraseConfirmed: async () => overrides?.passphrase ?? "test-pass",
    log: (msg) => logs.push(msg),
    error: (msg) => errors.push(msg),
  };
}

describe("parseKeyOptions", () => {
  test("returns defaults when no args", () => {
    const opts = parseKeyOptions([]);
    expect(opts.accountIndex).toBe(0);
    expect(opts.addressIndex).toBe(0);
    expect(opts.keystorePath).toContain(".iscl");
  });

  test("parses --keystore-path", () => {
    const opts = parseKeyOptions(["--keystore-path", "/tmp/ks"]);
    expect(opts.keystorePath).toBe("/tmp/ks");
  });

  test("parses --account-index", () => {
    const opts = parseKeyOptions(["--account-index", "3"]);
    expect(opts.accountIndex).toBe(3);
  });

  test("parses --address-index", () => {
    const opts = parseKeyOptions(["--address-index", "5"]);
    expect(opts.addressIndex).toBe(5);
  });

  test("throws on invalid --account-index", () => {
    expect(() => parseKeyOptions(["--account-index", "abc"])).toThrow(
      "Invalid --account-index",
    );
  });
});

describe("handleKeyImport", () => {
  let ksPath: string;

  beforeEach(() => {
    ksPath = mkdtempSync(join(tmpdir(), "cli-import-test-"));
  });

  afterEach(() => {
    rmSync(ksPath, { recursive: true, force: true });
  });

  test("imports a valid private key", async () => {
    const io = createMockIO({ secretLine: TEST_PRIVATE_KEY });
    await handleKeyImport(["--keystore-path", ksPath], io, FAST_SCRYPT);

    expect(io.logs.some((l) => l.includes("imported successfully"))).toBe(true);
    expect(io.logs.some((l) => l.includes("0x"))).toBe(true);
  });

  test("rejects invalid private key format", async () => {
    const io = createMockIO({ secretLine: "not-a-key" });
    await expect(
      handleKeyImport(["--keystore-path", ksPath], io, FAST_SCRYPT),
    ).rejects.toThrow("Invalid private key format");
  });

  test("rejects key with wrong length", async () => {
    const io = createMockIO({ secretLine: "0xabcd" });
    await expect(
      handleKeyImport(["--keystore-path", ksPath], io, FAST_SCRYPT),
    ).rejects.toThrow("Invalid private key format");
  });
});

describe("handleKeyImportMnemonic", () => {
  let ksPath: string;

  beforeEach(() => {
    ksPath = mkdtempSync(join(tmpdir(), "cli-mnemonic-test-"));
  });

  afterEach(() => {
    rmSync(ksPath, { recursive: true, force: true });
  });

  test("imports a valid mnemonic", async () => {
    const io = createMockIO({ secretLine: TEST_MNEMONIC });
    await handleKeyImportMnemonic(
      ["--keystore-path", ksPath],
      io,
      FAST_SCRYPT,
    );

    expect(io.logs.some((l) => l.includes("imported successfully"))).toBe(true);
    expect(io.logs.some((l) => l.includes("m/44'/60'/0'/0/0"))).toBe(true);
  });

  test("rejects invalid mnemonic", async () => {
    const io = createMockIO({ secretLine: "invalid words here" });
    await expect(
      handleKeyImportMnemonic(["--keystore-path", ksPath], io, FAST_SCRYPT),
    ).rejects.toThrow("Invalid BIP-39 mnemonic");
  });

  test("respects --account-index", async () => {
    const io = createMockIO({ secretLine: TEST_MNEMONIC });
    await handleKeyImportMnemonic(
      ["--keystore-path", ksPath, "--account-index", "1"],
      io,
      FAST_SCRYPT,
    );

    expect(io.logs.some((l) => l.includes("m/44'/60'/1'/0/0"))).toBe(true);
  });
});

describe("handleKeyGenerate", () => {
  let ksPath: string;

  beforeEach(() => {
    ksPath = mkdtempSync(join(tmpdir(), "cli-generate-test-"));
  });

  afterEach(() => {
    rmSync(ksPath, { recursive: true, force: true });
  });

  test("generates a new key", async () => {
    const io = createMockIO();
    await handleKeyGenerate(["--keystore-path", ksPath], io, FAST_SCRYPT);

    expect(io.logs.some((l) => l.includes("generated successfully"))).toBe(
      true,
    );
    expect(io.logs.some((l) => /0x[0-9a-f]{40}/.test(l))).toBe(true);
  });
});

describe("handleKeyList", () => {
  let ksPath: string;

  beforeEach(() => {
    ksPath = mkdtempSync(join(tmpdir(), "cli-list-test-"));
  });

  afterEach(() => {
    rmSync(ksPath, { recursive: true, force: true });
  });

  test("shows no keys for empty keystore", async () => {
    const io = createMockIO();
    await handleKeyList(["--keystore-path", ksPath], io);

    expect(io.logs.some((l) => l.includes("No keys found"))).toBe(true);
  });

  test("lists addresses after import", async () => {
    const io1 = createMockIO({ secretLine: TEST_PRIVATE_KEY });
    await handleKeyImport(["--keystore-path", ksPath], io1, FAST_SCRYPT);

    const io2 = createMockIO();
    await handleKeyList(["--keystore-path", ksPath], io2);

    expect(io2.logs.some((l) => l.includes("1 key(s)"))).toBe(true);
    expect(io2.logs.some((l) => /0x[0-9a-f]{40}/.test(l))).toBe(true);
  });
});

describe("handleKeyCommand", () => {
  test("unknown subcommand sets exit code", async () => {
    const io = createMockIO();
    const prevExitCode = process.exitCode;
    await handleKeyCommand("unknown", [], io);
    expect(process.exitCode).toBe(1);
    expect(io.errors.some((e) => e.includes("Unknown key subcommand"))).toBe(
      true,
    );
    process.exitCode = prevExitCode;
  });

  test("missing subcommand sets exit code", async () => {
    const io = createMockIO();
    const prevExitCode = process.exitCode;
    await handleKeyCommand(undefined, [], io);
    expect(process.exitCode).toBe(1);
    expect(io.errors.some((e) => e.includes("Missing key subcommand"))).toBe(
      true,
    );
    process.exitCode = prevExitCode;
  });
});
