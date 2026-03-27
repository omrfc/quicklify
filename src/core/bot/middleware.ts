/**
 * Telegram bot auth middleware.
 * Enforces allowedChatIds globally before any command handler runs (D-10).
 * Unauthorized chats are silently ignored — no reply, no log (D-09).
 */

import type { Context, NextFunction } from "grammy";
import { loadAllowedChatIds } from "../notifyStore.js";

const CACHE_TTL_MS = 5_000;
let cachedIds: string[] | null = null;
let cacheTime = 0;

/** Reset internal cache — for testing only. */
export function _resetCache(): void {
  cachedIds = null;
  cacheTime = 0;
}

function getCachedAllowedIds(): string[] {
  const now = Date.now();
  if (cachedIds === null || now - cacheTime > CACHE_TTL_MS) {
    cachedIds = loadAllowedChatIds();
    cacheTime = now;
  }
  return cachedIds;
}

export async function allowedChatIdsMiddleware(
  ctx: Context,
  next: NextFunction,
): Promise<void> {
  const allowed = getCachedAllowedIds();

  if (allowed.length === 0) {
    await next();
    return;
  }

  const chatId = String(ctx.chat?.id ?? "");
  if (allowed.includes(chatId)) {
    await next();
  }
}
