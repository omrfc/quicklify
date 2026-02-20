import inquirer from "inquirer";
import { getServers, findServer } from "./config.js";
import { logger } from "./logger.js";
import type { ServerRecord } from "../types/index.js";

export async function selectServer(promptMessage?: string): Promise<ServerRecord | undefined> {
  const servers = getServers();

  if (servers.length === 0) {
    logger.info("No servers found. Deploy one with: quicklify init");
    return undefined;
  }

  const { serverId } = await inquirer.prompt([
    {
      type: "list",
      name: "serverId",
      message: promptMessage || "Select a server:",
      choices: servers.map((s) => ({
        name: `${s.name} (${s.ip}) - ${s.provider}`,
        value: s.id,
      })),
    },
  ]);

  return servers.find((s) => s.id === serverId);
}

export async function resolveServer(
  query?: string,
  promptMessage?: string,
): Promise<ServerRecord | undefined> {
  if (query) {
    const server = findServer(query);
    if (!server) {
      logger.error(`Server not found: ${query}`);
      return undefined;
    }
    return server;
  }
  return selectServer(promptMessage);
}

export async function promptApiToken(providerName: string): Promise<string> {
  const envKey = providerName === "hetzner" ? "HETZNER_TOKEN" : "DIGITALOCEAN_TOKEN";
  if (process.env[envKey]) {
    return process.env[envKey]!;
  }

  const { apiToken } = await inquirer.prompt([
    {
      type: "password",
      name: "apiToken",
      message: `Enter your ${providerName} API token:`,
      validate: (input: string) => (input.trim().length > 0 ? true : "API token is required"),
    },
  ]);
  return apiToken.trim();
}
