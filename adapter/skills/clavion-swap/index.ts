import type { SwapExactInAction } from "../../../core/types.js";
import type { ISCLClient } from "../../shared/iscl-client.js";
import { ISCLError } from "../../shared/iscl-client.js";
import { buildIntent } from "../intent-builder.js";
import type { SwapParams, SkillResult } from "../types.js";

export async function handleSwap(
  params: SwapParams,
  client: ISCLClient,
): Promise<SkillResult> {
  try {
    const action: SwapExactInAction = {
      type: "swap_exact_in",
      router: params.router,
      assetIn: params.assetIn,
      assetOut: params.assetOut,
      amountIn: params.amountIn,
      minAmountOut: params.minAmountOut,
    };

    const intent = buildIntent({
      walletAddress: params.walletAddress,
      action,
      chainId: params.chainId,
      rpcHint: params.rpcHint,
      maxGasWei: params.maxGasWei,
      deadline: params.deadline,
      slippageBps: params.slippageBps,
      source: params.source,
    });

    const result = await client.txBuild(intent);

    return {
      success: true,
      intentId: result.intentId,
      description: result.description,
      data: { txRequestHash: result.txRequestHash },
    };
  } catch (err) {
    if (err instanceof ISCLError) {
      return { success: false, error: err.message };
    }
    throw err;
  }
}
