import { isValidProvider, validateServerName } from "./manage.js";
import { getProviderToken } from "./tokens.js";
import { createProviderWithToken } from "../utils/providerFactory.js";
import { getCoolifyCloudInit } from "../utils/cloudInit.js";
import { findLocalSshKey, getSshKeyName } from "../utils/sshKey.js";
import { saveServer } from "../utils/config.js";
import { getTemplateDefaults } from "../utils/templates.js";
import { getErrorMessage, mapProviderError } from "../utils/errorMapper.js";
import { assertValidIp } from "../utils/ssh.js";
import type { CloudProvider } from "../providers/base.js";
import type { ServerRecord } from "../types/index.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProvisionConfig {
  provider: string;
  region?: string;
  size?: string;
  name: string;
  template?: string;
}

export interface ProvisionResult {
  success: boolean;
  server?: ServerRecord;
  error?: string;
  hint?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

// TODO: v1.2.0'da init.ts ile birleştirilecek — ortak modüle taşı
const IP_WAIT: Record<string, { attempts: number; interval: number }> = {
  hetzner:      { attempts: 10, interval: 3000 },   // 30s
  digitalocean: { attempts: 20, interval: 3000 },   // 60s
  vultr:        { attempts: 40, interval: 5000 },    // 200s
  linode:       { attempts: 30, interval: 5000 },    // 150s
};

const BOOT_MAX_ATTEMPTS = 30;
const BOOT_INTERVAL = 1000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPendingIp(ip: string): boolean {
  return !ip || ip === "pending" || ip === "0.0.0.0";
}

export async function uploadSshKeyBestEffort(provider: CloudProvider): Promise<string[]> {
  const publicKey = findLocalSshKey();
  if (!publicKey) {
    process.stderr.write("[provision] No local SSH key found, skipping upload\n");
    return [];
  }

  try {
    const keyId = await provider.uploadSshKey(getSshKeyName(), publicKey);
    return [keyId];
  } catch (error: unknown) {
    process.stderr.write(
      `[provision] SSH key upload failed: ${getErrorMessage(error)}. Continuing without SSH key.\n`,
    );
    return [];
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function provisionServer(config: ProvisionConfig): Promise<ProvisionResult> {
  // 1. Validate provider
  if (!isValidProvider(config.provider)) {
    return {
      success: false,
      error: `Invalid provider: ${config.provider}. Valid: hetzner, digitalocean, vultr, linode`,
    };
  }

  // 2. Validate name
  const nameError = validateServerName(config.name);
  if (nameError) {
    return { success: false, error: nameError };
  }

  // 3. Resolve region/size — explicit params override template defaults
  const template = config.template || "starter";
  const defaults = getTemplateDefaults(template, config.provider);
  const region = config.region || defaults?.region;
  const size = config.size || defaults?.size;

  if (!region || !size) {
    return {
      success: false,
      error: `Could not resolve region/size for provider "${config.provider}" with template "${template}"`,
      hint: "Provide explicit region and size parameters, or use a valid template",
    };
  }

  // 4. Resolve token
  const token = getProviderToken(config.provider);
  if (!token) {
    return {
      success: false,
      error: `No API token found for ${config.provider}`,
      hint: `Set ${config.provider.toUpperCase()}_TOKEN environment variable`,
    };
  }

  // 5. Create provider instance
  const provider = createProviderWithToken(config.provider, token);

  // 6. Validate token
  try {
    const valid = await provider.validateToken(token);
    if (!valid) {
      return { success: false, error: `Invalid API token for ${config.provider}` };
    }
  } catch (error: unknown) {
    return {
      success: false,
      error: `Token validation failed: ${getErrorMessage(error)}`,
    };
  }

  // 7. Upload SSH key (best-effort)
  const sshKeyIds = await uploadSshKeyBestEffort(provider);

  // 8. Generate cloud-init
  const cloudInit = getCoolifyCloudInit(config.name);

  // 9. Create server
  let serverId: string;
  let serverIp: string;
  try {
    const result = await provider.createServer({
      name: config.name,
      region,
      size,
      cloudInit,
      sshKeyIds,
    });
    serverId = result.id;
    serverIp = result.ip;
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const hint = mapProviderError(error, config.provider);
    return {
      success: false,
      error: `Server creation failed: ${message}`,
      ...(hint ? { hint } : {}),
    };
  }

  // 10. Wait for running status
  for (let i = 0; i < BOOT_MAX_ATTEMPTS; i++) {
    try {
      const status = await provider.getServerStatus(serverId);
      if (status === "running") break;
    } catch {
      // Ignore polling errors, retry
    }
    if (i === BOOT_MAX_ATTEMPTS - 1) {
      return {
        success: false,
        error: `Server did not reach running state within ${BOOT_MAX_ATTEMPTS}s`,
        hint: "The server may still be booting. Check status manually.",
      };
    }
    await sleep(BOOT_INTERVAL);
  }

  // 11. Wait for IP assignment (provider-specific timing)
  if (isPendingIp(serverIp)) {
    const ipConfig = IP_WAIT[config.provider] || { attempts: 20, interval: 3000 };
    for (let i = 0; i < ipConfig.attempts; i++) {
      await sleep(ipConfig.interval);
      try {
        const details = await provider.getServerDetails(serverId);
        if (!isPendingIp(details.ip)) {
          try {
            assertValidIp(details.ip);
            serverIp = details.ip;
            break;
          } catch {
            // Invalid IP format, keep polling
          }
        }
      } catch {
        // Ignore polling errors, retry
      }
    }
  } else {
    // Validate the IP we already have
    try {
      assertValidIp(serverIp);
    } catch {
      process.stderr.write(`[provision] IP validation failed for ${serverIp}, marking as pending\n`);
      serverIp = "pending";
    }
  }

  // 12. Save to config
  const record: ServerRecord = {
    id: serverId,
    name: config.name,
    provider: config.provider,
    ip: serverIp,
    region,
    size,
    createdAt: new Date().toISOString(),
  };
  saveServer(record);

  // 13. Return result
  if (isPendingIp(serverIp)) {
    return {
      success: true,
      server: record,
      hint: `IP address not yet assigned. Check status with: server_info { action: 'status', server: '${config.name}' }`,
    };
  }

  return { success: true, server: record };
}
