import * as fix from "../../src/core/audit/fix.js";
import * as ssh from "../../src/utils/ssh.js";
import * as commands from "../../src/core/audit/commands.js";
import * as checksIndex from "../../src/core/audit/checks/index.js";
import type { AuditResult, AuditCategory, AuditCheck } from "../../src/core/audit/types.js";

jest.mock("../../src/utils/ssh.js");
jest.mock("../../src/core/audit/commands.js");
jest.mock("../../src/core/audit/checks/index.js");
jest.mock("inquirer");
jest.mock("../../src/utils/sshCommand.js");

const mockedSshExec = ssh.sshExec as jest.MockedFunction<typeof ssh.sshExec>;
const mockedBuildBatches = commands.buildAuditBatchCommands as jest.MockedFunction<typeof commands.buildAuditBatchCommands>;
const mockedParseAllChecks = checksIndex.parseAllChecks as jest.MockedFunction<typeof checksIndex.parseAllChecks>;

function makeCheck(overrides: Partial<AuditCheck> = {}): AuditCheck {
  return {
    id: "SSH-01",
    category: "SSH",
    name: "Test check",
    severity: "critical",
    passed: false,
    currentValue: "bad",
    expectedValue: "good",
    ...overrides,
  };
}

function makeCategory(name: string, checks: AuditCheck[], score = 50): AuditCategory {
  return { name, checks, score, maxScore: 100 };
}

function makeResult(categories: AuditCategory[], overallScore = 53): AuditResult {
  return {
    serverName: "test-server",
    serverIp: "1.2.3.4",
    platform: "bare",
    timestamp: "2026-01-01T00:00:00.000Z",
    auditVersion: "1.0.0",
    categories,
    overallScore,
    quickWins: [],
  };
}

describe("runScoreCheck", () => {
  beforeEach(() => {
    jest.resetAllMocks();

    // Default batch setup: 3 tiers
    mockedBuildBatches.mockReturnValue([
      { tier: "fast", command: "echo fast" },
      { tier: "medium", command: "echo medium" },
      { tier: "slow", command: "echo slow" },
    ]);

    // Default SSH: returns empty output for each batch
    mockedSshExec.mockResolvedValue({ stdout: "output", stderr: "", code: 0 });
  });

  it("returns new overall score after successful SSH re-audit", async () => {
    const originalResult = makeResult([
      makeCategory("SSH", [makeCheck({ id: "SSH-01", severity: "critical", passed: false })], 0),
    ], 0);

    // After fix, SSH check now passes
    mockedParseAllChecks.mockReturnValue([
      makeCategory("SSH", [makeCheck({ id: "SSH-01", severity: "critical", passed: true })], 100),
    ]);

    const newScore = await fix.runScoreCheck("1.2.3.4", "bare", originalResult, ["SSH"]);

    expect(newScore).not.toBeNull();
    expect(newScore).toBeGreaterThan(0);
  });

  it("returns null when SSH fails", async () => {
    const originalResult = makeResult([
      makeCategory("SSH", [makeCheck()], 50),
    ]);

    mockedSshExec.mockRejectedValue(new Error("Connection refused"));

    const result = await fix.runScoreCheck("1.2.3.4", "bare", originalResult, ["SSH"]);

    expect(result).toBeNull();
  });

  it("returns null when affectedCategories is empty", async () => {
    const originalResult = makeResult([
      makeCategory("SSH", [makeCheck()], 50),
    ]);

    const result = await fix.runScoreCheck("1.2.3.4", "bare", originalResult, []);

    expect(result).toBeNull();
    expect(mockedSshExec).not.toHaveBeenCalled();
  });

  it("replaces only affected categories, keeps others unchanged", async () => {
    const sshCategory = makeCategory("SSH", [makeCheck({ id: "SSH-01", severity: "critical", passed: false })], 0);
    const firewallCategory = makeCategory("Firewall", [makeCheck({ id: "FW-01", category: "Firewall", severity: "critical", passed: true })], 100);

    const originalResult = makeResult([sshCategory, firewallCategory], 50);

    // Fresh parse returns both categories but SSH is now fixed
    mockedParseAllChecks.mockReturnValue([
      makeCategory("SSH", [makeCheck({ id: "SSH-01", severity: "critical", passed: true })], 100),
      makeCategory("Firewall", [makeCheck({ id: "FW-01", category: "Firewall", severity: "critical", passed: false })], 0), // degraded
    ]);

    // Only SSH affected — Firewall should keep original score
    const result = await fix.runScoreCheck("1.2.3.4", "bare", originalResult, ["SSH"]);

    // Result should be non-null
    expect(result).not.toBeNull();

    // The Firewall category was NOT in affectedCategories so its original score (100) is kept
    // SSH improved from 0 to 100 — overall should increase
    // SSH weight=3, Firewall weight=3 → (100*3 + 100*3) / (3+3) = 100
    expect(result).toBeGreaterThan(50);
  });

  it("calls buildAuditBatchCommands with correct platform", async () => {
    const originalResult = makeResult([
      makeCategory("SSH", [makeCheck()], 50),
    ]);

    mockedParseAllChecks.mockReturnValue([
      makeCategory("SSH", [makeCheck({ passed: true })], 100),
    ]);

    await fix.runScoreCheck("1.2.3.4", "coolify", originalResult, ["SSH"]);

    expect(mockedBuildBatches).toHaveBeenCalledWith("coolify");
  });

  it("runs all 3 SSH batches for score re-check", async () => {
    const originalResult = makeResult([
      makeCategory("SSH", [makeCheck()], 50),
    ]);

    mockedParseAllChecks.mockReturnValue([
      makeCategory("SSH", [makeCheck({ passed: true })], 100),
    ]);

    await fix.runScoreCheck("1.2.3.4", "bare", originalResult, ["SSH"]);

    expect(mockedSshExec).toHaveBeenCalledTimes(3);
  });
});
