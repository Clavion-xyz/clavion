import { describe, it, expect, vi } from "vitest";
import type { Context, NextFunction } from "grammy";

import { createAuthMiddleware, requireSameSender } from "../src/middleware/auth.js";

/* ---------- helpers ---------- */

function mockCtx(chatId?: number, hasMessage = true) {
  return {
    chat: chatId !== undefined ? { id: chatId } : undefined,
    message: hasMessage ? { text: "/test" } : undefined,
    reply: vi.fn().mockResolvedValue(undefined),
    from: { id: 12345 },
  } as unknown as Context;
}

/* ========================================================== */
/*  createAuthMiddleware                                       */
/* ========================================================== */
describe("createAuthMiddleware", () => {
  it("allows when no allowlist configured", async () => {
    const middleware = createAuthMiddleware({ allowedChatIds: new Set() });
    const ctx = mockCtx(123);
    const next = vi.fn().mockResolvedValue(undefined) as unknown as NextFunction;

    await middleware(ctx, next);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it("allows when chat is in allowlist", async () => {
    const middleware = createAuthMiddleware({ allowedChatIds: new Set([123]) });
    const ctx = mockCtx(123);
    const next = vi.fn().mockResolvedValue(undefined) as unknown as NextFunction;

    await middleware(ctx, next);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it("blocks when chat not in allowlist", async () => {
    const middleware = createAuthMiddleware({ allowedChatIds: new Set([123]) });
    const ctx = mockCtx(999);
    const next = vi.fn().mockResolvedValue(undefined) as unknown as NextFunction;

    await middleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      "Unauthorized: this chat is not allowed to use this bot.",
    );
  });

  it("blocks when no chat", async () => {
    const middleware = createAuthMiddleware({ allowedChatIds: new Set([123]) });
    const ctx = mockCtx(undefined);
    const next = vi.fn().mockResolvedValue(undefined) as unknown as NextFunction;

    await middleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
  });
});

/* ========================================================== */
/*  requireSameSender                                          */
/* ========================================================== */
describe("requireSameSender", () => {
  it("returns true for matching user", () => {
    const ctx = { from: { id: 456 } } as unknown as Context;
    expect(requireSameSender(456, ctx)).toBe(true);
  });

  it("returns false for different user", () => {
    const ctx = { from: { id: 789 } } as unknown as Context;
    expect(requireSameSender(456, ctx)).toBe(false);
  });
});
