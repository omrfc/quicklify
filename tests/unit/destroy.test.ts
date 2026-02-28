import inquirer from "inquirer";
import { destroyCommand } from "../../src/commands/destroy";
import * as coreManage from "../../src/core/manage";
import * as serverSelect from "../../src/utils/serverSelect";

jest.mock("../../src/core/manage");
jest.mock("../../src/utils/serverSelect");

const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;
const mockedCoreManage = coreManage as jest.Mocked<typeof coreManage>;
const mockedServerSelect = serverSelect as jest.Mocked<typeof serverSelect>;

const sampleServer = {
  id: "123",
  name: "coolify-test",
  provider: "hetzner",
  ip: "1.2.3.4",
  region: "nbg1",
  size: "cax11",
  createdAt: "2026-02-20T00:00:00Z",
};

const destroySuccessResult = {
  success: true,
  server: sampleServer,
  cloudDeleted: true,
  localRemoved: true,
};

const destroyNotFoundResult = {
  success: true,
  server: sampleServer,
  cloudDeleted: false,
  localRemoved: true,
  hint: "Server not found on hetzner (may have been deleted manually). Removed from local config.",
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
    // resolveServer returns undefined — server lookup shows "Server not found" inside resolveServer
    // which is mocked, so we verify no further action is taken
    mockedServerSelect.resolveServer.mockResolvedValue(undefined);

    await destroyCommand("nonexistent");

    // No destroy attempted, no prompts asked
    expect(mockedCoreManage.destroyCloudServer).not.toHaveBeenCalled();
    expect(mockedInquirer.prompt).not.toHaveBeenCalled();
  });

  it("should show info when no servers exist and no query", async () => {
    mockedServerSelect.resolveServer.mockResolvedValue(undefined);

    await destroyCommand();

    // resolveServer returns undefined -> early return, no destroy called
    expect(mockedCoreManage.destroyCloudServer).not.toHaveBeenCalled();
  });

  it("should cancel when user declines first confirmation", async () => {
    mockedServerSelect.resolveServer.mockResolvedValue(sampleServer);
    mockedInquirer.prompt.mockResolvedValueOnce({ confirm: false });

    await destroyCommand("1.2.3.4");

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("cancelled");
    expect(mockedCoreManage.destroyCloudServer).not.toHaveBeenCalled();
  });

  it("should cancel when server name does not match", async () => {
    mockedServerSelect.resolveServer.mockResolvedValue(sampleServer);
    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ confirmName: "wrong-name" });

    await destroyCommand("1.2.3.4");

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("does not match");
    expect(mockedCoreManage.destroyCloudServer).not.toHaveBeenCalled();
  });

  it("should destroy server successfully", async () => {
    mockedServerSelect.resolveServer.mockResolvedValue(sampleServer);
    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ confirmName: "coolify-test" });
    mockedCoreManage.destroyCloudServer.mockResolvedValue(destroySuccessResult);

    await destroyCommand("1.2.3.4");

    expect(mockedCoreManage.destroyCloudServer).toHaveBeenCalledWith("coolify-test");
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    // logger.success output is captured (spinner.succeed text is from ora, not console.log)
    expect(output).toContain("removed from your cloud provider");
  });

  it("should handle API error during destroy", async () => {
    mockedServerSelect.resolveServer.mockResolvedValue(sampleServer);
    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ confirmName: "coolify-test" })
      .mockResolvedValueOnce({ removeLocal: false });
    mockedCoreManage.destroyCloudServer.mockResolvedValue({
      success: false,
      server: sampleServer,
      cloudDeleted: false,
      localRemoved: false,
      error: "API Error",
    });

    await destroyCommand("1.2.3.4");

    // logger.error("API Error") is captured via console.log
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("API Error");
  });

  it("should remove from local config when user confirms after API error", async () => {
    mockedServerSelect.resolveServer.mockResolvedValue(sampleServer);
    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ confirmName: "coolify-test" })
      .mockResolvedValueOnce({ removeLocal: true });
    mockedCoreManage.destroyCloudServer.mockResolvedValue({
      success: false,
      server: sampleServer,
      cloudDeleted: false,
      localRemoved: false,
      error: "API Error",
    });
    mockedCoreManage.removeServerRecord.mockReturnValue({
      success: true,
      server: sampleServer,
    });

    await destroyCommand("1.2.3.4");

    expect(mockedCoreManage.removeServerRecord).toHaveBeenCalledWith("coolify-test");
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("Removed from local config");
  });

  it("should remove from local config when server not found on provider", async () => {
    mockedServerSelect.resolveServer.mockResolvedValue(sampleServer);
    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ confirmName: "coolify-test" });
    mockedCoreManage.destroyCloudServer.mockResolvedValue(destroyNotFoundResult);

    await destroyCommand("1.2.3.4");

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("Removed from local config");
  });

  it("should allow interactive server selection", async () => {
    mockedServerSelect.resolveServer.mockResolvedValue(sampleServer);
    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ confirmName: "coolify-test" });
    mockedCoreManage.destroyCloudServer.mockResolvedValue(destroySuccessResult);

    await destroyCommand();

    expect(mockedServerSelect.resolveServer).toHaveBeenCalledWith(
      undefined,
      "Select a server to destroy:",
    );
    expect(mockedCoreManage.destroyCloudServer).toHaveBeenCalledWith("coolify-test");
  });

  // ---- BARE-03 regression: destroy works on bare servers ----

  it("should destroy bare-mode server successfully (BARE-03 regression)", async () => {
    const bareServer = { ...sampleServer, mode: "bare" as const };
    const bareDestroyResult = {
      success: true,
      server: bareServer,
      cloudDeleted: true,
      localRemoved: true,
    };

    mockedServerSelect.resolveServer.mockResolvedValue(bareServer);
    mockedInquirer.prompt
      .mockResolvedValueOnce({ confirm: true })
      .mockResolvedValueOnce({ confirmName: "coolify-test" });
    mockedCoreManage.destroyCloudServer.mockResolvedValue(bareDestroyResult);

    await destroyCommand("1.2.3.4");

    expect(mockedCoreManage.destroyCloudServer).toHaveBeenCalledWith("coolify-test");
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("removed from your cloud provider");
  });
});
