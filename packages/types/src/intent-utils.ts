import type { TxIntent } from "./index.js";

/**
 * Extracts token contract addresses from a TxIntent action.
 * Returns ERC-20 addresses involved (asset, assetIn, assetOut).
 * Returns an empty array for transfer_native (no token contract).
 */
export function extractTokenAddresses(intent: TxIntent): string[] {
  const action = intent.action;
  switch (action.type) {
    case "transfer":
    case "approve":
      return [action.asset.address];
    case "swap_exact_in":
    case "swap_exact_out":
      return [action.assetIn.address, action.assetOut.address];
    default:
      return [];
  }
}

/**
 * Extracts the contract address (spender or router) from a TxIntent action.
 * Returns undefined for transfers (no external contract interaction).
 */
export function extractContractAddress(intent: TxIntent): string | undefined {
  const action = intent.action;
  switch (action.type) {
    case "approve":
      return action.spender;
    case "swap_exact_in":
    case "swap_exact_out":
      return action.router;
    default:
      return undefined;
  }
}
