import { readFileSync, existsSync } from "fs";
import { join, basename } from "path";
import { spawn } from "child_process";
import inquirer from "inquirer";
import { resolveServer } from "../utils/serverSelect.js";
import { checkSshAvailable, sshExec, sanitizedEnv } from "../utils/ssh.js";
import { listBackups, getBackupDir } from "./backup.js";
import { logger, createSpinner } from "../utils/logger.js";
import { getErrorMessage, mapSshError } from "../utils/errorMapper.js";
import type { BackupManifest } from "../types/index.js";

// Pure functions (testable)

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

export function buildCleanupCommand(): string {
  return "rm -f /tmp/coolify-backup.sql.gz /tmp/coolify-config.tar.gz";
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

export function loadManifest(backupPath: string): BackupManifest | undefined {
  const manifestPath = join(backupPath, "manifest.json");
  if (!existsSync(manifestPath)) return undefined;
  try {
    return JSON.parse(readFileSync(manifestPath, "utf-8"));
  } catch {
    return undefined;
  }
}

export async function tryRestartCoolify(ip: string): Promise<void> {
  logger.warning("Attempting to restart Coolify...");
  try {
    await sshExec(ip, buildStartCoolifyCommand());
  } catch {
    // Best-effort — swallow errors
  }
}

// Command

export async function restoreCommand(
  query?: string,
  options?: { dryRun?: boolean; backup?: string },
): Promise<void> {
  if (!checkSshAvailable()) {
    logger.error("SSH client not found. Please install OpenSSH.");
    return;
  }

  const server = await resolveServer(query, "Select a server to restore:");
  if (!server) return;

  const dryRun = options?.dryRun || false;

  // Select backup
  let selectedBackup: string;

  if (options?.backup) {
    selectedBackup = basename(options.backup);
  } else {
    const backups = listBackups(server.name);
    if (backups.length === 0) {
      logger.info(`No backups found for ${server.name}. Run 'quicklify backup' first.`);
      return;
    }

    const { backup } = await inquirer.prompt([
      {
        type: "list",
        name: "backup",
        message: "Select a backup to restore:",
        choices: backups.map((b) => ({ name: b, value: b })),
      },
    ]);
    selectedBackup = backup;
  }

  const backupPath = join(getBackupDir(server.name), selectedBackup);
  const manifest = loadManifest(backupPath);

  if (!manifest) {
    logger.error(`Invalid backup: manifest.json not found in ${backupPath}`);
    return;
  }

  // Verify backup files exist
  for (const file of manifest.files) {
    if (!existsSync(join(backupPath, file))) {
      logger.error(`Missing backup file: ${file}`);
      return;
    }
  }

  if (dryRun) {
    logger.title("Dry Run - Restore");
    logger.info(`Server: ${server.name} (${server.ip})`);
    logger.info(`Backup: ${selectedBackup}`);
    logger.info(`Coolify version: ${manifest.coolifyVersion}`);
    console.log();
    logger.info("Steps to execute:");
    logger.step("Upload backup files to server");
    logger.step(buildStopCoolifyCommand());
    logger.step(buildStartDbCommand());
    logger.step(buildRestoreDbCommand());
    logger.step(buildRestoreConfigCommand());
    logger.step(buildStartCoolifyCommand());
    logger.step(buildCleanupCommand());
    console.log();
    logger.warning("No changes applied. Remove --dry-run to execute.");
    return;
  }

  // Double confirmation
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `This will restore "${server.name}" from backup ${selectedBackup}. Current data will be OVERWRITTEN. Continue?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info("Restore cancelled.");
    return;
  }

  const { confirmName } = await inquirer.prompt([
    {
      type: "input",
      name: "confirmName",
      message: `Type the server name "${server.name}" to confirm:`,
    },
  ]);

  if (confirmName.trim() !== server.name) {
    logger.error("Server name does not match. Restore cancelled.");
    return;
  }

  // Step 1: Upload backup files
  const uploadSpinner = createSpinner("Uploading backup files...");
  uploadSpinner.start();

  try {
    const dbUpload = await scpUpload(
      server.ip,
      join(backupPath, "coolify-backup.sql.gz"),
      "/tmp/coolify-backup.sql.gz",
    );
    if (dbUpload.code !== 0) {
      uploadSpinner.fail("Failed to upload database backup");
      if (dbUpload.stderr) logger.error(dbUpload.stderr);
      return;
    }

    const configUpload = await scpUpload(
      server.ip,
      join(backupPath, "coolify-config.tar.gz"),
      "/tmp/coolify-config.tar.gz",
    );
    if (configUpload.code !== 0) {
      uploadSpinner.fail("Failed to upload config backup");
      if (configUpload.stderr) logger.error(configUpload.stderr);
      return;
    }
    uploadSpinner.succeed("Backup files uploaded");
  } catch (error: unknown) {
    uploadSpinner.fail("Failed to upload backup files");
    logger.error(getErrorMessage(error));
    const hint = mapSshError(error, server.ip);
    if (hint) logger.info(hint);
    return;
  }

  // Step 2: Stop Coolify
  const stopSpinner = createSpinner("Stopping Coolify...");
  stopSpinner.start();

  try {
    const stopResult = await sshExec(server.ip, buildStopCoolifyCommand());
    if (stopResult.code !== 0) {
      stopSpinner.fail("Failed to stop Coolify");
      if (stopResult.stderr) logger.error(stopResult.stderr);
      return;
    }
    stopSpinner.succeed("Coolify stopped");
  } catch (error: unknown) {
    stopSpinner.fail("Failed to stop Coolify");
    logger.error(getErrorMessage(error));
    const hint = mapSshError(error, server.ip);
    if (hint) logger.info(hint);
    return;
  }

  // Step 3: Start DB only
  const dbStartSpinner = createSpinner("Starting database...");
  dbStartSpinner.start();

  try {
    const dbStartResult = await sshExec(server.ip, buildStartDbCommand());
    if (dbStartResult.code !== 0) {
      dbStartSpinner.fail("Failed to start database");
      if (dbStartResult.stderr) logger.error(dbStartResult.stderr);
      await tryRestartCoolify(server.ip);
      return;
    }
    dbStartSpinner.succeed("Database started");
  } catch (error: unknown) {
    dbStartSpinner.fail("Failed to start database");
    logger.error(getErrorMessage(error));
    const hint = mapSshError(error, server.ip);
    if (hint) logger.info(hint);
    await tryRestartCoolify(server.ip);
    return;
  }

  // Step 4: Restore database
  const restoreDbSpinner = createSpinner("Restoring database...");
  restoreDbSpinner.start();

  try {
    const restoreResult = await sshExec(server.ip, buildRestoreDbCommand());
    if (restoreResult.code !== 0) {
      restoreDbSpinner.fail("Database restore failed");
      if (restoreResult.stderr) logger.error(restoreResult.stderr);
      await tryRestartCoolify(server.ip);
      return;
    }
    restoreDbSpinner.succeed("Database restored");
  } catch (error: unknown) {
    restoreDbSpinner.fail("Database restore failed");
    logger.error(getErrorMessage(error));
    const hint = mapSshError(error, server.ip);
    if (hint) logger.info(hint);
    await tryRestartCoolify(server.ip);
    return;
  }

  // Step 5: Restore config
  const restoreConfigSpinner = createSpinner("Restoring config files...");
  restoreConfigSpinner.start();

  try {
    const configResult = await sshExec(server.ip, buildRestoreConfigCommand());
    if (configResult.code !== 0) {
      restoreConfigSpinner.fail("Config restore failed");
      if (configResult.stderr) logger.error(configResult.stderr);
      await tryRestartCoolify(server.ip);
      return;
    }
    restoreConfigSpinner.succeed("Config files restored");
  } catch (error: unknown) {
    restoreConfigSpinner.fail("Config restore failed");
    logger.error(getErrorMessage(error));
    const hint = mapSshError(error, server.ip);
    if (hint) logger.info(hint);
    await tryRestartCoolify(server.ip);
    return;
  }

  // Step 6: Start Coolify
  const startSpinner = createSpinner("Starting Coolify...");
  startSpinner.start();

  try {
    const startResult = await sshExec(server.ip, buildStartCoolifyCommand());
    if (startResult.code !== 0) {
      startSpinner.fail("Failed to start Coolify");
      if (startResult.stderr) logger.error(startResult.stderr);
      return;
    }
    startSpinner.succeed("Coolify started");
  } catch (error: unknown) {
    startSpinner.fail("Failed to start Coolify");
    logger.error(getErrorMessage(error));
    const hint = mapSshError(error, server.ip);
    if (hint) logger.info(hint);
    return;
  }

  // Step 7: Cleanup remote
  await sshExec(server.ip, buildCleanupCommand()).catch(() => {});

  logger.success(`Restore complete for ${server.name}`);
  logger.info(`Backup: ${selectedBackup} (Coolify ${manifest.coolifyVersion})`);
  logger.info(`Access Coolify: http://${server.ip}:8000`);
}
