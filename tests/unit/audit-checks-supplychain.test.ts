import { parseSupplyChainChecks } from "../../src/core/audit/checks/supplychain.js";

describe("parseSupplyChainChecks", () => {
  const validOutput = [
    "https://deb.debian.org/debian",
    "KEYS_PRESENT",
    "Listing...",
    "NO_UNSIGNED_PACKAGES",
    "APT_KEY_UNAVAIL",
    "REPOS_HAVE_SIGNATURES",
    "GPG_VERIFY_OK",
    "NO_UNAUTH_SOURCES",
  ].join("\n");

  const badOutput = [
    "http://deb.debian.org/debian\nhttp://security.debian.org/debian-security",
    "NO_KEYS",
    "Listing...\ndeprecated\napt-key is deprecated",
    "UNSIGNED_PACKAGES\nhttpd\ncurl",
    "Warning: apt-key is deprecated",
    "REPOS_NO_SIGNATURES",
    "GPG_VERIFY_FAIL",
    "UNAUTH_SOURCES_FOUND",
  ].join("\n");

  describe("N/A handling", () => {
    it("returns checks with passed=false and currentValue='Unable to determine' for N/A input", () => {
      const checks = parseSupplyChainChecks("N/A", "bare");
      checks.forEach((c) => {
        expect(c.passed).toBe(false);
        expect(c.currentValue).toBe("Unable to determine");
      });
    });

    it("returns checks with passed=false for empty string input", () => {
      const checks = parseSupplyChainChecks("", "bare");
      checks.forEach((c) => {
        expect(c.passed).toBe(false);
      });
    });
  });

  describe("check count and shape", () => {
    it("returns at least 6 checks", () => {
      const checks = parseSupplyChainChecks(validOutput, "bare");
      expect(checks.length).toBeGreaterThanOrEqual(6);
    });

    it("all check IDs start with SUPPLY-", () => {
      const checks = parseSupplyChainChecks("", "bare");
      checks.forEach((c) => expect(c.id).toMatch(/^SUPPLY-/));
    });

    it("all checks have explain.length > 20", () => {
      const checks = parseSupplyChainChecks("", "bare");
      checks.forEach((c) => expect((c.explain ?? "").length).toBeGreaterThan(20));
    });

    it("all checks have fixCommand defined", () => {
      const checks = parseSupplyChainChecks("", "bare");
      checks.forEach((c) => expect(c.fixCommand).toBeDefined());
    });

    it("category is 'Supply Chain' on all checks", () => {
      const checks = parseSupplyChainChecks(validOutput, "bare");
      checks.forEach((c) => expect(c.category).toBe("Supply Chain"));
    });
  });

  describe("severity budget", () => {
    it("critical checks <= 40% of total", () => {
      const checks = parseSupplyChainChecks("", "bare");
      const criticalCount = checks.filter((c) => c.severity === "critical").length;
      expect(criticalCount / checks.length).toBeLessThanOrEqual(0.4);
    });
  });

  describe("SUPPLY-APT-HTTPS-REPOS", () => {
    it("passes when APT repos use HTTPS", () => {
      const checks = parseSupplyChainChecks(validOutput, "bare");
      const check = checks.find((c) => c.id === "SUPPLY-APT-HTTPS-REPOS");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it("fails when APT repos use HTTP (unencrypted)", () => {
      const checks = parseSupplyChainChecks(badOutput, "bare");
      const check = checks.find((c) => c.id === "SUPPLY-APT-HTTPS-REPOS");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });
  });

  describe("SUPPLY-GPG-KEYS-TRUSTED", () => {
    it("passes when trusted GPG keys present", () => {
      const checks = parseSupplyChainChecks(validOutput, "bare");
      const check = checks.find((c) => c.id === "SUPPLY-GPG-KEYS-TRUSTED");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it("fails when no trusted GPG keys found", () => {
      const checks = parseSupplyChainChecks(badOutput, "bare");
      const check = checks.find((c) => c.id === "SUPPLY-GPG-KEYS-TRUSTED");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });
  });

  describe("SUPPLY-NO-UNSIGNED-PACKAGES", () => {
    it("passes when no unsigned packages found", () => {
      const checks = parseSupplyChainChecks(validOutput, "bare");
      const check = checks.find((c) => c.id === "SUPPLY-NO-UNSIGNED-PACKAGES");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it("fails when unsigned packages detected", () => {
      const checks = parseSupplyChainChecks(badOutput, "bare");
      const check = checks.find((c) => c.id === "SUPPLY-NO-UNSIGNED-PACKAGES");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });
  });

  describe("SUPPLY-APT-KEY-DEPRECATED", () => {
    it("passes when apt-key deprecated warning absent", () => {
      const checks = parseSupplyChainChecks(validOutput, "bare");
      const check = checks.find((c) => c.id === "SUPPLY-APT-KEY-DEPRECATED");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it("fails when apt-key deprecated warning present", () => {
      const checks = parseSupplyChainChecks(badOutput, "bare");
      const check = checks.find((c) => c.id === "SUPPLY-APT-KEY-DEPRECATED");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });
  });
});
