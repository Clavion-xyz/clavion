import { Bot } from "grammy";
import type { ISCLClient, ApproveRequestResponse } from "./shared/iscl-client.js";
import type { TelegramAdapterConfig } from "./config.js";
import { createAuthMiddleware, requireSameSender } from "./middleware/auth.js";
import type { ActiveTransactionStore } from "./approval/approval-flow.js";
import { formatSuccessMessage, formatDeniedMessage, formatErrorMessage } from "./approval/formatters.js";
import { handleStartCommand } from "./commands/start.js";
import { handleTransferCommand } from "./commands/transfer.js";
import { handleSendCommand } from "./commands/send.js";
import { handleSwapCommand } from "./commands/swap.js";
import { handleApproveTokenCommand } from "./commands/approve-token.js";
import { handleBalanceCommand } from "./commands/balance.js";
import { handleStatusCommand } from "./commands/status.js";

export interface BotDeps {
  client: ISCLClient;
  config: TelegramAdapterConfig;
}

export function createBot(deps: BotDeps): Bot {
  const { client, config } = deps;
  const bot = new Bot(config.botToken);
  const activeTransactions: ActiveTransactionStore = new Map();

  // Auth middleware
  bot.use(createAuthMiddleware({ allowedChatIds: config.allowedChatIds }));

  // Commands
  bot.command("start", (ctx) => handleStartCommand(ctx));
  bot.command("help", (ctx) => handleStartCommand(ctx));
  bot.command("transfer", (ctx) =>
    handleTransferCommand(ctx, client, config, activeTransactions),
  );
  bot.command("send", (ctx) =>
    handleSendCommand(ctx, client, config, activeTransactions),
  );
  bot.command("swap", (ctx) =>
    handleSwapCommand(ctx, client, config, activeTransactions),
  );
  bot.command("approve", (ctx) =>
    handleApproveTokenCommand(ctx, client, config, activeTransactions),
  );
  bot.command("balance", (ctx) => handleBalanceCommand(ctx, client, config));
  bot.command("status", (ctx) => handleStatusCommand(ctx, client));

  // Callback queries for inline keyboard buttons
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const colonIdx = data.indexOf(":");
    if (colonIdx === -1) {
      await ctx.answerCallbackQuery({ text: "Invalid action" });
      return;
    }

    const action = data.slice(0, colonIdx);
    const requestId = data.slice(colonIdx + 1);

    if (!requestId || (action !== "approve" && action !== "deny")) {
      await ctx.answerCallbackQuery({ text: "Invalid action" });
      return;
    }

    const active = activeTransactions.get(requestId);
    if (!active) {
      await ctx.answerCallbackQuery({ text: "Transaction expired or not found" });
      return;
    }

    // Security: only the initiator can decide
    if (!requireSameSender(active.userId, ctx)) {
      await ctx.answerCallbackQuery({
        text: "Only the transaction initiator can decide",
      });
      return;
    }

    const approved = action === "approve";

    try {
      // Submit decision to ISCL Core
      await client.submitDecision(requestId, approved);
      await ctx.answerCallbackQuery({ text: approved ? "Approved!" : "Denied." });

      // Wait for the blocked approve-request to resolve
      let approvalResponse: ApproveRequestResponse;
      try {
        approvalResponse = await active.approvePromise;
      } catch (err) {
        await ctx.editMessageText(formatErrorMessage(err), { parse_mode: "HTML" }).catch(() => {});
        activeTransactions.delete(requestId);
        return;
      }

      if (approved && approvalResponse.approved && approvalResponse.approvalTokenId) {
        // Sign and broadcast
        await ctx.editMessageText("Signing and broadcasting...").catch(() => {});

        try {
          const signed = await client.txSignAndSend({
            intent: active.intent,
            approvalTokenId: approvalResponse.approvalTokenId,
          });

          await ctx.editMessageText(
            formatSuccessMessage({
              intentId: signed.intentId,
              txHash: signed.txHash,
              broadcast: signed.broadcast,
              broadcastError: signed.broadcastError,
            }),
            { parse_mode: "HTML" },
          ).catch(() => {});
        } catch (err) {
          await ctx.editMessageText(formatErrorMessage(err), {
            parse_mode: "HTML",
          }).catch(() => {});
        }
      } else {
        await ctx.editMessageText(formatDeniedMessage()).catch(() => {});
      }
    } catch (err) {
      await ctx.editMessageText(formatErrorMessage(err), { parse_mode: "HTML" }).catch(() => {});
    } finally {
      activeTransactions.delete(requestId);
    }
  });

  return bot;
}
