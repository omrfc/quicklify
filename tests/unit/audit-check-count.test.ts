/**
 * CI gate: enforces minimum total check count across all categories.
 * Phase 49-05 result: 349 bare-metal checks (355 on VPS with Cloud Metadata 6 checks).
 * +27 checks from Phase 49-05 across 14 categories.
 * Note: Cloud Metadata returns [] on bare-metal/empty input (intentional — Phase 48-01 decision).
 * VPS environments will yield additional Cloud Metadata checks at runtime.
 */

import { CHECK_REGISTRY } from "../../src/core/audit/checks/index.js";

describe("Total check count CI gate", () => {
  it("should have at least 349 checks across all categories", () => {
    const allChecks = CHECK_REGISTRY.flatMap((entry) =>
      entry.parser("", "bare"),
    );
    expect(allChecks.length).toBeGreaterThanOrEqual(349);
  });

  it("each category should produce at least 1 check", () => {
    // Cloud Metadata intentionally returns [] on bare metal / empty input
    // (maxScore=0 excludes it from weighted score on non-VPS hosts — Phase 48-01 decision)
    const BARE_METAL_CATEGORIES = new Set(["Cloud Metadata"]);
    for (const entry of CHECK_REGISTRY) {
      if (BARE_METAL_CATEGORIES.has(entry.name)) continue;
      const checks = entry.parser("", "bare");
      expect(checks.length).toBeGreaterThan(0);
    }
  });
});
