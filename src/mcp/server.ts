import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { serverInfoSchema, handleServerInfo } from "./tools/serverInfo.js";
import { serverLogsSchema, handleServerLogs } from "./tools/serverLogs.js";
import { serverManageSchema, handleServerManage } from "./tools/serverManage.js";
import { serverMaintainSchema, handleServerMaintain } from "./tools/serverMaintain.js";
import { serverSecureSchema, handleServerSecure } from "./tools/serverSecure.js";
import { serverBackupSchema, handleServerBackup } from "./tools/serverBackup.js";
import { serverProvisionSchema, handleServerProvision } from "./tools/serverProvision.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgPath = join(__dirname, "..", "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { name: string; version: string };

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

  server.registerTool("server_maintain", {
    description:
      "Maintain Quicklify servers. Actions: 'update' runs Coolify update via SSH, 'restart' reboots server via cloud provider API, 'maintain' runs full 5-step maintenance (status check → update → health check → reboot → final check). Snapshot not included — use server_backup tool. Requires SSH access for update, provider API tokens for restart/status. Manual servers: update works, restart not available.",
    inputSchema: serverMaintainSchema,
    annotations: {
      title: "Server Maintenance",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  }, async (params) => {
    return handleServerMaintain(params);
  });

  server.registerTool("server_secure", {
    description:
      "Secure Quicklify servers. Secure: 'secure-setup' applies SSH hardening + fail2ban, 'secure-audit' runs security audit with score. Firewall: 'firewall-setup' installs UFW with Coolify ports, 'firewall-add'/'firewall-remove' manage port rules, 'firewall-status' shows current rules. Domain: 'domain-set'/'domain-remove' manage custom domain with optional SSL, 'domain-check' verifies DNS, 'domain-info' shows current FQDN. All require SSH access to server.",
    inputSchema: serverSecureSchema,
    annotations: {
      title: "Server Security",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  }, async (params) => {
    return handleServerSecure(params);
  });

  server.registerTool("server_backup", {
    description:
      "Backup and snapshot Quicklify servers. Backup: 'backup-create' dumps Coolify DB + config via SSH, 'backup-list' shows local backups, 'backup-restore' restores from backup (SAFE_MODE blocks this). Snapshot: 'snapshot-create'/'snapshot-list'/'snapshot-delete' manage cloud provider snapshots (requires provider API token). Snapshots not available for manually added servers. Backup uses SSH, snapshots use provider API.",
    inputSchema: serverBackupSchema,
    annotations: {
      title: "Server Backup & Snapshots",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  }, async (params) => {
    return handleServerBackup(params);
  });

  server.registerTool("server_provision", {
    description:
      "Provision a new Coolify server on a cloud provider. Creates VPS with Coolify auto-install via cloud-init. Requires provider API token as environment variable (HETZNER_TOKEN, DIGITALOCEAN_TOKEN, VULTR_TOKEN, LINODE_TOKEN). WARNING: Creates a billable cloud resource. Blocked when QUICKLIFY_SAFE_MODE=true. Server takes 3-5 minutes to fully initialize after provisioning.",
    inputSchema: serverProvisionSchema,
    annotations: {
      title: "Server Provisioning",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  }, async (params) => {
    return handleServerProvision(params);
  });

  return server;
}
