import type { Action, IAgentRuntime, Memory, State, HandlerCallback, ActionExample } from "@elizaos/core";
import { ClavionService } from "../service.js";
import { buildIntent } from "../shared/intent-builder.js";
import { executeSecurePipeline } from "../shared/pipeline.js";
import { transferTemplate } from "../templates.js";
import type { TransferAction } from "@clavion/types";

const examples: ActionExample[][] = [
  [
    {
      name: "user",
      content: { text: "Send 1000000 USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) to 0xAlice" },
    },
    {
      name: "assistant",
      content: { text: "Initiating secure ERC-20 transfer via Clavion...", actions: ["CLAVION_TRANSFER"] },
    },
  ],
];

export const transferAction: Action = {
  name: "CLAVION_TRANSFER",
  similes: ["SEND_TOKENS", "TRANSFER_TOKENS", "SEND_ERC20", "TRANSFER_ERC20"],
  description: "Transfer ERC-20 tokens securely via Clavion ISCL. Policy-enforced with human approval.",
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

    // Extract parameters via LLM
    let params: { tokenAddress: string; recipient: string; amount: string };
    try {
      const context = transferTemplate.replace(
        "{{recentMessages}}",
        message.content.text ?? "",
      );
      const result = await runtime.generateText(context);
      const text = typeof result === "string" ? result : result.text;
      const match = text.match(/```json\s*([\s\S]*?)\s*```/);
      params = JSON.parse(match ? match[1]! : text) as typeof params;
    } catch {
      if (callback) await callback({ text: "Could not extract transfer parameters from your message." });
      return { success: false, error: "parameter_extraction_failed" };
    }

    const action: TransferAction = {
      type: "transfer",
      asset: { kind: "erc20", address: params.tokenAddress },
      to: params.recipient,
      amount: params.amount,
    };

    const intent = buildIntent({ walletAddress: wallet, action });

    try {
      const result = await executeSecurePipeline(intent, service.getClient());

      if (!result.success) {
        if (callback) {
          await callback({
            text: `Transfer declined: ${result.declineReason ?? "unknown reason"}. Risk score: ${result.riskScore ?? "N/A"}/100.`,
          });
        }
        return { success: false, error: result.declineReason };
      }

      if (callback) {
        await callback({
          text: `Transfer successful! ${result.description ?? ""}\nTx hash: ${result.txHash ?? "N/A"}\nBroadcast: ${result.broadcast ? "yes" : "no (sign-only)"}`,
        });
      }

      return {
        success: true,
        text: result.description,
        data: { txHash: result.txHash, intentId: result.intentId, broadcast: result.broadcast },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (callback) await callback({ text: `Transfer failed: ${msg}` });
      return { success: false, error: msg };
    }
  },
};
