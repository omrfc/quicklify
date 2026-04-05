/**
 * Telegram bot offset persistence.
 * Tracks the last processed update_id to prevent stale command replay on restart.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { KASTELL_DIR } from "../../utils/paths.js";

export interface BotOffset {
  lastUpdateId: number;
  savedAt: string;
}

const OFFSET_FILE = join(KASTELL_DIR, "telegram-bot-offset.json");
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/** Ensure KASTELL_DIR exists. Call once at startup, not per-save. */
export function ensureOffsetDir(): void {
  if (!existsSync(KASTELL_DIR)) mkdirSync(KASTELL_DIR, { recursive: true });
}

/** Load the last saved offset. Returns null if file is missing or corrupt. */
export function loadOffset(): BotOffset | null {
  try {
    return JSON.parse(readFileSync(OFFSET_FILE, "utf-8")) as BotOffset;
  } catch {
    return null;
  }
}

/** Persist the last processed update_id with current timestamp. */
export function saveOffset(updateId: number): void {
  const data: BotOffset = {
    lastUpdateId: updateId,
    savedAt: new Date().toISOString(),
  };
  writeFileSync(OFFSET_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

/** Check if the given savedAt timestamp is older than 24 hours. */
export function isStale(savedAt: string): boolean {
  return Date.now() - new Date(savedAt).getTime() > STALE_THRESHOLD_MS;
}
