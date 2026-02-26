import { z } from "zod";
import { getServers, findServer } from "../../utils/config.js";
import { getProviderToken } from "../../core/tokens.js";
import {
  executeCoolifyUpdate,
  rebootAndWait,
  maintainServer,
} from "../../core/maintain.js";
import { getErrorMessage } from "../../utils/errorMapper.js";

export const serverMaintainSchema = {
  action: z.enum(["update", "restart", "maintain"]).describe(
    "Action: 'update' runs Coolify update via SSH, 'restart' reboots server via cloud API, 'maintain' runs full 5-step maintenance (status → update → health → reboot → final)",
  ),
  server: z.string().optional().describe(
    "Server name or IP. Auto-selected if only one server exists.",
  ),
  skipReboot: z.boolean().default(false).describe(
    "Skip reboot and final check steps (only for 'maintain' action). Useful during business hours.",
  ),
};

function resolveServer(params: { server?: string }, servers: ReturnType<typeof getServers>) {
  if (params.server) {
    return findServer(params.server);
  }
  if (servers.length === 1) {
    return servers[0];
  }
  return undefined;
}

export async function handleServerMaintain(params: {
  action: "update" | "restart" | "maintain";
  server?: string;
  skipReboot?: boolean;
}): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  try {
    const servers = getServers();
    if (servers.length === 0) {
      return {
        content: [{ type: "text", text: JSON.stringify({
          error: "No servers found",
          suggested_actions: [{ command: "quicklify init", reason: "Deploy a server first" }],
        }) }],
        isError: true,
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
      case "update": {
        // Update only needs SSH — no API token required
        const result = await executeCoolifyUpdate(server.ip);

        if (!result.success) {
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

        return {
          content: [{ type: "text", text: JSON.stringify({
            success: true,
            server: server.name,
            ip: server.ip,
            message: "Coolify update completed successfully",
            suggested_actions: [
              { command: `server_info { action: 'health', server: '${server.name}' }`, reason: "Verify Coolify is running after update" },
              { command: `server_logs { action: 'logs', server: '${server.name}' }`, reason: "Check logs after update" },
            ],
          }) }],
        };
      }

      case "restart": {
        // Restart requires API token for cloud provider
        const isManual = server.id.startsWith("manual-");
        if (isManual) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: `Cannot reboot manually added server via API`,
              hint: `Use SSH: ssh root@${server.ip} reboot`,
              server: { name: server.name, ip: server.ip },
            }) }],
            isError: true,
          };
        }

        const token = getProviderToken(server.provider);
        if (!token) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: `No API token found for provider: ${server.provider}`,
              hint: `Set environment variable: ${server.provider.toUpperCase()}_TOKEN`,
            }) }],
            isError: true,
          };
        }

        const result = await rebootAndWait(server, token);

        if (!result.success) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              server: server.name,
              ip: server.ip,
              error: result.error,
              ...(result.hint ? { hint: result.hint } : {}),
              suggested_actions: [
                { command: `server_info { action: 'status', server: '${server.name}' }`, reason: "Check current server status" },
              ],
            }) }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify({
            success: true,
            server: server.name,
            ip: server.ip,
            message: "Server restarted successfully",
            finalStatus: result.finalStatus,
            suggested_actions: [
              { command: `server_info { action: 'health', server: '${server.name}' }`, reason: "Verify Coolify is accessible" },
              { command: `server_logs { action: 'logs', server: '${server.name}' }`, reason: "Check logs after restart" },
            ],
          }) }],
        };
      }

      case "maintain": {
        // Maintain requires API token for non-manual servers
        const isManual = server.id.startsWith("manual-");
        let token = "";

        if (!isManual) {
          const envToken = getProviderToken(server.provider);
          if (!envToken) {
            return {
              content: [{ type: "text", text: JSON.stringify({
                error: `No API token found for provider: ${server.provider}`,
                hint: `Set environment variable: ${server.provider.toUpperCase()}_TOKEN`,
                suggested_actions: [
                  { command: `server_maintain { action: 'update', server: '${server.name}' }`, reason: "Run update only (no token needed)" },
                ],
              }) }],
              isError: true,
            };
          }
          token = envToken;
        }

        const result = await maintainServer(server, token, {
          skipReboot: params.skipReboot ?? false,
        });

        const suggestedActions = [];
        const hasFailure = result.steps.some((s) => s.status === "failure");

        if (hasFailure) {
          suggestedActions.push(
            { command: `server_info { action: 'health', server: '${server.name}' }`, reason: "Check Coolify reachability" },
            { command: `server_logs { action: 'logs', server: '${server.name}' }`, reason: "Check logs for errors" },
          );
        } else {
          suggestedActions.push(
            { command: `server_info { action: 'status', server: '${server.name}' }`, reason: "Verify full server status" },
            { command: `server_logs { action: 'logs', server: '${server.name}' }`, reason: "Check Coolify startup logs" },
          );
        }

        return {
          content: [{ type: "text", text: JSON.stringify({
            success: result.success,
            server: result.server,
            ip: result.ip,
            provider: result.provider,
            steps: result.steps,
            summary: {
              total: result.steps.length,
              success: result.steps.filter((s) => s.status === "success").length,
              failure: result.steps.filter((s) => s.status === "failure").length,
              skipped: result.steps.filter((s) => s.status === "skipped").length,
            },
            suggested_actions: suggestedActions,
          }) }],
          ...(hasFailure ? { isError: true } : {}),
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
