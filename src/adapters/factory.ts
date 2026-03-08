import type { PlatformAdapter } from "./interface.js";
import type { ServerRecord } from "../types/index.js";
import type { Platform } from "../types/index.js";
import { CoolifyAdapter } from "./coolify.js";
import { DokployAdapter } from "./dokploy.js";
import { assertValidIp, sshExec } from "../utils/ssh.js";

export type { Platform };

export async function detectPlatform(ip: string): Promise<Platform | "bare"> {
  assertValidIp(ip);
  try {
    // Check Dokploy first (newer platform, less likely false positive)
    const dokployCheck = await sshExec(ip, "test -d /etc/dokploy && echo dokploy || echo no");
    if (dokployCheck.code === 0 && dokployCheck.stdout.trim() === "dokploy") {
      return "dokploy";
    }
    // Check Coolify
    const coolifyCheck = await sshExec(ip, "test -d /data/coolify/source && echo coolify || echo no");
    if (coolifyCheck.code === 0 && coolifyCheck.stdout.trim() === "coolify") {
      return "coolify";
    }
    return "bare";
  } catch {
    return "bare";
  }
}

export function getAdapter(platform: Platform): PlatformAdapter {
  switch (platform) {
    case "coolify":
      return new CoolifyAdapter();
    case "dokploy":
      return new DokployAdapter();
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

export function resolvePlatform(server: ServerRecord): Platform | undefined {
  if (server.platform) return server.platform;
  if (server.mode === "bare") return undefined;
  return "coolify";
}
