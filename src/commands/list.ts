import { getServers } from "../utils/config.js";
import { logger } from "../utils/logger.js";

export async function listCommand(): Promise<void> {
  const servers = getServers();

  if (servers.length === 0) {
    logger.info("No servers found. Deploy one with: quicklify init");
    return;
  }

  logger.title("Registered Servers");

  // Table header
  const header = `${"ID".padEnd(12)} ${"Name".padEnd(20)} ${"Provider".padEnd(14)} ${"IP".padEnd(16)} ${"Region".padEnd(10)} ${"Created".padEnd(12)}`;
  console.log(header);
  console.log("─".repeat(header.length));

  // Table rows
  for (const server of servers) {
    const created = server.createdAt ? server.createdAt.split("T")[0] : "N/A";
    console.log(
      `${server.id.padEnd(12)} ${server.name.padEnd(20)} ${server.provider.padEnd(14)} ${server.ip.padEnd(16)} ${server.region.padEnd(10)} ${created.padEnd(12)}`,
    );
  }

  console.log();
  logger.info(`Total: ${servers.length} server(s)`);
}
