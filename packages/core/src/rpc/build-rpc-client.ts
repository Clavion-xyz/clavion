import type { RpcClient } from "@clavion/types/rpc";
import { ViemRpcClient } from "./viem-rpc-client.js";
import { RpcRouter } from "./rpc-router.js";
import { parseRpcEnv } from "./parse-rpc-env.js";

/**
 * Build an RpcClient from environment variables.
 * Returns undefined if no RPC URLs are configured.
 * Returns a plain ViemRpcClient for a single URL, or a RpcRouter for multiple chains.
 */
export function buildRpcClient(env: Record<string, string | undefined>): RpcClient | undefined {
  const urls = parseRpcEnv(env);
  if (urls.size === 0) return undefined;
  if (urls.size === 1) {
    const [, url] = [...urls.entries()][0]!;
    return new ViemRpcClient(url);
  }
  const clients = new Map<number, RpcClient>();
  for (const [chainId, url] of urls) {
    clients.set(chainId, new ViemRpcClient(url));
  }
  return new RpcRouter(clients);
}
