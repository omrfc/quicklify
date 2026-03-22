import type { ServerRecord } from "../../src/types/index.js";

/**
 * Default server values for test factories.
 * All required fields of ServerRecord are populated with sensible test data.
 */
const SERVER_DEFAULTS: ServerRecord = {
  id: "server-001",
  name: "test-server",
  provider: "hetzner",
  ip: "1.2.3.4",
  region: "nbg1",
  size: "cax11",
  createdAt: "2026-01-01T00:00:00.000Z",
  mode: "coolify",
};

/**
 * createMockServer — creates a ServerRecord with coolify platform defaults.
 * Pass overrides to customise individual fields.
 */
export function createMockServer(overrides: Partial<ServerRecord> = {}): ServerRecord {
  return { ...SERVER_DEFAULTS, ...overrides };
}

/**
 * createBareServer — creates a ServerRecord in bare mode (no platform adapter).
 * Pass overrides to customise individual fields.
 */
export function createBareServer(overrides: Partial<ServerRecord> = {}): ServerRecord {
  return { ...SERVER_DEFAULTS, mode: "bare", platform: undefined, ...overrides };
}
