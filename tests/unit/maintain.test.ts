import axios from "axios";
import * as config from "../../src/utils/config";
import * as sshUtils from "../../src/utils/ssh";
import { maintainCommand } from "../../src/commands/maintain";

jest.mock("../../src/utils/config");
jest.mock("../../src/utils/ssh");

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedConfig = config as jest.Mocked<typeof config>;
const mockedSsh = sshUtils as jest.Mocked<typeof sshUtils>;

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

describe("maintainCommand", () => {
  let consoleSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  const originalSetTimeout = global.setTimeout;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    jest.clearAllMocks();
    // Make setTimeout instant for tests
    global.setTimeout = ((fn: Function) => {
      fn();
      return 0;
    }) as any;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    global.setTimeout = originalSetTimeout;
  });

  it("should show error when SSH not available", async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(false);
    await maintainCommand();
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("SSH client not found");
  });

  it("should return when no server found", async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServers.mockReturnValue([]);
    await maintainCommand("nonexistent");
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("Server not found");
  });

  it("should show dry-run output for single server", async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServers.mockReturnValue([sampleServer]);

    await maintainCommand("1.2.3.4", { dryRun: true });

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("Dry Run");
    expect(output).toContain("Step 0");
    expect(output).toContain("Step 1");
    expect(output).toContain("Step 2");
    expect(output).toContain("Step 3");
    expect(output).toContain("Step 4");
    expect(output).toContain("Step 5");
    expect(output).toContain("No changes applied");
    expect(mockedSsh.sshExec).not.toHaveBeenCalled();
  });

  it("should show dry-run with skip-reboot marking steps 4 and 5 as SKIPPED", async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServers.mockReturnValue([sampleServer]);

    await maintainCommand("1.2.3.4", { dryRun: true, skipReboot: true });

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("SKIPPED");
    expect(output).toContain("--skip-reboot");
    expect(mockedSsh.sshExec).not.toHaveBeenCalled();
  });

  it("should abort when server status check fails (not running)", async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServers.mockReturnValue([sampleServer]);

    // promptApiToken via env or prompt
    mockedConfig.findServers.mockReturnValue([sampleServer]);
    const inquirer = await import("inquirer");
    (inquirer as any).default.prompt = jest.fn().mockResolvedValueOnce({ apiToken: "test-token" });

    // Step 0: snapshot cost estimate (fails -> skipped)
    mockedAxios.get.mockRejectedValueOnce(new Error("snapshot cost"));
    // getServerStatus returns "off"
    mockedAxios.get.mockResolvedValueOnce({ data: { server: { status: "off" } } });

    await maintainCommand("1.2.3.4");

    // sshExec should NOT have been called since server is not running
    expect(mockedSsh.sshExec).not.toHaveBeenCalled();
  });

  it("should abort when server status check throws an error", async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServers.mockReturnValue([sampleServer]);

    const inquirer = await import("inquirer");
    (inquirer as any).default.prompt = jest.fn().mockResolvedValueOnce({ apiToken: "test-token" });

    // Step 0: snapshot cost estimate (fails -> skipped)
    mockedAxios.get.mockRejectedValueOnce(new Error("snapshot cost"));
    // getServerStatus throws
    mockedAxios.get.mockRejectedValueOnce(new Error("Unauthorized"));

    await maintainCommand("1.2.3.4");

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("Unauthorized");
    expect(mockedSsh.sshExec).not.toHaveBeenCalled();
  });

  it("should abort when Coolify update fails (non-zero exit)", async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServers.mockReturnValue([sampleServer]);

    const inquirer = await import("inquirer");
    (inquirer as any).default.prompt = jest.fn().mockResolvedValueOnce({ apiToken: "test-token" });

    // Step 0: snapshot cost estimate (fails -> skipped)
    mockedAxios.get.mockRejectedValueOnce(new Error("snapshot cost"));
    // getServerStatus returns "running"
    mockedAxios.get.mockResolvedValueOnce({ data: { server: { status: "running" } } });

    // sshExec update fails
    mockedSsh.sshExec.mockResolvedValueOnce({ code: 1, stdout: "", stderr: "update error" });

    await maintainCommand("1.2.3.4");

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("update error");
  });

  it("should abort when Coolify update throws an exception", async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServers.mockReturnValue([sampleServer]);

    const inquirer = await import("inquirer");
    (inquirer as any).default.prompt = jest.fn().mockResolvedValueOnce({ apiToken: "test-token" });

    // Step 0: snapshot cost estimate (fails -> skipped)
    mockedAxios.get.mockRejectedValueOnce(new Error("snapshot cost"));
    // getServerStatus returns "running"
    mockedAxios.get.mockResolvedValueOnce({ data: { server: { status: "running" } } });

    // sshExec throws
    mockedSsh.sshExec.mockRejectedValueOnce(new Error("SSH connection lost"));

    await maintainCommand("1.2.3.4");

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("SSH connection lost");
  });

  it("should show SSH hint when Coolify update throws connection refused", async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServers.mockReturnValue([sampleServer]);

    const inquirer = await import("inquirer");
    (inquirer as any).default.prompt = jest.fn().mockResolvedValueOnce({ apiToken: "test-token" });

    // Step 0: snapshot cost estimate (fails -> skipped)
    mockedAxios.get.mockRejectedValueOnce(new Error("snapshot cost"));
    // getServerStatus returns "running"
    mockedAxios.get.mockResolvedValueOnce({ data: { server: { status: "running" } } });

    // sshExec throws with matching SSH pattern
    mockedSsh.sshExec.mockRejectedValueOnce(new Error("Connection refused"));

    await maintainCommand("1.2.3.4");

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("SSH connection refused");
  });

  it("should abort when health check fails after update", async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServers.mockReturnValue([sampleServer]);

    const inquirer = await import("inquirer");
    (inquirer as any).default.prompt = jest.fn().mockResolvedValueOnce({ apiToken: "test-token" });

    // Step 0: snapshot cost estimate (fails -> skipped)
    mockedAxios.get.mockRejectedValueOnce(new Error("snapshot cost"));
    // Step 1: getServerStatus returns "running"
    mockedAxios.get.mockResolvedValueOnce({ data: { server: { status: "running" } } });

    // Step 2: update succeeds
    mockedSsh.sshExec.mockResolvedValueOnce({ code: 0, stdout: "ok", stderr: "" });

    // Step 3: health check - all attempts fail
    mockedAxios.get.mockRejectedValue(new Error("ECONNREFUSED"));

    await maintainCommand("1.2.3.4");

    // Verify update was called
    expect(mockedSsh.sshExec).toHaveBeenCalledTimes(1);
  });

  it("should complete full maintenance with reboot", async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServers.mockReturnValue([sampleServer]);

    const inquirer = await import("inquirer");
    (inquirer as any).default.prompt = jest.fn().mockResolvedValueOnce({ apiToken: "test-token" });

    // Step 0: snapshot cost estimate (fails -> skipped)
    mockedAxios.get.mockRejectedValueOnce(new Error("snapshot cost"));
    // Step 1: getServerStatus "running"
    mockedAxios.get.mockResolvedValueOnce({ data: { server: { status: "running" } } });

    // Step 2: update succeeds
    mockedSsh.sshExec.mockResolvedValueOnce({ code: 0, stdout: "updated", stderr: "" });

    // Step 3: health check succeeds (first poll)
    mockedAxios.get.mockResolvedValueOnce({ status: 200 });

    // Step 4: reboot succeeds
    mockedAxios.post.mockResolvedValueOnce({ data: { action: { id: 1 } } });

    // Step 5: getServerStatus "running" after reboot
    mockedAxios.get.mockResolvedValueOnce({ data: { server: { status: "running" } } });

    // Step 5: Coolify health after reboot
    mockedAxios.get.mockResolvedValueOnce({ status: 200 });

    await maintainCommand("1.2.3.4");

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("Maintenance Report");
    expect(output).toContain("status OK");
    expect(output).toContain("update OK");
    expect(output).toContain("health OK");
    expect(output).toContain("reboot OK");
    expect(output).toContain("final OK");
  });

  it("should complete maintenance with --skip-reboot", async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServers.mockReturnValue([sampleServer]);

    const inquirer = await import("inquirer");
    (inquirer as any).default.prompt = jest.fn().mockResolvedValueOnce({ apiToken: "test-token" });

    // Step 0: snapshot cost estimate (fails -> skipped)
    mockedAxios.get.mockRejectedValueOnce(new Error("snapshot cost"));
    // Step 1: getServerStatus "running"
    mockedAxios.get.mockResolvedValueOnce({ data: { server: { status: "running" } } });

    // Step 2: update succeeds
    mockedSsh.sshExec.mockResolvedValueOnce({ code: 0, stdout: "updated", stderr: "" });

    // Step 3: health check succeeds
    mockedAxios.get.mockResolvedValueOnce({ status: 200 });

    await maintainCommand("1.2.3.4", { skipReboot: true });

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("Maintenance Report");
    expect(output).toContain("reboot SKIP");
    expect(output).toContain("final SKIP");
    // reboot API should NOT have been called
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("should handle reboot API failure", async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServers.mockReturnValue([sampleServer]);

    const inquirer = await import("inquirer");
    (inquirer as any).default.prompt = jest.fn().mockResolvedValueOnce({ apiToken: "test-token" });

    // Step 0: snapshot cost estimate (fails -> skipped)
    mockedAxios.get.mockRejectedValueOnce(new Error("snapshot cost"));
    // Step 1: running
    mockedAxios.get.mockResolvedValueOnce({ data: { server: { status: "running" } } });
    // Step 2: update OK
    mockedSsh.sshExec.mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" });
    // Step 3: health OK
    mockedAxios.get.mockResolvedValueOnce({ status: 200 });
    // Step 4: reboot fails
    mockedAxios.post.mockRejectedValueOnce(new Error("Reboot API error"));

    await maintainCommand("1.2.3.4");

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("Reboot API error");
    expect(output).toContain("reboot FAIL");
  });

  it("should handle final check when server does not come back", async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServers.mockReturnValue([sampleServer]);

    const inquirer = await import("inquirer");
    (inquirer as any).default.prompt = jest.fn().mockResolvedValueOnce({ apiToken: "test-token" });

    // Step 0: snapshot cost estimate (fails -> skipped)
    mockedAxios.get.mockRejectedValueOnce(new Error("snapshot cost"));
    // Step 1: running
    mockedAxios.get.mockResolvedValueOnce({ data: { server: { status: "running" } } });
    // Step 2: update OK
    mockedSsh.sshExec.mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" });
    // Step 3: health OK
    mockedAxios.get.mockResolvedValueOnce({ status: 200 });
    // Step 4: reboot OK
    mockedAxios.post.mockResolvedValueOnce({ data: { action: { id: 1 } } });
    // Step 5: server never comes back (all polls return "off")
    mockedAxios.get.mockResolvedValue({ data: { server: { status: "off" } } });

    await maintainCommand("1.2.3.4");

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("final FAIL");
  });

  it("should handle final check when server is back but Coolify is not responding", async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServers.mockReturnValue([sampleServer]);

    const inquirer = await import("inquirer");
    (inquirer as any).default.prompt = jest.fn().mockResolvedValueOnce({ apiToken: "test-token" });

    // Step 0: snapshot cost estimate (fails -> skipped)
    mockedAxios.get.mockRejectedValueOnce(new Error("snapshot cost"));
    // Step 1: running
    mockedAxios.get.mockResolvedValueOnce({ data: { server: { status: "running" } } });
    // Step 2: update OK
    mockedSsh.sshExec.mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" });
    // Step 3: health check pass
    mockedAxios.get.mockResolvedValueOnce({ status: 200 });
    // Step 4: reboot OK
    mockedAxios.post.mockResolvedValueOnce({ data: { action: { id: 1 } } });
    // Step 5: server is running
    mockedAxios.get.mockResolvedValueOnce({ data: { server: { status: "running" } } });
    // Step 5: Coolify health check fails (all polls)
    mockedAxios.get.mockRejectedValue(new Error("ECONNREFUSED"));

    await maintainCommand("1.2.3.4");

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    // finalCheck is false because Coolify didn't respond, report shows "final FAIL"
    // The spinner.warn message is not captured by consoleSpy (ora mock behavior)
    expect(output).toContain("final FAIL");
    expect(output).toContain("reboot OK");
  });

  it("should show snapshot step 0 message", async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServers.mockReturnValue([sampleServer]);

    const inquirer = await import("inquirer");
    (inquirer as any).default.prompt = jest.fn().mockResolvedValueOnce({ apiToken: "test-token" });

    // Step 0: snapshot cost estimate (fails -> skipped)
    mockedAxios.get.mockRejectedValueOnce(new Error("snapshot cost"));
    // Fail at step 1 to keep test short
    mockedAxios.get.mockRejectedValueOnce(new Error("fail"));

    await maintainCommand("1.2.3.4");

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("snapshot");
    expect(output).toContain("Could not estimate snapshot cost");
  });

  // --all tests
  describe("--all flag", () => {
    it("should show error when SSH not available", async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(false);
      await maintainCommand(undefined, { all: true });
      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
      expect(output).toContain("SSH client not found");
    });

    it("should return when no servers found", async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.getServers.mockReturnValue([]);
      await maintainCommand(undefined, { all: true });
      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
      expect(output).toContain("No servers found");
    });

    it("should show dry-run for all servers", async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.getServers.mockReturnValue([sampleServer, sampleServer2]);

      const inquirer = await import("inquirer");
      (inquirer as any).default.prompt = jest
        .fn()
        .mockResolvedValueOnce({ apiToken: "hetzner-token" })
        .mockResolvedValueOnce({ apiToken: "do-token" });

      await maintainCommand(undefined, { all: true, dryRun: true });

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
      expect(output).toContain("coolify-test");
      expect(output).toContain("coolify-prod");
      expect(output).toContain("Dry Run");
      expect(mockedSsh.sshExec).not.toHaveBeenCalled();
    });

    it("should maintain all servers sequentially", async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.getServers.mockReturnValue([sampleServer]);

      const inquirer = await import("inquirer");
      (inquirer as any).default.prompt = jest
        .fn()
        .mockResolvedValueOnce({ apiToken: "test-token" });

      // Step 1: running
      mockedAxios.get.mockResolvedValueOnce({ data: { server: { status: "running" } } });
      // Step 2: update OK
      mockedSsh.sshExec.mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" });
      // Step 3: health OK
      mockedAxios.get.mockResolvedValueOnce({ status: 200 });
      // Step 4: reboot
      mockedAxios.post.mockResolvedValueOnce({ data: { action: { id: 1 } } });
      // Step 5: server running
      mockedAxios.get.mockResolvedValueOnce({ data: { server: { status: "running" } } });
      // Step 5: coolify OK
      mockedAxios.get.mockResolvedValueOnce({ status: 200 });

      await maintainCommand(undefined, { all: true });

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
      expect(output).toContain("Maintenance Report");
      expect(output).toContain("status OK");
    });

    it("should maintain all with --skip-reboot", async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(true);
      mockedConfig.getServers.mockReturnValue([sampleServer]);

      const inquirer = await import("inquirer");
      (inquirer as any).default.prompt = jest
        .fn()
        .mockResolvedValueOnce({ apiToken: "test-token" });

      // Step 1: running
      mockedAxios.get.mockResolvedValueOnce({ data: { server: { status: "running" } } });
      // Step 2: update OK
      mockedSsh.sshExec.mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" });
      // Step 3: health OK
      mockedAxios.get.mockResolvedValueOnce({ status: 200 });

      await maintainCommand(undefined, { all: true, skipReboot: true });

      const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
      expect(output).toContain("reboot SKIP");
      expect(output).toContain("final SKIP");
    });
  });

  it("should handle final check exception", async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServers.mockReturnValue([sampleServer]);

    const inquirer = await import("inquirer");
    (inquirer as any).default.prompt = jest.fn().mockResolvedValueOnce({ apiToken: "test-token" });

    // Step 0: snapshot cost estimate (fails -> skipped)
    mockedAxios.get.mockRejectedValueOnce(new Error("snapshot cost"));
    // Step 1: running
    mockedAxios.get.mockResolvedValueOnce({ data: { server: { status: "running" } } });
    // Step 2: update OK
    mockedSsh.sshExec.mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" });
    // Step 3: health OK
    mockedAxios.get.mockResolvedValueOnce({ status: 200 });
    // Step 4: reboot OK
    mockedAxios.post.mockResolvedValueOnce({ data: { action: { id: 1 } } });
    // Step 5: getServerStatus throws permanently
    mockedAxios.get.mockRejectedValue(new Error("Network error"));

    await maintainCommand("1.2.3.4");

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    // The outer catch for final check should show the error
    expect(output).toContain("Maintenance Report");
  });

  it("should report failed maintenance in report", async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServers.mockReturnValue([sampleServer]);

    const inquirer = await import("inquirer");
    (inquirer as any).default.prompt = jest.fn().mockResolvedValueOnce({ apiToken: "test-token" });

    // Step 0: snapshot cost estimate (fails -> skipped)
    mockedAxios.get.mockRejectedValueOnce(new Error("snapshot cost"));
    // Step 1: not running
    mockedAxios.get.mockResolvedValueOnce({ data: { server: { status: "off" } } });

    await maintainCommand("1.2.3.4");

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("Maintenance Report");
    expect(output).toContain("status FAIL");
  });

  it("should include SSH setup help messages", async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(false);
    await maintainCommand();
    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("Windows:");
    expect(output).toContain("Linux/macOS:");
  });

  it("should show update stderr when update fails", async () => {
    mockedSsh.checkSshAvailable.mockReturnValue(true);
    mockedConfig.findServers.mockReturnValue([sampleServer]);

    const inquirer = await import("inquirer");
    (inquirer as any).default.prompt = jest.fn().mockResolvedValueOnce({ apiToken: "test-token" });

    // Step 0: snapshot cost estimate (fails -> skipped)
    mockedAxios.get.mockRejectedValueOnce(new Error("snapshot cost"));
    // Step 1: running
    mockedAxios.get.mockResolvedValueOnce({ data: { server: { status: "running" } } });
    // Step 2: update fails with stderr
    mockedSsh.sshExec.mockResolvedValueOnce({
      code: 1,
      stdout: "",
      stderr: "  curl: network error  ",
    });

    await maintainCommand("1.2.3.4");

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("curl: network error");
  });
});
