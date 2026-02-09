import { createRequire } from "node:module";
import { keccak256, toBytes, recoverAddress } from "viem";
import { sign } from "viem/accounts";
import type { SkillManifest } from "@clavion/types";

const require = createRequire(import.meta.url);
const canonicalize = require("canonicalize") as (
  input: unknown,
) => string | undefined;

/**
 * Compute the canonical keccak256 hash of a SkillManifest (excluding signature).
 * 1. Remove the `signature` field
 * 2. JCS canonicalize
 * 3. keccak256
 */
export function computeManifestHash(manifest: SkillManifest): `0x${string}` {
  const { signature: _, ...rest } = manifest;
  const canonical = canonicalize(rest);
  if (canonical === undefined) {
    throw new Error(
      "Failed to canonicalize manifest — input contains unsupported types",
    );
  }
  return keccak256(toBytes(canonical));
}

/**
 * Sign a manifest with the publisher's private key.
 * Returns a complete SkillManifest with the signature field populated.
 */
export async function signManifest(
  manifest: Omit<SkillManifest, "signature">,
  privateKey: `0x${string}`,
): Promise<SkillManifest> {
  // Compute hash of unsigned manifest (add a dummy signature so types work)
  const withDummy = { ...manifest, signature: "0x00" } as SkillManifest;
  const hash = computeManifestHash(withDummy);

  const signature = await sign({ hash, privateKey, to: "hex" });

  return { ...manifest, signature };
}

/**
 * Verify that a manifest's signature matches its publisher address.
 * 1. Compute manifest hash (without signature)
 * 2. Recover the signer address from the signature
 * 3. Compare (case-insensitive) with publisher.address
 */
export async function verifyManifest(manifest: SkillManifest): Promise<boolean> {
  const hash = computeManifestHash(manifest);

  const recoveredAddress = await recoverAddress({
    hash,
    signature: manifest.signature as `0x${string}`,
  });

  return (
    recoveredAddress.toLowerCase() === manifest.publisher.address.toLowerCase()
  );
}
