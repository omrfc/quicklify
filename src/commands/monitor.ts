import { resolveServer } from "../utils/serverSelect.js";
import { checkSshAvailable, sshExec } from "../utils/ssh.js";
import { logger, createSpinner } from "../utils/logger.js";

export interface SystemMetrics {
  cpu: string;
  ramUsed: string;
  ramTotal: string;
  diskUsed: string;
  diskTotal: string;
  diskPercent: string;
}

export function parseMetrics(stdout: string): SystemMetrics {
  const lines = stdout.split("\n");

  // Parse CPU from top output - look for %Cpu(s) line
  let cpu = "N/A";
  for (const line of lines) {
    if (line.includes("Cpu") || line.includes("cpu")) {
      // Match patterns like "0.0 us" or "0.0%us"
      const idleMatch = line.match(/([\d.]+)\s*(?:%?\s*)?id/);
      if (idleMatch) {
        const idle = parseFloat(idleMatch[1]);
        cpu = `${(100 - idle).toFixed(1)}%`;
      }
      break;
    }
  }

  // Parse RAM from free -h output
  let ramUsed = "N/A";
  let ramTotal = "N/A";
  for (const line of lines) {
    if (line.startsWith("Mem:")) {
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        ramTotal = parts[1];
        ramUsed = parts[2];
      }
      break;
    }
  }

  // Parse Disk from df -h output - look for "total" line
  let diskUsed = "N/A";
  let diskTotal = "N/A";
  let diskPercent = "N/A";
  for (const line of lines) {
    if (line.startsWith("total") || line.includes("/dev/")) {
      const parts = line.split(/\s+/);
      if (parts.length >= 5) {
        diskTotal = parts[1];
        diskUsed = parts[2];
        diskPercent = parts[4];
      }
      // Prefer "total" line over individual disk lines
      if (line.startsWith("total")) break;
    }
  }

  return { cpu, ramUsed, ramTotal, diskUsed, diskTotal, diskPercent };
}

export async function monitorCommand(
  query?: string,
  options?: { containers?: boolean },
): Promise<void> {
  if (!checkSshAvailable()) {
    logger.error("SSH client not found. Please install OpenSSH.");
    return;
  }

  const server = await resolveServer(query, "Select a server to monitor:");
  if (!server) return;

  const spinner = createSpinner(`Fetching metrics from ${server.name}...`);
  spinner.start();

  try {
    // Gather all metrics in a single SSH command
    let command =
      "top -bn1 | head -5 && echo '---SEPARATOR---' && free -h && echo '---SEPARATOR---' && df -h --total | grep -E '(Filesystem|total)'";
    if (options?.containers) {
      command +=
        " && echo '---SEPARATOR---' && docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}'";
    }

    const result = await sshExec(server.ip, command);

    if (result.code !== 0) {
      spinner.fail("Failed to fetch metrics");
      if (result.stderr) logger.error(result.stderr);
      return;
    }

    spinner.succeed(`Metrics for ${server.name} (${server.ip})`);

    const metrics = parseMetrics(result.stdout);

    console.log();
    logger.info(`CPU Usage:    ${metrics.cpu}`);
    logger.info(`RAM Usage:    ${metrics.ramUsed} / ${metrics.ramTotal}`);
    logger.info(
      `Disk Usage:   ${metrics.diskUsed} / ${metrics.diskTotal} (${metrics.diskPercent})`,
    );

    if (options?.containers) {
      const sections = result.stdout.split("---SEPARATOR---");
      if (sections.length >= 4) {
        console.log();
        logger.title("Docker Containers");
        console.log(sections[3].trim());
      }
    }
  } catch (error: unknown) {
    spinner.fail("Failed to fetch metrics");
    logger.error(error instanceof Error ? error.message : String(error));
  }
}
