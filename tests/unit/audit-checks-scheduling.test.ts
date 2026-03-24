import { parseSchedulingChecks } from "../../src/core/audit/checks/scheduling.js";

describe("parseSchedulingChecks", () => {
  const secureOutput = [
    "cron.allow EXISTS",
    "cron.deny EXISTS",
    "at.allow EXISTS",
    "at.deny EXISTS",
    "700 root root /etc/cron.d",
    "700 root root /etc/cron.daily",
    "700 root root /etc/cron.weekly",
    "700 root root /etc/cron.monthly",
    "700 root root /etc/cron.hourly",
    "600 root root /etc/crontab",
    "NONE",
    "3",
    "NONE",
  ].join("\n");

  const insecureOutput = [
    "cron.allow MISSING",
    "cron.deny MISSING",
    "at.allow MISSING",
    "at.deny MISSING",
    "777 root root /etc/cron.d",
    "755 root root /etc/cron.daily",
    "644 nobody nogroup /etc/crontab",
    "/etc/cron.d/somefile",
  ].join("\n");

  it("should return 12 checks for the Scheduling category", () => {
    const checks = parseSchedulingChecks(secureOutput, "bare");
    expect(checks.length).toBeGreaterThanOrEqual(12);
    checks.forEach((c) => expect(c.category).toBe("Scheduling"));
  });

  it("all check IDs should start with SCHED-", () => {
    const checks = parseSchedulingChecks(secureOutput, "bare");
    checks.forEach((c) => expect(c.id).toMatch(/^SCHED-/));
  });

  it("all checks should have explain > 20 chars and fixCommand defined", () => {
    const checks = parseSchedulingChecks(secureOutput, "bare");
    checks.forEach((c) => {
      expect(c.explain!.length).toBeGreaterThan(20);
      expect(c.fixCommand).toBeDefined();
    });
  });

  it("SCHED-CRON-ACCESS-CONTROL passes when cron.allow exists", () => {
    const checks = parseSchedulingChecks(secureOutput, "bare");
    const check = checks.find((c) => c.id === "SCHED-CRON-ACCESS-CONTROL");
    expect(check!.passed).toBe(true);
  });

  it("SCHED-CRON-ACCESS-CONTROL fails when cron.allow missing", () => {
    const checks = parseSchedulingChecks(insecureOutput, "bare");
    const check = checks.find((c) => c.id === "SCHED-CRON-ACCESS-CONTROL");
    expect(check!.passed).toBe(false);
  });

  it("SCHED-CRON-DIR-PERMS passes with no world-writable dirs", () => {
    const checks = parseSchedulingChecks(secureOutput, "bare");
    const check = checks.find((c) => c.id === "SCHED-CRON-DIR-PERMS");
    expect(check!.passed).toBe(true);
  });

  it("SCHED-CRON-DIR-PERMS fails with world-writable dirs", () => {
    const checks = parseSchedulingChecks(insecureOutput, "bare");
    const check = checks.find((c) => c.id === "SCHED-CRON-DIR-PERMS");
    expect(check!.passed).toBe(false);
  });

  it("SCHED-CRONTAB-PERMS passes with 600 root", () => {
    const checks = parseSchedulingChecks(secureOutput, "bare");
    const check = checks.find((c) => c.id === "SCHED-CRONTAB-PERMS");
    expect(check!.passed).toBe(true);
  });

  it("SCHED-CRONTAB-OWNER passes when /etc/crontab is 600 root root", () => {
    const checks = parseSchedulingChecks(secureOutput, "bare");
    const check = checks.find((c) => c.id === "SCHED-CRONTAB-OWNER");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  it("SCHED-CRONTAB-OWNER fails when /etc/crontab is 644 nobody nogroup", () => {
    const checks = parseSchedulingChecks(insecureOutput, "bare");
    const check = checks.find((c) => c.id === "SCHED-CRONTAB-OWNER");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
  });

  it("SCHED-NO-USER-CRONTABS passes when no world-writable cron entries", () => {
    const checks = parseSchedulingChecks(secureOutput, "bare");
    const check = checks.find((c) => c.id === "SCHED-NO-USER-CRONTABS");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  it("SCHED-NO-USER-CRONTABS fails when world-writable cron directories found", () => {
    const checks = parseSchedulingChecks(insecureOutput, "bare");
    const check = checks.find((c) => c.id === "SCHED-NO-USER-CRONTABS");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
  });

  it("SCHED-CRON-D-FILE-COUNT passes when count <= 15", () => {
    const checks = parseSchedulingChecks(secureOutput, "bare");
    const check = checks.find((c) => c.id === "SCHED-CRON-D-FILE-COUNT");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  it("SCHED-CRON-D-FILE-COUNT fails when count > 15", () => {
    // Replace the "3" count with "20" to simulate too many cron.d files
    const highCountOutput = secureOutput.replace("\n3\n", "\n20\n");
    const checks = parseSchedulingChecks(highCountOutput, "bare");
    const check = checks.find((c) => c.id === "SCHED-CRON-D-FILE-COUNT");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
  });

  it("SCHED-NO-WORLD-READABLE-CRONTABS passes when NONE sentinel present", () => {
    const checks = parseSchedulingChecks(secureOutput, "bare");
    const check = checks.find((c) => c.id === "SCHED-NO-WORLD-READABLE-CRONTABS");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  it("SCHED-NO-WORLD-READABLE-CRONTABS fails when world-readable crontab path found", () => {
    const worldReadableOutput = secureOutput + "\n/var/spool/cron/crontabs/alice";
    const checks = parseSchedulingChecks(worldReadableOutput, "bare");
    const check = checks.find((c) => c.id === "SCHED-NO-WORLD-READABLE-CRONTABS");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
  });

  it("should handle N/A output gracefully", () => {
    const checks = parseSchedulingChecks("N/A", "bare");
    expect(checks.length).toBeGreaterThanOrEqual(12);
    checks.forEach((c) => {
      expect(c.passed).toBe(false);
      expect(c.currentValue).toBe("Unable to determine");
    });
  });

  describe("SCHED-CRON-DENY — missing branch", () => {
    it("fails when MISSING appears before cron.deny", () => {
      const output = "MISSING cron.deny";
      const checks = parseSchedulingChecks(output, "bare");
      const check = checks.find((c) => c.id === "SCHED-CRON-DENY");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });

    it("fails when cron.deny is not mentioned at all", () => {
      const output = "some unrelated output";
      const checks = parseSchedulingChecks(output, "bare");
      const check = checks.find((c) => c.id === "SCHED-CRON-DENY");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });
  });

  describe("SCHED-AT-ACCESS-CONTROL — missing branch", () => {
    it("fails when at.allow MISSING", () => {
      const output = "at.allow MISSING";
      const checks = parseSchedulingChecks(output, "bare");
      const check = checks.find((c) => c.id === "SCHED-AT-ACCESS-CONTROL");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });
  });

  describe("SCHED-AT-DENY — missing branch", () => {
    it("fails when MISSING appears before at.deny", () => {
      const output = "MISSING at.deny";
      const checks = parseSchedulingChecks(output, "bare");
      const check = checks.find((c) => c.id === "SCHED-AT-DENY");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });

    it("fails when at.deny is not mentioned at all", () => {
      const output = "some unrelated output";
      const checks = parseSchedulingChecks(output, "bare");
      const check = checks.find((c) => c.id === "SCHED-AT-DENY");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });
  });

  describe("SCHED-CRONTAB-PERMS — 644 owner root branch", () => {
    it("passes with 644 root permissions", () => {
      const output = "644 root root /etc/crontab";
      const checks = parseSchedulingChecks(output, "bare");
      const check = checks.find((c) => c.id === "SCHED-CRONTAB-PERMS");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it("fails with 777 permissions", () => {
      const output = "777 root root /etc/crontab";
      const checks = parseSchedulingChecks(output, "bare");
      const check = checks.find((c) => c.id === "SCHED-CRONTAB-PERMS");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });

    it("fails when unable to parse permissions", () => {
      const output = "no crontab permissions info";
      const checks = parseSchedulingChecks(output, "bare");
      const check = checks.find((c) => c.id === "SCHED-CRONTAB-PERMS");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.currentValue).toContain("Unable to read");
    });
  });

  describe("SCHED-CRON-D-PERMS — alternative permissions", () => {
    it("passes with 750 root permissions", () => {
      const output = "750 root root /etc/cron.d";
      const checks = parseSchedulingChecks(output, "bare");
      const check = checks.find((c) => c.id === "SCHED-CRON-D-PERMS");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it("passes with 755 root permissions", () => {
      const output = "755 root root /etc/cron.d";
      const checks = parseSchedulingChecks(output, "bare");
      const check = checks.find((c) => c.id === "SCHED-CRON-D-PERMS");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it("fails when unable to parse permissions", () => {
      const output = "no cron.d permissions info";
      const checks = parseSchedulingChecks(output, "bare");
      const check = checks.find((c) => c.id === "SCHED-CRON-D-PERMS");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.currentValue).toContain("Unable to read");
    });
  });

  describe("SCHED-CRON-DAILY-PERMS — alternative permissions", () => {
    it("passes with 750 root permissions", () => {
      const output = "750 root root /etc/cron.daily";
      const checks = parseSchedulingChecks(output, "bare");
      const check = checks.find((c) => c.id === "SCHED-CRON-DAILY-PERMS");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it("fails when unable to parse permissions", () => {
      const output = "no cron.daily permissions info";
      const checks = parseSchedulingChecks(output, "bare");
      const check = checks.find((c) => c.id === "SCHED-CRON-DAILY-PERMS");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.currentValue).toContain("Unable to read");
    });
  });

  describe("SCHED-CRON-D-FILE-COUNT — no standalone numbers branch", () => {
    it("fails when no standalone numbers are found in output", () => {
      const output = "cron.d contains various files but no count line";
      const checks = parseSchedulingChecks(output, "bare");
      const check = checks.find((c) => c.id === "SCHED-CRON-D-FILE-COUNT");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.currentValue).toContain("Unable to determine");
    });
  });

  describe("SCHED-CRONTAB-OWNER — edge cases", () => {
    it("fails when permissions > 600 even with root owner", () => {
      const output = "644 root root /etc/crontab";
      const checks = parseSchedulingChecks(output, "bare");
      const check = checks.find((c) => c.id === "SCHED-CRONTAB-OWNER");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });

    it("fails when owner is not root", () => {
      const output = "600 nobody root /etc/crontab";
      const checks = parseSchedulingChecks(output, "bare");
      const check = checks.find((c) => c.id === "SCHED-CRONTAB-OWNER");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });

    it("fails when unable to parse ownership", () => {
      const output = "no crontab ownership info";
      const checks = parseSchedulingChecks(output, "bare");
      const check = checks.find((c) => c.id === "SCHED-CRONTAB-OWNER");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.currentValue).toContain("Unable to read");
    });
  });
});
