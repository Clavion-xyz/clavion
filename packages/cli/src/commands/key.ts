import { homedir } from "node:os";
import { join } from "node:path";
import { EncryptedKeystore, isValidMnemonic, deriveMnemonicKey, type KeystoreOptions } from "@clavion/signer";
import { AuditTraceService } from "@clavion/audit";
import { privateKeyToAddress } from "viem/accounts";
import {
  readSecretLine,
  readPassphrase,
  readPassphraseConfirmed,
} from "../io.js";

// ---------- Injectable I/O for testability ----------

export interface IOProvider {
  readSecretLine(prompt?: string): Promise<string>;
  readPassphrase(prompt?: string): Promise<string>;
  readPassphraseConfirmed(prompt?: string): Promise<string>;
  log(msg: string): void;
  error(msg: string): void;
}

const defaultIO: IOProvider = {
  readSecretLine,
  readPassphrase,
  readPassphraseConfirmed,
  log: (msg) => console.log(msg),
  error: (msg) => console.error(msg),
};

// ---------- Option parsing ----------

export function parseKeyOptions(
  args: string[],
): { keystorePath: string; accountIndex: number; addressIndex: number } {
  let keystorePath = join(homedir(), ".iscl", "keystore");
  let accountIndex = 0;
  let addressIndex = 0;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === "--keystore-path" && next) {
      keystorePath = next;
      i++;
    } else if (arg === "--account-index" && next) {
      accountIndex = parseInt(next, 10);
      if (Number.isNaN(accountIndex) || accountIndex < 0) {
        throw new Error(`Invalid --account-index: ${next}`);
      }
      i++;
    } else if (arg === "--address-index" && next) {
      addressIndex = parseInt(next, 10);
      if (Number.isNaN(addressIndex) || addressIndex < 0) {
        throw new Error(`Invalid --address-index: ${next}`);
      }
      i++;
    }
  }

  return { keystorePath, accountIndex, addressIndex };
}

// ---------- Command dispatch ----------

export async function handleKeyCommand(
  subcommand: string | undefined,
  args: string[],
  io: IOProvider = defaultIO,
): Promise<void> {
  switch (subcommand) {
    case "import":
      await handleKeyImport(args, io);
      break;
    case "import-mnemonic":
      await handleKeyImportMnemonic(args, io);
      break;
    case "generate":
      await handleKeyGenerate(args, io);
      break;
    case "list":
      await handleKeyList(args, io);
      break;
    default:
      io.error(
        subcommand
          ? `Unknown key subcommand: ${subcommand}`
          : "Missing key subcommand",
      );
      io.error(
        "Usage: clavion-cli key <import|import-mnemonic|generate|list> [options]",
      );
      process.exitCode = 1;
  }
}

// ---------- Subcommands ----------

const PRIVATE_KEY_RE = /^0x[0-9a-fA-F]{64}$/;

export async function handleKeyImport(
  args: string[],
  io: IOProvider = defaultIO,
  keystoreOpts?: KeystoreOptions,
): Promise<void> {
  const { keystorePath } = parseKeyOptions(args);

  io.log("Reading private key from stdin...");
  const rawKey = await io.readSecretLine("Paste private key (0x...): ");

  if (!PRIVATE_KEY_RE.test(rawKey)) {
    throw new Error(
      "Invalid private key format. Expected 0x followed by 64 hex characters.",
    );
  }

  const privateKey = rawKey as `0x${string}`;
  const derivedAddress = privateKeyToAddress(privateKey).toLowerCase();
  io.log(`Derived address: ${derivedAddress}`);

  const passphrase = await io.readPassphraseConfirmed();

  const keystore = new EncryptedKeystore(keystorePath, keystoreOpts);
  const address = await keystore.importKey(privateKey, passphrase);

  // Audit log — address only, NEVER the key
  try {
    const auditDbPath = join(keystorePath, "..", "audit.db");
    const audit = new AuditTraceService(auditDbPath);
    audit.log("key_imported", { intentId: "system", address, source: "private_key" });
  } catch {
    // Non-fatal — audit DB may not exist yet
  }

  io.log(`Key imported successfully: ${address}`);
}

export async function handleKeyImportMnemonic(
  args: string[],
  io: IOProvider = defaultIO,
  keystoreOpts?: KeystoreOptions,
): Promise<void> {
  const { keystorePath, accountIndex, addressIndex } = parseKeyOptions(args);

  io.log("Reading mnemonic from stdin...");
  const mnemonic = await io.readSecretLine("Paste mnemonic phrase: ");

  if (!isValidMnemonic(mnemonic)) {
    throw new Error(
      "Invalid BIP-39 mnemonic. Expected 12 or 24 valid English words.",
    );
  }

  const { address, derivationPath } = deriveMnemonicKey(mnemonic, {
    accountIndex,
    addressIndex,
  });
  io.log(`Derived address: ${address}`);
  io.log(`Derivation path: ${derivationPath}`);

  const passphrase = await io.readPassphraseConfirmed();

  const keystore = new EncryptedKeystore(keystorePath, keystoreOpts);
  await keystore.importMnemonic(mnemonic, passphrase, {
    accountIndex,
    addressIndex,
  });

  // Audit log — address + path only, NEVER the mnemonic
  try {
    const auditDbPath = join(keystorePath, "..", "audit.db");
    const audit = new AuditTraceService(auditDbPath);
    audit.log("key_imported", { intentId: "system", address, source: "mnemonic", derivationPath });
  } catch {
    // Non-fatal
  }

  io.log(`Key imported successfully: ${address}`);
  io.log(`Derivation path: ${derivationPath}`);
}

export async function handleKeyGenerate(
  args: string[],
  io: IOProvider = defaultIO,
  keystoreOpts?: KeystoreOptions,
): Promise<void> {
  const { keystorePath } = parseKeyOptions(args);

  const passphrase = await io.readPassphraseConfirmed();

  const keystore = new EncryptedKeystore(keystorePath, keystoreOpts);
  const address = await keystore.generate(passphrase);

  // Audit log
  try {
    const auditDbPath = join(keystorePath, "..", "audit.db");
    const audit = new AuditTraceService(auditDbPath);
    audit.log("key_generated", { intentId: "system", address });
  } catch {
    // Non-fatal
  }

  io.log(`Key generated successfully: ${address}`);
}

export async function handleKeyList(
  args: string[],
  io: IOProvider = defaultIO,
): Promise<void> {
  const { keystorePath } = parseKeyOptions(args);

  const keystore = new EncryptedKeystore(keystorePath);
  const addresses = keystore.listAddresses();

  if (addresses.length === 0) {
    io.log("No keys found in keystore.");
    return;
  }

  io.log(`Found ${addresses.length} key(s):`);
  for (const addr of addresses) {
    io.log(`  ${addr}`);
  }
}
