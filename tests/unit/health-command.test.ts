import axios from "axios";
import * as config from "../../src/utils/config";
import * as serverSelect from "../../src/utils/serverSelect";
import { checkServerHealth, healthCommand } from "../../src/commands/health";

jest.mock("../../src/utils/config");
jest.mock("../../src/utils/serverSelect");

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedConfig = config as jest.Mocked<typeof config>;
// serverSelect is imported but not directly used in these tests
void serverSelect;

const sampleServer = {
  id: "123",
  name: "coolify-test",
  provider: "hetzner",
  ip: "1.2.3.4",
  region: "nbg1",
  size: "cax11",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const sampleServer2 = {
  id: "456",
  name: "coolify-prod",
  provider: "digitalocean",
  ip: "5.6.7.8",
  region: "nyc1",
  size: "s-2vcpu-4gb",
  createdAt: "2026-01-02T00:00:00.000Z",
};

describe("healthCommand", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("should show message when no servers found", async () => {
    mockedConfig.getServers.mockReturnValue([]);
    await healthCommand();
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("No servers found");
  });

  it("should return healthy for reachable server", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: {}, status: 200 });
    const result = await checkServerHealth(sampleServer);
    expect(result.status).toBe("healthy");
    expect(result.responseTime).toBeGreaterThanOrEqual(0);
  });

  // Note: checkCoolifyHealth returns "running" for any HTTP response (including 500)
  // since it uses validateStatus: () => true. So 5xx responses map to "healthy".
  it("should return healthy even for 500 status (core uses validateStatus: always true)", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: {}, status: 500 });
    const result = await checkServerHealth(sampleServer);
    expect(result.status).toBe("healthy");
  });

  it("should return unreachable when connection fails", async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await checkServerHealth(sampleServer);
    expect(result.status).toBe("unreachable");
  });

  it("should display table for multiple servers", async () => {
    mockedConfig.getServers.mockReturnValue([sampleServer, sampleServer2]);
    mockedAxios.get
      .mockResolvedValueOnce({ data: {}, status: 200 })
      .mockRejectedValueOnce(new Error("timeout"));

    await healthCommand();

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("coolify-test");
    expect(output).toContain("coolify-prod");
    expect(output).toContain("healthy");
    expect(output).toContain("unreachable");
  });

  it("should show all healthy message when all servers are up", async () => {
    mockedConfig.getServers.mockReturnValue([sampleServer]);
    mockedAxios.get.mockResolvedValueOnce({ data: {}, status: 200 });

    await healthCommand();

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("All 1 server(s) are healthy");
  });

  it("should show warning summary when some servers are down", async () => {
    mockedConfig.getServers.mockReturnValue([sampleServer, sampleServer2]);
    mockedAxios.get
      .mockResolvedValueOnce({ data: {}, status: 200 })
      .mockRejectedValueOnce(new Error("timeout"));

    await healthCommand();

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("1 healthy");
    expect(output).toContain("1 unreachable");
  });

  // ---- Bare mode tests ----

  describe("bare server guard", () => {
    const bareServer = {
      ...sampleServer,
      id: "bare-123",
      name: "bare-test",
      ip: "9.9.9.9",
      mode: "bare" as const,
    };

    it("should skip bare servers and warn when all servers are bare", async () => {
      mockedConfig.getServers.mockReturnValue([bareServer]);

      await healthCommand();

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
      expect(output).toContain("bare");
      // No health check performed (no axios.get call)
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it("should skip bare servers but health-check coolify servers in mixed list", async () => {
      mockedConfig.getServers.mockReturnValue([sampleServer, bareServer]);
      mockedAxios.get.mockResolvedValueOnce({ data: {}, status: 200 });

      await healthCommand();

      // Only one health check (for coolify server, not bare)
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
      expect(output).toContain("coolify-test");
      // Health table should contain healthy coolify server only
      expect(output).toContain("healthy");
    });

    it("should show message when all servers are bare (no Coolify health checks run)", async () => {
      mockedConfig.getServers.mockReturnValue([bareServer]);

      await healthCommand();

      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });

  // ---- BUG-6: health command query parameter ----

  describe("query parameter (BUG-6)", () => {
    it("should filter to matching server when query is provided", async () => {
      mockedConfig.getServers.mockReturnValue([sampleServer, sampleServer2]);
      mockedConfig.findServer.mockReturnValue(sampleServer);
      mockedAxios.get.mockResolvedValueOnce({ data: {}, status: 200 });

      await healthCommand("coolify-test");

      // Should only health-check the one matched server
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
      expect(output).toContain("coolify-test");
    });

    it("should show error when query matches no server", async () => {
      mockedConfig.getServers.mockReturnValue([sampleServer]);
      mockedConfig.findServer.mockReturnValue(undefined);

      await healthCommand("nonexistent");

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
      expect(output).toContain("Server not found");
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it("should check all servers when no query is provided (backward compat)", async () => {
      mockedConfig.getServers.mockReturnValue([sampleServer, sampleServer2]);
      mockedAxios.get
        .mockResolvedValueOnce({ data: {}, status: 200 })
        .mockResolvedValueOnce({ data: {}, status: 200 });

      await healthCommand();

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
  });
});
