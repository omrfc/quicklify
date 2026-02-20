import axios from "axios";
import { getServers } from "../utils/config.js";
import { logger, createSpinner } from "../utils/logger.js";
import type { ServerRecord } from "../types/index.js";

export interface HealthResult {
  server: ServerRecord;
  status: "healthy" | "unhealthy" | "unreachable";
  responseTime: number;
}

export async function checkServerHealth(server: ServerRecord): Promise<HealthResult> {
  const start = Date.now();
  try {
    const response = await axios.get(`http://${server.ip}:8000`, {
      timeout: 5000,
      validateStatus: () => true,
    });
    const responseTime = Date.now() - start;
    const status = response.status < 500 ? "healthy" : "unhealthy";
    return { server, status, responseTime };
  } catch {
    const responseTime = Date.now() - start;
    return { server, status: "unreachable", responseTime };
  }
}

export async function healthCommand(): Promise<void> {
  const servers = getServers();

  if (servers.length === 0) {
    logger.info("No servers found. Deploy one with: quicklify init");
    return;
  }

  const spinner = createSpinner(`Checking health of ${servers.length} server(s)...`);
  spinner.start();

  const results = await Promise.all(servers.map(checkServerHealth));

  spinner.succeed("Health check complete");

  console.log();

  // Table header
  const header = `${"Name".padEnd(20)} ${"IP".padEnd(16)} ${"Status".padEnd(14)} ${"Response".padEnd(10)}`;
  console.log(header);
  console.log("─".repeat(header.length));

  // Table rows
  for (const result of results) {
    const statusStr =
      result.status === "healthy"
        ? "✔ healthy"
        : result.status === "unhealthy"
          ? "⚠ unhealthy"
          : "✖ unreachable";
    const timeStr = result.status === "unreachable" ? "timeout" : `${result.responseTime}ms`;
    console.log(
      `${result.server.name.padEnd(20)} ${result.server.ip.padEnd(16)} ${statusStr.padEnd(14)} ${timeStr.padEnd(10)}`,
    );
  }

  console.log();

  const healthy = results.filter((r) => r.status === "healthy").length;
  const unhealthy = results.filter((r) => r.status === "unhealthy").length;
  const unreachable = results.filter((r) => r.status === "unreachable").length;

  if (unreachable > 0 || unhealthy > 0) {
    logger.warning(`${healthy} healthy, ${unhealthy} unhealthy, ${unreachable} unreachable`);
  } else {
    logger.success(`All ${healthy} server(s) are healthy`);
  }
}
