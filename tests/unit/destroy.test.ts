import axios from "axios";
import inquirer from "inquirer";
import { destroyCommand } from "../../src/commands/destroy";
import * as config from "../../src/utils/config";

jest.mock("../../src/utils/config");

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;
const mockedConfig = config as jest.Mocked<typeof config>;

const sampleServer = {
  id: "123",
  name: "coolify-test",
  provider: "hetzner",
  ip: "1.2.3.4",
  region: "nbg1",
  size: "cax11",
  createdAt: "2026-02-20T00:00:00Z",
};

describe("destroyCommand", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("should show error when server not found by query", async () => {
    mockedConfig.findServers.mockReturnValue([]);

    await destroyCommand("nonexistent");

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("Server not found");
  });

  it("should show info when no servers exist and no query", async () => {
    mockedConfig.getServers.mockReturnValue([]);

    await destroyCommand();

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("No servers found");
  });

  it("should cancel when user declines first confirmation", async () => {
    mockedConfig.findServers.mockReturnValue([sampleServer]);

    mockedInquirer.prompt.mockResolvedValueOnce({ confirm: false });

    await destroyCommand("1.2.3.4");

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("cancelled");
    expect(mockedAxios.delete).not.toHaveBeenCalled();
  });

  it("should cancel when server name does not match", async () => {
    mockedConfig.findServers.mockReturnValue([sampleServer]);

    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ confirmName: "wrong-name" });

    await destroyCommand("1.2.3.4");

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("does not match");
    expect(mockedAxios.delete).not.toHaveBeenCalled();
  });

  it("should destroy server successfully", async () => {
    mockedConfig.findServers.mockReturnValue([sampleServer]);
    mockedConfig.removeServer.mockReturnValue(true);

    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ confirmName: "coolify-test" })
      .mockResolvedValueOnce({ apiToken: "test-token" });

    mockedAxios.delete.mockResolvedValueOnce({});

    await destroyCommand("1.2.3.4");

    expect(mockedAxios.delete).toHaveBeenCalled();
    expect(mockedConfig.removeServer).toHaveBeenCalledWith("123");

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("removed");
  });

  it("should handle API error during destroy", async () => {
    mockedConfig.findServers.mockReturnValue([sampleServer]);

    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ confirmName: "coolify-test" })
      .mockResolvedValueOnce({ apiToken: "test-token" })
      .mockResolvedValueOnce({ removeLocal: false });

    mockedAxios.delete.mockRejectedValueOnce(new Error("API Error"));

    await destroyCommand("1.2.3.4");

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("Failed to destroy");
  });

  it("should remove from local config when user confirms after API error", async () => {
    mockedConfig.findServers.mockReturnValue([sampleServer]);
    mockedConfig.removeServer.mockReturnValue(true);

    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ confirmName: "coolify-test" })
      .mockResolvedValueOnce({ apiToken: "test-token" })
      .mockResolvedValueOnce({ removeLocal: true });

    mockedAxios.delete.mockRejectedValueOnce(new Error("API Error"));

    await destroyCommand("1.2.3.4");

    expect(mockedConfig.removeServer).toHaveBeenCalledWith("123");
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("Removed from local config");
  });

  it("should remove from local config when server not found on provider", async () => {
    mockedConfig.findServers.mockReturnValue([sampleServer]);
    mockedConfig.removeServer.mockReturnValue(true);

    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ confirmName: "coolify-test" })
      .mockResolvedValueOnce({ apiToken: "test-token" });

    mockedAxios.delete.mockRejectedValueOnce(
      new Error("Failed to destroy server: server not found"),
    );

    await destroyCommand("1.2.3.4");

    expect(mockedConfig.removeServer).toHaveBeenCalledWith("123");
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("Removed from local config");
  });

  it("should allow interactive server selection", async () => {
    mockedConfig.getServers.mockReturnValue([sampleServer]);
    mockedConfig.removeServer.mockReturnValue(true);

    mockedInquirer.prompt
      .mockResolvedValueOnce({ serverId: "123" })
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ confirmName: "coolify-test" })
      .mockResolvedValueOnce({ apiToken: "test-token" });

    mockedAxios.delete.mockResolvedValueOnce({});

    await destroyCommand();

    expect(mockedAxios.delete).toHaveBeenCalled();
  });
});
