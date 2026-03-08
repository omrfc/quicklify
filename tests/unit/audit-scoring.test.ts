import { calculateCategoryScore, calculateOverallScore } from "../../src/core/audit/scoring.js";
import type { AuditCheck, AuditCategory } from "../../src/core/audit/types.js";

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

describe("calculateCategoryScore", () => {
  it("should return score 100 when all checks pass", () => {
    const checks: AuditCheck[] = [
      makeCheck({ id: "T-01", severity: "critical", passed: true }),
      makeCheck({ id: "T-02", severity: "warning", passed: true }),
      makeCheck({ id: "T-03", severity: "info", passed: true }),
    ];

    const result = calculateCategoryScore(checks);
    expect(result.score).toBe(100);
  });

  it("should return score 0 when all checks fail", () => {
    const checks: AuditCheck[] = [
      makeCheck({ id: "T-01", severity: "critical", passed: false }),
      makeCheck({ id: "T-02", severity: "warning", passed: false }),
      makeCheck({ id: "T-03", severity: "info", passed: false }),
    ];

    const result = calculateCategoryScore(checks);
    expect(result.score).toBe(0);
  });

  it("should weight critical checks more than warning, warning more than info", () => {
    // Only critical fails: should lose more score
    const critFail: AuditCheck[] = [
      makeCheck({ id: "T-01", severity: "critical", passed: false }),
      makeCheck({ id: "T-02", severity: "warning", passed: true }),
      makeCheck({ id: "T-03", severity: "info", passed: true }),
    ];

    // Only info fails: should lose less score
    const infoFail: AuditCheck[] = [
      makeCheck({ id: "T-01", severity: "critical", passed: true }),
      makeCheck({ id: "T-02", severity: "warning", passed: true }),
      makeCheck({ id: "T-03", severity: "info", passed: false }),
    ];

    const critResult = calculateCategoryScore(critFail);
    const infoResult = calculateCategoryScore(infoFail);

    // Critical failure should result in lower score than info failure
    expect(critResult.score).toBeLessThan(infoResult.score);
  });

  it("should return score 0 and maxScore 0 for empty checks", () => {
    const result = calculateCategoryScore([]);
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(0);
  });

  it("should return maxScore based on total weights", () => {
    const checks: AuditCheck[] = [
      makeCheck({ id: "T-01", severity: "critical", passed: true }),
      makeCheck({ id: "T-02", severity: "warning", passed: false }),
    ];

    const result = calculateCategoryScore(checks);
    // critical=3, warning=2, total=5, passed=3
    expect(result.maxScore).toBe(100);
    expect(result.score).toBe(60); // 3/5 * 100 = 60
  });
});

describe("calculateOverallScore", () => {
  it("should average category scores with equal weight", () => {
    const categories: AuditCategory[] = [
      { name: "SSH", checks: [], score: 80, maxScore: 100 },
      { name: "Firewall", checks: [], score: 60, maxScore: 100 },
    ];

    const overall = calculateOverallScore(categories);
    expect(overall).toBe(70); // (80 + 60) / 2
  });

  it("should return 0 for empty categories", () => {
    const overall = calculateOverallScore([]);
    expect(overall).toBe(0);
  });

  it("should round to nearest integer", () => {
    const categories: AuditCategory[] = [
      { name: "SSH", checks: [], score: 33, maxScore: 100 },
      { name: "Firewall", checks: [], score: 33, maxScore: 100 },
      { name: "Docker", checks: [], score: 34, maxScore: 100 },
    ];

    const overall = calculateOverallScore(categories);
    // (33 + 33 + 34) / 3 = 33.333... -> 33
    expect(overall).toBe(33);
  });

  it("should handle single category", () => {
    const categories: AuditCategory[] = [
      { name: "SSH", checks: [], score: 95, maxScore: 100 },
    ];

    const overall = calculateOverallScore(categories);
    expect(overall).toBe(95);
  });
});
