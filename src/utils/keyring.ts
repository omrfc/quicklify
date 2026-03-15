import { existsSync } from "fs";

// ─── Android detection ───────────────────────────────────────────────────────

export const IS_ANDROID =
  process.platform === "android" ||
  process.env["PREFIX"]?.includes("com.termux") ||
  existsSync("/data/data/com.termux");

// ─── Keyring lazy-load ────────────────────────────────────────────────────────

export type KeyringEntry = import("@napi-rs/keyring").Entry;
let _Entry: (new (service: string, key: string) => KeyringEntry) | null = null;
let _keyringLoaded = false;

export function loadKeyring(): typeof _Entry {
  if (_keyringLoaded) return _Entry;
  _keyringLoaded = true;
  if (IS_ANDROID) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@napi-rs/keyring") as typeof import("@napi-rs/keyring");
    _Entry = mod.Entry;
  } catch { _Entry = null; }
  return _Entry;
}

export function isKeychainAvailable(serviceName: string): boolean {
  const EntryClass = loadKeyring();
  if (IS_ANDROID || !EntryClass) return false;
  try { new EntryClass(serviceName, "__test__"); return true; }
  catch { return false; }
}

export function getKeychainEntry(serviceName: string, key: string): KeyringEntry | null {
  const EntryClass = loadKeyring();
  if (!EntryClass) return null;
  try { return new EntryClass(serviceName, key); }
  catch { return null; }
}
