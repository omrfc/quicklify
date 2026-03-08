import * as auditCore from "../../src/core/audit/index";
import * as serverSelect from "../../src/utils/serverSelect";
import * as ssh from "../../src/utils/ssh";

jest.mock("../../src/core/audit/index");
jest.mock("../../src/utils/serverSelect");
jest.mock("../../src/utils/ssh");

const mockedAuditCore = auditCore as jest.Mocked<typeof auditCore>;
const mockedServerSelect = serverSelect as jest.Mocked<typeof serverSelect>;
const mockedSsh = ssh as jest.Mocked<typeof ssh>;

// Mock AuditResult for testing
const mockAuditResult = {
  serverName: "test-server",
  serverIp: "1.2.3.4",
  platform: "bare" as const,
  timestamp: "2026-03-08T00:00:00.000Z",
  categories: [
    {
      name: "SSH",
      checks: [
        {
          id: "SSH-01",
          category: "SSH",
          name: "Password Auth",
          severity: "critical" as const,
          passed: true,
          currentValue: "no",
          expectedValue: "no",
          fixCommand: "sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config",
        },
        {
          id: "SSH-02",
          category: "SSH",
          name: "Root Login",
          severity: "critical" as const,
          passed: false,
          currentValue: "yes",
          expectedValue: "prohibit-password",
          fixCommand: "sed -i 's/PermitRootLogin yes/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config",
        },
      ],
      score: 50,
      maxScore: 100,
    },
    {
      name: "Firewall",
      checks: [
        {
          id: "FW-01",
          category: "Firewall",
          name: "UFW Enabled",
          severity: "critical" as const,
          passed: true,
          currentValue: "active",
          expectedValue: "active",
        },
      ],
      score: 100,
      maxScore: 100,
    },
  ],
  overallScore: 72,
  quickWins: [
    {
      commands: ["sed -i 's/PermitRootLogin yes/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config"],
      currentScore: 72,
      projectedScore: 85,
      description: "Disable root password login",
    },
  ],
};

describe("auditCommand", () => {
  let consoleSpy: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation();
    exitSpy = jest.spyOn(process, "exit").mockImplementation(() => undefined as never);
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
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("should call runAudit with resolved server IP and name", async () => {
    const { auditCommand } = await import("../../src/commands/audit");
    await auditCommand("test-server", {});

    expect(mockedAuditCore.runAudit).toHaveBeenCalledWith("1.2.3.4", "test-server", "bare");
  });

  it("should use --json flag to select JSON formatter", async () => {
    const { auditCommand } = await import("../../src/commands/audit");
    await auditCommand(undefined, { json: true });

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    // JSON output should be parseable
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("should use --badge flag to select badge formatter", async () => {
    const { auditCommand } = await import("../../src/commands/audit");
    await auditCommand(undefined, { badge: true });

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("<svg");
    expect(output).toContain("xmlns");
  });

  it("should output score/100 with --score-only", async () => {
    const { auditCommand } = await import("../../src/commands/audit");
    await auditCommand(undefined, { scoreOnly: true });

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("72/100");
  });

  it("should parse --host user@ip and skip resolveServer", async () => {
    mockedSsh.assertValidIp.mockImplementation(() => {});
    const { auditCommand } = await import("../../src/commands/audit");
    await auditCommand(undefined, { host: "root@5.6.7.8" });

    expect(mockedServerSelect.resolveServer).not.toHaveBeenCalled();
    expect(mockedAuditCore.runAudit).toHaveBeenCalledWith("5.6.7.8", "5.6.7.8", "bare");
  });

  it("should exit with code 1 if score < threshold", async () => {
    const { auditCommand } = await import("../../src/commands/audit");
    await auditCommand(undefined, { threshold: "80" });

    // Score is 72, threshold is 80 -> should exit 1
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("should not exit with code 1 if score >= threshold", async () => {
    const { auditCommand } = await import("../../src/commands/audit");
    await auditCommand(undefined, { threshold: "70" });

    // Score is 72, threshold is 70 -> should NOT exit 1
    expect(exitSpy).not.toHaveBeenCalledWith(1);
  });

  it("should handle audit failure gracefully", async () => {
    mockedAuditCore.runAudit.mockResolvedValue({
      success: false,
      error: "Audit failed: SSH connection refused",
      hint: "Check SSH config",
    });
    const { auditCommand } = await import("../../src/commands/audit");
    await auditCommand(undefined, {});

    const output = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
    expect(output).toContain("Audit failed");
  });
});
