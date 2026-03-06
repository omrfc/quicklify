import type { PlatformAdapter } from "./interface.js";
import type { ServerRecord } from "../types/index.js";
import type { Platform } from "../types/index.js";
import { CoolifyAdapter } from "./coolify.js";
import { DokployAdapter } from "./dokploy.js";

export type { Platform };

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
