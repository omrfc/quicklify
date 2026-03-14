import type { ServerRecord, ServerMode } from "../types/index.js";
import { resolvePlatform } from "../adapters/factory.js";

export function getServerMode(server: ServerRecord): ServerMode {
  return server.mode || "coolify";
}

/** Returns display label for CLI output: "coolify", "dokploy", or "bare" */
export function getServerModeLabel(server: ServerRecord): string {
  if (isBareServer(server)) return "bare";
  const platform = resolvePlatform(server);
  return platform ?? "coolify";
}

export function isBareServer(server: ServerRecord): boolean {
  return resolvePlatform(server) === undefined;
}

export function requireManagedMode(server: ServerRecord, commandName: string): string | null {
  const platform = resolvePlatform(server);
  if (!platform) {
    return `The "${commandName}" command is not available for bare servers. This command requires a managed platform (Coolify or Dokploy).`;
  }
  return null;
}

