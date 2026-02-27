import { z } from "zod";
import { getServers } from "../../utils/config.js";
import {
  isSafeMode,
  addServerRecord,
  removeServerRecord,
  destroyCloudServer,
} from "../../core/manage.js";
import { getErrorMessage } from "../../utils/errorMapper.js";

export const serverManageSchema = {
  action: z.enum(["add", "remove", "destroy"]).describe(
    "Action: 'add' register an existing server, 'remove' unregister from local config (server stays running), 'destroy' permanently delete from cloud provider AND local config",
  ),
  server: z.string().optional().describe(
    "Server name or IP (required for 'remove' and 'destroy' actions)",
  ),
  provider: z.enum(["hetzner", "digitalocean", "vultr", "linode"]).optional().describe(
    "Cloud provider: 'hetzner', 'digitalocean', 'vultr', 'linode' (required for 'add' action)",
  ),
  ip: z.string().optional().describe(
    "Server public IP address (required for 'add' action)",
  ),
  name: z.string().optional().describe(
    "Server name, 3-63 chars, lowercase alphanumeric and hyphens (required for 'add' action)",
  ),
  skipVerify: z.boolean().default(false).describe(
    "Skip Coolify SSH verification when adding a server (only for 'add' action)",
  ),
};

export async function handleServerManage(params: {
  action: "add" | "remove" | "destroy";
  server?: string;
  provider?: string;
  ip?: string;
  name?: string;
  skipVerify?: boolean;
}): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  try {
    switch (params.action) {
      case "add": {
        if (!params.provider) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: "Missing required parameter: provider",
              hint: "Specify provider: 'hetzner', 'digitalocean', 'vultr', or 'linode'",
            }) }],
            isError: true,
          };
        }
        if (!params.ip) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: "Missing required parameter: ip",
              hint: "Specify the server's public IP address",
            }) }],
            isError: true,
          };
        }
        if (!params.name) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: "Missing required parameter: name",
              hint: "Specify a server name (3-63 chars, lowercase, alphanumeric and hyphens)",
            }) }],
            isError: true,
          };
        }

        const result = await addServerRecord({
          provider: params.provider,
          ip: params.ip,
          name: params.name,
          skipVerify: params.skipVerify ?? false,
        });

        if (!result.success) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: result.error,
              suggested_actions: [
                { command: "server_info { action: 'list' }", reason: "Check existing servers" },
              ],
            }) }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify({
            success: true,
            message: `Server "${result.server!.name}" added successfully`,
            server: {
              name: result.server!.name,
              ip: result.server!.ip,
              provider: result.server!.provider,
              id: result.server!.id,
            },
            coolifyStatus: result.coolifyStatus,
            suggested_actions: [
              { command: `server_info { action: 'status', server: '${result.server!.name}' }`, reason: "Check server status" },
              { command: `server_info { action: 'health', server: '${result.server!.name}' }`, reason: "Check Coolify health" },
              { command: `server_logs { action: 'logs', server: '${result.server!.name}' }`, reason: "View server logs" },
            ],
          }) }],
        };
      }

      case "remove": {
        if (!params.server) {
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
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: "Missing required parameter: server",
              available_servers: servers.map((s) => ({ name: s.name, ip: s.ip })),
              hint: "Specify which server to remove by name or IP",
            }) }],
            isError: true,
          };
        }

        const result = removeServerRecord(params.server);

        if (!result.success) {
          const servers = getServers();
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: result.error,
              available_servers: servers.map((s) => s.name),
            }) }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify({
            success: true,
            message: `Server "${result.server!.name}" removed from local config`,
            note: "The cloud server is still running. Use 'destroy' to delete it from the provider.",
            server: {
              name: result.server!.name,
              ip: result.server!.ip,
              provider: result.server!.provider,
            },
            suggested_actions: [
              { command: "server_info { action: 'list' }", reason: "View remaining servers" },
            ],
          }) }],
        };
      }

      case "destroy": {
        // SAFE_MODE check
        if (isSafeMode()) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: "Destroy is disabled in SAFE_MODE",
              hint: "Set QUICKLIFY_SAFE_MODE=false to enable destructive operations",
              suggested_actions: [
                { command: `server_manage { action: 'remove', server: '${params.server ?? ""}' }`, reason: "Remove from local config only (non-destructive)" },
              ],
            }) }],
            isError: true,
          };
        }

        if (!params.server) {
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
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: "Missing required parameter: server",
              available_servers: servers.map((s) => ({ name: s.name, ip: s.ip, provider: s.provider })),
              hint: "Specify which server to destroy by name or IP",
              warning: "This will PERMANENTLY DELETE the server from the cloud provider",
            }) }],
            isError: true,
          };
        }

        const result = await destroyCloudServer(params.server);

        if (!result.success) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: result.error,
              ...(result.hint ? { hint: result.hint } : {}),
              ...(result.server ? {
                server: { name: result.server.name, ip: result.server.ip, provider: result.server.provider },
              } : {}),
              suggested_actions: [
                { command: `server_manage { action: 'remove', server: '${params.server}' }`, reason: "Remove from local config only" },
                { command: "quicklify doctor --check-tokens", reason: "Verify API tokens" },
              ],
            }) }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify({
            success: true,
            message: `Server "${result.server!.name}" destroyed`,
            cloudDeleted: result.cloudDeleted,
            localRemoved: result.localRemoved,
            ...(result.hint ? { note: result.hint } : {}),
            server: {
              name: result.server!.name,
              ip: result.server!.ip,
              provider: result.server!.provider,
            },
            suggested_actions: [
              { command: "server_info { action: 'list' }", reason: "Verify server was removed" },
            ],
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
