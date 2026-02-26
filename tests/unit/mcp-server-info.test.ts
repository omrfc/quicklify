import axios from "axios";
import * as config from "../../src/utils/config";
import * as providerFactory from "../../src/utils/providerFactory";
import { handleServerInfo } from "../../src/mcp/tools/serverInfo";
import type { CloudProvider } from "../../src/providers/base";

jest.mock("../../src/utils/config");
jest.mock("../../src/utils/providerFactory");

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedConfig = config as jest.Mocked<typeof config>;
const mockedProviderFactory = providerFactory as jest.Mocked<typeof providerFactory>;

const sampleServer = {
  id: "123",
  name: "coolify-test",
  provider: "hetzner",
  ip: "1.2.3.4",
  region: "nbg1",
  size: "cax11",
  createdAt: "2026-02-20T00:00:00Z",
};

const sampleServer2 = {
  id: "456",
  name: "coolify-prod",
  provider: "digitalocean",
  ip: "5.6.7.8",
  region: "nyc1",
  size: "s-2vcpu-4gb",
  createdAt: "2026-02-21T00:00:00Z",
};

const mockProvider: CloudProvider = {
  name: "hetzner",
  displayName: "Hetzner Cloud",
  validateToken: jest.fn(),
  getRegions: jest.fn().mockReturnValue([]),
  getServerSizes: jest.fn().mockReturnValue([]),
  getAvailableLocations: jest.fn().mockResolvedValue([]),
  getAvailableServerTypes: jest.fn().mockResolvedValue([]),
  uploadSshKey: jest.fn(),
  createServer: jest.fn(),
  getServerStatus: jest.fn(),
  getServerDetails: jest.fn(),
  destroyServer: jest.fn(),
  rebootServer: jest.fn(),
  createSnapshot: jest.fn(),
  listSnapshots: jest.fn(),
  deleteSnapshot: jest.fn(),
  getSnapshotCostEstimate: jest.fn(),
};

const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe("handleServerInfo — list", () => {
  it("should return empty list when no servers", async () => {
    mockedConfig.getServers.mockReturnValue([]);

    const result = await handleServerInfo({ action: "list" });
    const data = JSON.parse(result.content[0].text);

    expect(data.servers).toEqual([]);
    expect(data.total).toBe(0);
    expect(data.suggested_actions).toBeDefined();
    expect(result.isError).toBeUndefined();
  });

  it("should return all servers with details", async () => {
    mockedConfig.getServers.mockReturnValue([sampleServer, sampleServer2]);

    const result = await handleServerInfo({ action: "list" });
    const data = JSON.parse(result.content[0].text);

    expect(data.servers).toHaveLength(2);
    expect(data.servers[0].name).toBe("coolify-test");
    expect(data.servers[0].ip).toBe("1.2.3.4");
    expect(data.servers[0].provider).toBe("hetzner");
    expect(data.servers[1].name).toBe("coolify-prod");
    expect(data.total).toBe(2);
  });

  it("should include suggested_actions in response", async () => {
    mockedConfig.getServers.mockReturnValue([sampleServer]);

    const result = await handleServerInfo({ action: "list" });
    const data = JSON.parse(result.content[0].text);

    expect(data.suggested_actions).toBeDefined();
    expect(data.suggested_actions.length).toBeGreaterThan(0);
    expect(data.suggested_actions[0]).toHaveProperty("command");
    expect(data.suggested_actions[0]).toHaveProperty("reason");
  });
});

describe("handleServerInfo — status", () => {
  it("should return error when no servers exist", async () => {
    mockedConfig.getServers.mockReturnValue([]);

    const result = await handleServerInfo({ action: "status" });
    const data = JSON.parse(result.content[0].text);

    expect(result.isError).toBe(true);
    expect(data.error).toBe("No servers found");
  });

  it("should return error when server not found", async () => {
    mockedConfig.getServers.mockReturnValue([sampleServer]);
    mockedConfig.findServer.mockReturnValue(undefined);

    const result = await handleServerInfo({ action: "status", server: "nonexistent" });
    const data = JSON.parse(result.content[0].text);

    expect(result.isError).toBe(true);
    expect(data.error).toContain("Server not found");
    expect(data.available_servers).toContain("coolify-test");
  });

  it("should return error when API token is missing", async () => {
    mockedConfig.getServers.mockReturnValue([sampleServer]);
    mockedConfig.findServer.mockReturnValue(sampleServer);
    delete process.env.HETZNER_TOKEN;

    const result = await handleServerInfo({ action: "status", server: "coolify-test" });
    const data = JSON.parse(result.content[0].text);

    expect(result.isError).toBe(true);
    expect(data.error).toContain("No API token");
    expect(data.hint).toContain("HETZNER_TOKEN");
  });

  it("should return single server status with token from env", async () => {
    process.env.HETZNER_TOKEN = "test-token";
    mockedConfig.getServers.mockReturnValue([sampleServer]);
    mockedConfig.findServer.mockReturnValue(sampleServer);
    (mockProvider.getServerStatus as jest.Mock).mockResolvedValue("running");
    mockedProviderFactory.createProviderWithToken.mockReturnValue(mockProvider);
    mockedAxios.get.mockResolvedValueOnce({ status: 200 });

    const result = await handleServerInfo({ action: "status", server: "coolify-test" });
    const data = JSON.parse(result.content[0].text);

    expect(result.isError).toBeUndefined();
    expect(data.results).toHaveLength(1);
    expect(data.results[0].serverStatus).toBe("running");
    expect(data.results[0].coolifyStatus).toBe("running");
    expect(data.summary.running).toBe(1);
  });

  it("should return all servers status", async () => {
    process.env.HETZNER_TOKEN = "h-token";
    process.env.DIGITALOCEAN_TOKEN = "do-token";
    mockedConfig.getServers.mockReturnValue([sampleServer, sampleServer2]);
    (mockProvider.getServerStatus as jest.Mock).mockResolvedValue("running");
    mockedProviderFactory.createProviderWithToken.mockReturnValue(mockProvider);
    mockedAxios.get.mockResolvedValue({ status: 200 });

    const result = await handleServerInfo({ action: "status" });
    const data = JSON.parse(result.content[0].text);

    expect(data.results).toHaveLength(2);
    expect(data.summary.total).toBe(2);
    expect(data.summary.running).toBe(2);
  });

  it("should return error when tokens missing for all-servers status", async () => {
    delete process.env.HETZNER_TOKEN;
    mockedConfig.getServers.mockReturnValue([sampleServer]);

    const result = await handleServerInfo({ action: "status" });
    const data = JSON.parse(result.content[0].text);

    expect(result.isError).toBe(true);
    expect(data.error).toContain("Missing API tokens");
    expect(data.missing[0].provider).toBe("hetzner");
    expect(data.missing[0].envVar).toBe("HETZNER_TOKEN");
  });

  it("should work with manual servers without token", async () => {
    const manualServer = { ...sampleServer, id: "manual-abc" };
    mockedConfig.getServers.mockReturnValue([manualServer]);
    mockedConfig.findServer.mockReturnValue(manualServer);
    mockedAxios.get.mockResolvedValueOnce({ status: 200 });

    const result = await handleServerInfo({ action: "status", server: "coolify-test" });
    const data = JSON.parse(result.content[0].text);

    expect(result.isError).toBeUndefined();
    expect(data.results[0].serverStatus).toBe("unknown (manual)");
    expect(data.results[0].coolifyStatus).toBe("running");
  });

  it("should suggest autostart when coolify not reachable", async () => {
    process.env.HETZNER_TOKEN = "test-token";
    mockedConfig.getServers.mockReturnValue([sampleServer]);
    mockedConfig.findServer.mockReturnValue(sampleServer);
    (mockProvider.getServerStatus as jest.Mock).mockResolvedValue("running");
    mockedProviderFactory.createProviderWithToken.mockReturnValue(mockProvider);
    mockedAxios.get.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await handleServerInfo({ action: "status", server: "coolify-test" });
    const data = JSON.parse(result.content[0].text);

    expect(data.results[0].coolifyStatus).toBe("not reachable");
    expect(data.suggested_actions.some((a: { command: string }) => a.command.includes("--autostart"))).toBe(true);
  });
});

describe("handleServerInfo — health", () => {
  it("should return error when no servers exist", async () => {
    mockedConfig.getServers.mockReturnValue([]);

    const result = await handleServerInfo({ action: "health" });
    const data = JSON.parse(result.content[0].text);

    expect(result.isError).toBe(true);
    expect(data.error).toBe("No servers found");
  });

  it("should return error when server not found", async () => {
    mockedConfig.getServers.mockReturnValue([sampleServer]);
    mockedConfig.findServer.mockReturnValue(undefined);

    const result = await handleServerInfo({ action: "health", server: "nonexistent" });
    const data = JSON.parse(result.content[0].text);

    expect(result.isError).toBe(true);
    expect(data.error).toContain("Server not found");
  });

  it("should return single server health — running", async () => {
    mockedConfig.getServers.mockReturnValue([sampleServer]);
    mockedConfig.findServer.mockReturnValue(sampleServer);
    mockedAxios.get.mockResolvedValueOnce({ status: 200 });

    const result = await handleServerInfo({ action: "health", server: "coolify-test" });
    const data = JSON.parse(result.content[0].text);

    expect(data.coolifyStatus).toBe("running");
    expect(data.coolifyUrl).toBe("http://1.2.3.4:8000");
    expect(data.suggested_actions[0].command).toContain("8000");
  });

  it("should return single server health — not reachable", async () => {
    mockedConfig.getServers.mockReturnValue([sampleServer]);
    mockedConfig.findServer.mockReturnValue(sampleServer);
    mockedAxios.get.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await handleServerInfo({ action: "health", server: "coolify-test" });
    const data = JSON.parse(result.content[0].text);

    expect(data.coolifyStatus).toBe("not reachable");
    expect(data.coolifyUrl).toBeNull();
    expect(data.suggested_actions[0].command).toContain("--autostart");
  });

  it("should return all servers health", async () => {
    mockedConfig.getServers.mockReturnValue([sampleServer, sampleServer2]);
    mockedAxios.get
      .mockResolvedValueOnce({ status: 200 })
      .mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await handleServerInfo({ action: "health" });
    const data = JSON.parse(result.content[0].text);

    expect(data.results).toHaveLength(2);
    expect(data.summary.running).toBe(1);
    expect(data.summary.notReachable).toBe(1);
    expect(data.suggested_actions.some((a: { command: string }) => a.command.includes("--autostart"))).toBe(true);
  });

  it("should not require API tokens for health checks", async () => {
    mockedConfig.getServers.mockReturnValue([sampleServer]);
    mockedConfig.findServer.mockReturnValue(sampleServer);
    mockedAxios.get.mockResolvedValueOnce({ status: 200 });
    // No env tokens set
    delete process.env.HETZNER_TOKEN;

    const result = await handleServerInfo({ action: "health", server: "coolify-test" });
    const data = JSON.parse(result.content[0].text);

    // Health check should work without API tokens
    expect(result.isError).toBeUndefined();
    expect(data.coolifyStatus).toBe("running");
  });
});

describe("handleServerInfo — error handling", () => {
  it("should catch unexpected errors and return isError", async () => {
    mockedConfig.getServers.mockImplementation(() => {
      throw new Error("Config file corrupted");
    });

    const result = await handleServerInfo({ action: "list" });
    const data = JSON.parse(result.content[0].text);

    expect(result.isError).toBe(true);
    expect(data.error).toBe("Config file corrupted");
  });

  it("should handle non-Error thrown values", async () => {
    mockedConfig.getServers.mockImplementation(() => {
      throw "unexpected string error";
    });

    const result = await handleServerInfo({ action: "list" });
    const data = JSON.parse(result.content[0].text);

    expect(result.isError).toBe(true);
    expect(data.error).toBe("unexpected string error");
  });
});
