import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { serverInfoSchema, handleServerInfo } from "./tools/serverInfo.js";

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

  return server;
}
