import type { Context } from "grammy";
import type { TransferAction } from "@clavion/types";
import type { ISCLClient } from "../shared/iscl-client.js";
import type { TelegramAdapterConfig } from "../config.js";
import type { ActiveTransactionStore } from "../approval/approval-flow.js";
import { buildIntent } from "../shared/intent-builder.js";
import { initiateApprovalFlow } from "../approval/approval-flow.js";

const TRANSFER_RE =
  /^\/transfer\s+(\d+)\s+(0x[a-fA-F0-9]{40})\s+to\s+(0x[a-fA-F0-9]{40})$/i;

export function parseTransferCommand(
  text: string,
): { amount: string; tokenAddress: string; recipient: string } | null {
  const match = TRANSFER_RE.exec(text);
  if (!match) return null;
  return {
    amount: match[1]!,
    tokenAddress: match[2]!,
    recipient: match[3]!,
  };
}

export async function handleTransferCommand(
  ctx: Context,
  client: ISCLClient,
  config: TelegramAdapterConfig,
  store: ActiveTransactionStore,
): Promise<void> {
  const text = ctx.message?.text ?? "";
  const params = parseTransferCommand(text);

  if (!params) {
    await ctx.reply(
      "Usage: /transfer <amount> <tokenAddress> to <recipientAddress>\n" +
        "Example: /transfer 1000000 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 to 0xAbC...",
    );
    return;
  }

  const action: TransferAction = {
    type: "transfer",
    asset: { kind: "erc20", address: params.tokenAddress },
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
