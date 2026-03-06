import type { ServerRecord, ServerMode } from "../types/index.js";
import { resolvePlatform } from "../adapters/factory.js";

export function getServerMode(server: ServerRecord): ServerMode {
  return server.mode || "coolify";
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

/** @deprecated Use requireManagedMode instead. Kept for backward compat */
export function requireCoolifyMode(server: ServerRecord, commandName: string): string | null {
  return requireManagedMode(server, commandName);
}
