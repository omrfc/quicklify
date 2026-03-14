import * as backupScheduleCore from "../../src/core/backupSchedule";
import * as sshUtils from "../../src/utils/ssh";
import * as serverSelect from "../../src/utils/serverSelect";
import * as loggerUtils from "../../src/utils/logger";
import { backupCommand } from "../../src/commands/backup";

jest.mock("../../src/core/backupSchedule");
jest.mock("../../src/utils/ssh");
jest.mock("../../src/utils/serverSelect");
jest.mock("../../src/utils/logger");
// These are used by existing backup logic — mock to avoid side effects
jest.mock("../../src/utils/config", () => ({
  getServers: jest.fn(() => []),
  CONFIG_DIR: "/tmp/kastell-test",
}));
jest.mock("../../src/utils/modeGuard", () => ({
  isBareServer: jest.fn(() => false),
}));
jest.mock("../../src/adapters/factory", () => ({
  resolvePlatform: jest.fn(() => null),
  getAdapter: jest.fn(),
}));
jest.mock("../../src/core/backup", () => ({
  formatTimestamp: jest.fn(() => "2026-01-01_00-00-00-000"),
  getBackupDir: jest.fn(() => "/tmp/backups/my-server"),
  buildPgDumpCommand: jest.fn(),
  buildConfigTarCommand: jest.fn(),
  buildCleanupCommand: jest.fn(),
  buildCoolifyVersionCommand: jest.fn(),
  listBackups: jest.fn(() => []),
  scpDownload: jest.fn(),
  createBareBackup: jest.fn(),
  listOrphanBackups: jest.fn(() => []),
  cleanupServerBackups: jest.fn(),
}));
jest.mock("inquirer", () => ({
  default: { prompt: jest.fn() },
  prompt: jest.fn(),
}));

const mockedCore = backupScheduleCore as jest.Mocked<typeof backupScheduleCore>;
const mockedSsh = sshUtils as jest.Mocked<typeof sshUtils>;
const mockedServerSelect = serverSelect as jest.Mocked<typeof serverSelect>;
const mockedLogger = loggerUtils as jest.Mocked<typeof loggerUtils>;

const sampleServer = {
  id: "abc",
  name: "my-server",
  provider: "hetzner" as const,
  ip: "1.2.3.4",
  region: "nbg1",
  size: "cax11",
  createdAt: "2026-01-01T00:00:00.000Z",
  mode: "bare" as const,
};

const mockSpinner = {
  start: jest.fn().mockReturnThis(),
  succeed: jest.fn().mockReturnThis(),
  fail: jest.fn().mockReturnThis(),
  stop: jest.fn().mockReturnThis(),
  warn: jest.fn().mockReturnThis(),
};

describe("backupCommand --schedule option routing", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    consoleSpy = jest.spyOn(console, "log").mockImplementation();

    // Default SSH available
    mockedSsh.checkSshAvailable.mockReturnValue(true);

    // Default spinner
    mockedLogger.createSpinner.mockReturnValue(mockSpinner as any);

    // Default server resolution
    mockedServerSelect.resolveServer.mockResolvedValue(sampleServer);

    // Default core function mocks
    mockedCore.validateCronExpr.mockReturnValue({ valid: true });
    mockedCore.scheduleBackup.mockResolvedValue({ success: true });
    mockedCore.listBackupSchedule.mockResolvedValue({
      success: true,
      cronExpr: "0 3 * * *",
      localCronExpr: "0 3 * * *",
    });
    mockedCore.removeBackupSchedule.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe("schedule cron expression", () => {
    it("resolves server and calls scheduleBackup with cron expression", async () => {
      await backupCommand("my-server", { schedule: "0 3 * * *" });

      expect(mockedServerSelect.resolveServer).toHaveBeenCalledWith(
        "my-server",
        expect.any(String),
      );
      expect(mockedCore.scheduleBackup).toHaveBeenCalledWith(
        sampleServer.ip,
        sampleServer.name,
        "0 3 * * *",
      );
    });

    it("starts spinner and calls spinner.succeed on success", async () => {
      await backupCommand("my-server", { schedule: "0 3 * * *" });

      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalled();
      expect(mockSpinner.fail).not.toHaveBeenCalled();
    });

    it("calls spinner.fail with error when scheduleBackup fails", async () => {
      mockedCore.scheduleBackup.mockResolvedValue({
        success: false,
        error: "SSH connection refused",
      });

      await backupCommand("my-server", { schedule: "0 3 * * *" });

      expect(mockSpinner.fail).toHaveBeenCalled();
      expect(mockSpinner.succeed).not.toHaveBeenCalled();
    });

    it("logs hint when scheduleBackup returns hint on failure", async () => {
      mockedCore.scheduleBackup.mockResolvedValue({
        success: false,
        error: "Failed to install cron",
        hint: "Check cron daemon",
      });

      await backupCommand("my-server", { schedule: "0 3 * * *" });

      expect(mockedLogger.logger.info).toHaveBeenCalledWith("Check cron daemon");
    });

    it("shows validation error without SSH call when cron expression is invalid", async () => {
      mockedCore.validateCronExpr.mockReturnValue({
        valid: false,
        error: "Cron expression must have 5 fields, got 4",
      });

      await backupCommand("my-server", { schedule: "0 3 * *" });

      expect(mockedCore.scheduleBackup).not.toHaveBeenCalled();
      expect(mockedLogger.logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Cron expression must have 5 fields, got 4"),
      );
    });
  });

  describe("schedule list", () => {
    it("resolves server and calls listBackupSchedule", async () => {
      await backupCommand("my-server", { schedule: "list" });

      expect(mockedServerSelect.resolveServer).toHaveBeenCalled();
      expect(mockedCore.listBackupSchedule).toHaveBeenCalledWith(
        sampleServer.ip,
        sampleServer.name,
      );
    });

    it("displays cronExpr when schedule exists", async () => {
      mockedCore.listBackupSchedule.mockResolvedValue({
        success: true,
        cronExpr: "0 3 * * *",
      });

      await backupCommand("my-server", { schedule: "list" });

      expect(mockedLogger.logger.info).toHaveBeenCalledWith(
        expect.stringContaining("0 3 * * *"),
      );
    });

    it("shows no schedule message when cronExpr is undefined", async () => {
      mockedCore.listBackupSchedule.mockResolvedValue({
        success: true,
        cronExpr: undefined,
      });

      await backupCommand("my-server", { schedule: "list" });

      expect(mockedLogger.logger.info).toHaveBeenCalledWith(
        expect.stringContaining("No backup schedule"),
      );
    });

    it("shows error when listBackupSchedule fails", async () => {
      mockedCore.listBackupSchedule.mockResolvedValue({
        success: false,
        error: "SSH failed",
      });

      await backupCommand("my-server", { schedule: "list" });

      expect(mockedLogger.logger.error).toHaveBeenCalledWith(
        expect.stringContaining("SSH failed"),
      );
    });
  });

  describe("schedule remove", () => {
    it("resolves server and calls removeBackupSchedule", async () => {
      await backupCommand("my-server", { schedule: "remove" });

      expect(mockedServerSelect.resolveServer).toHaveBeenCalled();
      expect(mockedCore.removeBackupSchedule).toHaveBeenCalledWith(
        sampleServer.ip,
        sampleServer.name,
      );
    });

    it("starts spinner and calls spinner.succeed on success", async () => {
      await backupCommand("my-server", { schedule: "remove" });

      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it("calls spinner.fail on removeBackupSchedule failure", async () => {
      mockedCore.removeBackupSchedule.mockResolvedValue({
        success: false,
        error: "Failed to remove cron",
      });

      await backupCommand("my-server", { schedule: "remove" });

      expect(mockSpinner.fail).toHaveBeenCalled();
    });
  });

  describe("early returns", () => {
    it("returns early if SSH is not available", async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(false);

      await backupCommand("my-server", { schedule: "0 3 * * *" });

      expect(mockedServerSelect.resolveServer).not.toHaveBeenCalled();
      expect(mockedCore.scheduleBackup).not.toHaveBeenCalled();
      expect(mockedLogger.logger.error).toHaveBeenCalled();
    });

    it("returns early if resolveServer returns null", async () => {
      mockedServerSelect.resolveServer.mockResolvedValue(undefined);

      await backupCommand("my-server", { schedule: "0 3 * * *" });

      expect(mockedCore.scheduleBackup).not.toHaveBeenCalled();
    });
  });

  describe("existing backup logic unchanged", () => {
    it("does not call schedule functions when no --schedule option (SSH unavailable path)", async () => {
      // Make SSH unavailable so regular backup returns early without deep path execution
      mockedSsh.checkSshAvailable.mockReturnValue(false);

      await backupCommand("my-server", { dryRun: false });

      expect(mockedCore.scheduleBackup).not.toHaveBeenCalled();
      expect(mockedCore.listBackupSchedule).not.toHaveBeenCalled();
      expect(mockedCore.removeBackupSchedule).not.toHaveBeenCalled();
    });

    it("does not call schedule functions when schedule is undefined (SSH unavailable path)", async () => {
      mockedSsh.checkSshAvailable.mockReturnValue(false);

      await backupCommand("my-server", { schedule: undefined });

      expect(mockedCore.scheduleBackup).not.toHaveBeenCalled();
    });
  });
});
