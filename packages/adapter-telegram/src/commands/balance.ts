import type { Context } from "grammy";
import type { ISCLClient } from "../shared/iscl-client.js";
import type { TelegramAdapterConfig } from "../config.js";
import { formatBalanceMessage, formatErrorMessage } from "../approval/formatters.js";

const BALANCE_RE = /^\/balance\s+(0x[a-fA-F0-9]{40})\s+(0x[a-fA-F0-9]{40})$/i;

export function parseBalanceCommand(
  text: string,
): { token: string; account: string } | null {
  const match = BALANCE_RE.exec(text);
  if (!match) return null;
  return {
    token: match[1]!,
    account: match[2]!,
  };
}

export async function handleBalanceCommand(
  ctx: Context,
  client: ISCLClient,
  config: TelegramAdapterConfig,
): Promise<void> {
  const text = ctx.message?.text ?? "";
  const params = parseBalanceCommand(text);

  if (!params) {
    await ctx.reply(
      "Usage: /balance <tokenAddress> <accountAddress>\n" +
        "Example: /balance 0xUSDC 0xMyWallet",
    );
    return;
  }

  try {
    const resp = await client.balance(params.token, params.account, config.chainId);
    await ctx.reply(formatBalanceMessage(resp), { parse_mode: "HTML" });
  } catch (err) {
    await ctx.reply(formatErrorMessage(err), { parse_mode: "HTML" });
  }
}
