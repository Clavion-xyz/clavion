/** Known 1inch AggregationRouterV6 addresses per chain. Same address on all supported chains. */
export const ONEINCH_ROUTERS: Record<number, string> = {
  1: "0x111111125421cA6dc452d289314280a0f8842A65", // Ethereum
  10: "0x111111125421cA6dc452d289314280a0f8842A65", // Optimism
  42161: "0x111111125421cA6dc452d289314280a0f8842A65", // Arbitrum
  8453: "0x111111125421cA6dc452d289314280a0f8842A65", // Base
};

/** The special address 1inch uses to represent native ETH. */
export const ONEINCH_NATIVE_TOKEN =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

/** Chain IDs supported by 1inch API v6. */
export const ONEINCH_SUPPORTED_CHAINS = new Set([1, 10, 42161, 8453]);
