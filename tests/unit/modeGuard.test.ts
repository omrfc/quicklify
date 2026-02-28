import { getServerMode, isBareServer, requireCoolifyMode } from "../../src/utils/modeGuard";
import type { ServerRecord } from "../../src/types/index";

const makeRecord = (mode?: "coolify" | "bare"): ServerRecord => ({
  id: "1",
  name: "test-server",
  provider: "hetzner",
  ip: "1.2.3.4",
  region: "nbg1",
  size: "cax11",
  createdAt: "2026-01-01T00:00:00Z",
  ...(mode !== undefined ? { mode } : {}),
});

describe("getServerMode", () => {
  it("should return 'bare' for a server with mode='bare'", () => {
    const record = makeRecord("bare");
    expect(getServerMode(record)).toBe("bare");
  });

  it("should return 'coolify' for a server with mode='coolify'", () => {
    const record = makeRecord("coolify");
    expect(getServerMode(record)).toBe("coolify");
  });

  it("should return 'coolify' for a server with no mode field", () => {
    const record = makeRecord(); // no mode
    expect(getServerMode(record)).toBe("coolify");
  });
});

describe("isBareServer", () => {
  it("should return true for a server with mode='bare'", () => {
    const record = makeRecord("bare");
    expect(isBareServer(record)).toBe(true);
  });

  it("should return false for a server with mode='coolify'", () => {
    const record = makeRecord("coolify");
    expect(isBareServer(record)).toBe(false);
  });

  it("should return false for a server with no mode field", () => {
    const record = makeRecord(); // no mode
    expect(isBareServer(record)).toBe(false);
  });
});

describe("requireCoolifyMode", () => {
  it("should return an error string containing command name for a bare server", () => {
    const record = makeRecord("bare");
    const result = requireCoolifyMode(record, "health");
    expect(result).not.toBeNull();
    expect(result).toContain("health");
  });

  it("should return null for a coolify server", () => {
    const record = makeRecord("coolify");
    const result = requireCoolifyMode(record, "health");
    expect(result).toBeNull();
  });

  it("should include the command name in the error message", () => {
    const record = makeRecord("bare");
    const result = requireCoolifyMode(record, "logs");
    expect(result).toContain("logs");
  });

  it("should mention Coolify in the error message", () => {
    const record = makeRecord("bare");
    const result = requireCoolifyMode(record, "update");
    expect(result).toContain("Coolify");
  });

  it("should return null for a server with no mode field (defaults to coolify)", () => {
    const record = makeRecord(); // no mode
    const result = requireCoolifyMode(record, "health");
    expect(result).toBeNull();
  });
});
