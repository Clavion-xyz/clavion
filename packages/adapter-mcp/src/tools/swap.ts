import type { ISCLClient } from "../shared/iscl-client.js";
import type { McpToolResult } from "../formatters.js";
import type { SwapExactInAction } from "@clavion/types";
import { buildIntent } from "./intent-builder.js";
import { executeSecurePipeline } from "./pipeline.js";
import { formatPipelineResult, formatError } from "../formatters.js";

interface SwapArgs {
  wallet: string;
  router: string;
  assetIn: { kind: "erc20"; address: string; symbol?: string; decimals?: number };
  assetOut: { kind: "erc20"; address: string; symbol?: string; decimals?: number };
  amountIn: string;
  minAmountOut: string;
  slippageBps?: number;
  provider?: "uniswap_v3" | "1inch";
  chainId?: number;
  maxGasWei?: string;
}

export async function handleSwap(
  args: SwapArgs,
  client: ISCLClient,
): Promise<McpToolResult> {
  try {
    const action: SwapExactInAction = {
      type: "swap_exact_in",
      router: args.router,
      provider: args.provider,
      assetIn: args.assetIn,
      assetOut: args.assetOut,
      amountIn: args.amountIn,
      minAmountOut: args.minAmountOut,
    };

    const intent = buildIntent({
      walletAddress: args.wallet,
      action,
      chainId: args.chainId,
      maxGasWei: args.maxGasWei,
      slippageBps: args.slippageBps,
    });

    const result = await executeSecurePipeline(intent, client);
    return formatPipelineResult(result, "Token Swap");
  } catch (err) {
    return formatError(err);
  }
}
