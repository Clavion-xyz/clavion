/**
 * Shared test key material — NEVER use on mainnet.
 * This is the first Anvil/Hardhat default account key.
 */
export const TEST_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as `0x${string}`;

export const TEST_PASSPHRASE = "test-pass";

/** Fast scrypt parameters for tests (N=1024 vs 262144 production). */
export const FAST_SCRYPT = { scryptN: 1024 } as const;

export const INTENT_ID = "550e8400-e29b-41d4-a716-446655440000";
export const TX_REQUEST_HASH =
  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

/** BIP-39 standard test vectors. */
export const TEST_MNEMONIC_12 =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
export const TEST_MNEMONIC_24 =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";
