/**
 * CI gate: enforces explain and fixCommand presence on all 400+ checks.
 * Every check must have an explain string > 20 chars and a fixCommand.
 * Cloud Metadata requires VPS-like input to enumerate its checks
 * (intentionally returns [] on bare metal — Phase 48-01 decision).
 */

import { CHECK_REGISTRY } from "../../src/core/audit/checks/index.js";
import type { AuditCheck } from "../../src/core/audit/types.js";

describe("CHECK_REGISTRY explain/fixCommand enforcement", () => {
  let allChecks: AuditCheck[];

  beforeAll(() => {
    allChecks = CHECK_REGISTRY.flatMap((entry) => {
      // Cloud Metadata returns [] on bare-metal empty input (Phase 48-01 decision)
      // Use VPS-like input to enumerate Cloud Metadata checks too
      if (entry.name === "Cloud Metadata") {
        return entry.parser(
          "VPS_TYPE:kvm\nMETADATA_ACCESSIBLE\nMETADATA_FIREWALL_MISSING\nCLOUDINIT_CLEAN\nCLOUDINIT_NO_SENSITIVE_ENV\nIMDSV2_UNAVAILABLE",
          "bare",
        );
      }
      return entry.parser("", "bare");
    });
  });

  it("all checks have explain with length > 20", () => {
    const violations = allChecks.filter(
      (c) => !c.explain || c.explain.length <= 20,
    );
    if (violations.length > 0) {
      console.error(
        "Checks missing explain or explain too short:",
        violations.map((c) => c.id),
      );
    }
    expect(violations).toHaveLength(0);
  });

  it("all checks have fixCommand", () => {
    const violations = allChecks.filter((c) => !c.fixCommand);
    if (violations.length > 0) {
      console.error("Checks missing fixCommand:", violations.map((c) => c.id));
    }
    expect(violations).toHaveLength(0);
  });

  it("total enforced checks exceeds 400", () => {
    expect(allChecks.length).toBeGreaterThanOrEqual(400);
  });
});
