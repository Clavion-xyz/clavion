/**
 * Parse RPC URL environment variables into a chainId → URL map.
 *
 * Supports two formats:
 * - `ISCL_RPC_URL_{chainId}` (e.g., ISCL_RPC_URL_1, ISCL_RPC_URL_8453)
 * - `BASE_RPC_URL` (legacy, maps to chain 8453)
 *
 * `ISCL_RPC_URL_8453` takes precedence over `BASE_RPC_URL`.
 */
export function parseRpcEnv(env: Record<string, string | undefined>): Map<number, string> {
  const urls = new Map<number, string>();

  for (const [key, value] of Object.entries(env)) {
    const match = /^ISCL_RPC_URL_(\d+)$/.exec(key);
    if (match && value) {
      urls.set(Number(match[1]), value);
    }
  }

  // Legacy: BASE_RPC_URL → chain 8453 (only if ISCL_RPC_URL_8453 not already set)
  const baseRpcUrl = env["BASE_RPC_URL"];
  if (baseRpcUrl && !urls.has(8453)) {
    urls.set(8453, baseRpcUrl);
  }

  return urls;
}
