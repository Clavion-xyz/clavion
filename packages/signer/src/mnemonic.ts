import { mnemonicToAccount } from "viem/accounts";
import { toHex } from "viem";
import { validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";

export interface MnemonicImportOptions {
  /** BIP-44 account index (default 0). Path: m/44'/60'/{accountIndex}'/0/0 */
  accountIndex?: number;
  /** BIP-44 address index (default 0). Path: m/44'/60'/0'/0/{addressIndex} */
  addressIndex?: number;
  /** Optional BIP-39 passphrase (NOT the keystore encryption passphrase). */
  hdPassphrase?: string;
}

export interface MnemonicDeriveResult {
  privateKey: `0x${string}`;
  address: string;
  derivationPath: string;
}

/**
 * Validates a BIP-39 mnemonic phrase.
 * Checks word count (12 or 24), word validity, and checksum.
 */
export function isValidMnemonic(mnemonic: string): boolean {
  const normalized = normalizeMnemonic(mnemonic);
  const words = normalized.split(" ");
  if (words.length !== 12 && words.length !== 24) return false;

  return validateMnemonic(normalized, wordlist);
}

/**
 * Derives a private key and address from a BIP-39 mnemonic.
 * Default derivation path: m/44'/60'/0'/0/0 (standard Ethereum).
 *
 * @throws if the mnemonic is invalid
 */
export function deriveMnemonicKey(
  mnemonic: string,
  options?: MnemonicImportOptions,
): MnemonicDeriveResult {
  const normalized = normalizeMnemonic(mnemonic);
  const accountIndex = options?.accountIndex ?? 0;
  const addressIndex = options?.addressIndex ?? 0;

  const MAX_BIP44_INDEX = 0x7FFFFFFF; // 2^31 - 1
  if (accountIndex < 0 || accountIndex > MAX_BIP44_INDEX) {
    throw new Error(`accountIndex out of BIP-44 range (0..${MAX_BIP44_INDEX})`);
  }
  if (addressIndex < 0 || addressIndex > MAX_BIP44_INDEX) {
    throw new Error(`addressIndex out of BIP-44 range (0..${MAX_BIP44_INDEX})`);
  }

  const account = mnemonicToAccount(normalized, {
    accountIndex,
    addressIndex,
    passphrase: options?.hdPassphrase,
  });

  const hdKey = account.getHdKey();
  if (!hdKey.privateKey) {
    throw new Error("Failed to derive private key from mnemonic");
  }

  const privateKey = toHex(hdKey.privateKey) as `0x${string}`;
  const derivationPath = `m/44'/60'/${accountIndex}'/0/${addressIndex}`;

  return {
    privateKey,
    address: account.address.toLowerCase(),
    derivationPath,
  };
}

/** Normalize whitespace: trim + collapse multiple spaces to single. */
function normalizeMnemonic(mnemonic: string): string {
  return mnemonic.trim().replace(/\s+/g, " ").toLowerCase();
}
