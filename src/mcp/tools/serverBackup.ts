import { z } from "zod";
import { getServers, findServer } from "../../utils/config.js";
import { isSafeMode } from "../../core/manage.js";
import { getProviderToken } from "../../core/tokens.js";
import {
  createBackup,
  restoreBackup,
  listBackups,
  loadManifest,
} from "../../core/backup.js";
import {
  createSnapshot,
  listSnapshots,
  deleteSnapshot,
} from "../../core/snapshot.js";
import { getErrorMessage } from "../../utils/errorMapper.js";

export const serverBackupSchema = {
  action: z.enum([
    "backup-create", "backup-list", "backup-restore",
    "snapshot-create", "snapshot-list", "snapshot-delete",
  ]).describe(
    "Backup: 'backup-create' dumps Coolify DB+config via SSH, 'backup-list' shows local backups, 'backup-restore' restores (SAFE_MODE blocks). Snapshot: 'snapshot-create'/'snapshot-list'/'snapshot-delete' manage cloud snapshots (requires API token).",
  ),
  server: z.string().optional().describe(
    "Server name or IP. Auto-selected if only one server exists.",
  ),
  backupId: z.string().optional().describe(
    "Backup timestamp folder name (required for backup-restore).",
  ),
  snapshotId: z.string().optional().describe(
    "Cloud snapshot ID (required for snapshot-delete).",
  ),
};

type Action = z.infer<typeof serverBackupSchema.action>;

function resolveServer(params: { server?: string }, servers: ReturnType<typeof getServers>) {
  if (params.server) {
    return findServer(params.server);
  }
  if (servers.length === 1) {
    return servers[0];
  }
  return undefined;
}

export async function handleServerBackup(params: {
  action: Action;
  server?: string;
  backupId?: string;
  snapshotId?: string;
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
      // ─── Backup Actions ──────────────────────────────────────────────

      case "backup-create": {
        const result = await createBackup(server.ip, server.name, server.provider);

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
            backupPath: result.backupPath,
            manifest: result.manifest,
            suggested_actions: [
              { command: `server_backup { action: 'backup-list', server: '${server.name}' }`, reason: "View all backups" },
              { command: `server_secure { action: 'secure-audit', server: '${server.name}' }`, reason: "Run security audit" },
            ],
          }) }],
        };
      }

      case "backup-list": {
        const backupIds = listBackups(server.name);

        if (backupIds.length === 0) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              server: server.name,
              backups: [],
              message: "No backups found for this server",
              suggested_actions: [
                { command: `server_backup { action: 'backup-create', server: '${server.name}' }`, reason: "Create a backup" },
              ],
            }) }],
          };
        }

        const { getBackupDir } = await import("../../core/backup.js");
        const { join } = await import("path");
        const backups = backupIds.map((id) => {
          const manifest = loadManifest(join(getBackupDir(server.name), id));
          if (manifest) {
            return {
              backupId: id,
              timestamp: manifest.timestamp,
              coolifyVersion: manifest.coolifyVersion,
              files: manifest.files,
            };
          }
          return { backupId: id, status: "corrupt/unreadable" };
        });

        return {
          content: [{ type: "text", text: JSON.stringify({
            server: server.name,
            backupCount: backupIds.length,
            backups,
            suggested_actions: [
              { command: `server_backup { action: 'backup-restore', server: '${server.name}', backupId: '${backupIds[0]}' }`, reason: "Restore latest backup" },
            ],
          }) }],
        };
      }

      case "backup-restore": {
        if (isSafeMode()) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: "Restore disabled in SAFE_MODE",
              hint: "Set QUICKLIFY_SAFE_MODE=false to enable restore operations",
            }) }],
            isError: true,
          };
        }

        if (!params.backupId) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: "backupId is required for backup-restore",
              hint: "Use backup-list to see available backups",
              suggested_actions: [
                { command: `server_backup { action: 'backup-list', server: '${server.name}' }`, reason: "List available backups" },
              ],
            }) }],
            isError: true,
          };
        }

        const result = await restoreBackup(server.ip, server.name, params.backupId);

        if (!result.success) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              server: server.name,
              ip: server.ip,
              backupId: params.backupId,
              error: result.error,
              steps: result.steps,
              ...(result.hint ? { hint: result.hint } : {}),
            }) }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify({
            success: true,
            server: server.name,
            ip: server.ip,
            backupId: params.backupId,
            steps: result.steps,
            suggested_actions: [
              { command: `server_info { action: 'health', server: '${server.name}' }`, reason: "Verify Coolify is running" },
            ],
          }) }],
        };
      }

      // ─── Snapshot Actions ────────────────────────────────────────────

      case "snapshot-create": {
        const isManual = server.id.startsWith("manual-");
        if (isManual) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: "Snapshots require cloud provider API. Manual servers don't have provider IDs.",
              hint: "Use backup-create for SSH-based backup instead.",
              suggested_actions: [
                { command: `server_backup { action: 'backup-create', server: '${server.name}' }`, reason: "SSH-based backup" },
              ],
            }) }],
            isError: true,
          };
        }

        const token = getProviderToken(server.provider);
        if (!token) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: `No API token found for ${server.provider}`,
              hint: `Set ${server.provider.toUpperCase()}_TOKEN environment variable`,
            }) }],
            isError: true,
          };
        }

        const result = await createSnapshot(server, token);

        if (!result.success) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              server: server.name,
              ip: server.ip,
              error: result.error,
              ...(result.hint ? { hint: result.hint } : {}),
            }) }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify({
            success: true,
            server: server.name,
            ip: server.ip,
            snapshot: result.snapshot,
            costEstimate: result.costEstimate,
            suggested_actions: [
              { command: `server_backup { action: 'snapshot-list', server: '${server.name}' }`, reason: "View all snapshots" },
            ],
          }) }],
        };
      }

      case "snapshot-list": {
        const isManual = server.id.startsWith("manual-");
        if (isManual) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: "Snapshots require cloud provider API. Manual servers don't have provider IDs.",
              hint: "Use backup-list for local backups instead.",
              suggested_actions: [
                { command: `server_backup { action: 'backup-list', server: '${server.name}' }`, reason: "List local backups" },
              ],
            }) }],
            isError: true,
          };
        }

        const token = getProviderToken(server.provider);
        if (!token) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: `No API token found for ${server.provider}`,
              hint: `Set ${server.provider.toUpperCase()}_TOKEN environment variable`,
            }) }],
            isError: true,
          };
        }

        const result = await listSnapshots(server, token);

        if (result.error) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              server: server.name,
              ip: server.ip,
              error: result.error,
              ...(result.hint ? { hint: result.hint } : {}),
            }) }],
            isError: true,
          };
        }

        if (result.snapshots.length === 0) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              server: server.name,
              snapshots: [],
              message: "No snapshots found",
              suggested_actions: [
                { command: `server_backup { action: 'snapshot-create', server: '${server.name}' }`, reason: "Create a snapshot" },
              ],
            }) }],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify({
            server: server.name,
            ip: server.ip,
            snapshotCount: result.snapshots.length,
            snapshots: result.snapshots,
            suggested_actions: [
              { command: `server_backup { action: 'snapshot-delete', server: '${server.name}', snapshotId: '${result.snapshots[0].id}' }`, reason: "Delete a snapshot" },
            ],
          }) }],
        };
      }

      case "snapshot-delete": {
        if (isSafeMode()) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: "Snapshot delete disabled in SAFE_MODE",
              hint: "Set QUICKLIFY_SAFE_MODE=false to enable snapshot deletion",
            }) }],
            isError: true,
          };
        }

        const isManual = server.id.startsWith("manual-");
        if (isManual) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: "Snapshots require cloud provider API. Manual servers don't have provider IDs.",
              hint: "Manual servers cannot manage cloud snapshots.",
            }) }],
            isError: true,
          };
        }

        const token = getProviderToken(server.provider);
        if (!token) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: `No API token found for ${server.provider}`,
              hint: `Set ${server.provider.toUpperCase()}_TOKEN environment variable`,
            }) }],
            isError: true,
          };
        }

        if (!params.snapshotId) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: "snapshotId is required for snapshot-delete",
              hint: "Use snapshot-list to see available snapshots",
              suggested_actions: [
                { command: `server_backup { action: 'snapshot-list', server: '${server.name}' }`, reason: "List snapshots" },
              ],
            }) }],
            isError: true,
          };
        }

        const result = await deleteSnapshot(server, token, params.snapshotId);

        if (!result.success) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              server: server.name,
              ip: server.ip,
              snapshotId: params.snapshotId,
              error: result.error,
              ...(result.hint ? { hint: result.hint } : {}),
            }) }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify({
            success: true,
            server: server.name,
            ip: server.ip,
            snapshotId: params.snapshotId,
            message: "Snapshot deleted",
            suggested_actions: [
              { command: `server_backup { action: 'snapshot-list', server: '${server.name}' }`, reason: "View remaining snapshots" },
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
