import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { ServerRecord } from "../types/index.js";

const CONFIG_DIR = join(homedir(), ".quicklify");
const SERVERS_FILE = join(CONFIG_DIR, "servers.json");

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function getServers(): ServerRecord[] {
  try {
    if (!existsSync(SERVERS_FILE)) {
      return [];
    }
    const data = readFileSync(SERVERS_FILE, "utf-8");
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

export function saveServer(record: ServerRecord): void {
  ensureConfigDir();
  const servers = getServers();
  servers.push(record);
  writeFileSync(SERVERS_FILE, JSON.stringify(servers, null, 2), { mode: 0o600 });
}

export function removeServer(id: string): boolean {
  const servers = getServers();
  const filtered = servers.filter((s) => s.id !== id);
  if (filtered.length === servers.length) {
    return false;
  }
  ensureConfigDir();
  writeFileSync(SERVERS_FILE, JSON.stringify(filtered, null, 2), { mode: 0o600 });
  return true;
}

export function findServer(query: string): ServerRecord | undefined {
  const servers = getServers();
  // Search by IP first (unique), then by name
  return servers.find((s) => s.ip === query) || servers.find((s) => s.name === query);
}

// Exported for testing
export { CONFIG_DIR, SERVERS_FILE };
