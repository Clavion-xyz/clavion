import { createRequire } from "node:module";
import { keccak256, toBytes } from "viem";

const require = createRequire(import.meta.url);
const canonicalize = require("canonicalize") as (
  input: unknown,
) => string | undefined;

/**
 * Compute a deterministic keccak256 hash of a txRequest object.
 * Converts BigInt fields to strings before JCS canonicalization.
 */
export function computeTxRequestHash(
  txRequest: Record<string, unknown>,
): `0x${string}` {
  const serializable = JSON.parse(
    JSON.stringify(txRequest, (_key, value) =>
      typeof value === "bigint" ? value.toString() : (value as unknown),
    ),
  ) as unknown;
  const canonical = canonicalize(serializable);
  if (canonical === undefined) {
    throw new Error("Failed to canonicalize txRequest");
  }
  return keccak256(toBytes(canonical));
}
