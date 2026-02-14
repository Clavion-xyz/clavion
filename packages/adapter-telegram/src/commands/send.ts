import type { Context } from "grammy";
import type { TransferNativeAction } from "@clavion/types";
import type { ISCLClient } from "../shared/iscl-client.js";
import type { TelegramAdapterConfig } from "../config.js";
import type { ActiveTransactionStore } from "../approval/approval-flow.js";
import { buildIntent } from "../shared/intent-builder.js";
import { initiateApprovalFlow } from "../approval/approval-flow.js";

const SEND_RE = /^\/send\s+(\d+)\s+to\s+(0x[a-fA-F0-9]{40})$/i;

export function parseSendCommand(
  text: string,
): { amount: string; recipient: string } | null {
  const match = SEND_RE.exec(text);
  if (!match) return null;
  return {
    amount: match[1]!,
    recipient: match[2]!,
  };
}

export async function handleSendCommand(
  ctx: Context,
  client: ISCLClient,
  config: TelegramAdapterConfig,
  store: ActiveTransactionStore,
): Promise<void> {
  const text = ctx.message?.text ?? "";
  const params = parseSendCommand(text);

  if (!params) {
    await ctx.reply(
      "Usage: /send <amountWei> to <recipientAddress>\n" +
        "Example: /send 1000000000000000000 to 0xAbC... (sends 1 ETH)",
    );
    return;
  }

  const action: TransferNativeAction = {
    type: "transfer_native",
    to: params.recipient,
    amount: params.amount,
  };

  const intent = buildIntent({
    walletAddress: config.walletAddress,
    action,
    chainId: config.chainId,
  });

  await initiateApprovalFlow(ctx, intent, client, config, store);
}
