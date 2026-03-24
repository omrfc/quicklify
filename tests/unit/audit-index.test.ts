import { detectSkippedCategories, runAudit } from "../../src/core/audit/index.js";
import type { AuditCategory } from "../../src/core/audit/types.js";
import * as ssh from "../../src/utils/ssh.js";
import * as commands from "../../src/core/audit/commands.js";
import * as checksIndex from "../../src/core/audit/checks/index.js";
import * as vps from "../../src/core/audit/vps.js";

jest.mock("../../src/utils/ssh.js");
jest.mock("../../src/core/audit/commands.js");
jest.mock("../../src/core/audit/checks/index.js");
jest.mock("../../src/core/audit/vps.js");
jest.mock("../../src/core/audit/quickwin.js", () => ({
  calculateQuickWins: jest.fn(() => []),
}));

const mockedSsh = ssh as jest.Mocked<typeof ssh>;
const mockedCommands = commands as jest.Mocked<typeof commands>;
const mockedChecksIndex = checksIndex as jest.Mocked<typeof checksIndex>;
const mockedVps = vps as jest.Mocked<typeof vps>;

describe("detectSkippedCategories", () => {
  it("returns empty array when no categories", () => {
    expect(detectSkippedCategories([])).toEqual([]);
  });

  it("skips categories with empty checks array", () => {
    const cat: AuditCategory = { name: "SSH", checks: [], score: 0, maxScore: 0 };
    expect(detectSkippedCategories([cat])).toEqual([]);
  });

  it("detects category where all checks have 'not installed'", () => {
    const cat: AuditCategory = {
      name: "Docker",
      checks: [
        { id: "DOC-1", category: "Docker", name: "Test", severity: "warning", passed: false, currentValue: "Docker not installed", expectedValue: "installed" },
        { id: "DOC-2", category: "Docker", name: "Test2", severity: "info", passed: false, currentValue: "not installed", expectedValue: "installed" },
      ],
      score: 0,
      maxScore: 100,
    };
    expect(detectSkippedCategories([cat])).toEqual(["Docker"]);
  });

  it("detects category where all checks have 'N/A' currentValue", () => {
    const cat: AuditCategory = {
      name: "TLS",
      checks: [
        { id: "TLS-1", category: "TLS", name: "Test", severity: "info", passed: false, currentValue: "N/A", expectedValue: "configured" },
      ],
      score: 0,
      maxScore: 100,
    };
    expect(detectSkippedCategories([cat])).toEqual(["TLS"]);
  });

  it("does not skip category with mixed currentValues", () => {
    const cat: AuditCategory = {
      name: "SSH",
      checks: [
        { id: "SSH-1", category: "SSH", name: "Test", severity: "critical", passed: true, currentValue: "no", expectedValue: "no" },
        { id: "SSH-2", category: "SSH", name: "Test2", severity: "warning", passed: false, currentValue: "not installed", expectedValue: "installed" },
      ],
      score: 50,
      maxScore: 100,
    };
    expect(detectSkippedCategories([cat])).toEqual([]);
  });

  it("returns multiple skipped categories", () => {
    const cats: AuditCategory[] = [
      {
        name: "Docker",
        checks: [{ id: "DOC-1", category: "Docker", name: "Test", severity: "warning", passed: false, currentValue: "not installed", expectedValue: "installed" }],
        score: 0,
        maxScore: 100,
      },
      {
        name: "TLS",
        checks: [{ id: "TLS-1", category: "TLS", name: "Test", severity: "info", passed: false, currentValue: "N/A", expectedValue: "configured" }],
        score: 0,
        maxScore: 100,
      },
    ];
    expect(detectSkippedCategories(cats)).toEqual(["Docker", "TLS"]);
  });
});

describe("runAudit", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedCommands.buildAuditBatchCommands.mockReturnValue([
      { tier: "fast" as const, command: "echo test" },
    ]);
    (mockedCommands as Record<string, unknown>).BATCH_TIMEOUTS = { fast: 30000, medium: 60000, slow: 120000 };

    mockedSsh.sshExec.mockResolvedValue({ code: 0, stdout: "test output", stderr: "" });

    mockedChecksIndex.parseAllChecks.mockReturnValue([
      {
        name: "SSH",
        checks: [
          { id: "SSH-1", category: "SSH", name: "Test", severity: "warning", passed: true, currentValue: "ok", expectedValue: "ok" },
        ],
        score: 100,
        maxScore: 100,
      },
    ]);
    mockedChecksIndex.mergeComplianceRefs.mockImplementation((cats) => cats);
    mockedVps.extractVpsType.mockReturnValue(null);
    mockedVps.applyVpsAdjustments.mockImplementation((cats) => ({ categories: cats, adjustedCount: 0 }));
  });

  it("returns success with audit result on normal run", async () => {
    const result = await runAudit("1.2.3.4", "test-server", "bare");
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.serverName).toBe("test-server");
    expect(result.data!.serverIp).toBe("1.2.3.4");
    expect(result.data!.platform).toBe("bare");
  });

  it("returns error result when top-level exception occurs", async () => {
    mockedCommands.buildAuditBatchCommands.mockImplementation(() => {
      throw new Error("Build failed");
    });
    const result = await runAudit("1.2.3.4", "test-server", "bare");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Audit failed.*Build failed/);
    expect(result.hint).toBeDefined();
  });

  it("handles non-Error exceptions in top-level catch", async () => {
    mockedCommands.buildAuditBatchCommands.mockImplementation(() => {
      throw "string error";
    });
    const result = await runAudit("1.2.3.4", "test-server", "bare");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/string error/);
  });

  it("includes batch error warnings when SSH batch fails", async () => {
    mockedSsh.sshExec.mockRejectedValueOnce(new Error("Connection refused"));
    mockedChecksIndex.parseAllChecks.mockReturnValue([
      {
        name: "SSH",
        checks: [
          { id: "SSH-1", category: "SSH", name: "Test", severity: "warning", passed: false, currentValue: "Unable to determine", expectedValue: "ok" },
        ],
        score: 0,
        maxScore: 100,
      },
    ]);

    const result = await runAudit("1.2.3.4", "test-server", "bare");
    expect(result.success).toBe(true);
    expect(result.data!.warnings).toBeDefined();
    expect(result.data!.warnings![0]).toMatch(/SSH fast batch failed/);
  });

  it("marks undetermined categories as connectionError when batch fails", async () => {
    mockedSsh.sshExec.mockRejectedValueOnce(new Error("timeout"));
    mockedChecksIndex.parseAllChecks.mockReturnValue([
      {
        name: "SSH",
        checks: [
          { id: "SSH-1", category: "SSH", name: "Test", severity: "warning", passed: false, currentValue: "Unable to determine", expectedValue: "ok" },
        ],
        score: 0,
        maxScore: 100,
      },
    ]);

    const result = await runAudit("1.2.3.4", "test-server", "bare");
    expect(result.success).toBe(true);
    // connectionError categories get score 0, maxScore 0
    const sshCat = result.data!.categories.find((c) => c.name === "SSH");
    expect(sshCat!.score).toBe(0);
    expect(sshCat!.maxScore).toBe(0);
  });

  it("marks categories with empty currentValue as connectionError when batch fails", async () => {
    mockedSsh.sshExec.mockRejectedValueOnce(new Error("timeout"));
    mockedChecksIndex.parseAllChecks.mockReturnValue([
      {
        name: "Firewall",
        checks: [
          { id: "FW-1", category: "Firewall", name: "Test", severity: "warning", passed: false, currentValue: "", expectedValue: "ok" },
        ],
        score: 0,
        maxScore: 100,
      },
    ]);

    const result = await runAudit("1.2.3.4", "test-server", "bare");
    expect(result.success).toBe(true);
    const fwCat = result.data!.categories.find((c) => c.name === "Firewall");
    expect(fwCat!.score).toBe(0);
    expect(fwCat!.maxScore).toBe(0);
  });

  it("does not mark categories as connectionError when no batch errors", async () => {
    mockedChecksIndex.parseAllChecks.mockReturnValue([
      {
        name: "SSH",
        checks: [
          { id: "SSH-1", category: "SSH", name: "Test", severity: "warning", passed: false, currentValue: "Unable to determine", expectedValue: "ok" },
        ],
        score: 0,
        maxScore: 100,
      },
    ]);

    const result = await runAudit("1.2.3.4", "test-server", "bare");
    expect(result.success).toBe(true);
    // No batch errors, so connectionError should NOT be set even if checks are undetermined
    const sshCat = result.data!.categories.find((c) => c.name === "SSH");
    expect(sshCat!.connectionError).toBeUndefined();
  });

  it("includes vpsType and vpsAdjustedCount when VPS detected", async () => {
    mockedVps.extractVpsType.mockReturnValue("kvm");
    mockedVps.applyVpsAdjustments.mockImplementation((cats) => ({ categories: cats, adjustedCount: 3 }));

    const result = await runAudit("1.2.3.4", "test-server", "bare");
    expect(result.success).toBe(true);
    expect(result.data!.vpsType).toBe("kvm");
    expect(result.data!.vpsAdjustedCount).toBe(3);
  });

  it("includes skippedCategories when some categories are skipped", async () => {
    mockedChecksIndex.parseAllChecks.mockReturnValue([
      {
        name: "Docker",
        checks: [
          { id: "DOC-1", category: "Docker", name: "Test", severity: "warning", passed: false, currentValue: "Docker not installed", expectedValue: "installed" },
        ],
        score: 0,
        maxScore: 100,
      },
    ]);

    const result = await runAudit("1.2.3.4", "test-server", "bare");
    expect(result.success).toBe(true);
    expect(result.data!.skippedCategories).toEqual(["Docker"]);
  });

  it("handles non-Error batch exceptions", async () => {
    mockedSsh.sshExec.mockRejectedValueOnce("string batch error");
    mockedChecksIndex.parseAllChecks.mockReturnValue([
      {
        name: "SSH",
        checks: [
          { id: "SSH-1", category: "SSH", name: "Test", severity: "warning", passed: true, currentValue: "ok", expectedValue: "ok" },
        ],
        score: 100,
        maxScore: 100,
      },
    ]);

    const result = await runAudit("1.2.3.4", "test-server", "bare");
    expect(result.success).toBe(true);
    expect(result.data!.warnings![0]).toMatch(/string batch error/);
  });
});
