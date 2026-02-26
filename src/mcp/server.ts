import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { serverInfoSchema, handleServerInfo } from "./tools/serverInfo.js";
import { serverLogsSchema, handleServerLogs } from "./tools/serverLogs.js";
import { serverManageSchema, handleServerManage } from "./tools/serverManage.js";

const pkg = { name: "quicklify-mcp", version: "1.1.0" };

export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: pkg.name, version: pkg.version },
    { capabilities: { logging: {} } },
  );

  server.registerTool("server_info", {
    description:
      "Get information about Quicklify-managed servers. Actions: 'list' all servers, 'status' check cloud provider + Coolify status, 'health' check Coolify reachability. Requires provider API tokens as environment variables (HETZNER_TOKEN, DIGITALOCEAN_TOKEN, VULTR_TOKEN, LINODE_TOKEN) for status checks. Avoid calling repeatedly in short intervals to prevent provider API rate limiting.",
    inputSchema: serverInfoSchema,
    annotations: {
      title: "Server Information",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  }, async (params) => {
    return handleServerInfo(params);
  });

  server.registerTool("server_logs", {
    description:
      "Fetch logs and system metrics from Quicklify-managed servers via SSH. Actions: 'logs' retrieves recent log lines from Coolify container, Docker service, or system journal. 'monitor' fetches CPU, RAM, and disk usage metrics. Requires SSH access to target server (root@ip). Note: live streaming (--follow) is not available via MCP — use the CLI for live log tailing.",
    inputSchema: serverLogsSchema,
    annotations: {
      title: "Server Logs & Metrics",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  }, async (params) => {
    return handleServerLogs(params);
  });

  server.registerTool("server_manage", {
    description:
      "Manage Quicklify servers. Actions: 'add' registers an existing server to local config (validates API token, optionally verifies Coolify via SSH). 'remove' unregisters a server from local config only (cloud server keeps running). 'destroy' PERMANENTLY DELETES the server from the cloud provider and removes from local config. Requires provider API tokens as environment variables. Destroy is blocked when QUICKLIFY_SAFE_MODE=true.",
    inputSchema: serverManageSchema,
    annotations: {
      title: "Server Management",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  }, async (params) => {
    return handleServerManage(params);
  });

  return server;
}
