import axios from "axios";
import inquirer from "inquirer";
import { getServers, findServer } from "../utils/config.js";
import { createProviderWithToken } from "../utils/providerFactory.js";
import { logger, createSpinner } from "../utils/logger.js";
import type { ServerRecord } from "../types/index.js";

async function selectServer(): Promise<ServerRecord | undefined> {
  const servers = getServers();

  if (servers.length === 0) {
    logger.info("No servers found. Deploy one with: quicklify init");
    return undefined;
  }

  const { serverId } = await inquirer.prompt([
    {
      type: "list",
      name: "serverId",
      message: "Select a server:",
      choices: servers.map((s) => ({
        name: `${s.name} (${s.ip}) - ${s.provider}`,
        value: s.id,
      })),
    },
  ]);

  return servers.find((s) => s.id === serverId);
}

export async function statusCommand(query?: string): Promise<void> {
  let server: ServerRecord | undefined;

  if (query) {
    server = findServer(query);
    if (!server) {
      logger.error(`Server not found: ${query}`);
      return;
    }
  } else {
    server = await selectServer();
    if (!server) return;
  }

  // Ask for API token
  const { apiToken } = await inquirer.prompt([
    {
      type: "password",
      name: "apiToken",
      message: `Enter your ${server.provider} API token:`,
      validate: (input: string) => (input.trim().length > 0 ? true : "API token is required"),
    },
  ]);

  const spinner = createSpinner("Checking server status...");
  spinner.start();

  try {
    const provider = createProviderWithToken(server.provider, apiToken.trim());

    // Check server status via provider API
    const serverStatus = await provider.getServerStatus(server.id);

    // Check Coolify health
    let coolifyStatus = "unknown";
    try {
      await axios.get(`http://${server.ip}:8000`, {
        timeout: 5000,
        validateStatus: () => true,
      });
      coolifyStatus = "running";
    } catch {
      coolifyStatus = "not reachable";
    }

    spinner.succeed("Status retrieved");

    console.log();
    logger.info(`Name:           ${server.name}`);
    logger.info(`Provider:       ${server.provider}`);
    logger.info(`IP:             ${server.ip}`);
    logger.info(`Region:         ${server.region}`);
    logger.info(`Size:           ${server.size}`);
    logger.info(`Server Status:  ${serverStatus}`);
    logger.info(`Coolify Status: ${coolifyStatus}`);
    console.log();

    if (coolifyStatus === "running") {
      logger.success(`Access Coolify: http://${server.ip}:8000`);
    } else {
      logger.warning("Coolify is not reachable. It may still be installing.");
    }
  } catch (error: unknown) {
    spinner.fail("Failed to check status");
    logger.error(error instanceof Error ? error.message : String(error));
  }
}
