import type { Context } from "grammy";
import { formatHelp } from "../approval/formatters.js";

export async function handleStartCommand(ctx: Context): Promise<void> {
  await ctx.reply(formatHelp(), { parse_mode: "HTML" });
}
