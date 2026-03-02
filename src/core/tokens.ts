import type { ServerRecord } from "../types/index.js";
import { PROVIDER_ENV_KEYS } from "../constants.js";

export function getProviderToken(provider: string): string | undefined {
  const envKey = PROVIDER_ENV_KEYS[provider as keyof typeof PROVIDER_ENV_KEYS];
  const raw = envKey ? process.env[envKey] : undefined;
  const trimmed = raw?.trim();
  return trimmed || undefined;
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
