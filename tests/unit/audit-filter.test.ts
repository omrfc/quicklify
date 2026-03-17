import { filterAuditResult, buildFilterAnnotation } from "../../src/core/audit/filter";
import type { AuditResult, AuditCategory } from "../../src/core/audit/types";

// Mock AuditResult with 3 categories for comprehensive filter testing
const sshCategory: AuditCategory = {
  name: "SSH",
  checks: [
    {
      id: "SSH-PASSWORD-AUTH",
      category: "SSH",
      name: "Password Auth",
      severity: "critical",
      passed: false,
      currentValue: "yes",
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
    },
    {
      id: "SSH-MAX-AUTH-TRIES",
      category: "SSH",
      name: "Max Auth Tries",
      severity: "warning",
      passed: true,
      currentValue: "3",
      expectedValue: "3",
    },
  ],
  score: 30,
  maxScore: 100,
};

const firewallCategory: AuditCategory = {
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
    {
      id: "FW-DEFAULT-DENY",
      category: "Firewall",
      name: "Default Deny",
      severity: "info",
      passed: false,
      currentValue: "allow",
      expectedValue: "deny",
    },
  ],
  score: 50,
  maxScore: 100,
};

const updatesCategory: AuditCategory = {
  name: "Updates",
  checks: [
    {
      id: "UPD-AUTO-UPDATES",
      category: "Updates",
      name: "Auto Updates",
      severity: "warning",
      passed: false,
      currentValue: "disabled",
      expectedValue: "enabled",
    },
  ],
  score: 0,
  maxScore: 100,
};

const mockAuditResult: AuditResult = {
  serverName: "test-server",
  serverIp: "1.2.3.4",
  platform: "bare",
  timestamp: "2026-03-17T00:00:00.000Z",
  auditVersion: "1.10.0",
  categories: [sshCategory, firewallCategory, updatesCategory],
  overallScore: 53,
  quickWins: [],
};

describe("filterAuditResult", () => {
  it("returns result unchanged when no filter is provided (identity)", () => {
    const result = filterAuditResult(mockAuditResult, {});
    expect(result).toBe(mockAuditResult); // same reference — no copy needed
    expect(result.categories).toHaveLength(3);
    expect(result.overallScore).toBe(53);
  });

  it("filters by single category (ssh)", () => {
    const result = filterAuditResult(mockAuditResult, { category: "ssh" });
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].name).toBe("SSH");
    expect(result.overallScore).toBe(53); // preserved unchanged
  });

  it("filters by multiple categories (comma-separated)", () => {
    const result = filterAuditResult(mockAuditResult, { category: "ssh,firewall" });
    expect(result.categories).toHaveLength(2);
    const names = result.categories.map((c) => c.name);
    expect(names).toContain("SSH");
    expect(names).toContain("Firewall");
    expect(result.overallScore).toBe(53);
  });

  it("is case-insensitive for category matching ('SSH' matches 'ssh')", () => {
    const result = filterAuditResult(mockAuditResult, { category: "SSH" });
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].name).toBe("SSH");
  });

  it("filters by severity (critical only)", () => {
    const result = filterAuditResult(mockAuditResult, { severity: "critical" });
    // SSH has 2 critical, Firewall has 1 critical, Updates has 0 critical
    expect(result.categories).toHaveLength(2);
    const sshResult = result.categories.find((c) => c.name === "SSH");
    expect(sshResult?.checks).toHaveLength(2);
    expect(sshResult?.checks.every((ch) => ch.severity === "critical")).toBe(true);
    const fwResult = result.categories.find((c) => c.name === "Firewall");
    expect(fwResult?.checks).toHaveLength(1);
    expect(result.overallScore).toBe(53);
  });

  it("drops categories with zero checks after severity filter", () => {
    const result = filterAuditResult(mockAuditResult, { severity: "critical" });
    // Updates has only a warning check — should be dropped
    const updatesResult = result.categories.find((c) => c.name === "Updates");
    expect(updatesResult).toBeUndefined();
  });

  it("applies AND logic for combined category + severity filter", () => {
    const result = filterAuditResult(mockAuditResult, { category: "ssh", severity: "critical" });
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].name).toBe("SSH");
    expect(result.categories[0].checks).toHaveLength(2);
    expect(result.categories[0].checks.every((ch) => ch.severity === "critical")).toBe(true);
  });

  it("returns empty categories when combined filter matches nothing", () => {
    // SSH has no 'info' checks
    const result = filterAuditResult(mockAuditResult, { category: "ssh", severity: "info" });
    expect(result.categories).toHaveLength(0);
    expect(result.overallScore).toBe(53); // still preserved
  });

  it("does not mutate the original result", () => {
    const originalCategoryCount = mockAuditResult.categories.length;
    const originalScore = mockAuditResult.overallScore;
    filterAuditResult(mockAuditResult, { category: "ssh", severity: "critical" });
    expect(mockAuditResult.categories).toHaveLength(originalCategoryCount);
    expect(mockAuditResult.overallScore).toBe(originalScore);
  });

  it("preserves overallScore unchanged in all filter combinations", () => {
    const r1 = filterAuditResult(mockAuditResult, { category: "ssh" });
    const r2 = filterAuditResult(mockAuditResult, { severity: "warning" });
    const r3 = filterAuditResult(mockAuditResult, { category: "firewall", severity: "critical" });
    expect(r1.overallScore).toBe(53);
    expect(r2.overallScore).toBe(53);
    expect(r3.overallScore).toBe(53);
  });
});

describe("buildFilterAnnotation", () => {
  it("returns empty string when no filter is active", () => {
    expect(buildFilterAnnotation({})).toBe("");
  });

  it("returns annotation with category only", () => {
    expect(buildFilterAnnotation({ category: "ssh" })).toBe(" (showing category: ssh)");
  });

  it("returns annotation with severity only", () => {
    expect(buildFilterAnnotation({ severity: "critical" })).toBe(" (showing severity: critical)");
  });

  it("returns annotation with both category and severity", () => {
    expect(buildFilterAnnotation({ category: "ssh", severity: "critical" })).toBe(
      " (showing category: ssh, severity: critical)",
    );
  });
});
