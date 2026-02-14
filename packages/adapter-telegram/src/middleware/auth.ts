import type { Context, NextFunction } from "grammy";

export interface AuthConfig {
  allowedChatIds: Set<number>;
}

export function createAuthMiddleware(config: AuthConfig) {
  return async (ctx: Context, next: NextFunction): Promise<void> => {
    if (config.allowedChatIds.size === 0) {
      return next();
    }

    const chatId = ctx.chat?.id;
    if (chatId === undefined || !config.allowedChatIds.has(chatId)) {
      if (ctx.message) {
        await ctx.reply("Unauthorized: this chat is not allowed to use this bot.");
      }
      return;
    }

    return next();
  };
}

export function requireSameSender(storedUserId: number, ctx: Context): boolean {
  return ctx.from?.id === storedUserId;
}
