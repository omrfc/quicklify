import { getProviderToken, collectProviderTokensFromEnv } from "../../src/core/tokens";

describe("getProviderToken", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should return token from HETZNER_TOKEN env var", () => {
    process.env.HETZNER_TOKEN = "hetzner-test-token";
    expect(getProviderToken("hetzner")).toBe("hetzner-test-token");
  });

  it("should return token from DIGITALOCEAN_TOKEN env var", () => {
    process.env.DIGITALOCEAN_TOKEN = "do-test-token";
    expect(getProviderToken("digitalocean")).toBe("do-test-token");
  });

  it("should return token from VULTR_TOKEN env var", () => {
    process.env.VULTR_TOKEN = "vultr-test-token";
    expect(getProviderToken("vultr")).toBe("vultr-test-token");
  });

  it("should return token from LINODE_TOKEN env var", () => {
    process.env.LINODE_TOKEN = "linode-test-token";
    expect(getProviderToken("linode")).toBe("linode-test-token");
  });

  it("should return undefined when env var is not set", () => {
    delete process.env.HETZNER_TOKEN;
    expect(getProviderToken("hetzner")).toBeUndefined();
  });

  it("should return undefined for unknown provider", () => {
    expect(getProviderToken("aws")).toBeUndefined();
  });
});

describe("collectProviderTokensFromEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should collect tokens for all providers with env vars", () => {
    process.env.HETZNER_TOKEN = "h-token";
    process.env.DIGITALOCEAN_TOKEN = "do-token";

    const servers = [
      { id: "1", name: "s1", provider: "hetzner", ip: "1.1.1.1", region: "nbg1", size: "cx11", createdAt: "" },
      { id: "2", name: "s2", provider: "digitalocean", ip: "2.2.2.2", region: "nyc1", size: "s-1", createdAt: "" },
    ];

    const tokenMap = collectProviderTokensFromEnv(servers);

    expect(tokenMap.get("hetzner")).toBe("h-token");
    expect(tokenMap.get("digitalocean")).toBe("do-token");
    expect(tokenMap.size).toBe(2);
  });

  it("should skip providers without env vars", () => {
    process.env.HETZNER_TOKEN = "h-token";
    delete process.env.DIGITALOCEAN_TOKEN;

    const servers = [
      { id: "1", name: "s1", provider: "hetzner", ip: "1.1.1.1", region: "nbg1", size: "cx11", createdAt: "" },
      { id: "2", name: "s2", provider: "digitalocean", ip: "2.2.2.2", region: "nyc1", size: "s-1", createdAt: "" },
    ];

    const tokenMap = collectProviderTokensFromEnv(servers);

    expect(tokenMap.get("hetzner")).toBe("h-token");
    expect(tokenMap.has("digitalocean")).toBe(false);
    expect(tokenMap.size).toBe(1);
  });

  it("should skip manual servers", () => {
    process.env.HETZNER_TOKEN = "h-token";

    const servers = [
      { id: "manual-abc", name: "s1", provider: "hetzner", ip: "1.1.1.1", region: "nbg1", size: "cx11", createdAt: "" },
    ];

    const tokenMap = collectProviderTokensFromEnv(servers);

    expect(tokenMap.size).toBe(0);
  });

  it("should deduplicate providers", () => {
    process.env.HETZNER_TOKEN = "h-token";

    const servers = [
      { id: "1", name: "s1", provider: "hetzner", ip: "1.1.1.1", region: "nbg1", size: "cx11", createdAt: "" },
      { id: "2", name: "s2", provider: "hetzner", ip: "2.2.2.2", region: "fsn1", size: "cx21", createdAt: "" },
    ];

    const tokenMap = collectProviderTokensFromEnv(servers);

    expect(tokenMap.size).toBe(1);
    expect(tokenMap.get("hetzner")).toBe("h-token");
  });

  it("should return empty map for empty server list", () => {
    const tokenMap = collectProviderTokensFromEnv([]);
    expect(tokenMap.size).toBe(0);
  });
});
