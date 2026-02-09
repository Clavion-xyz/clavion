import { createRequire } from "node:module";
import { keccak256, toBytes } from "viem";

const require = createRequire(import.meta.url);
const canonicalize = require("canonicalize") as (input: unknown) => string | undefined;
import type { TxIntent } from "../types.js";

/**
 * Compute the canonical hash of a TxIntent.
 * 1. Serialize using JCS (JSON Canonicalization Scheme)
 * 2. Hash with keccak256
 * Returns hex string prefixed with 0x.
 */
export function computeIntentHash(intent: TxIntent): `0x${string}` {
  const canonical = canonicalize(intent);
  if (canonical === undefined) {
    throw new Error("Failed to canonicalize intent — input contains unsupported types");
  }
  return keccak256(toBytes(canonical));
}
