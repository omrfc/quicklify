/**
 * Provider contract conformance suite.
 *
 * Runs identical behavioral assertions against every CloudProvider
 * implementation to verify they satisfy the interface contract invariants.
 * Each provider uses its own mock response shape (not shared) so that
 * provider-specific parsing logic is exercised.
 *
 * Implementation-specific tests remain in their own files; this suite covers
 * cross-provider behavioral guarantees only.
 */

import axios from "axios";
import { HetznerProvider } from "../../src/providers/hetzner";
import { DigitalOceanProvider } from "../../src/providers/digitalocean";
import { VultrProvider } from "../../src/providers/vultr";
import { LinodeProvider } from "../../src/providers/linode";
import type { CloudProvider } from "../../src/providers/base";

// --- Mock setup ---
// axios is auto-mocked via tests/__mocks__/axios.ts.
// axios.create() returns the same mock object, so all apiClient.get/post/delete
// calls are intercepted by mockedAxios.get/post/delete.

const mockedAxios = axios as jest.Mocked<typeof axios>;

// --- Per-provider mock response data maps ---
// Keyed by provider.name to exercise each provider's parser independently.

const CREATE_MOCK_DATA: Record<string, unknown> = {
  hetzner: {
    server: { id: 123, public_net: { ipv4: { ip: "1.2.3.4" } }, status: "running" },
  },
  digitalocean: {
    droplet: {
      id: 456,
      networks: { v4: [{ type: "public", ip_address: "1.2.3.5" }] },
      status: "active",
    },
  },
  vultr: {
    instance: { id: "abc", main_ip: "1.2.3.6", power_status: "running" },
  },
  linode: { id: 789, ipv4: ["1.2.3.7"], status: "running" },
};

const STATUS_MOCK_DATA: Record<string, unknown> = {
  hetzner: { server: { status: "running" } },
  digitalocean: { droplet: { status: "active" } },
  // Vultr special case: power_status=running + server_status=ok → normal path (not "provisioning")
  vultr: { instance: { power_status: "running", server_status: "ok" } },
  linode: { status: "running" },
};

// --- Shared server config for createServer calls ---

const SAMPLE_CONFIG = {
  name: "contract-test",
  size: "small",
  region: "us-east",
  cloudInit: "#!/bin/bash\necho hello",
};

// --- Provider factory registry ---

const PROVIDERS: Array<{ providerName: string; factory: () => CloudProvider }> = [
  { providerName: "HetznerProvider", factory: () => new HetznerProvider("test-token") },
  { providerName: "DigitalOceanProvider", factory: () => new DigitalOceanProvider("test-token") },
  { providerName: "VultrProvider", factory: () => new VultrProvider("test-token") },
  { providerName: "LinodeProvider", factory: () => new LinodeProvider("test-token") },
];

// --- Shared contract conformance suite ---

describe.each(PROVIDERS)("CloudProvider contract — $providerName", ({ factory }) => {
  let provider: CloudProvider;

  beforeEach(() => {
    provider = factory();
    // resetAllMocks clears both call history AND return value queues,
    // preventing mock state leakage between tests in the same describe.each run.
    jest.resetAllMocks();
  });

  // ─── name property ─────────────────────────────────────────────────────────

  it("name is a non-empty lowercase string", () => {
    expect(typeof provider.name).toBe("string");
    expect(provider.name.length).toBeGreaterThan(0);
    expect(provider.name).toBe(provider.name.toLowerCase());
  });

  // ─── displayName property ──────────────────────────────────────────────────

  it("displayName is a non-empty string", () => {
    expect(typeof provider.displayName).toBe("string");
    expect(provider.displayName.length).toBeGreaterThan(0);
  });

  // ─── getServerSizes ────────────────────────────────────────────────────────

  it("getServerSizes returns non-empty array with required shape", () => {
    const sizes = provider.getServerSizes();
    expect(Array.isArray(sizes)).toBe(true);
    expect(sizes.length).toBeGreaterThan(0);
    for (const s of sizes) {
      expect(typeof s.id).toBe("string");
      expect(typeof s.vcpu).toBe("number");
      expect(typeof s.ram).toBe("number");
      expect(typeof s.price).toBe("string");
    }
  });

  // ─── getRegions ────────────────────────────────────────────────────────────

  it("getRegions returns non-empty array with required shape", () => {
    const regions = provider.getRegions();
    expect(Array.isArray(regions)).toBe(true);
    expect(regions.length).toBeGreaterThan(0);
    for (const r of regions) {
      expect(typeof r.id).toBe("string");
      expect(typeof r.name).toBe("string");
    }
  });

  // ─── createServer ──────────────────────────────────────────────────────────

  it("createServer resolves to { id, ip, status } on success", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: CREATE_MOCK_DATA[provider.name] });
    const result = await provider.createServer(SAMPLE_CONFIG);
    expect(typeof result.id).toBe("string");
    expect(typeof result.ip).toBe("string");
    expect(typeof result.status).toBe("string");
  });

  // ─── destroyServer ─────────────────────────────────────────────────────────

  it("destroyServer resolves without throwing on success", async () => {
    mockedAxios.delete.mockResolvedValueOnce({});
    await expect(provider.destroyServer("123")).resolves.toBeUndefined();
  });

  // ─── getServerStatus ───────────────────────────────────────────────────────

  it("getServerStatus returns a non-empty string", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: STATUS_MOCK_DATA[provider.name] });
    const status = await provider.getServerStatus("123");
    expect(typeof status).toBe("string");
    expect(status.length).toBeGreaterThan(0);
  });

  // ─── rebootServer ──────────────────────────────────────────────────────────

  it("rebootServer resolves without throwing on success", async () => {
    mockedAxios.post.mockResolvedValueOnce({});
    await expect(provider.rebootServer("123")).resolves.toBeUndefined();
  });
});
