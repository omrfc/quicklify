import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { z } from "zod";
import axios from "axios";
import { CONFIG_DIR } from "../utils/config.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const NOTIFY_FILE = join(CONFIG_DIR, "notify.json");
const COOLDOWN_FILE = join(CONFIG_DIR, "notify-cooldown.json");
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

// ─── Schemas ──────────────────────────────────────────────────────────────────

const TelegramChannelSchema = z.object({
  botToken: z.string().min(1),
  chatId: z.string().min(1),
});

const WebhookChannelSchema = z.object({
  webhookUrl: z.string().url(),
});

export const NotifyConfigSchema = z.object({
  telegram: TelegramChannelSchema.optional(),
  discord: WebhookChannelSchema.optional(),
  slack: WebhookChannelSchema.optional(),
});

const CooldownStateSchema = z.record(z.string(), z.string());

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotifyConfig = z.infer<typeof NotifyConfigSchema>;

export interface ChannelResult {
  channel: "telegram" | "discord" | "slack";
  success: boolean;
  error?: string;
}

// ─── Config Management ────────────────────────────────────────────────────────

export function loadNotifyConfig(): NotifyConfig {
  if (!existsSync(NOTIFY_FILE)) return {};
  try {
    const raw = JSON.parse(readFileSync(NOTIFY_FILE, "utf-8"));
    const result = NotifyConfigSchema.safeParse(raw);
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

export function saveNotifyConfig(config: NotifyConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(NOTIFY_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

// ─── Channel Dispatchers ──────────────────────────────────────────────────────

export async function sendTelegram(
  botToken: string,
  chatId: string,
  text: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      { chat_id: chatId, text },
      { timeout: 10_000 },
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendDiscord(
  webhookUrl: string,
  content: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(webhookUrl, { content }, { timeout: 10_000 });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendSlack(
  webhookUrl: string,
  text: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(webhookUrl, { text }, { timeout: 10_000 });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Fan-out ──────────────────────────────────────────────────────────────────

export async function dispatchNotification(
  message: string,
  config?: NotifyConfig,
): Promise<ChannelResult[]> {
  const cfg = config ?? loadNotifyConfig();
  const tasks: Promise<ChannelResult>[] = [];

  if (cfg.telegram) {
    tasks.push(
      sendTelegram(cfg.telegram.botToken, cfg.telegram.chatId, message).then(
        (r) => ({ channel: "telegram" as const, ...r }),
      ),
    );
  }
  if (cfg.discord) {
    tasks.push(
      sendDiscord(cfg.discord.webhookUrl, message).then(
        (r) => ({ channel: "discord" as const, ...r }),
      ),
    );
  }
  if (cfg.slack) {
    tasks.push(
      sendSlack(cfg.slack.webhookUrl, message).then(
        (r) => ({ channel: "slack" as const, ...r }),
      ),
    );
  }

  const settled = await Promise.allSettled(tasks);
  return settled.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { channel: "unknown" as never, success: false, error: String(r.reason) },
  );
}

// ─── Cooldown State ───────────────────────────────────────────────────────────

export function loadCooldownState(): Record<string, string> {
  if (!existsSync(COOLDOWN_FILE)) return {};
  try {
    const result = CooldownStateSchema.safeParse(
      JSON.parse(readFileSync(COOLDOWN_FILE, "utf-8")),
    );
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

export function saveCooldownState(state: Record<string, string>): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(COOLDOWN_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
}

export async function dispatchWithCooldown(
  serverName: string,
  findingType: string,
  message: string,
): Promise<{ skipped: boolean; results: ChannelResult[] }> {
  const key = `${serverName}:${findingType}`;
  const state = loadCooldownState();
  const lastSent = state[key];
  if (lastSent && Date.now() - new Date(lastSent).getTime() < COOLDOWN_MS) {
    return { skipped: true, results: [] };
  }
  const results = await dispatchNotification(message);
  const anySuccess = results.some((r) => r.success);
  if (anySuccess) {
    state[key] = new Date().toISOString();
    saveCooldownState(state);
  }
  return { skipped: false, results };
}
