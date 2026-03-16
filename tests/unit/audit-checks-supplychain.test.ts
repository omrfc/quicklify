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
    "NONE",
    "debian-archive-keyring.gpg ubuntu-keyring-2018-archive.gpg",
    "3",
    "/usr/bin/debsums",
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
    it("returns at least 12 checks", () => {
      const checks = parseSupplyChainChecks(validOutput, "bare");
      expect(checks.length).toBeGreaterThanOrEqual(12);
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

  describe("SUPPLY-NO-INSECURE-REPOS", () => {
    it("passes when NONE sentinel in apt-config output", () => {
      const checks = parseSupplyChainChecks(validOutput, "bare");
      const check = checks.find((c) => c.id === "SUPPLY-NO-INSECURE-REPOS");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it("fails when AllowUnauthenticated true found in apt-config (no NONE sentinel)", () => {
      // Use output without NONE so the check doesn't short-circuit
      const output = 'APT::Get::AllowUnauthenticated "true";\nAPT::Get::AllowInsecureRepositories "false";';
      const checks = parseSupplyChainChecks(output, "bare");
      const check = checks.find((c) => c.id === "SUPPLY-NO-INSECURE-REPOS");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });
  });

  describe("SUPPLY-GPG-KEYS-PRESENT", () => {
    it("passes when .gpg key files found in trusted.gpg.d", () => {
      const checks = parseSupplyChainChecks(validOutput, "bare");
      const check = checks.find((c) => c.id === "SUPPLY-GPG-KEYS-PRESENT");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it("fails when no GPG key files found", () => {
      const output = validOutput.replace("debian-archive-keyring.gpg ubuntu-keyring-2018-archive.gpg", "NONE_FOUND");
      const checks = parseSupplyChainChecks(output, "bare");
      const check = checks.find((c) => c.id === "SUPPLY-GPG-KEYS-PRESENT");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });
  });

  describe("SUPPLY-PACKAGE-VERIFY-CLEAN", () => {
    it("passes when modified package file count <= 5", () => {
      const checks = parseSupplyChainChecks(validOutput, "bare");
      const check = checks.find((c) => c.id === "SUPPLY-PACKAGE-VERIFY-CLEAN");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it("fails when modified package file count > 5", () => {
      const highCountOutput = validOutput + "\n20";
      const checks = parseSupplyChainChecks(highCountOutput, "bare");
      const check = checks.find((c) => c.id === "SUPPLY-PACKAGE-VERIFY-CLEAN");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });
  });

  describe("SUPPLY-DEBSUMS-INSTALLED", () => {
    it("passes when debsums path is in output", () => {
      const checks = parseSupplyChainChecks(validOutput, "bare");
      const check = checks.find((c) => c.id === "SUPPLY-DEBSUMS-INSTALLED");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it("fails when NOT_INSTALLED sentinel is present", () => {
      const noDebsumsOutput = validOutput.replace("/usr/bin/debsums", "NOT_INSTALLED");
      const checks = parseSupplyChainChecks(noDebsumsOutput, "bare");
      const check = checks.find((c) => c.id === "SUPPLY-DEBSUMS-INSTALLED");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });
  });
});
