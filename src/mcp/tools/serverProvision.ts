import { z } from "zod";
import { isSafeMode } from "../../core/manage.js";
import { provisionServer } from "../../core/provision.js";
import { getErrorMessage } from "../../utils/errorMapper.js";

// ─── Schema ──────────────────────────────────────────────────────────────────

export const serverProvisionSchema = {
  provider: z
    .enum(["hetzner", "digitalocean", "vultr", "linode"])
    .describe("Cloud provider to create server on"),
  region: z
    .string()
    .optional()
    .describe(
      "Region/location ID (e.g. 'nbg1' for Hetzner, 'fra1' for DigitalOcean, 'ewr' for Vultr, 'us-east' for Linode). Uses template defaults if omitted",
    ),
  size: z
    .string()
    .optional()
    .describe(
      "Server type/plan ID (e.g. 'cax11' for Hetzner, 's-2vcpu-2gb' for DigitalOcean). Uses template defaults if omitted",
    ),
  name: z
    .string()
    .describe(
      "Server hostname, 3-63 chars, lowercase, starts with letter, only alphanumeric and hyphens, ends with letter or number",
    ),
  template: z
    .enum(["starter", "production", "dev"])
    .default("starter")
    .describe(
      "Template for default region/size. 'starter' = cheapest, 'production' = more resources, 'dev' = development. Explicit region/size override template defaults. Default: starter",
    ),
};

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function handleServerProvision(params: {
  provider: "hetzner" | "digitalocean" | "vultr" | "linode";
  region?: string;
  size?: string;
  name: string;
  template?: "starter" | "production" | "dev";
}): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  // SAFE_MODE guard
  if (isSafeMode()) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "Provision is disabled in SAFE_MODE",
            hint: "Set QUICKLIFY_SAFE_MODE=false to enable server provisioning. WARNING: This creates billable cloud resources.",
          }),
        },
      ],
      isError: true,
    };
  }

  try {
    const result = await provisionServer({
      provider: params.provider,
      region: params.region,
      size: params.size,
      name: params.name,
      template: params.template,
    });

    if (!result.success) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: result.error,
              ...(result.hint ? { hint: result.hint } : {}),
              suggested_actions: [
                {
                  command: "server_info { action: 'list' }",
                  reason: "Check existing servers",
                },
              ],
            }),
          },
        ],
        isError: true,
      };
    }

    if (!result.server) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "Unexpected: server record missing" }) }],
        isError: true,
      };
    }

    const server = result.server;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `Server "${server.name}" provisioned on ${server.provider}`,
            server: {
              id: server.id,
              name: server.name,
              provider: server.provider,
              ip: server.ip,
              region: server.region,
              size: server.size,
              createdAt: server.createdAt,
            },
            ...(result.hint ? { hint: result.hint } : {}),
            suggested_actions: [
              {
                command: `server_info { action: 'health', server: '${server.name}' }`,
                reason:
                  "Check Coolify health (wait 3-5 minutes after creation for Coolify to initialize)",
              },
              {
                command: `server_secure { action: 'secure-setup', server: '${server.name}' }`,
                reason: "Harden SSH security + install fail2ban",
              },
              {
                command: `server_secure { action: 'firewall-setup', server: '${server.name}' }`,
                reason: "Setup UFW firewall with Coolify ports",
              },
              {
                command: `server_info { action: 'status', server: '${server.name}' }`,
                reason: "Check cloud provider status",
              },
            ],
          }),
        },
      ],
    };
  } catch (error: unknown) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: getErrorMessage(error) }) }],
      isError: true,
    };
  }
}
