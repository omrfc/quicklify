import { mkdirSync, existsSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import { getServers } from "../utils/config.js";
import { resolveServer } from "../utils/serverSelect.js";
import { checkSshAvailable, sshExec, sanitizedEnv } from "../utils/ssh.js";
import { BACKUPS_DIR } from "../utils/config.js";
import { logger, createSpinner } from "../utils/logger.js";
import type { BackupManifest, ServerRecord } from "../types/index.js";

// Pure functions (testable)

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

// Single server backup (extracted for reuse)

async function backupSingleServer(server: ServerRecord, dryRun: boolean): Promise<boolean> {
  const timestamp = formatTimestamp(new Date());
  const backupPath = join(getBackupDir(server.name), timestamp);

  if (dryRun) {
    logger.info(`[${server.name}] Dry run - would backup to: ${backupPath}`);
    return true;
  }

  const versionResult = await sshExec(server.ip, buildCoolifyVersionCommand());
  const coolifyVersion = versionResult.code === 0 ? versionResult.stdout.trim() : "unknown";

  const dbSpinner = createSpinner(`[${server.name}] Creating database backup...`);
  dbSpinner.start();
  try {
    const dbResult = await sshExec(server.ip, buildPgDumpCommand());
    if (dbResult.code !== 0) {
      dbSpinner.fail(`[${server.name}] Database backup failed`);
      return false;
    }
    dbSpinner.succeed(`[${server.name}] Database backup created`);
  } catch {
    dbSpinner.fail(`[${server.name}] Database backup failed`);
    return false;
  }

  const configSpinner = createSpinner(`[${server.name}] Creating config backup...`);
  configSpinner.start();
  try {
    const configResult = await sshExec(server.ip, buildConfigTarCommand());
    if (configResult.code !== 0) {
      configSpinner.fail(`[${server.name}] Config backup failed`);
      return false;
    }
    configSpinner.succeed(`[${server.name}] Config backup created`);
  } catch {
    configSpinner.fail(`[${server.name}] Config backup failed`);
    return false;
  }

  mkdirSync(backupPath, { recursive: true, mode: 0o700 });

  const dlSpinner = createSpinner(`[${server.name}] Downloading backup files...`);
  dlSpinner.start();
  try {
    const dbDl = await scpDownload(
      server.ip,
      "/tmp/coolify-backup.sql.gz",
      join(backupPath, "coolify-backup.sql.gz"),
    );
    if (dbDl.code !== 0) {
      dlSpinner.fail(`[${server.name}] Download failed`);
      return false;
    }
    const configDl = await scpDownload(
      server.ip,
      "/tmp/coolify-config.tar.gz",
      join(backupPath, "coolify-config.tar.gz"),
    );
    if (configDl.code !== 0) {
      dlSpinner.fail(`[${server.name}] Download failed`);
      return false;
    }
    dlSpinner.succeed(`[${server.name}] Backup files downloaded`);
  } catch {
    dlSpinner.fail(`[${server.name}] Download failed`);
    return false;
  }

  const manifest: BackupManifest = {
    serverName: server.name,
    serverIp: server.ip,
    provider: server.provider,
    timestamp,
    coolifyVersion,
    files: ["coolify-backup.sql.gz", "coolify-config.tar.gz"],
  };
  writeFileSync(join(backupPath, "manifest.json"), JSON.stringify(manifest, null, 2));
  await sshExec(server.ip, buildCleanupCommand()).catch(() => {});

  logger.success(`[${server.name}] Backup saved to ${backupPath}`);
  return true;
}

async function backupAll(dryRun: boolean): Promise<void> {
  if (!checkSshAvailable()) {
    logger.error("SSH client not found. Please install OpenSSH.");
    return;
  }

  const servers = getServers();
  if (servers.length === 0) {
    logger.info("No servers found. Deploy one with: quicklify init");
    return;
  }

  logger.title(`Backing up ${servers.length} server(s)...`);

  let succeeded = 0;
  let failed = 0;

  for (const server of servers) {
    const ok = await backupSingleServer(server, dryRun);
    if (ok) succeeded++;
    else failed++;
    console.log();
  }

  if (failed === 0) {
    logger.success(`All ${succeeded} server(s) backed up successfully!`);
  } else {
    logger.warning(`${succeeded} succeeded, ${failed} failed`);
  }
}

// Command

export async function backupCommand(
  query?: string,
  options?: { dryRun?: boolean; all?: boolean },
): Promise<void> {
  if (options?.all) {
    return backupAll(options?.dryRun || false);
  }

  if (!checkSshAvailable()) {
    logger.error("SSH client not found. Please install OpenSSH.");
    return;
  }

  const server = await resolveServer(query, "Select a server to backup:");
  if (!server) return;

  const dryRun = options?.dryRun || false;
  const timestamp = formatTimestamp(new Date());
  const backupPath = join(getBackupDir(server.name), timestamp);

  if (dryRun) {
    logger.title("Dry Run - Backup");
    logger.info(`Server: ${server.name} (${server.ip})`);
    logger.info(`Backup path: ${backupPath}`);
    console.log();
    logger.info("Commands to execute:");
    logger.step(buildPgDumpCommand());
    logger.step(buildConfigTarCommand());
    logger.step(`scp root@${server.ip}:/tmp/coolify-backup.sql.gz ${backupPath}/`);
    logger.step(`scp root@${server.ip}:/tmp/coolify-config.tar.gz ${backupPath}/`);
    logger.step(buildCleanupCommand());
    console.log();
    logger.warning("No changes applied. Remove --dry-run to execute.");
    return;
  }

  // Step 1: Get Coolify version
  const versionResult = await sshExec(server.ip, buildCoolifyVersionCommand());
  const coolifyVersion = versionResult.code === 0 ? versionResult.stdout.trim() : "unknown";

  // Step 2: Database backup
  const dbSpinner = createSpinner("Creating database backup...");
  dbSpinner.start();

  try {
    const dbResult = await sshExec(server.ip, buildPgDumpCommand());
    if (dbResult.code !== 0) {
      dbSpinner.fail("Database backup failed");
      if (dbResult.stderr) logger.error(dbResult.stderr);
      return;
    }
    dbSpinner.succeed("Database backup created");
  } catch (error: unknown) {
    dbSpinner.fail("Database backup failed");
    logger.error(error instanceof Error ? error.message : String(error));
    return;
  }

  // Step 3: Config backup
  const configSpinner = createSpinner("Creating config backup...");
  configSpinner.start();

  try {
    const configResult = await sshExec(server.ip, buildConfigTarCommand());
    if (configResult.code !== 0) {
      configSpinner.fail("Config backup failed");
      if (configResult.stderr) logger.error(configResult.stderr);
      return;
    }
    configSpinner.succeed("Config backup created");
  } catch (error: unknown) {
    configSpinner.fail("Config backup failed");
    logger.error(error instanceof Error ? error.message : String(error));
    return;
  }

  // Step 4: Download to local
  mkdirSync(backupPath, { recursive: true, mode: 0o700 });

  const dlSpinner = createSpinner("Downloading backup files...");
  dlSpinner.start();

  try {
    const dbDl = await scpDownload(
      server.ip,
      "/tmp/coolify-backup.sql.gz",
      join(backupPath, "coolify-backup.sql.gz"),
    );
    if (dbDl.code !== 0) {
      dlSpinner.fail("Failed to download database backup");
      if (dbDl.stderr) logger.error(dbDl.stderr);
      return;
    }

    const configDl = await scpDownload(
      server.ip,
      "/tmp/coolify-config.tar.gz",
      join(backupPath, "coolify-config.tar.gz"),
    );
    if (configDl.code !== 0) {
      dlSpinner.fail("Failed to download config backup");
      if (configDl.stderr) logger.error(configDl.stderr);
      return;
    }
    dlSpinner.succeed("Backup files downloaded");
  } catch (error: unknown) {
    dlSpinner.fail("Failed to download backup files");
    logger.error(error instanceof Error ? error.message : String(error));
    return;
  }

  // Step 5: Write manifest
  const manifest: BackupManifest = {
    serverName: server.name,
    serverIp: server.ip,
    provider: server.provider,
    timestamp,
    coolifyVersion,
    files: ["coolify-backup.sql.gz", "coolify-config.tar.gz"],
  };

  writeFileSync(join(backupPath, "manifest.json"), JSON.stringify(manifest, null, 2));

  // Step 6: Cleanup remote
  await sshExec(server.ip, buildCleanupCommand()).catch(() => {});

  logger.success(`Backup saved to ${backupPath}`);
  logger.info(`Coolify version: ${coolifyVersion}`);
  logger.info("Files: coolify-backup.sql.gz, coolify-config.tar.gz, manifest.json");
}
