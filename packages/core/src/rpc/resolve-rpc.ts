import type { RpcClient } from "@clavion/types/rpc";
import { RpcRouter } from "./rpc-router.js";

/**
 * Resolve the correct RpcClient for a given chainId.
 *
 * - If rpc is an RpcRouter → returns chain-specific client (or null if chain not configured)
 * - If rpc is a plain RpcClient → returns it as-is (single-chain mode)
 * - If rpc is null → returns null
 */
export function resolveRpc(
  rpc: RpcClient | null,
  chainId: number,
): RpcClient | null {
  if (!rpc) return null;
  if (rpc instanceof RpcRouter) {
    return rpc.hasChain(chainId) ? rpc.forChain(chainId) : null;
  }
  return rpc;
}
