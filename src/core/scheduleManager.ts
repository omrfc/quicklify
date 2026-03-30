import { execSync } from "child_process";
import { appendFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import { join } from "path";
import {
  validateCronExpr,
  saveSchedule,
  removeSchedule,
  getSchedules,
} from "../core/backupSchedule.js";
import { CONFIG_DIR } from "../utils/config.js";
import { sanitizedEnv } from "../utils/ssh.js";
import { dispatchWithCooldown } from "../core/notify.js";

export type ScheduleType = "fix" | "audit";

export interface LocalCronResult {
  success: boolean;
  error?: string;
  windowsFallback?: boolean;
  command?: string;
}


export const SCHEDULE_MARKERS = {
  fix: "# kastell-fix-schedule",
  audit: "# kastell-audit-schedule",
} as const;

const SCHEDULE_LOGS_DIR = join(CONFIG_DIR, "schedule-logs");
const LOG_RETENTION_DAYS = 30;


export function scheduleKey(server: string, type: ScheduleType): string {
  return `${server}:${type}`;
}

export function parseScheduleKey(key: string): { server: string; type: ScheduleType } | null {
  const lastColon = key.lastIndexOf(":");
  if (lastColon === -1) return null;
  const server = key.slice(0, lastColon);
  const maybeType = key.slice(lastColon + 1);
  if (maybeType !== "fix" && maybeType !== "audit") return null;
  return { server, type: maybeType };
}


export function sanitizeServerName(name: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
    throw new Error(
      `Invalid server name "${name}": only alphanumeric characters, dots, hyphens, and underscores are allowed`,
    );
  }
  return name;
}


export function resolveKastellBin(): string {
  const argv1 = process.argv[1];
  if (!argv1) return "kastell";
  if (argv1.endsWith(".ts")) return `npx tsx ${argv1}`;
  return argv1;
}


export function installLocalCron(
  cronExpr: string,
  serverName: string,
  type: ScheduleType,
): LocalCronResult {
  const validation = validateCronExpr(cronExpr);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  let sanitized: string;
  try {
    sanitized = sanitizeServerName(serverName);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }

  const kastellBin = resolveKastellBin();
  const fixCmd = `${kastellBin} fix --safe --server "${sanitized}" --no-interactive`;
  const auditCmd = `${kastellBin} audit --server "${sanitized}" --json`;
  const command = type === "fix" ? fixCmd : auditCmd;

  if (process.platform === "win32") {
    saveSchedule(scheduleKey(sanitized, type), cronExpr);
    return { success: true, windowsFallback: true, command };
  }

  const marker = SCHEDULE_MARKERS[type];
  const entry = `${cronExpr} ${command} ${marker}`;
  const cronInstallCmd = `(crontab -l 2>/dev/null | grep -v '${marker}'; echo '${entry}') | crontab -`;

  try {
    execSync(cronInstallCmd, { env: sanitizedEnv() });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }

  saveSchedule(scheduleKey(sanitized, type), cronExpr);
  return { success: true };
}

export function removeLocalCron(serverName: string, type: ScheduleType): LocalCronResult {
  const marker = SCHEDULE_MARKERS[type];

  if (process.platform !== "win32") {
    const cronRemoveCmd = `(crontab -l 2>/dev/null | grep -v '${marker}') | crontab -`;
    try {
      execSync(cronRemoveCmd, { env: sanitizedEnv() });
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  removeSchedule(scheduleKey(serverName, type));
  return { success: true };
}

export function listLocalCron(
  serverFilter?: string,
): Array<{ server: string; type: ScheduleType; cronExpr: string }> {
  const schedules = getSchedules();
  const results: Array<{ server: string; type: ScheduleType; cronExpr: string }> = [];

  for (const [key, cronExpr] of Object.entries(schedules)) {
    const parsed = parseScheduleKey(key);
    if (!parsed) continue;
    if (serverFilter && parsed.server !== serverFilter) continue;
    results.push({ server: parsed.server, type: parsed.type, cronExpr });
  }

  return results;
}


export function writeScheduleLog(
  type: ScheduleType,
  serverName: string,
  result: { applied: number; failed: number; scoreBefore?: number; scoreAfter?: number },
): void {
  mkdirSync(SCHEDULE_LOGS_DIR, { recursive: true });

  const now = new Date();
  const isoTimestamp = now.toISOString();
  const dateStr = isoTimestamp.slice(0, 10);
  const logFile = join(SCHEDULE_LOGS_DIR, `${type}-${serverName}-${dateStr}.log`);

  const hasDelta = result.scoreBefore !== undefined && result.scoreAfter !== undefined;
  const delta = hasDelta ? result.scoreAfter! - result.scoreBefore! : undefined;

  let line = `[${isoTimestamp}] applied=${result.applied} failed=${result.failed}`;
  if (delta !== undefined) line += ` scoreDelta=${delta}`;
  line += "\n";

  appendFileSync(logFile, line);

  const summaryMessage =
    `Schedule ${type} complete: applied=${result.applied} failed=${result.failed}` +
    (delta !== undefined ? ` scoreDelta=${delta}` : "");

  dispatchWithCooldown(serverName, `schedule-${type}`, summaryMessage).catch(() => {});

  cleanOldScheduleLogs();
}

export function cleanOldScheduleLogs(): void {
  const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let files: string[];

  try {
    files = readdirSync(SCHEDULE_LOGS_DIR);
  } catch {
    return;
  }

  for (const file of files) {
    try {
      const filePath = join(SCHEDULE_LOGS_DIR, file);
      const { mtime } = statSync(filePath);
      if (mtime.getTime() < cutoff) {
        unlinkSync(filePath);
      }
    } catch {
      // Skip files we can't stat/unlink
    }
  }
}
