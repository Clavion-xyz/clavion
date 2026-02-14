import type {
  TxIntent,
  SwapExactInAction,
  BuildPlan,
} from "@clavion/types";
import type { OneInchClient } from "../../aggregator/oneinch-client.js";
import { ONEINCH_ROUTERS } from "../../aggregator/oneinch-routers.js";
import { computeTxRequestHash } from "./build-utils.js";

/**
 * Build a swap transaction using the 1inch Swap API v6.
 * Only supports swap_exact_in — swap_exact_out should fall back to Uniswap V3.
 */
export async function buildSwapOneInch(
  intent: TxIntent,
  oneInchClient: OneInchClient,
): Promise<BuildPlan> {
  const action = intent.action;
  if (action.type !== "swap_exact_in") {
    throw new Error(
      `1inch only supports swap_exact_in, got ${action.type}`,
    );
  }

  const chainId = intent.chain.chainId;
  const expectedRouter = ONEINCH_ROUTERS[chainId];
  if (!expectedRouter) {
    throw new Error(`1inch swaps not supported on chain ${chainId}`);
  }

  // Validate the router address matches the known 1inch router for this chain
  if (action.router.toLowerCase() !== expectedRouter.toLowerCase()) {
    throw new Error(
      `Unknown 1inch router ${action.router} for chain ${chainId}. Expected: ${expectedRouter}`,
    );
  }

  const a = action as SwapExactInAction;

  // Convert slippage from basis points to percentage (100 bps = 1%)
  const slippagePercent = (intent.constraints.maxSlippageBps / 100).toString();

  const response = await oneInchClient.getSwap(chainId, {
    src: a.assetIn.address,
    dst: a.assetOut.address,
    amount: a.amountIn,
    from: intent.wallet.address,
    slippage: slippagePercent,
    disableEstimate: true, // We do our own preflight simulation
  });

  const txRequest = {
    to: response.tx.to as `0x${string}`,
    data: response.tx.data as `0x${string}`,
    value: BigInt(response.tx.value),
    chainId,
    type: "eip1559" as const,
    maxFeePerGas: 0n,
    maxPriorityFeePerGas: 0n,
  };

  return {
    intentId: intent.id,
    txRequest,
    txRequestHash: computeTxRequestHash(txRequest),
    description: `Swap ${a.amountIn} ${a.assetIn.symbol ?? "tokenIn"} for ${a.assetOut.symbol ?? "tokenOut"} via 1inch`,
  };
}
