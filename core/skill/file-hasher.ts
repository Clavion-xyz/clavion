import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Compute the SHA-256 hash of a file.
 * Returns a lowercase hex string (no 0x prefix).
 */
export function hashFile(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Verify all file hashes in a skill package against their manifest entries.
 * Returns { valid, mismatches } where mismatches lists paths that failed.
 */
export function verifyFileHashes(
  basePath: string,
  files: Array<{ path: string; sha256: string }>,
): { valid: boolean; mismatches: string[] } {
  const mismatches: string[] = [];

  for (const entry of files) {
    const fullPath = join(basePath, entry.path);
    try {
      const actual = hashFile(fullPath);
      if (actual !== entry.sha256) {
        mismatches.push(entry.path);
      }
    } catch {
      mismatches.push(entry.path);
    }
  }

  return { valid: mismatches.length === 0, mismatches };
}
