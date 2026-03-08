import { Entry } from "@napi-rs/keyring";
import { SUPPORTED_PROVIDERS, PROVIDER_ENV_KEYS } from "../constants.js";
import type { SupportedProvider } from "../constants.js";

const SERVICE_NAME = "kastell";

function getKeychainEntry(provider: string): Entry | null {
  const envKey = PROVIDER_ENV_KEYS[provider as SupportedProvider];
  if (!envKey) return null;
  try {
    return new Entry(SERVICE_NAME, envKey);
  } catch {
    return null;
  }
}

export function setToken(provider: string, token: string): boolean {
  if (!SUPPORTED_PROVIDERS.includes(provider as SupportedProvider)) {
    return false;
  }
  const entry = getKeychainEntry(provider);
  if (!entry) return false;
  try {
    entry.setPassword(token);
    return true;
  } catch {
    return false;
  }
}

export function getToken(provider: string): string | undefined {
  const entry = getKeychainEntry(provider);
  if (!entry) return undefined;
  try {
    const password = entry.getPassword();
    return password ?? undefined;
  } catch {
    return undefined;
  }
}

export function removeToken(provider: string): boolean {
  if (!SUPPORTED_PROVIDERS.includes(provider as SupportedProvider)) {
    return false;
  }
  const entry = getKeychainEntry(provider);
  if (!entry) return false;
  try {
    entry.deletePassword();
    return true;
  } catch {
    return false;
  }
}

export function listStoredProviders(): string[] {
  const stored: string[] = [];
  for (const provider of SUPPORTED_PROVIDERS) {
    try {
      const token = getToken(provider);
      if (token) stored.push(provider);
    } catch {
      // skip unavailable
    }
  }
  return stored;
}

export function isKeychainAvailable(): boolean {
  try {
    new Entry(SERVICE_NAME, "__test__");
    return true;
  } catch {
    return false;
  }
}
