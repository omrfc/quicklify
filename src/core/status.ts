import { createProviderWithToken } from "../utils/providerFactory.js";
import { getErrorMessage, mapSshError } from "../utils/errorMapper.js";
import { getAdapter, resolvePlatform } from "../adapters/factory.js";
import { sshExec } from "../utils/ssh.js";
import { COOLIFY_RESTART_CMD, POLL_DELAY_MS } from "../constants.js";
import type { ServerRecord } from "../types/index.js";

export interface StatusResult {
  server: ServerRecord;
  serverStatus: string;
  platformStatus: string;
  error?: string;
}

export async function getCloudServerStatus(
  server: ServerRecord,
  apiToken: string,
): Promise<string> {
  if (server.id.startsWith("manual-")) {
    return "unknown (manual)";
  }
  if (!apiToken) {
    return "unknown (no token)";
  }
  const provider = createProviderWithToken(server.provider, apiToken);
  return provider.getServerStatus(server.id);
}

export async function checkServerStatus(
  server: ServerRecord,
  apiToken: string,
): Promise<StatusResult> {
  try {
    const serverStatus = await getCloudServerStatus(server, apiToken);
    const platform = resolvePlatform(server);
    const platformStatus = platform
      ? (await getAdapter(platform).healthCheck(server.ip, server.domain)).status
      : "n/a";
    return { server, serverStatus, platformStatus };
  } catch (error: unknown) {
    return {
      server,
      serverStatus: "error",
      platformStatus: "unknown",
      error: getErrorMessage(error),
    };
  }
}

export async function checkAllServersStatus(
  servers: ServerRecord[],
  tokenMap: Map<string, string>,
): Promise<StatusResult[]> {
  return Promise.all(
    servers.map((s) => checkServerStatus(s, tokenMap.get(s.provider) ?? "")),
  );
}

export interface RestartCoolifyResult {
  success: boolean;
  nowRunning: boolean;
  error?: string;
  hint?: string;
}

export async function restartCoolify(server: ServerRecord): Promise<RestartCoolifyResult> {
  try {
    const result = await sshExec(server.ip, COOLIFY_RESTART_CMD);
    if (result.code !== 0) {
      return {
        success: false,
        nowRunning: false,
        error: result.stderr || "Restart command failed",
      };
    }

    // Wait for Coolify to start
    await new Promise((resolve) => setTimeout(resolve, POLL_DELAY_MS));

    // Check health
    const platform = resolvePlatform(server) ?? "coolify";
    const healthResult = await getAdapter(platform).healthCheck(server.ip, server.domain);
    return {
      success: true,
      nowRunning: healthResult.status === "running",
    };
  } catch (error: unknown) {
    const hint = mapSshError(error, server.ip);
    return {
      success: false,
      nowRunning: false,
      error: getErrorMessage(error),
      ...(hint ? { hint } : {}),
    };
  }
}
