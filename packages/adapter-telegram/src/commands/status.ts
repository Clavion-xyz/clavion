import type { Context } from "grammy";
import type { ISCLClient } from "../shared/iscl-client.js";
import { formatReceiptMessage, formatErrorMessage } from "../approval/formatters.js";

const STATUS_RE = /^\/status\s+(0x[a-fA-F0-9]{64})$/i;

export function parseStatusCommand(text: string): { txHash: string } | null {
  const match = STATUS_RE.exec(text);
  if (!match) return null;
  return { txHash: match[1]! };
}

export async function handleStatusCommand(
  ctx: Context,
  client: ISCLClient,
): Promise<void> {
  const text = ctx.message?.text ?? "";
  const params = parseStatusCommand(text);

  if (!params) {
    await ctx.reply(
      "Usage: /status <transactionHash>\n" +
        "Example: /status 0xabc123...",
    );
    return;
  }

  try {
    const resp = await client.txReceipt(params.txHash);
    await ctx.reply(formatReceiptMessage(resp), { parse_mode: "HTML" });
  } catch (err) {
    await ctx.reply(formatErrorMessage(err), { parse_mode: "HTML" });
  }
}
