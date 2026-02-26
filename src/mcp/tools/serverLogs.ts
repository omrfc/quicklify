import { z } from "zod";
import { getServers, findServer } from "../../utils/config.js";
import { fetchServerLogs, fetchServerMetrics } from "../../core/logs.js";
import { getErrorMessage } from "../../utils/errorMapper.js";
import type { LogService } from "../../core/logs.js";

export const serverLogsSchema = {
  action: z.enum(["logs", "monitor"]).describe(
    "Action: 'logs' fetch recent log lines, 'monitor' fetch CPU/RAM/Disk metrics",
  ),
  server: z.string().optional().describe(
    "Server name or IP. Auto-selected if only one server exists.",
  ),
  service: z.enum(["coolify", "docker", "system"]).default("coolify").describe(
    "Log source (only for 'logs' action): 'coolify' container, 'docker' service journal, 'system' full journal",
  ),
  lines: z.number().min(1).max(500).default(50).describe(
    "Number of log lines to fetch (only for 'logs' action, default: 50, max: 500)",
  ),
  containers: z.boolean().default(false).describe(
    "Include Docker container list in metrics (only for 'monitor' action)",
  ),
};

interface SuggestedAction {
  command: string;
  reason: string;
}

function resolveServer(params: { server?: string }, servers: ReturnType<typeof getServers>) {
  if (params.server) {
    return findServer(params.server);
  }
  if (servers.length === 1) {
    return servers[0];
  }
  return undefined;
}

export async function handleServerLogs(params: {
  action: "logs" | "monitor";
  server?: string;
  service?: LogService;
  lines?: number;
  containers?: boolean;
}): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  try {
    const servers = getServers();
    if (servers.length === 0) {
      return {
        content: [{ type: "text", text: JSON.stringify({
          error: "No servers found",
          suggested_actions: [{ command: "quicklify init", reason: "Deploy a server first" }],
        }) }],
      };
    }

    const server = resolveServer(params, servers);
    if (!server) {
      if (params.server) {
        return {
          content: [{ type: "text", text: JSON.stringify({
            error: `Server not found: ${params.server}`,
            available_servers: servers.map((s) => s.name),
          }) }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify({
          error: "Multiple servers found. Specify which server to use.",
          available_servers: servers.map((s) => ({ name: s.name, ip: s.ip })),
        }) }],
        isError: true,
      };
    }

    switch (params.action) {
      case "logs": {
        const service: LogService = params.service ?? "coolify";
        const lines = params.lines ?? 50;
        const result = await fetchServerLogs(server.ip, service, lines);

        if (result.error) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              server: server.name,
              ip: server.ip,
              service,
              error: result.error,
              ...(result.hint ? { hint: result.hint } : {}),
              ...(result.logs ? { partial_logs: result.logs } : {}),
              suggested_actions: [
                { command: `quicklify logs ${server.name} --service ${service}`, reason: "Try from CLI for interactive mode" },
                { command: `server_info { action: 'health', server: '${server.name}' }`, reason: "Check if server is reachable" },
              ],
            }) }],
            isError: true,
          };
        }

        const suggestedActions: SuggestedAction[] = [
          { command: `server_logs { action: 'monitor', server: '${server.name}' }`, reason: "Check system metrics" },
        ];
        if (lines < 200) {
          suggestedActions.unshift({
            command: `server_logs { action: 'logs', server: '${server.name}', service: '${service}', lines: 200 }`,
            reason: "Fetch more lines",
          });
        }
        if (service === "coolify") {
          suggestedActions.push({
            command: `server_logs { action: 'logs', server: '${server.name}', service: 'system' }`,
            reason: "Check system journal",
          });
        }

        return {
          content: [{ type: "text", text: JSON.stringify({
            server: server.name,
            ip: server.ip,
            service,
            lines,
            logs: result.logs,
            suggested_actions: suggestedActions,
          }) }],
        };
      }

      case "monitor": {
        const includeContainers = params.containers ?? false;
        const result = await fetchServerMetrics(server.ip, includeContainers);

        if (result.error) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              server: server.name,
              ip: server.ip,
              error: result.error,
              ...(result.hint ? { hint: result.hint } : {}),
              suggested_actions: [
                { command: `server_info { action: 'health', server: '${server.name}' }`, reason: "Check if server is reachable" },
              ],
            }) }],
            isError: true,
          };
        }

        const suggestedActions: SuggestedAction[] = [
          { command: `server_logs { action: 'logs', server: '${server.name}' }`, reason: "Check recent logs" },
        ];
        if (!includeContainers) {
          suggestedActions.unshift({
            command: `server_logs { action: 'monitor', server: '${server.name}', containers: true }`,
            reason: "Include Docker container list",
          });
        }

        return {
          content: [{ type: "text", text: JSON.stringify({
            server: server.name,
            ip: server.ip,
            metrics: result.metrics,
            ...(result.containers ? { containers: result.containers } : {}),
            suggested_actions: suggestedActions,
          }) }],
        };
      }
    }
  } catch (error: unknown) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: getErrorMessage(error) }) }],
      isError: true,
    };
  }
}
