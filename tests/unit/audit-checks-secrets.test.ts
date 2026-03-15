import { parseSecretsChecks } from "../../src/core/audit/checks/secrets.js";

describe("parseSecretsChecks", () => {
  const validOutput = [
    "NO_WORLD_READABLE_ENV",
    "NONE",
    "600 /home/alice/.ssh/id_rsa",
    "NONE",
    "NONE",
    "NO_ENV_IN_HOME",
    "NO_WORLD_READABLE_KEYS",
    "NO_PLAINTEXT_ETC_CRED",
    "NO_AWS_CREDS",
    "NO_DOCKER_ENV",
    "NO_NPMRC_TOKEN",
    "NONE",
    "allowagentforwarding no",
  ].join("\n");

  const badOutput = [
    "WORLD_READABLE_ENV\n/home/alice/app/.env",
    "664 /home/alice/.ssh/id_rsa\n644 /home/bob/.ssh/id_ed25519",
    "/home/alice/.git/config\n/opt/app/.git/config",
    "/etc/mysql/my.cnf\n/etc/redis/redis.conf",
    "ENV_IN_HOME\n/home/alice/.env",
    "WORLD_READABLE_KEY\n/home/alice/.ssh/id_rsa",
    "PLAINTEXT_ETC_CRED\n/etc/mysql/my.cnf",
    "AWS_CREDS_FOUND\n/home/alice/.aws/credentials",
    "DOCKER_ENV_FOUND\n/home/alice/docker.env",
    "NPMRC_TOKEN_FOUND\n/home/alice/.npmrc",
  ].join("\n");

  describe("N/A handling", () => {
    it("returns checks with passed=false and currentValue='Unable to determine' for N/A input", () => {
      const checks = parseSecretsChecks("N/A", "bare");
      checks.forEach((c) => {
        expect(c.passed).toBe(false);
        expect(c.currentValue).toBe("Unable to determine");
      });
    });

    it("returns checks with passed=false for empty string input", () => {
      const checks = parseSecretsChecks("", "bare");
      checks.forEach((c) => {
        expect(c.passed).toBe(false);
      });
    });
  });

  describe("check count and shape", () => {
    it("returns at least 12 checks", () => {
      const checks = parseSecretsChecks(validOutput, "bare");
      expect(checks.length).toBeGreaterThanOrEqual(12);
    });

    it("all check IDs start with SECRETS- or SEC-", () => {
      const checks = parseSecretsChecks("", "bare");
      checks.forEach((c) => expect(c.id).toMatch(/^(SECRETS|SEC)-/));
    });

    it("all checks have explain.length > 20", () => {
      const checks = parseSecretsChecks("", "bare");
      checks.forEach((c) => expect((c.explain ?? "").length).toBeGreaterThan(20));
    });

    it("all checks have fixCommand defined", () => {
      const checks = parseSecretsChecks("", "bare");
      checks.forEach((c) => expect(c.fixCommand).toBeDefined());
    });

    it("category is 'Secrets' on all checks", () => {
      const checks = parseSecretsChecks(validOutput, "bare");
      checks.forEach((c) => expect(c.category).toBe("Secrets"));
    });
  });

  describe("severity budget", () => {
    it("critical checks <= 40% of total", () => {
      const checks = parseSecretsChecks("", "bare");
      const criticalCount = checks.filter((c) => c.severity === "critical").length;
      expect(criticalCount / checks.length).toBeLessThanOrEqual(0.4);
    });
  });

  describe("SECRETS-ENV-WORLD-READABLE", () => {
    it("passes when WORLD_READABLE_ENV sentinel absent", () => {
      const checks = parseSecretsChecks(validOutput, "bare");
      const check = checks.find((c) => c.id === "SECRETS-ENV-WORLD-READABLE");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it("fails when WORLD_READABLE_ENV sentinel present", () => {
      const checks = parseSecretsChecks(badOutput, "bare");
      const check = checks.find((c) => c.id === "SECRETS-ENV-WORLD-READABLE");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });
  });

  describe("SECRETS-SSH-KEY-PERMS", () => {
    it("passes when SSH keys have 600 permissions", () => {
      const checks = parseSecretsChecks(validOutput, "bare");
      const check = checks.find((c) => c.id === "SECRETS-SSH-KEY-PERMS");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it("fails when SSH keys have overly permissive permissions (644)", () => {
      const checks = parseSecretsChecks(badOutput, "bare");
      const check = checks.find((c) => c.id === "SECRETS-SSH-KEY-PERMS");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });
  });

  describe("SECRETS-GIT-CONFIG-TOKEN", () => {
    it("passes when no .git/config token paths found", () => {
      const checks = parseSecretsChecks(validOutput, "bare");
      const check = checks.find((c) => c.id === "SECRETS-GIT-CONFIG-TOKEN");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it("fails when .git/config token paths found", () => {
      const checks = parseSecretsChecks(badOutput, "bare");
      const check = checks.find((c) => c.id === "SECRETS-GIT-CONFIG-TOKEN");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });
  });

  describe("SECRETS-ETC-PLAINTEXT-CRED", () => {
    it("passes when no plaintext credentials in /etc", () => {
      const checks = parseSecretsChecks(validOutput, "bare");
      const check = checks.find((c) => c.id === "SECRETS-ETC-PLAINTEXT-CRED");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it("fails when plaintext credentials found in /etc", () => {
      const checks = parseSecretsChecks(badOutput, "bare");
      const check = checks.find((c) => c.id === "SECRETS-ETC-PLAINTEXT-CRED");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });
  });

  describe("SEC-NO-READABLE-HISTORY", () => {
    it("passes when no world-readable .bash_history files found", () => {
      const checks = parseSecretsChecks(validOutput, "bare");
      const check = checks.find((c) => c.id === "SEC-NO-READABLE-HISTORY");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it("fails when world-readable .bash_history files found", () => {
      const output = validOutput + "\n/home/alice/.bash_history";
      const checks = parseSecretsChecks(output, "bare");
      const check = checks.find((c) => c.id === "SEC-NO-READABLE-HISTORY");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });
  });

  describe("SEC-NO-SSH-AGENT-FORWARDING", () => {
    it("passes when allowagentforwarding no", () => {
      const checks = parseSecretsChecks(validOutput, "bare");
      const check = checks.find((c) => c.id === "SEC-NO-SSH-AGENT-FORWARDING");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it("fails when allowagentforwarding yes", () => {
      const output = validOutput.replace("allowagentforwarding no", "allowagentforwarding yes");
      const checks = parseSecretsChecks(output, "bare");
      const check = checks.find((c) => c.id === "SEC-NO-SSH-AGENT-FORWARDING");
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });
  });
});
