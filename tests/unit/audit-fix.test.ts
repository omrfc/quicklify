import { previewFixes, runFix } from "../../src/core/audit/fix.js";
import type { AuditResult, AuditCheck, AuditCategory } from "../../src/core/audit/types.js";
import * as ssh from "../../src/utils/ssh.js";
import inquirer from "inquirer";

jest.mock("../../src/utils/ssh.js");
jest.mock("inquirer");

const mockedSshExec = ssh.sshExec as jest.MockedFunction<typeof ssh.sshExec>;
const mockedPrompt = inquirer.prompt as jest.MockedFunction<typeof inquirer.prompt>;

function makeCheck(overrides: Partial<AuditCheck> = {}): AuditCheck {
  return {
    id: "TEST-01",
    category: "Test",
    name: "Test Check",
    severity: "warning",
    passed: true,
    currentValue: "good",
    expectedValue: "good",
    ...overrides,
  };
}

function makeCategory(name: string, checks: AuditCheck[]): AuditCategory {
  const totalWeight = checks.reduce((sum, c) => {
    const w = c.severity === "critical" ? 3 : c.severity === "warning" ? 2 : 1;
    return sum + w;
  }, 0);
  const passedWeight = checks.filter(c => c.passed).reduce((sum, c) => {
    const w = c.severity === "critical" ? 3 : c.severity === "warning" ? 2 : 1;
    return sum + w;
  }, 0);
  const score = totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : 0;
  return { name, checks, score, maxScore: totalWeight > 0 ? 100 : 0 };
}

function makeResult(categories: AuditCategory[]): AuditResult {
  const sum = categories.reduce((acc, c) => acc + c.score, 0);
  const overallScore = categories.length > 0 ? Math.round(sum / categories.length) : 0;
  return {
    serverName: "test-server",
    serverIp: "1.2.3.4",
    platform: "bare",
    timestamp: new Date().toISOString(),
    auditVersion: "1.0.0",
    categories,
    overallScore,
    quickWins: [],
  };
}

describe("previewFixes", () => {
  it("should return grouped fixes by severity (critical first)", () => {
    const result = makeResult([
      makeCategory("SSH", [
        makeCheck({ id: "SSH-PASSWORD-AUTH", category: "SSH", severity: "critical", passed: false, fixCommand: "sed -i 's/yes/no/' /etc/ssh/sshd_config" }),
        makeCheck({ id: "SSH-ROOT-LOGIN", category: "SSH", severity: "info", passed: false, fixCommand: "sed -i 's/a/b/' /etc/test" }),
        makeCheck({ id: "SSH-EMPTY-PASSWORDS", category: "SSH", severity: "warning", passed: false, fixCommand: "systemctl restart sshd" }),
      ]),
    ]);

    const plan = previewFixes(result);
    expect(plan.groups).toHaveLength(3);
    expect(plan.groups[0].severity).toBe("critical");
    expect(plan.groups[1].severity).toBe("warning");
    expect(plan.groups[2].severity).toBe("info");
  });

  it("should exclude checks without fixCommand", () => {
    const result = makeResult([
      makeCategory("SSH", [
        makeCheck({ id: "SSH-PASSWORD-AUTH", severity: "critical", passed: false, fixCommand: "chmod 600 /etc/ssh/sshd_config" }),
        makeCheck({ id: "SSH-ROOT-LOGIN", severity: "warning", passed: false }), // no fixCommand
      ]),
    ]);

    const plan = previewFixes(result);
    const allChecks = plan.groups.flatMap(g => g.checks);
    expect(allChecks).toHaveLength(1);
    expect(allChecks[0].id).toBe("SSH-PASSWORD-AUTH");
  });

  it("should include pre-condition checks for SSH password disable", () => {
    const result = makeResult([
      makeCategory("SSH", [
        makeCheck({
          id: "SSH-PASSWORD-AUTH",
          category: "SSH",
          name: "Password Authentication",
          severity: "critical",
          passed: false,
          fixCommand: "sed -i 's/^#?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config && systemctl restart sshd",
        }),
      ]),
    ]);

    const plan = previewFixes(result);
    const sshFix = plan.groups[0].checks[0];
    expect(sshFix.preCondition).toBeDefined();
    expect(sshFix.preCondition).toContain("authorized_keys");
  });

  it("should batch fixes by category for efficiency", () => {
    const result = makeResult([
      makeCategory("SSH", [
        makeCheck({ id: "SSH-PASSWORD-AUTH", category: "SSH", severity: "critical", passed: false, fixCommand: "sed -i 's/x/y/' /etc/a" }),
        makeCheck({ id: "SSH-ROOT-LOGIN", category: "SSH", severity: "critical", passed: false, fixCommand: "sed -i 's/p/q/' /etc/b" }),
      ]),
      makeCategory("Firewall", [
        makeCheck({ id: "FW-UFW-ACTIVE", category: "Firewall", severity: "critical", passed: false, fixCommand: "ufw enable" }),
      ]),
    ]);

    const plan = previewFixes(result);
    // Critical group should contain all 3 critical checks
    const criticalGroup = plan.groups.find(g => g.severity === "critical");
    expect(criticalGroup).toBeDefined();
    expect(criticalGroup!.checks).toHaveLength(3);
  });

  it("should calculate estimatedImpact for each group", () => {
    const result = makeResult([
      makeCategory("SSH", [
        makeCheck({ id: "SSH-PASSWORD-AUTH", category: "SSH", severity: "critical", passed: false, fixCommand: "chmod 600 /etc/ssh/sshd_config" }),
        makeCheck({ id: "SSH-ROOT-LOGIN", category: "SSH", severity: "info", passed: true }),
      ]),
    ]);

    const plan = previewFixes(result);
    expect(plan.groups[0].estimatedImpact).toBeGreaterThan(0);
  });
});

describe("runFix", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should call sshExec with fix commands for confirmed checks", async () => {
    const result = makeResult([
      makeCategory("SSH", [
        makeCheck({ id: "SSH-PASSWORD-AUTH", category: "SSH", severity: "critical", passed: false, fixCommand: "sed -i 's/PermitRootLogin yes/no/' /etc/ssh/sshd_config" }),
      ]),
    ]);

    mockedPrompt.mockResolvedValueOnce({ confirm: true });
    mockedSshExec.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

    const fixResult = await runFix("1.2.3.4", result, { dryRun: false });
    expect(mockedSshExec).toHaveBeenCalledWith("1.2.3.4", expect.stringContaining("PermitRootLogin"));
    expect(fixResult.applied).toContain("SSH-PASSWORD-AUTH");
  });

  it("should skip checks the user declined", async () => {
    const result = makeResult([
      makeCategory("SSH", [
        makeCheck({ id: "SSH-PASSWORD-AUTH", category: "SSH", severity: "critical", passed: false, fixCommand: "sed -i 's/PermitRootLogin yes/no/' /etc/ssh/sshd_config" }),
      ]),
    ]);

    mockedPrompt.mockResolvedValueOnce({ confirm: false });

    const fixResult = await runFix("1.2.3.4", result, { dryRun: false });
    expect(mockedSshExec).not.toHaveBeenCalled();
    expect(fixResult.skipped).toContain("SSH-PASSWORD-AUTH");
  });

  it("should not execute commands in dry-run mode", async () => {
    const result = makeResult([
      makeCategory("SSH", [
        makeCheck({ id: "SSH-PASSWORD-AUTH", category: "SSH", severity: "critical", passed: false, fixCommand: "sed -i 's/PermitRootLogin yes/no/' /etc/ssh/sshd_config" }),
      ]),
    ]);

    const fixResult = await runFix("1.2.3.4", result, { dryRun: true });
    expect(mockedSshExec).not.toHaveBeenCalled();
    expect(fixResult.applied).toHaveLength(0);
    expect(fixResult.preview).toBeDefined();
  });

  it("should record errors when sshExec fails", async () => {
    const result = makeResult([
      makeCategory("SSH", [
        makeCheck({ id: "SSH-PASSWORD-AUTH", category: "SSH", severity: "critical", passed: false, fixCommand: "sed -i 's/PermitRootLogin yes/no/' /etc/ssh/sshd_config" }),
      ]),
    ]);

    mockedPrompt.mockResolvedValueOnce({ confirm: true });
    mockedSshExec.mockRejectedValue(new Error("Connection refused"));

    const fixResult = await runFix("1.2.3.4", result, { dryRun: false });
    expect(fixResult.errors).toHaveLength(1);
    expect(fixResult.errors[0]).toContain("SSH-PASSWORD-AUTH");
  });

  it("should record errors when sshExec throws a non-Error", async () => {
    const result = makeResult([
      makeCategory("SSH", [
        makeCheck({ id: "SSH-PASSWORD-AUTH", category: "SSH", severity: "critical", passed: false, fixCommand: "sed -i 's/PermitRootLogin yes/no/' /etc/ssh/sshd_config" }),
      ]),
    ]);

    mockedPrompt.mockResolvedValueOnce({ confirm: true });
    mockedSshExec.mockRejectedValue("string error");

    const fixResult = await runFix("1.2.3.4", result, { dryRun: false });
    expect(fixResult.errors).toHaveLength(1);
    expect(fixResult.errors[0]).toContain("SSH-PASSWORD-AUTH");
  });

  it("should record error when pre-condition check fails", async () => {
    const result = makeResult([
      makeCategory("SSH", [
        makeCheck({
          id: "SSH-PASSWORD-AUTH",
          category: "SSH",
          name: "Password Authentication",
          severity: "critical",
          passed: false,
          fixCommand: "sed -i 's/^#?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config",
        }),
      ]),
    ]);

    mockedPrompt.mockResolvedValueOnce({ confirm: true });
    // First call: pre-condition check fails (no authorized_keys)
    mockedSshExec.mockResolvedValueOnce({ code: 1, stdout: "", stderr: "file not found" });

    const fixResult = await runFix("1.2.3.4", result, { dryRun: false });
    expect(fixResult.errors).toHaveLength(1);
    expect(fixResult.errors[0]).toContain("pre-condition failed");
  });

  it("should reject fix commands with shell metacharacters", async () => {
    const result = makeResult([
      makeCategory("Test", [
        makeCheck({
          id: "TEST-INJECT",
          category: "Test",
          severity: "warning",
          passed: false,
          fixCommand: "echo hello; rm -rf /",
        }),
      ]),
    ]);

    mockedPrompt.mockResolvedValueOnce({ confirm: true });

    const fixResult = await runFix("1.2.3.4", result, { dryRun: false });
    expect(fixResult.errors).toHaveLength(1);
    expect(fixResult.errors[0]).toContain("fix command rejected");
  });

  it("should reject fix commands with unknown prefixes", async () => {
    const result = makeResult([
      makeCategory("Test", [
        makeCheck({
          id: "TEST-UNKNOWN",
          category: "Test",
          severity: "warning",
          passed: false,
          fixCommand: "malicious_binary --do-bad-things",
        }),
      ]),
    ]);

    mockedPrompt.mockResolvedValueOnce({ confirm: true });

    const fixResult = await runFix("1.2.3.4", result, { dryRun: false });
    expect(fixResult.errors).toHaveLength(1);
    expect(fixResult.errors[0]).toContain("fix command rejected");
  });

  it("should record error when SSH command exits with non-zero code", async () => {
    const result = makeResult([
      makeCategory("SSH", [
        makeCheck({
          id: "SSH-ROOT-LOGIN",
          category: "SSH",
          severity: "warning",
          passed: false,
          fixCommand: "sed -i 's/yes/no/' /etc/ssh/sshd_config",
        }),
      ]),
    ]);

    mockedPrompt.mockResolvedValueOnce({ confirm: true });
    mockedSshExec.mockResolvedValue({ code: 1, stdout: "", stderr: "permission denied" });

    const fixResult = await runFix("1.2.3.4", result, { dryRun: false });
    expect(fixResult.errors).toHaveLength(1);
    expect(fixResult.errors[0]).toContain("command failed");
    expect(fixResult.errors[0]).toContain("permission denied");
  });

  it("should record error without stderr when SSH command fails without stderr", async () => {
    const result = makeResult([
      makeCategory("SSH", [
        makeCheck({
          id: "SSH-ROOT-LOGIN",
          category: "SSH",
          severity: "warning",
          passed: false,
          fixCommand: "sed -i 's/yes/no/' /etc/ssh/sshd_config",
        }),
      ]),
    ]);

    mockedPrompt.mockResolvedValueOnce({ confirm: true });
    mockedSshExec.mockResolvedValue({ code: 2, stdout: "", stderr: "" });

    const fixResult = await runFix("1.2.3.4", result, { dryRun: false });
    expect(fixResult.errors).toHaveLength(1);
    expect(fixResult.errors[0]).toContain("command failed (exit 2)");
  });

  it("should include Firewall pre-condition for ufw fix commands", () => {
    const result = makeResult([
      makeCategory("Firewall", [
        makeCheck({
          id: "FW-UFW-ACTIVE",
          category: "Firewall",
          name: "UFW Active",
          severity: "warning",
          passed: false,
          fixCommand: "ufw enable",
        }),
      ]),
    ]);

    const plan = previewFixes(result);
    const fwCheck = plan.groups[0]?.checks[0];
    expect(fwCheck).toBeDefined();
    expect(fwCheck!.preCondition).toBeDefined();
    expect(fwCheck!.preCondition).toContain("ufw status");
  });
});

describe("previewFixes — edge cases", () => {
  it("should return 0 estimatedImpact when totalOverallWeight is 0", () => {
    // All categories have maxScore 0 (no checks)
    const result = makeResult([
      makeCategory("Empty", []),
    ]);
    // Manually add a failed check to a zero-maxScore category
    result.categories[0].checks = [
      makeCheck({ id: "TEST-01", category: "Empty", severity: "warning", passed: false, fixCommand: "echo test" }),
    ];
    result.categories[0].maxScore = 0;

    const plan = previewFixes(result);
    if (plan.groups.length > 0) {
      expect(plan.groups[0].estimatedImpact).toBe(0);
    }
  });

  it("should skip severity groups with no fixable checks", () => {
    const result = makeResult([
      makeCategory("Test", [
        makeCheck({ id: "TEST-01", severity: "warning", passed: false, fixCommand: "echo test" }),
        makeCheck({ id: "TEST-02", severity: "info", passed: true }),
      ]),
    ]);

    const plan = previewFixes(result);
    // No critical group since there are no critical failed checks
    expect(plan.groups.find(g => g.severity === "critical")).toBeUndefined();
  });

  it("should exclude passed checks from the fix plan", () => {
    const result = makeResult([
      makeCategory("Test", [
        makeCheck({ id: "TEST-PASS", severity: "warning", passed: true, fixCommand: "echo already-fixed" }),
        makeCheck({ id: "TEST-FAIL", severity: "warning", passed: false, fixCommand: "echo fix-me" }),
      ]),
    ]);

    const plan = previewFixes(result);
    const allCheckIds = plan.groups.flatMap(g => g.checks.map(c => c.id));
    expect(allCheckIds).not.toContain("TEST-PASS");
    expect(allCheckIds).toContain("TEST-FAIL");
  });
});
