#!/usr/bin/env node

import { handleKeyCommand } from "./commands/key.js";
import { VERSION } from "./index.js";

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

function printUsage(): void {
  console.log(`clavion-cli v${VERSION}

Usage: clavion-cli <command> [options]

Commands:
  key import             Import a private key (reads from stdin)
  key import-mnemonic    Import from BIP-39 mnemonic phrase (reads from stdin)
  key generate           Generate a new random key
  key list               List all keystore addresses

Options:
  --keystore-path <dir>  Override keystore directory (default: ~/.iscl/keystore)
  --account-index <n>    BIP-44 account index for mnemonic import (default: 0)
  --address-index <n>    BIP-44 address index for mnemonic import (default: 0)
  --version, -v          Show version
  --help, -h             Show this help

Examples:
  echo "0xprivatekey..." | clavion-cli key import
  echo "word1 word2 ... word12" | clavion-cli key import-mnemonic
  clavion-cli key generate
  clavion-cli key list
`);
}

async function main(): Promise<void> {
  if (command === "key") {
    await handleKeyCommand(subcommand, args.slice(2));
  } else if (command === "--version" || command === "-v") {
    console.log(`clavion-cli v${VERSION}`);
  } else if (command === "--help" || command === "-h" || !command) {
    printUsage();
  } else {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(
    `Error: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exitCode = 1;
});
