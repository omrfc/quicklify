import { z } from "zod";
import { getServers, findServer } from "../../utils/config.js";
import { checkCoolifyHealth, checkServerStatus, checkAllServersStatus } from "../../core/status.js";
import { getProviderToken, collectProviderTokensFromEnv } from "../../core/tokens.js";
import { getErrorMessage } from "../../utils/errorMapper.js";
import { isBareServer } from "../../utils/modeGuard.js";
import { sshExec } from "../../utils/ssh.js";
import { mcpSuccess, mcpError } from "../utils.js";
import type { ServerRecord } from "../../types/index.js";
import type { StatusResult } from "../../core/status.js";

export const serverInfoSchema = {
  action: z.enum(["list", "status", "health"]).describe(
    "Action to perform: 'list' all servers, 'status' check server/cloud status, 'health' check Coolify reachability (or SSH reachability for bare servers)",
  ),
  server: z.string().optional().describe(
    "Server name or IP. Required for single-server status/health. Omit for all servers.",
  ),
};

interface SuggestedAction {
  command: string;
  reason: string;
}

function formatServerList(servers: ServerRecord[]): Record<string, unknown> {
  if (servers.length === 0) {
    return {
      servers: [],
      total: 0,
      message: "No servers found. Deploy one with: quicklify init",
      suggested_actions: [
        { command: "quicklify init", reason: "Deploy your first Coolify server" },
      ],
    };
  }

  return {
    servers: servers.map((s) => ({
      name: s.name,
      ip: s.ip,
      provider: s.provider,
      region: s.region,
      size: s.size,
      id: s.id,
      mode: s.mode ?? "coolify",
      createdAt: s.createdAt,
    })),
    total: servers.length,
    suggested_actions: [
      { command: "server_info { action: 'status' }", reason: "Check status of all servers" },
      { command: "server_info { action: 'health' }", reason: "Check health on all servers" },
    ],
  };
}

function formatStatusResult(result: StatusResult): object {
  return {
    name: result.server.name,
    ip: result.server.ip,
    provider: result.server.provider,
    region: result.server.region,
    size: result.server.size,
    mode: result.server.mode ?? "coolify",
    serverStatus: result.serverStatus,
    coolifyStatus: result.coolifyStatus,
    ...(result.error ? { error: result.error } : {}),
  };
}

function formatStatusResults(results: StatusResult[]): Record<string, unknown> {
  const suggestedActions: SuggestedAction[] = [];

  const notReachable = results.filter((r) => r.coolifyStatus === "not reachable");
  if (notReachable.length > 0) {
    for (const r of notReachable) {
      suggestedActions.push({
        command: `quicklify status ${r.server.name} --autostart`,
        reason: `Coolify is not reachable on ${r.server.name}, try auto-restart`,
      });
    }
  }

  const errors = results.filter((r) => r.error);
  if (errors.length > 0) {
    suggestedActions.push({
      command: "quicklify doctor --check-tokens",
      reason: "API errors detected, verify provider tokens",
    });
  }

  if (suggestedActions.length === 0) {
    suggestedActions.push({
      command: "server_logs { action: 'logs' }",
      reason: "All servers healthy, check logs for details",
    });
  }

  return {
    results: results.map(formatStatusResult),
    summary: {
      total: results.length,
      running: results.filter((r) => r.coolifyStatus === "running").length,
      notReachable: notReachable.length,
      errors: errors.length,
    },
    suggested_actions: suggestedActions,
  };
}

async function checkBareServerSsh(server: ServerRecord): Promise<boolean> {
  try {
    const result = await sshExec(server.ip, "echo ok");
    return result.code === 0;
  } catch {
    return false;
  }
}

export async function handleServerInfo(params: {
  action: "list" | "status" | "health";
  server?: string;
}): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  try {
    switch (params.action) {
      case "list": {
        const servers = getServers();
        return mcpSuccess(formatServerList(servers));
      }

      case "status": {
        const servers = getServers();
        if (servers.length === 0) {
          return mcpError(
            "No servers found",
            undefined,
            [{ command: "quicklify init", reason: "Deploy a server first" }],
          );
        }

        if (params.server) {
          const server = findServer(params.server);
          if (!server) {
            return {
              content: [{ type: "text", text: JSON.stringify({
                error: `Server not found: ${params.server}`,
                available_servers: servers.map((s) => s.name),
              }) }],
              isError: true,
            };
          }

          const token = server.id.startsWith("manual-") ? "" : (getProviderToken(server.provider) ?? "");
          if (!token && !server.id.startsWith("manual-")) {
            return {
              content: [{ type: "text", text: JSON.stringify({
                error: `No API token found for provider: ${server.provider}`,
                hint: `Set environment variable: ${server.provider.toUpperCase()}_TOKEN`,
                server: { name: server.name, ip: server.ip, provider: server.provider },
              }) }],
              isError: true,
            };
          }

          const result = await checkServerStatus(server, token);
          return mcpSuccess(formatStatusResults([result]));
        }

        // All servers
        const tokenMap = collectProviderTokensFromEnv(servers);
        const missingTokenProviders = [
          ...new Set(servers.filter((s) => !s.id.startsWith("manual-")).map((s) => s.provider)),
        ].filter((p) => !tokenMap.has(p));

        if (missingTokenProviders.length > 0) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: "Missing API tokens for providers",
              missing: missingTokenProviders.map((p) => ({
                provider: p,
                envVar: `${p.toUpperCase()}_TOKEN`,
              })),
              hint: "Set environment variables for each provider",
            }) }],
            isError: true,
          };
        }

        const results = await checkAllServersStatus(servers, tokenMap);
        return mcpSuccess(formatStatusResults(results));
      }

      case "health": {
        const servers = getServers();
        if (servers.length === 0) {
          return mcpError(
            "No servers found",
            undefined,
            [{ command: "quicklify init", reason: "Deploy a server first" }],
          );
        }

        if (params.server) {
          const server = findServer(params.server);
          if (!server) {
            return {
              content: [{ type: "text", text: JSON.stringify({
                error: `Server not found: ${params.server}`,
                available_servers: servers.map((s) => s.name),
              }) }],
              isError: true,
            };
          }

          // Bare server: check SSH reachability
          if (isBareServer(server)) {
            const sshReachable = await checkBareServerSsh(server);
            const suggestedActions: SuggestedAction[] = sshReachable
              ? [{ command: `ssh root@${server.ip}`, reason: "Connect to your bare server" }]
              : [{ command: `quicklify status ${server.name}`, reason: "Check server cloud status" }];

            return mcpSuccess({
              server: server.name,
              ip: server.ip,
              mode: "bare",
              sshReachable,
              suggested_actions: suggestedActions,
            });
          }

          // Coolify server: check Coolify health
          const status = await checkCoolifyHealth(server.ip);
          const suggestedActions: SuggestedAction[] = status === "not reachable"
            ? [{ command: `quicklify status ${server.name} --autostart`, reason: "Try auto-restart Coolify" }]
            : [{ command: `http://${server.ip}:8000`, reason: "Access Coolify dashboard" }];

          return mcpSuccess({
            server: server.name,
            ip: server.ip,
            coolifyStatus: status,
            coolifyUrl: status === "running" ? `http://${server.ip}:8000` : null,
            suggested_actions: suggestedActions,
          });
        }

        // All servers health — route based on mode
        const healthResults = await Promise.all(
          servers.map(async (s) => {
            if (isBareServer(s)) {
              const sshReachable = await checkBareServerSsh(s);
              return {
                name: s.name,
                ip: s.ip,
                mode: "bare" as const,
                sshReachable,
              };
            }
            return {
              name: s.name,
              ip: s.ip,
              mode: "coolify" as const,
              coolifyStatus: await checkCoolifyHealth(s.ip),
            };
          }),
        );

        const coolifyResults = healthResults.filter((r) => r.mode === "coolify");
        const bareResults = healthResults.filter((r) => r.mode === "bare");
        const notReachableCoolify = coolifyResults.filter(
          (r) => "coolifyStatus" in r && r.coolifyStatus === "not reachable",
        );

        const suggestedActions: SuggestedAction[] = notReachableCoolify.length > 0
          ? notReachableCoolify.map((r) => ({
              command: `quicklify status ${r.name} --autostart`,
              reason: `Coolify not reachable on ${r.name}`,
            }))
          : [{ command: "server_info { action: 'status' }", reason: "All healthy, check full status" }];

        return mcpSuccess({
          results: healthResults,
          summary: {
            total: healthResults.length,
            running: coolifyResults.filter(
              (r) => "coolifyStatus" in r && r.coolifyStatus === "running",
            ).length,
            notReachable: notReachableCoolify.length,
            bare: bareResults.length,
          },
          suggested_actions: suggestedActions,
        });
      }
    }
  } catch (error: unknown) {
    return mcpError(getErrorMessage(error));
  }
}
