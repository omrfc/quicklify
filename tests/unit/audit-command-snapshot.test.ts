/**
 * Integration tests for audit command snapshot wiring.
 * Tests --snapshot (save) and --snapshots (list) CLI options.
 */

import * as auditCore from "../../src/core/audit/index";
import * as serverSelect from "../../src/utils/serverSelect";
import * as ssh from "../../src/utils/ssh";
import * as formatters from "../../src/core/audit/formatters/index";
import * as auditHistory from "../../src/core/audit/history";
import * as snapshotModule from "../../src/core/audit/snapshot";

jest.mock("../../src/core/audit/index");
jest.mock("../../src/utils/serverSelect");
jest.mock("../../src/utils/ssh");
jest.mock("../../src/core/audit/formatters/index");
jest.mock("../../src/core/audit/history");
jest.mock("../../src/core/audit/snapshot");
jest.mock("../../src/core/audit/fix");
jest.mock("../../src/core/audit/watch");

const mockedAuditCore = auditCore as jest.Mocked<typeof auditCore>;
const mockedServerSelect = serverSelect as jest.Mocked<typeof serverSelect>;
const mockedHistory = auditHistory as jest.Mocked<typeof auditHistory>;
const mockedFormatters = formatters as jest.Mocked<typeof formatters>;
const mockedSnapshot = snapshotModule as jest.Mocked<typeof snapshotModule>;

const mockAuditResult = {
  serverName: "test-server",
  serverIp: "1.2.3.4",
  platform: "bare" as const,
  timestamp: "2026-03-11T00:00:00.000Z",
  categories: [],
  overallScore: 85,
  quickWins: [],
};

describe("auditCommand snapshot wiring", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation();
    jest.clearAllMocks();

    mockedServerSelect.resolveServer.mockResolvedValue({
      id: "srv-1",
      name: "test-server",
      provider: "hetzner",
      ip: "1.2.3.4",
      region: "fsn1",
      size: "cx11",
      createdAt: "2026-01-01",
      mode: "bare",
    });

    mockedAuditCore.runAudit.mockResolvedValue({
      success: true,
      data: mockAuditResult,
    });

    mockedHistory.loadAuditHistory.mockReturnValue([]);
    mockedHistory.detectTrend.mockReturnValue("first audit");
    mockedHistory.saveAuditHistory.mockResolvedValue(undefined);

    mockedFormatters.selectFormatter.mockResolvedValue(
      (result) => `formatted: ${result.overallScore}/100`,
    );

    mockedSnapshot.saveSnapshot.mockResolvedValue(undefined);
    mockedSnapshot.listSnapshots.mockResolvedValue([]);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe("--snapshots list mode", () => {
    it("calls listSnapshots with server IP and does NOT call runAudit", async () => {
      mockedSnapshot.listSnapshots.mockResolvedValue([
        {
          filename: "2026-03-11T00-00-00-000Z.json",
          savedAt: "2026-03-11T00:00:00.000Z",
          overallScore: 85,
        },
      ]);

      const { auditCommand } = await import("../../src/commands/audit");
      await auditCommand("test-server", { snapshots: true });

      expect(mockedSnapshot.listSnapshots).toHaveBeenCalledWith("1.2.3.4");
      expect(mockedAuditCore.runAudit).not.toHaveBeenCalled();
    });

    it("displays snapshot entries with score and filename", async () => {
      mockedSnapshot.listSnapshots.mockResolvedValue([
        {
          filename: "2026-03-11T00-00-00-000Z_pre-upgrade.json",
          savedAt: "2026-03-11T00:00:00.000Z",
          name: "pre-upgrade",
          overallScore: 72,
        },
      ]);

      const { auditCommand } = await import("../../src/commands/audit");
      await auditCommand("test-server", { snapshots: true });

      const output = consoleSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
      expect(output).toContain("pre-upgrade");
      expect(output).toContain("72/100");
      expect(output).toContain("2026-03-11T00-00-00-000Z_pre-upgrade.json");
    });

    it("shows info message when no snapshots exist", async () => {
      mockedSnapshot.listSnapshots.mockResolvedValue([]);

      const { auditCommand } = await import("../../src/commands/audit");
      await auditCommand("test-server", { snapshots: true });

      expect(mockedAuditCore.runAudit).not.toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
      expect(output).toContain("No snapshots found");
    });
  });

  describe("--snapshot save mode", () => {
    it("calls saveSnapshot with auditResult and no name when --snapshot is true", async () => {
      const { auditCommand } = await import("../../src/commands/audit");
      await auditCommand("test-server", { snapshot: true });

      expect(mockedAuditCore.runAudit).toHaveBeenCalled();
      expect(mockedSnapshot.saveSnapshot).toHaveBeenCalledWith(mockAuditResult, undefined);
    });

    it("calls saveSnapshot with auditResult and name when --snapshot is a string", async () => {
      const { auditCommand } = await import("../../src/commands/audit");
      await auditCommand("test-server", { snapshot: "pre-upgrade" });

      expect(mockedSnapshot.saveSnapshot).toHaveBeenCalledWith(mockAuditResult, "pre-upgrade");
    });

    it("does not call saveSnapshot when --snapshot is not set", async () => {
      const { auditCommand } = await import("../../src/commands/audit");
      await auditCommand("test-server", {});

      expect(mockedSnapshot.saveSnapshot).not.toHaveBeenCalled();
    });

    it("saveSnapshot is called after history save", async () => {
      const callOrder: string[] = [];
      mockedAuditCore.runAudit.mockImplementation(async () => {
        callOrder.push("runAudit");
        return { success: true, data: mockAuditResult };
      });
      mockedHistory.saveAuditHistory.mockImplementation(async () => {
        callOrder.push("saveAuditHistory");
      });
      mockedSnapshot.saveSnapshot.mockImplementation(async () => {
        callOrder.push("saveSnapshot");
      });

      const { auditCommand } = await import("../../src/commands/audit");
      await auditCommand("test-server", { snapshot: true });

      expect(callOrder).toEqual(["runAudit", "saveAuditHistory", "saveSnapshot"]);
    });
  });
});
