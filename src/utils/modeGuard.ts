import type { ServerRecord, ServerMode } from "../types/index.js";

export function getServerMode(server: ServerRecord): ServerMode {
  return server.mode || "coolify";
}

export function isBareServer(server: ServerRecord): boolean {
  return getServerMode(server) === "bare";
}

export function requireCoolifyMode(server: ServerRecord, commandName: string): string | null {
  if (isBareServer(server)) {
    return `The "${commandName}" command is not available for bare servers. This command requires Coolify.`;
  }
  return null;
}
