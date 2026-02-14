import { InlineKeyboard } from "grammy";
import type { Context } from "grammy";
import type {
  ISCLClient,
  PendingApprovalItem,
  ApproveRequestResponse,
} from "../shared/iscl-client.js";
import type { TxIntent } from "@clavion/types";
import type { TelegramAdapterConfig } from "../config.js";
import { formatApprovalCard, formatSuccessMessage, formatErrorMessage } from "./formatters.js";

export interface ActiveTransaction {
  intent: TxIntent;
  approvePromise: Promise<ApproveRequestResponse>;
  requestId: string;
  chatId: number;
  messageId: number;
  userId: number;
  createdAt: number;
}

export type ActiveTransactionStore = Map<string, ActiveTransaction>;

export async function pollForPendingApproval(
  client: ISCLClient,
  intentId: string,
  pollIntervalMs: number,
  timeoutMs: number,
): Promise<PendingApprovalItem | null> {
  const deadline = Date.now() + timeoutMs;
  let currentInterval = pollIntervalMs;
  while (Date.now() < deadline) {
    try {
      const { pending } = await client.pendingApprovals();
      const match = pending.find((p) => p.summary.intentId === intentId);
      if (match) return match;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[approval-poll] Error polling ISCL Core: ${msg}`);
    }
    await new Promise((r) => setTimeout(r, currentInterval));
    currentInterval = Math.min(currentInterval * 1.5, 5000);
  }
  return null;
}

export async function initiateApprovalFlow(
  ctx: Context,
  intent: TxIntent,
  client: ISCLClient,
  config: TelegramAdapterConfig,
  store: ActiveTransactionStore,
): Promise<void> {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (chatId === undefined || userId === undefined) return;

  const statusMsg = await ctx.reply("Processing transaction...");

  try {
    // Fire the blocking approve-request in the background
    const approvePromise = client.txApproveRequest(intent);

    // Poll for the pending approval to appear in the store
    const pending = await pollForPendingApproval(
      client,
      intent.id,
      config.pollIntervalMs,
      10_000,
    );

    if (!pending) {
      // Approve-request may have resolved immediately (policy=allow or policy=deny)
      const response = await approvePromise;

      if (response.approved && response.approvalTokenId) {
        // Auto-approved — go straight to sign-and-send
        const signed = await client.txSignAndSend({
          intent,
          approvalTokenId: response.approvalTokenId,
        });
        await ctx.api.editMessageText(
          chatId,
          statusMsg.message_id,
          formatSuccessMessage({
            intentId: signed.intentId,
            txHash: signed.txHash,
            broadcast: signed.broadcast,
            broadcastError: signed.broadcastError,
          }),
          { parse_mode: "HTML" },
        );
        return;
      }

      // Policy denied
      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        formatErrorMessage(response.reason ?? "Policy denied this transaction."),
        { parse_mode: "HTML" },
      );
      return;
    }

    // Render approval card with inline keyboard
    const keyboard = new InlineKeyboard()
      .text("Approve", `approve:${pending.requestId}`)
      .text("Deny", `deny:${pending.requestId}`);

    await ctx.api.editMessageText(
      chatId,
      statusMsg.message_id,
      formatApprovalCard(pending),
      { parse_mode: "HTML", reply_markup: keyboard },
    );

    // Store active transaction for callback handler
    store.set(pending.requestId, {
      intent,
      approvePromise,
      requestId: pending.requestId,
      chatId,
      messageId: statusMsg.message_id,
      userId,
      createdAt: Date.now(),
    });

    // Expiry cleanup
    setTimeout(() => {
      const entry = store.get(pending.requestId);
      if (entry) {
        store.delete(pending.requestId);
        ctx.api
          .editMessageText(entry.chatId, entry.messageId, "Transaction approval expired.")
          .catch(() => {});
      }
    }, config.approvalTimeoutMs);
  } catch (err) {
    await ctx.api.editMessageText(
      chatId,
      statusMsg.message_id,
      formatErrorMessage(err),
      { parse_mode: "HTML" },
    );
  }
}
