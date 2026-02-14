import type { Action, IAgentRuntime, Memory, State, HandlerCallback, ActionExample } from "@elizaos/core";
import { ClavionService } from "../service.js";
import { balanceTemplate } from "../templates.js";

const examples: ActionExample[][] = [
  [
    {
      name: "user",
      content: { text: "Check my USDC balance (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)" },
    },
    {
      name: "assistant",
      content: { text: "Checking your USDC balance...", actions: ["CLAVION_CHECK_BALANCE"] },
    },
  ],
];

export const balanceAction: Action = {
  name: "CLAVION_CHECK_BALANCE",
  similes: ["CHECK_BALANCE", "GET_BALANCE", "TOKEN_BALANCE", "SHOW_BALANCE"],
  description: "Check ERC-20 token balance via Clavion ISCL. Read-only, no signing required.",
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

    let params: { tokenAddress: string };
    try {
      const context = balanceTemplate.replace(
        "{{recentMessages}}",
        message.content.text ?? "",
      );
      const result = await runtime.generateText(context);
      const text = typeof result === "string" ? result : result.text;
      const match = text.match(/```json\s*([\s\S]*?)\s*```/);
      params = JSON.parse(match ? match[1]! : text) as typeof params;
    } catch {
      if (callback) await callback({ text: "Could not extract token address from your message." });
      return { success: false, error: "parameter_extraction_failed" };
    }

    try {
      const result = await service.getClient().balance(params.tokenAddress, wallet);

      if (callback) {
        await callback({
          text: `Token balance:\nToken: ${result.token}\nAccount: ${result.account}\nBalance: ${result.balance} (base units)`,
        });
      }

      return {
        success: true,
        text: `Balance: ${result.balance}`,
        data: { token: result.token, account: result.account, balance: result.balance },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (callback) await callback({ text: `Balance check failed: ${msg}` });
      return { success: false, error: msg };
    }
  },
};
