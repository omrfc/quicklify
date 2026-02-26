import { resolveServer } from "../utils/serverSelect.js";
import { checkSshAvailable, sshExec, sshStream } from "../utils/ssh.js";
import { logger } from "../utils/logger.js";
import { buildLogCommand } from "../core/logs.js";
import type { LogService } from "../core/logs.js";

export { buildLogCommand, type LogService };

export async function logsCommand(
  query?: string,
  options?: { lines?: string; follow?: boolean; service?: string },
): Promise<void> {
  if (!checkSshAvailable()) {
    logger.error("SSH client not found. Please install OpenSSH.");
    return;
  }

  const server = await resolveServer(query, "Select a server to view logs:");
  if (!server) return;

  const lines = parseInt(options?.lines || "50", 10);
  if (isNaN(lines) || lines <= 0) {
    logger.error("Invalid --lines value. Must be a positive number.");
    return;
  }

  const service: LogService = (options?.service as LogService) || "coolify";
  const validServices: LogService[] = ["coolify", "docker", "system"];
  if (!validServices.includes(service)) {
    logger.error(`Invalid service: ${service}. Choose from: ${validServices.join(", ")}`);
    return;
  }

  const follow = options?.follow || false;
  const command = buildLogCommand(service, lines, follow);

  logger.info(`Fetching ${service} logs from ${server.name} (${server.ip})...`);

  if (follow) {
    const exitCode = await sshStream(server.ip, command);
    if (exitCode === 130) {
      // Ctrl+C — normal user-initiated exit
    } else if (exitCode !== 0) {
      logger.error(`Log stream ended with code ${exitCode}`);
    }
  } else {
    const result = await sshExec(server.ip, command);
    if (result.stdout) console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);
    if (result.code !== 0) {
      logger.error(`Failed to fetch logs (exit code ${result.code})`);
    }
  }
}
