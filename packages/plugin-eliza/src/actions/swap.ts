import type { Action, IAgentRuntime, Memory, State, HandlerCallback, ActionExample } from "@elizaos/core";
import { ClavionService } from "../service.js";
import { buildIntent } from "../shared/intent-builder.js";
import { executeSecurePipeline } from "../shared/pipeline.js";
import { swapTemplate } from "../templates.js";
import type { SwapExactInAction } from "@clavion/types";

const examples: ActionExample[][] = [
  [
    {
      name: "user",
      content: { text: "Swap 1000000 USDC for WETH on Uniswap (router 0x2626664c2603336E57B271c5C0b26F421741e481)" },
    },
    {
      name: "assistant",
      content: { text: "Initiating secure token swap via Clavion...", actions: ["CLAVION_SWAP"] },
    },
  ],
];

export const swapAction: Action = {
  name: "CLAVION_SWAP",
  similes: ["SWAP_TOKENS", "EXCHANGE_TOKENS", "TRADE_TOKENS", "UNISWAP"],
  description: "Swap tokens via Uniswap V3 securely through Clavion ISCL with slippage protection and human approval.",
  examples,

  validate: async (runtime: IAgentRuntime, _message: Memory, _state?: State) => {
    const apiUrl = runtime.getSetting("ISCL_API_URL");
    const wallet = runtime.getSetting("ISCL_WALLET_ADDRESS");
    return typeof apiUrl === "string" && typeof wallet === "string";
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const wallet = runtime.getSetting("ISCL_WALLET_ADDRESS") as string;
    const service = runtime.getService<ClavionService>("clavion");
    if (!service) {
      return { success: false, error: "ClavionService not available" };
    }

    let params: { router: string; tokenIn: string; tokenOut: string; amountIn: string; minAmountOut: string; provider?: "uniswap_v3" | "1inch" };
    try {
      const context = swapTemplate.replace(
        "{{recentMessages}}",
        message.content.text ?? "",
      );
      const result = await runtime.generateText(context);
      const text = typeof result === "string" ? result : result.text;
      const match = text.match(/```json\s*([\s\S]*?)\s*```/);
      params = JSON.parse(match ? match[1]! : text) as typeof params;
    } catch {
      if (callback) await callback({ text: "Could not extract swap parameters from your message." });
      return { success: false, error: "parameter_extraction_failed" };
    }

    const action: SwapExactInAction = {
      type: "swap_exact_in",
      router: params.router,
      provider: params.provider,
      assetIn: { kind: "erc20", address: params.tokenIn },
      assetOut: { kind: "erc20", address: params.tokenOut },
      amountIn: params.amountIn,
      minAmountOut: params.minAmountOut,
    };

    const intent = buildIntent({ walletAddress: wallet, action });

    try {
      const result = await executeSecurePipeline(intent, service.getClient());

      if (!result.success) {
        if (callback) {
          await callback({
            text: `Swap declined: ${result.declineReason ?? "unknown reason"}. Risk score: ${result.riskScore ?? "N/A"}/100.`,
          });
        }
        return { success: false, error: result.declineReason };
      }

      if (callback) {
        await callback({
          text: `Swap successful! ${result.description ?? ""}\nTx hash: ${result.txHash ?? "N/A"}\nBroadcast: ${result.broadcast ? "yes" : "no (sign-only)"}`,
        });
      }

      return {
        success: true,
        text: result.description,
        data: { txHash: result.txHash, intentId: result.intentId, broadcast: result.broadcast },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (callback) await callback({ text: `Swap failed: ${msg}` });
      return { success: false, error: msg };
    }
  },
};
