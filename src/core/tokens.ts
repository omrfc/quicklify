import type { ServerRecord } from "../types/index.js";

const ENV_KEYS: Record<string, string> = {
  hetzner: "HETZNER_TOKEN",
  digitalocean: "DIGITALOCEAN_TOKEN",
  vultr: "VULTR_TOKEN",
  linode: "LINODE_TOKEN",
};

export function getProviderToken(provider: string): string | undefined {
  const envKey = ENV_KEYS[provider];
  return envKey ? process.env[envKey] : undefined;
}

export function collectProviderTokensFromEnv(
  servers: ServerRecord[],
): Map<string, string> {
  const tokenMap = new Map<string, string>();
  const providers = [
    ...new Set(
      servers.filter((s) => !s.id.startsWith("manual-")).map((s) => s.provider),
    ),
  ];
  for (const provider of providers) {
    const token = getProviderToken(provider);
    if (token) tokenMap.set(provider, token);
  }
  return tokenMap;
}
