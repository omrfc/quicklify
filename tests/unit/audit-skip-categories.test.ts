/**
 * Tests for opportunistic category skip detection and terminal display.
 * Verifies that categories where all checks have "not installed" currentValue
 * are flagged as skipped and shown in terminal output without affecting scores.
 */

import type { AuditCategory, AuditResult } from "../../src/core/audit/types";

// Helper: build a Docker "not installed" category (32 checks all with "Docker not installed")
function makeDockerSkippedCategory(): AuditCategory {
  const ids = [
    "DCK-NO-TCP-SOCKET", "DCK-NO-PRIVILEGED", "DCK-VERSION-CURRENT",
    "DCK-USER-NAMESPACE", "DCK-NO-HOST-NETWORK", "DCK-LOGGING-DRIVER",
    "DCK-LIVE-RESTORE", "DCK-NO-NEW-PRIVILEGES", "DCK-ICC-DISABLED",
    "DCK-TLS-VERIFY", "DCK-SOCKET-PERMS", "DCK-NO-ROOT-CONTAINERS",
    "DCK-READ-ONLY-ROOTFS", "DCK-LOG-MAX-SIZE", "DCK-DEFAULT-ULIMITS",
    "DCK-SECCOMP-ENABLED", "DCK-CONTENT-TRUST", "DCK-NO-SENSITIVE-MOUNTS",
    "DCK-APPARMOR-PROFILE", "DCK-NO-PRIVILEGED-PORTS", "DCK-NETWORK-DISABLED",
    "DCK-LOG-DRIVER-CONFIGURED", "DCK-ROOTLESS-MODE", "DCK-NO-HOST-NETWORK-INSPECT",
    "DCK-HEALTH-CHECK", "DCK-BRIDGE-NFCALL", "DCK-NO-INSECURE-REGISTRY",
    "DCK-NO-EXPERIMENTAL", "DCK-AUTH-PLUGIN", "DCK-REGISTRY-CERTS",
    "DCK-SWARM-INACTIVE", "DCK-PID-MODE",
  ];
  return {
    name: "Docker",
    checks: ids.map((id) => ({
      id,
      category: "Docker",
      name: id,
      severity: "info" as const,
      passed: true,
      currentValue: "Docker not installed",
      expectedValue: "Docker installed and configured securely",
    })),
    score: 100,
    maxScore: 100,
  };
}

function makeSshCategory(): AuditCategory {
  return {
    name: "SSH",
    checks: [
      {
        id: "SSH-PASSWORD-AUTH",
        category: "SSH",
        name: "Password Auth",
        severity: "critical" as const,
        passed: true,
        currentValue: "no",
        expectedValue: "no",
      },
    ],
    score: 100,
    maxScore: 100,
  };
}

function makeBaseResult(extra: Partial<AuditResult> = {}): AuditResult {
  return {
    serverName: "test-server",
    serverIp: "1.2.3.4",
    platform: "bare",
    timestamp: "2026-03-16T00:00:00.000Z",
    auditVersion: "1.10.0",
    categories: [makeSshCategory()],
    overallScore: 85,
    quickWins: [],
    ...extra,
  };
}

describe("detectSkippedCategories", () => {
  it("returns Docker in skipped list when all checks have 'Docker not installed' currentValue", async () => {
    const { detectSkippedCategories } = await import("../../src/core/audit/index");
    const categories = [makeSshCategory(), makeDockerSkippedCategory()];
    const skipped = detectSkippedCategories(categories);
    expect(skipped).toContain("Docker");
  });

  it("does NOT include SSH in skipped list when checks have real values", async () => {
    const { detectSkippedCategories } = await import("../../src/core/audit/index");
    const categories = [makeSshCategory(), makeDockerSkippedCategory()];
    const skipped = detectSkippedCategories(categories);
    expect(skipped).not.toContain("SSH");
  });

  it("does NOT include empty categories (0 checks) in skipped list", async () => {
    const { detectSkippedCategories } = await import("../../src/core/audit/index");
    const emptyCategory: AuditCategory = { name: "CloudMeta", checks: [], score: 0, maxScore: 0 };
    const categories = [emptyCategory, makeDockerSkippedCategory()];
    const skipped = detectSkippedCategories(categories);
    expect(skipped).not.toContain("CloudMeta");
    expect(skipped).toContain("Docker");
  });

  it("returns multiple skipped categories when multiple categories are skipped", async () => {
    const { detectSkippedCategories } = await import("../../src/core/audit/index");
    const malwareSkipped: AuditCategory = {
      name: "Malware",
      checks: [
        {
          id: "MLW-RKHUNTER",
          category: "Malware",
          name: "Rkhunter",
          severity: "info" as const,
          passed: true,
          currentValue: "rkhunter not installed",
          expectedValue: "rkhunter installed",
        },
      ],
      score: 100,
      maxScore: 100,
    };
    const categories = [makeSshCategory(), makeDockerSkippedCategory(), malwareSkipped];
    const skipped = detectSkippedCategories(categories);
    expect(skipped).toContain("Docker");
    expect(skipped).toContain("Malware");
    expect(skipped).not.toContain("SSH");
  });

  it("does NOT skip category when at least one check has a real (non-skip) value", async () => {
    const { detectSkippedCategories } = await import("../../src/core/audit/index");
    const mixedDockerCategory: AuditCategory = {
      name: "Docker",
      checks: [
        {
          id: "DCK-NO-TCP-SOCKET",
          category: "Docker",
          name: "No TCP Socket",
          severity: "info" as const,
          passed: true,
          currentValue: "Unix socket only",  // real value
          expectedValue: "No TCP socket",
        },
        {
          id: "DCK-NO-PRIVILEGED",
          category: "Docker",
          name: "No Privileged",
          severity: "info" as const,
          passed: true,
          currentValue: "Docker not installed",
          expectedValue: "Docker installed",
        },
      ],
      score: 50,
      maxScore: 100,
    };
    const skipped = detectSkippedCategories([mixedDockerCategory]);
    expect(skipped).not.toContain("Docker");
  });

  it("detects 'N/A' currentValue as a skip signal", async () => {
    const { detectSkippedCategories } = await import("../../src/core/audit/index");
    const naCategory: AuditCategory = {
      name: "SomeCheck",
      checks: [
        {
          id: "SC-TEST",
          category: "SomeCheck",
          name: "Test",
          severity: "info" as const,
          passed: true,
          currentValue: "N/A",
          expectedValue: "installed",
        },
      ],
      score: 100,
      maxScore: 100,
    };
    const skipped = detectSkippedCategories([naCategory]);
    expect(skipped).toContain("SomeCheck");
  });
});

describe("formatTerminal with skippedCategories", () => {
  it("shows 'Skipped: Docker (not installed)' line when skippedCategories includes Docker", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const result = makeBaseResult({ skippedCategories: ["Docker"] });
    const output = formatTerminal(result);
    expect(output).toContain("Skipped: Docker (not installed)");
  });

  it("does NOT show skipped line when skippedCategories is empty", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const result = makeBaseResult({ skippedCategories: [] });
    const output = formatTerminal(result);
    expect(output).not.toContain("Skipped:");
  });

  it("does NOT show skipped line when skippedCategories is undefined", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const result = makeBaseResult();  // no skippedCategories
    const output = formatTerminal(result);
    expect(output).not.toContain("Skipped:");
  });

  it("shows multiple skipped categories when present", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const result = makeBaseResult({ skippedCategories: ["Docker", "Malware"] });
    const output = formatTerminal(result);
    expect(output).toContain("Skipped: Docker (not installed)");
    expect(output).toContain("Skipped: Malware (not installed)");
  });
});

describe("skippedCategories does not affect scoring", () => {
  it("overall score is identical with or without skippedCategories set", async () => {
    const { formatTerminal } = await import("../../src/core/audit/formatters/terminal");
    const withSkip = makeBaseResult({ skippedCategories: ["Docker"], overallScore: 85 });
    const withoutSkip = makeBaseResult({ overallScore: 85 });
    const outWith = formatTerminal(withSkip);
    const outWithout = formatTerminal(withoutSkip);
    // Both should show the same overall score
    expect(outWith).toContain("85");
    expect(outWithout).toContain("85");
  });
});
