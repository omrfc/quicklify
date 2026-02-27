import { mkdirSync, existsSync, writeFileSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import { sshExec, assertValidIp, sanitizedEnv } from "../utils/ssh.js";
import { BACKUPS_DIR } from "../utils/config.js";
import { getErrorMessage, mapSshError } from "../utils/errorMapper.js";
import type { BackupManifest } from "../types/index.js";

// ─── Pure Functions (Backup) ─────────────────────────────────────────────────

export function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-").replace("T", "_").replace("Z", "");
}

export function getBackupDir(serverName: string): string {
  return join(BACKUPS_DIR, serverName);
}

export function buildPgDumpCommand(): string {
  return "docker exec coolify-db pg_dump -U coolify -d coolify | gzip > /tmp/coolify-backup.sql.gz";
}

export function buildConfigTarCommand(): string {
  return "tar czf /tmp/coolify-config.tar.gz -C /data/coolify/source .env docker-compose.yml docker-compose.prod.yml 2>/dev/null || tar czf /tmp/coolify-config.tar.gz -C /data/coolify/source .env docker-compose.yml";
}

export function buildCleanupCommand(): string {
  return "rm -f /tmp/coolify-backup.sql.gz /tmp/coolify-config.tar.gz";
}

export function buildCoolifyVersionCommand(): string {
  return "docker inspect coolify --format '{{.Config.Image}}' 2>/dev/null | sed 's/.*://' || echo unknown";
}

// ─── Pure Functions (Restore) ────────────────────────────────────────────────

export function buildStopCoolifyCommand(): string {
  return "cd /data/coolify/source && docker compose -f docker-compose.yml -f docker-compose.prod.yml stop";
}

export function buildStartCoolifyCommand(): string {
  return "cd /data/coolify/source && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d";
}

export function buildStartDbCommand(): string {
  return "cd /data/coolify/source && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres && sleep 3";
}

export function buildRestoreDbCommand(): string {
  return "gunzip -c /tmp/coolify-backup.sql.gz | docker exec -i coolify-db psql -U coolify -d coolify";
}

export function buildRestoreConfigCommand(): string {
  return "tar xzf /tmp/coolify-config.tar.gz -C /data/coolify/source";
}

// ─── Semi-Pure Functions (FS Read) ───────────────────────────────────────────

export function listBackups(serverName: string): string[] {
  const dir = getBackupDir(serverName);
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((name) => existsSync(join(dir, name, "manifest.json")))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function loadManifest(backupPath: string): BackupManifest | undefined {
  const manifestPath = join(backupPath, "manifest.json");
  if (!existsSync(manifestPath)) return undefined;
  try {
    return JSON.parse(readFileSync(manifestPath, "utf-8"));
  } catch {
    return undefined;
  }
}

// ─── SCP Functions ───────────────────────────────────────────────────────────

export function scpDownload(
  ip: string,
  remotePath: string,
  localPath: string,
): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(
      "scp",
      ["-o", "StrictHostKeyChecking=accept-new", `root@${ip}:${remotePath}`, localPath],
      { stdio: ["inherit", "pipe", "pipe"], env: sanitizedEnv() },
    );
    let stderr = "";
    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
    child.on("error", (err) => resolve({ code: 1, stderr: err.message }));
  });
}

export function scpUpload(
  ip: string,
  localPath: string,
  remotePath: string,
): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(
      "scp",
      ["-o", "StrictHostKeyChecking=accept-new", localPath, `root@${ip}:${remotePath}`],
      { stdio: ["inherit", "pipe", "pipe"], env: sanitizedEnv() },
    );
    let stderr = "";
    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
    child.on("error", (err) => resolve({ code: 1, stderr: err.message }));
  });
}

// ─── Best-Effort Rollback ────────────────────────────────────────────────────

export async function tryRestartCoolify(ip: string): Promise<void> {
  try {
    await sshExec(ip, buildStartCoolifyCommand());
  } catch {
    // Best-effort — swallow errors
  }
}

// ─── Result Types ────────────────────────────────────────────────────────────

export interface BackupResult {
  success: boolean;
  backupPath?: string;
  manifest?: BackupManifest;
  error?: string;
  hint?: string;
}

export interface RestoreResult {
  success: boolean;
  steps: Array<{ name: string; status: "success" | "failure"; error?: string }>;
  error?: string;
  hint?: string;
}

// ─── Async Wrappers ─────────────────────────────────────────────────────────

export async function createBackup(
  ip: string,
  serverName: string,
  provider: string,
): Promise<BackupResult> {
  assertValidIp(ip);

  try {
    // Step 1: Get Coolify version (best-effort)
    const versionResult = await sshExec(ip, buildCoolifyVersionCommand());
    const coolifyVersion = versionResult.code === 0 ? versionResult.stdout.trim() : "unknown";

    // Step 2: Database backup
    const dbResult = await sshExec(ip, buildPgDumpCommand());
    if (dbResult.code !== 0) {
      return {
        success: false,
        error: "Database backup failed",
        hint: dbResult.stderr || undefined,
      };
    }

    // Step 3: Config backup
    const configResult = await sshExec(ip, buildConfigTarCommand());
    if (configResult.code !== 0) {
      return {
        success: false,
        error: "Config backup failed",
        hint: configResult.stderr || undefined,
      };
    }

    // Step 4: Create local directory and download
    const timestamp = formatTimestamp(new Date());
    const backupPath = join(getBackupDir(serverName), timestamp);
    mkdirSync(backupPath, { recursive: true, mode: 0o700 });

    const dbDl = await scpDownload(
      ip,
      "/tmp/coolify-backup.sql.gz",
      join(backupPath, "coolify-backup.sql.gz"),
    );
    if (dbDl.code !== 0) {
      return { success: false, error: "Failed to download database backup", hint: dbDl.stderr || undefined };
    }

    const configDl = await scpDownload(
      ip,
      "/tmp/coolify-config.tar.gz",
      join(backupPath, "coolify-config.tar.gz"),
    );
    if (configDl.code !== 0) {
      return { success: false, error: "Failed to download config backup", hint: configDl.stderr || undefined };
    }

    // Step 5: Write manifest
    const manifest: BackupManifest = {
      serverName,
      serverIp: ip,
      provider,
      timestamp,
      coolifyVersion,
      files: ["coolify-backup.sql.gz", "coolify-config.tar.gz"],
    };
    writeFileSync(join(backupPath, "manifest.json"), JSON.stringify(manifest, null, 2));

    // Step 6: Cleanup remote (best-effort)
    await sshExec(ip, buildCleanupCommand()).catch(() => {});

    return { success: true, backupPath, manifest };
  } catch (error: unknown) {
    const hint = mapSshError(error, ip);
    return {
      success: false,
      error: getErrorMessage(error),
      ...(hint ? { hint } : {}),
    };
  }
}

export async function restoreBackup(
  ip: string,
  serverName: string,
  backupId: string,
): Promise<RestoreResult> {
  assertValidIp(ip);

  const backupPath = join(getBackupDir(serverName), backupId);
  const steps: Array<{ name: string; status: "success" | "failure"; error?: string }> = [];

  // Validate manifest
  const manifest = loadManifest(backupPath);
  if (!manifest) {
    return {
      success: false,
      steps,
      error: `Backup not found or corrupt: ${backupId}`,
    };
  }

  // Verify backup files exist
  for (const file of manifest.files) {
    if (!existsSync(join(backupPath, file))) {
      return {
        success: false,
        steps,
        error: `Missing backup file: ${file}`,
      };
    }
  }

  try {
    // Upload backup files (before stopping Coolify — safe to fail here)
    const dbUpload = await scpUpload(
      ip,
      join(backupPath, "coolify-backup.sql.gz"),
      "/tmp/coolify-backup.sql.gz",
    );
    if (dbUpload.code !== 0) {
      return {
        success: false,
        steps: [{ name: "Upload database backup", status: "failure", error: dbUpload.stderr }],
        error: "Failed to upload database backup",
      };
    }

    const configUpload = await scpUpload(
      ip,
      join(backupPath, "coolify-config.tar.gz"),
      "/tmp/coolify-config.tar.gz",
    );
    if (configUpload.code !== 0) {
      return {
        success: false,
        steps: [{ name: "Upload config backup", status: "failure", error: configUpload.stderr }],
        error: "Failed to upload config backup",
      };
    }

    // Step 1: Stop Coolify
    const stopResult = await sshExec(ip, buildStopCoolifyCommand());
    if (stopResult.code !== 0) {
      steps.push({ name: "Stop Coolify", status: "failure", error: stopResult.stderr });
      return { success: false, steps, error: "Failed to stop Coolify" };
    }
    steps.push({ name: "Stop Coolify", status: "success" });

    // Step 2: Start DB only
    const dbStartResult = await sshExec(ip, buildStartDbCommand());
    if (dbStartResult.code !== 0) {
      steps.push({ name: "Start database", status: "failure", error: dbStartResult.stderr });
      await tryRestartCoolify(ip);
      return { success: false, steps, error: "Failed to start database" };
    }
    steps.push({ name: "Start database", status: "success" });

    // Step 3: Restore database
    const restoreDbResult = await sshExec(ip, buildRestoreDbCommand());
    if (restoreDbResult.code !== 0) {
      steps.push({ name: "Restore database", status: "failure", error: restoreDbResult.stderr });
      await tryRestartCoolify(ip);
      return { success: false, steps, error: "Database restore failed" };
    }
    steps.push({ name: "Restore database", status: "success" });

    // Step 4: Restore config
    const restoreConfigResult = await sshExec(ip, buildRestoreConfigCommand());
    if (restoreConfigResult.code !== 0) {
      steps.push({ name: "Restore config", status: "failure", error: restoreConfigResult.stderr });
      await tryRestartCoolify(ip);
      return { success: false, steps, error: "Config restore failed" };
    }
    steps.push({ name: "Restore config", status: "success" });

    // Step 5: Start Coolify
    const startResult = await sshExec(ip, buildStartCoolifyCommand());
    if (startResult.code !== 0) {
      steps.push({ name: "Start Coolify", status: "failure", error: startResult.stderr });
      return { success: false, steps, error: "Failed to start Coolify" };
    }
    steps.push({ name: "Start Coolify", status: "success" });

    // Cleanup remote (best-effort)
    await sshExec(ip, buildCleanupCommand()).catch(() => {});

    return { success: true, steps };
  } catch (error: unknown) {
    const hint = mapSshError(error, ip);
    return {
      success: false,
      steps,
      error: getErrorMessage(error),
      ...(hint ? { hint } : {}),
    };
  }
}
