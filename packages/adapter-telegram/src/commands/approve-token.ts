import type { Context } from "grammy";
import type { ApproveAction } from "@clavion/types";
import type { ISCLClient } from "../shared/iscl-client.js";
import type { TelegramAdapterConfig } from "../config.js";
import type { ActiveTransactionStore } from "../approval/approval-flow.js";
import { buildIntent } from "../shared/intent-builder.js";
import { initiateApprovalFlow } from "../approval/approval-flow.js";

const APPROVE_RE =
  /^\/approve\s+(\d+)\s+(0x[a-fA-F0-9]{40})\s+for\s+(0x[a-fA-F0-9]{40})$/i;

export function parseApproveCommand(
  text: string,
): { amount: string; tokenAddress: string; spender: string } | null {
  const match = APPROVE_RE.exec(text);
  if (!match) return null;
  return {
    amount: match[1]!,
    tokenAddress: match[2]!,
    spender: match[3]!,
  };
}

export async function handleApproveTokenCommand(
  ctx: Context,
  client: ISCLClient,
  config: TelegramAdapterConfig,
  store: ActiveTransactionStore,
): Promise<void> {
  const text = ctx.message?.text ?? "";
  const params = parseApproveCommand(text);

  if (!params) {
    await ctx.reply(
      "Usage: /approve <amount> <tokenAddress> for <spenderAddress>\n" +
        "Example: /approve 1000000 0xUSDC for 0xRouter",
    );
    return;
  }

  const action: ApproveAction = {
    type: "approve",
    asset: { kind: "erc20", address: params.tokenAddress },
    spender: params.spender,
    amount: params.amount,
  };

  const intent = buildIntent({
    walletAddress: config.walletAddress,
    action,
    chainId: config.chainId,
  });

  await initiateApprovalFlow(ctx, intent, client, config, store);
}
