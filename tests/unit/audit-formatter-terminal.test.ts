import type { AuditResult } from "../../src/core/audit/types";

const mockResult: AuditResult = {
  serverName: "test-server",
  serverIp: "1.2.3.4",
  platform: "bare",
  timestamp: "2026-03-08T00:00:00.000Z",
  auditVersion: "1.0.0",
  categories: [
    {
      name: "SSH",
      checks: [
        {
          id: "SSH-PASSWORD-AUTH",
          category: "SSH",
          name: "Password Auth",
          severity: "critical",
          passed: true,
          currentValue: "no",
          expectedValue: "no",
        },
        {
          id: "SSH-ROOT-LOGIN",
          category: "SSH",
          name: "Root Login",
          severity: "critical",
          passed: false,
          currentValue: "yes",
          expectedValue: "prohibit-password",
          fixCommand: "sed -i 's/PermitRootLogin yes/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config",
          explain: "Root login allows brute-force attacks targeting the root account directly.",
        },
      ],
      score: 50,
      maxScore: 100,
    },
    {
      name: "Firewall",
      checks: [
        {
          id: "FW-UFW-ACTIVE",
          category: "Firewall",
          name: "UFW Enabled",
          severity: "critical",
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

describe("formatTerminal", () => {
  it("should produce output with category names and scores", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const output = formatTerminal(mockResult);

    expect(output).toContain("SSH");
    expect(output).toContain("Firewall");
    expect(output).toContain("50");
    expect(output).toContain("100");
  });

  it("should show server info in header", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const output = formatTerminal(mockResult);

    expect(output).toContain("test-server");
    expect(output).toContain("1.2.3.4");
  });

  it("should show overall score", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const output = formatTerminal(mockResult);

    expect(output).toContain("72");
  });

  it("should show failed checks with severity indicators", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const output = formatTerminal(mockResult);

    // Failed check SSH-ROOT-LOGIN should appear
    expect(output).toContain("SSH-ROOT-LOGIN");
    expect(output).toContain("Root Login");
  });

  it("should show quick wins section", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const output = formatTerminal(mockResult);

    expect(output).toContain("Quick");
    expect(output).toContain("85");
  });

  it("should handle result with no quick wins", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const resultNoWins = { ...mockResult, quickWins: [] };
    const output = formatTerminal(resultNoWins);

    // Should not throw, should still have categories
    expect(output).toContain("SSH");
  });

  it("should handle result with all checks passed", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const allPassedResult: AuditResult = {
      ...mockResult,
      overallScore: 100,
      categories: [
        {
          name: "SSH",
          checks: [
            {
              id: "SSH-PASSWORD-AUTH",
              category: "SSH",
              name: "Password Auth",
              severity: "critical",
              passed: true,
              currentValue: "no",
              expectedValue: "no",
            },
          ],
          score: 100,
          maxScore: 100,
        },
      ],
      quickWins: [],
    };
    const output = formatTerminal(allPassedResult);

    expect(output).toContain("100");
  });

  it("shows stats header with check counts", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const output = formatTerminal(mockResult);

    expect(output).toContain("Checks:");
    expect(output).toContain("total");
    expect(output).toContain("passed");
    expect(output).toContain("failed");
  });

  it("shows VPS banner when vpsType is set", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const vpsResult: AuditResult = {
      ...mockResult,
      vpsType: "kvm",
      vpsAdjustedCount: 3,
    };
    const output = formatTerminal(vpsResult);

    expect(output).toContain("VPS detected (kvm)");
    expect(output).toContain("3 checks adjusted to info");
  });

  it("does not show VPS banner on bare metal", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const output = formatTerminal(mockResult);

    expect(output).not.toContain("VPS detected");
  });

  it("shows failing categories before passing categories", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    // mockResult: SSH fails (score 50), Firewall passes (score 100)
    const output = formatTerminal(mockResult);

    const sshIndex = output.indexOf("SSH");
    const firewallIndex = output.indexOf("Firewall");
    expect(sshIndex).toBeGreaterThanOrEqual(0);
    expect(firewallIndex).toBeGreaterThan(sshIndex);
  });

  it("shows passing categories collapsed as single line", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    // Firewall has only passing checks — should show as collapsed with 100%
    const output = formatTerminal(mockResult);

    expect(output).toContain("Firewall");
    expect(output).toContain("100%");
    // Passing category's check IDs should NOT appear individually
    expect(output).not.toContain("FW-UFW-ACTIVE");
  });

  it("shows failed checks inline under failing category", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const output = formatTerminal(mockResult);

    // SSH-ROOT-LOGIN should appear inline under SSH category
    const sshIndex = output.indexOf("SSH");
    const rootLoginIndex = output.indexOf("SSH-ROOT-LOGIN");
    expect(rootLoginIndex).toBeGreaterThan(sshIndex);
  });

  it("does not render old Failed Checks section heading", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const output = formatTerminal(mockResult);

    // Old flat "Failed Checks" section heading should be gone
    // Check that "Failed Checks" does not appear as a standalone heading
    expect(output).not.toMatch(/\bFailed Checks\b/);
  });
});

describe("explain mode", () => {
  it("shows Why: line for a failing check when explain option is true", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const output = formatTerminal(mockResult, { explain: true });

    expect(output).toContain("Why:");
    expect(output).toContain("Root login allows brute-force attacks targeting the root account directly.");
  });

  it("does NOT show Why: line when explain option is false", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const output = formatTerminal(mockResult, { explain: false });

    expect(output).not.toContain("Why:");
  });

  it("does NOT show Why: line when explain option is not provided", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const output = formatTerminal(mockResult);

    expect(output).not.toContain("Why:");
  });

  it("does NOT show Why: for a passing check even when explain is true", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    // SSH-PASSWORD-AUTH is passing — its explain should never appear
    const resultWithPassingExplain: AuditResult = {
      ...mockResult,
      categories: [
        {
          name: "SSH",
          checks: [
            {
              id: "SSH-PASSWORD-AUTH",
              category: "SSH",
              name: "Password Auth",
              severity: "critical",
              passed: true,
              currentValue: "no",
              expectedValue: "no",
              explain: "Password auth should be disabled.",
            },
          ],
          score: 100,
          maxScore: 100,
        },
      ],
      quickWins: [],
    };
    const output = formatTerminal(resultWithPassingExplain, { explain: true });

    expect(output).not.toContain("Why:");
  });

  it("does NOT show Why: for a failing check with no explain field", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const resultNoExplain: AuditResult = {
      ...mockResult,
      categories: [
        {
          name: "SSH",
          checks: [
            {
              id: "SSH-ROOT-LOGIN",
              category: "SSH",
              name: "Root Login",
              severity: "critical",
              passed: false,
              currentValue: "yes",
              expectedValue: "prohibit-password",
              // no explain field
            },
          ],
          score: 0,
          maxScore: 100,
        },
      ],
      quickWins: [],
    };
    const output = formatTerminal(resultNoExplain, { explain: true });

    expect(output).not.toContain("Why:");
  });

  it("shows Why: when explain is true and only SSH category checks are present (--category filter applied upstream)", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const sshOnlyResult: AuditResult = {
      ...mockResult,
      categories: [
        {
          name: "SSH",
          checks: [
            {
              id: "SSH-ROOT-LOGIN",
              category: "SSH",
              name: "Root Login",
              severity: "critical",
              passed: false,
              currentValue: "yes",
              expectedValue: "prohibit-password",
              explain: "Root login allows brute-force attacks targeting the root account directly.",
            },
          ],
          score: 0,
          maxScore: 100,
        },
      ],
      quickWins: [],
    };
    const output = formatTerminal(sshOnlyResult, { explain: true });

    expect(output).toContain("Why:");
    expect(output).toContain("Root login allows brute-force attacks targeting the root account directly.");
  });

  it("shows Why: when explain is true and only critical severity checks are present (--severity filter applied upstream)", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const criticalOnlyResult: AuditResult = {
      ...mockResult,
      categories: [
        {
          name: "SSH",
          checks: [
            {
              id: "SSH-ROOT-LOGIN",
              category: "SSH",
              name: "Root Login",
              severity: "critical",
              passed: false,
              currentValue: "yes",
              expectedValue: "prohibit-password",
              explain: "Root login allows brute-force attacks targeting the root account directly.",
            },
          ],
          score: 0,
          maxScore: 100,
        },
      ],
      quickWins: [],
    };
    const output = formatTerminal(criticalOnlyResult, { explain: true });

    expect(output).toContain("Why:");
    expect(output).toContain("Root login allows brute-force attacks targeting the root account directly.");
  });
});
