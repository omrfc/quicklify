/**
 * CI gate: enforces minimum total check count across all categories.
 * Phase 47 Wave 2 target: >= 140 checks (132 existing + 14 new from MAC and Memory categories).
 */

import { CHECK_REGISTRY } from "../../src/core/audit/checks/index.js";

describe("Total check count CI gate", () => {
  it("should have at least 140 checks across all categories", () => {
    const allChecks = CHECK_REGISTRY.flatMap((entry) =>
      entry.parser("", "bare"),
    );
    expect(allChecks.length).toBeGreaterThanOrEqual(140);
  });

  it("each category should produce at least 1 check", () => {
    for (const entry of CHECK_REGISTRY) {
      const checks = entry.parser("", "bare");
      expect(checks.length).toBeGreaterThan(0);
    }
  });
});
