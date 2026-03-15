import { parseTimeChecks } from "../../src/core/audit/checks/time.js";

describe("parseTimeChecks", () => {
  const syncedOutput = [
    "Local time: Sun 2026-03-15 12:00:00 UTC",
    "Universal time: Sun 2026-03-15 12:00:00 UTC",
    "RTC time: Sun 2026-03-15 12:00:00",
    "Time zone: UTC (UTC, +0000)",
    "NTP synchronized: yes",
    "NTP service: active",
    "active",
    "Reference ID    : A29FC801",
    "System time     : 0.000123456 seconds slow of NTP time",
    "UTC",
    "2026-03-15 12:00:00.000000+00:00",
  ].join("\n");

  const unsyncedOutput = [
    "Local time: Sun 2026-03-15 12:00:00 UTC",
    "NTP synchronized: no",
    "NTP service: inactive",
    "inactive",
    "N/A",
    "N/A",
    "N/A",
  ].join("\n");

  it("should return 8 checks for the Time category", () => {
    const checks = parseTimeChecks(syncedOutput, "bare");
    expect(checks.length).toBeGreaterThanOrEqual(8);
    checks.forEach((c) => expect(c.category).toBe("Time"));
  });

  it("all check IDs should start with TIME-", () => {
    const checks = parseTimeChecks(syncedOutput, "bare");
    checks.forEach((c) => expect(c.id).toMatch(/^TIME-/));
  });

  it("all checks should have explain > 20 chars and fixCommand defined", () => {
    const checks = parseTimeChecks(syncedOutput, "bare");
    checks.forEach((c) => {
      expect(c.explain!.length).toBeGreaterThan(20);
      expect(c.fixCommand).toBeDefined();
    });
  });

  it("TIME-NTP-ACTIVE passes when NTP service is active", () => {
    const checks = parseTimeChecks(syncedOutput, "bare");
    const check = checks.find((c) => c.id === "TIME-NTP-ACTIVE");
    expect(check!.passed).toBe(true);
  });

  it("TIME-SYNCHRONIZED passes when NTP synchronized: yes", () => {
    const checks = parseTimeChecks(syncedOutput, "bare");
    const check = checks.find((c) => c.id === "TIME-SYNCHRONIZED");
    expect(check!.passed).toBe(true);
  });

  it("TIME-SYNCHRONIZED fails when NTP synchronized: no", () => {
    const checks = parseTimeChecks(unsyncedOutput, "bare");
    const check = checks.find((c) => c.id === "TIME-SYNCHRONIZED");
    expect(check!.passed).toBe(false);
  });

  it("TIME-TIMEZONE-SET passes when timezone is configured", () => {
    const checks = parseTimeChecks(syncedOutput, "bare");
    const check = checks.find((c) => c.id === "TIME-TIMEZONE-SET");
    expect(check!.passed).toBe(true);
  });

  it("TIME-DRIFT-CHECK passes with small drift", () => {
    const checks = parseTimeChecks(syncedOutput, "bare");
    const check = checks.find((c) => c.id === "TIME-DRIFT-CHECK");
    expect(check!.passed).toBe(true);
  });

  it("TIME-NTP-PEERS-CONFIGURED passes when chrony Reference ID detected", () => {
    const checks = parseTimeChecks(syncedOutput, "bare");
    const check = checks.find((c) => c.id === "TIME-NTP-PEERS-CONFIGURED");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  it("TIME-NTP-PEERS-CONFIGURED passes when ntpq peer lines present", () => {
    const ntpOutput = syncedOutput + "\n* ntp1.example.com  0.0.0.0  2  u  1  64  377  0.000  0.000  0.000\n+ ntp2.example.com  0.0.0.0  2  u  2  64  377  0.001  0.001  0.001";
    const checks = parseTimeChecks(ntpOutput, "bare");
    const check = checks.find((c) => c.id === "TIME-NTP-PEERS-CONFIGURED");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  it("TIME-NO-DRIFT passes when NTP synchronized: yes", () => {
    const checks = parseTimeChecks(syncedOutput, "bare");
    const check = checks.find((c) => c.id === "TIME-NO-DRIFT");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  it("TIME-NO-DRIFT fails when NTP not synchronized", () => {
    const checks = parseTimeChecks(unsyncedOutput, "bare");
    const check = checks.find((c) => c.id === "TIME-NO-DRIFT");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
  });

  it("should handle N/A output gracefully", () => {
    const checks = parseTimeChecks("N/A", "bare");
    expect(checks.length).toBeGreaterThanOrEqual(8);
    checks.forEach((c) => {
      expect(c.passed).toBe(false);
      expect(c.currentValue).toBe("Unable to determine");
    });
  });
});
