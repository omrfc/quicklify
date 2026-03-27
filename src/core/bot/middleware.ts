/**
 * Telegram bot auth middleware.
 * Enforces allowedChatIds globally before any command handler runs (D-10).
 * Unauthorized chats are silently ignored — no reply, no log (D-09).
 */

import type { Context, NextFunction } from "grammy";
import { loadAllowedChatIds } from "../notifyStore.js";

export async function allowedChatIdsMiddleware(
  ctx: Context,
  next: NextFunction,
): Promise<void> {
  const allowed = loadAllowedChatIds();

  // Empty allowlist = allow all (P92 backward compat)
  if (allowed.length === 0) {
    await next();
    return;
  }

  const chatId = String(ctx.chat?.id ?? "");
  if (allowed.includes(chatId)) {
    await next();
  }
  // Unauthorized: silent ignore — no reply, no log (D-09)
}
