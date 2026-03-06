import { getAdapter, resolvePlatform } from "../../src/adapters/factory";
import type { ServerRecord } from "../../src/types/index";
import type { Platform } from "../../src/types/index";

const makeRecord = (overrides: Partial<ServerRecord> = {}): ServerRecord => ({
  id: "1",
  name: "test-server",
  provider: "hetzner",
  ip: "1.2.3.4",
  region: "nbg1",
  size: "cax11",
  createdAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("Platform type", () => {
  it("should accept 'coolify' as a valid Platform", () => {
    const p: Platform = "coolify";
    expect(p).toBe("coolify");
  });

  it("should accept 'dokploy' as a valid Platform", () => {
    const p: Platform = "dokploy";
    expect(p).toBe("dokploy");
  });
});

describe("ServerRecord platform field", () => {
  it("should accept optional platform field with value 'coolify'", () => {
    const record = makeRecord({ platform: "coolify" });
    expect(record.platform).toBe("coolify");
  });

  it("should accept optional platform field with value 'dokploy'", () => {
    const record = makeRecord({ platform: "dokploy" });
    expect(record.platform).toBe("dokploy");
  });

  it("should accept record without platform field", () => {
    const record = makeRecord();
    expect(record.platform).toBeUndefined();
  });
});

describe("getAdapter", () => {
  it("should return an adapter with name 'coolify' for platform 'coolify'", () => {
    const adapter = getAdapter("coolify");
    expect(adapter.name).toBe("coolify");
  });

  it("should throw for unknown platform", () => {
    expect(() => getAdapter("unknown" as any)).toThrow("Unknown platform: unknown");
  });
});

describe("resolvePlatform", () => {
  it("should return 'coolify' when platform is 'coolify'", () => {
    const record = makeRecord({ platform: "coolify" });
    expect(resolvePlatform(record)).toBe("coolify");
  });

  it("should return 'dokploy' when platform is 'dokploy'", () => {
    const record = makeRecord({ platform: "dokploy" });
    expect(resolvePlatform(record)).toBe("dokploy");
  });

  it("should return undefined for mode='bare' (no platform)", () => {
    const record = makeRecord({ mode: "bare" });
    expect(resolvePlatform(record)).toBeUndefined();
  });

  it("should return 'coolify' for mode='coolify' (legacy compat)", () => {
    const record = makeRecord({ mode: "coolify" });
    expect(resolvePlatform(record)).toBe("coolify");
  });

  it("should return 'coolify' for legacy records with no mode/platform", () => {
    const record = makeRecord();
    expect(resolvePlatform(record)).toBe("coolify");
  });

  it("should prioritize platform over mode", () => {
    const record = makeRecord({ mode: "bare", platform: "coolify" });
    expect(resolvePlatform(record)).toBe("coolify");
  });
});
