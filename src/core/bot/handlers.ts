/**
 * Telegram bot command handlers.
 * Registers /status, /audit, /health, /doctor, /help commands.
 * All commands read local data only — zero SSH (D-07).
 */

import type { Bot } from "grammy";
import { readFileSync } from "fs";
import { join } from "path";
import { findServer, getServers } from "../../utils/config.js";
import { listSnapshots, loadSnapshot } from "../audit/snapshot.js";
import { getGuardStates } from "../guard.js";
import { loadMetricsHistory } from "../doctor.js";
import type { SnapshotListEntry } from "../audit/types.js";
import type { DoctorFinding } from "../doctor.js";
import {
  formatAuditMessage,
  formatStatusMessage,
  formatHealthMessage,
  formatDoctorMessage,
} from "./formatter.js";

let cachedVersion: string | null = null;

function getVersion(): string {
  if (cachedVersion !== null) return cachedVersion;
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8")) as { version: string };
    cachedVersion = pkg.version;
    return cachedVersion;
  } catch {
    cachedVersion = "0.0.0";
    return cachedVersion;
  }
}

/** Register all bot command handlers on the given Bot instance. */
export function registerHandlers(bot: Bot): void {
  // /audit <server> — D-06: server name mandatory
  bot.command("audit", async (ctx) => {
    const serverName = ctx.match?.trim();
    if (!serverName) {
      await ctx.reply("Kullanim: /audit <server>\nOrnek: /audit my-server");
      return;
    }

    const server = findServer(serverName);
    if (!server) {
      await ctx.reply(
        `Sunucu bulunamadi: ${serverName}\nKayitli sunucular: kastell list`,
      );
      return;
    }

    const entries = await listSnapshots(server.ip);
    if (entries.length === 0) {
      await ctx.reply(
        `Henuz audit snapshot yok. Calistir: kastell audit ${serverName}`,
      );
      return;
    }

    const latest = entries[entries.length - 1];
    const snapshot = await loadSnapshot(server.ip, latest.filename);
    if (!snapshot) {
      await ctx.reply("Snapshot okunamadi. Yeniden calistir: kastell audit " + serverName);
      return;
    }

    const ageHours = Math.floor(
      (Date.now() - new Date(snapshot.savedAt).getTime()) / 3600000,
    );
    await ctx.reply(formatAuditMessage(snapshot, ageHours));
  });

  // /status <server> — D-06: server name mandatory
  bot.command("status", async (ctx) => {
    const serverName = ctx.match?.trim();
    if (!serverName) {
      await ctx.reply("Kullanim: /status <server>\nOrnek: /status my-server");
      return;
    }

    const server = findServer(serverName);
    if (!server) {
      await ctx.reply(
        `Sunucu bulunamadi: ${serverName}\nKayitli sunucular: kastell list`,
      );
      return;
    }

    const guardStates = getGuardStates();
    const guardState = guardStates[server.name];

    const entries = await listSnapshots(server.ip);
    const latestEntry: SnapshotListEntry | undefined =
      entries.length > 0 ? entries[entries.length - 1] : undefined;

    await ctx.reply(formatStatusMessage(server, guardState, latestEntry));
  });

  // /health — fleet overview (no argument = all servers)
  bot.command("health", async (ctx) => {
    const arg = ctx.match?.trim();

    // With argument: treat as single-server status alias
    if (arg) {
      const server = findServer(arg);
      if (!server) {
        await ctx.reply(
          `Sunucu bulunamadi: ${arg}\nKayitli sunucular: kastell list`,
        );
        return;
      }
      const guardStates = getGuardStates();
      const entries = await listSnapshots(server.ip);
      const latestEntry: SnapshotListEntry | undefined =
        entries.length > 0 ? entries[entries.length - 1] : undefined;
      await ctx.reply(formatStatusMessage(server, guardStates[server.name], latestEntry));
      return;
    }

    // No argument: fleet overview
    const servers = getServers();
    const guardStates = getGuardStates();
    const snapshots = new Map<string, SnapshotListEntry>();

    const results = await Promise.all(
      servers.map(async (s) => {
        const entries = await listSnapshots(s.ip);
        return { ip: s.ip, entry: entries.length > 0 ? entries[entries.length - 1] : null };
      }),
    );
    for (const { ip, entry } of results) {
      if (entry) snapshots.set(ip, entry);
    }

    await ctx.reply(formatHealthMessage(servers, guardStates, snapshots));
  });

  // /doctor <server> — D-06: server name mandatory, D-07: cached data only
  bot.command("doctor", async (ctx) => {
    const serverName = ctx.match?.trim();
    if (!serverName) {
      await ctx.reply("Kullanim: /doctor <server>\nOrnek: /doctor my-server");
      return;
    }

    const server = findServer(serverName);
    if (!server) {
      await ctx.reply(
        `Sunucu bulunamadi: ${serverName}\nKayitli sunucular: kastell list`,
      );
      return;
    }

    const history = loadMetricsHistory(server.ip);
    if (history.length === 0) {
      await ctx.reply(
        `Doctor verisi yok. Calistir: kastell doctor ${serverName}`,
      );
      return;
    }

    // Derive basic findings from the latest metrics snapshot
    const latest = history[history.length - 1];
    const findings: DoctorFinding[] = [];

    if (latest.diskPct >= 90) {
      findings.push({
        id: "DISK-HIGH",
        severity: "critical",
        description: `Disk kullanimi yuksek: %${latest.diskPct}`,
        command: "df -h /",
      });
    } else if (latest.diskPct >= 80) {
      findings.push({
        id: "DISK-WARN",
        severity: "warning",
        description: `Disk kullanimi: %${latest.diskPct}`,
        command: "df -h /",
      });
    }

    if (latest.ramPct >= 90) {
      findings.push({
        id: "RAM-HIGH",
        severity: "critical",
        description: `RAM kullanimi yuksek: %${latest.ramPct}`,
        command: "free -h",
      });
    } else if (latest.ramPct >= 80) {
      findings.push({
        id: "RAM-WARN",
        severity: "warning",
        description: `RAM kullanimi: %${latest.ramPct}`,
        command: "free -h",
      });
    }

    const loadPerCpu = latest.cpuLoad1 / (latest.ncpu || 1);
    if (loadPerCpu >= 2) {
      findings.push({
        id: "CPU-HIGH",
        severity: "critical",
        description: `CPU load yuksek: ${latest.cpuLoad1} (${latest.ncpu} core)`,
        command: "uptime",
      });
    } else if (loadPerCpu >= 1) {
      findings.push({
        id: "CPU-WARN",
        severity: "warning",
        description: `CPU load: ${latest.cpuLoad1} (${latest.ncpu} core)`,
        command: "uptime",
      });
    }

    await ctx.reply(formatDoctorMessage(serverName, findings));
  });

  // /help — command list with version footer (D-05)
  bot.command("help", async (ctx) => {
    const lines = [
      "Kastell Bot Komutlari:",
      "",
      "/audit <server> -- Audit skoru + en kotu 5 kategori",
      "/status <server> -- Sunucu durumu (lokal veri)",
      "/health -- Tum sunucularin durumu",
      "/doctor <server> -- Doctor bulgulari (cached)",
      "/help -- Bu mesaj",
      "",
      `Kastell v${getVersion()} | 4 komut`,
    ];
    await ctx.reply(lines.join("\n"));
  });

  // /start — Telegram auto-sends this when user opens chat
  bot.command("start", async (ctx) => {
    await ctx.reply("Bot zaten calisiyor!");
  });
}
