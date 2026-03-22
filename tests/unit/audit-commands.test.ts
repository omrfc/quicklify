import { buildAuditBatchCommands, BATCH_TIMEOUTS } from "../../src/core/audit/commands.js";
import type { BatchDef, BatchTier } from "../../src/core/audit/commands.js";

describe("buildAuditBatchCommands", () => {
  it("should return exactly 3 BatchDef objects", () => {
    const batches = buildAuditBatchCommands("bare");
    expect(batches).toHaveLength(3);
  });

  it("should give each BatchDef a valid tier property", () => {
    const batches = buildAuditBatchCommands("bare");
    const tiers = batches.map((b: BatchDef) => b.tier);
    expect(tiers).toEqual(["fast", "medium", "slow"]);
  });

  it("should contain named separators for SSH, FIREWALL, UPDATES, AUTH in batch 1 (fast)", () => {
    const [fast] = buildAuditBatchCommands("bare");
    expect(fast.command).toContain("---SECTION:SSH---");
    expect(fast.command).toContain("---SECTION:FIREWALL---");
    expect(fast.command).toContain("---SECTION:UPDATES---");
    expect(fast.command).toContain("---SECTION:AUTH---");
  });

  it("should contain named separators for DOCKER, NETWORK, LOGGING, KERNEL in batch 2 (medium)", () => {
    const [, medium] = buildAuditBatchCommands("bare");
    expect(medium.command).toContain("---SECTION:DOCKER---");
    expect(medium.command).toContain("---SECTION:NETWORK---");
    expect(medium.command).toContain("---SECTION:LOGGING---");
    expect(medium.command).toContain("---SECTION:KERNEL---");
  });

  it("should contain named separator for FILESYSTEM in batch 3 (slow)", () => {
    const [, , slow] = buildAuditBatchCommands("bare");
    expect(slow.command).toContain("---SECTION:FILESYSTEM---");
  });

  it("BATCH_TIMEOUTS should have fast=30000, medium=60000, slow=120000", () => {
    expect(BATCH_TIMEOUTS.fast).toBe(30_000);
    expect(BATCH_TIMEOUTS.medium).toBe(60_000);
    expect(BATCH_TIMEOUTS.slow).toBe(120_000);
  });

  it("should not contain old ---SEPARATOR--- format in any batch", () => {
    const batches = buildAuditBatchCommands("bare");
    batches.forEach((b: BatchDef) => {
      expect(b.command).not.toContain("---SEPARATOR---");
    });
  });

  it("should not export SECTION_INDICES", async () => {
    const mod = await import("../../src/core/audit/commands.js");
    expect((mod as Record<string, unknown>)["SECTION_INDICES"]).toBeUndefined();
  });

  it("should include platform-specific sections for coolify in medium batch", () => {
    const [, mediumBare] = buildAuditBatchCommands("bare");
    const [, mediumCoolify] = buildAuditBatchCommands("coolify");
    expect(mediumCoolify.command.length).toBeGreaterThan(mediumBare.command.length);
  });

  it("should include platform-specific sections for dokploy in medium batch", () => {
    const [, mediumBare] = buildAuditBatchCommands("bare");
    const [, mediumDokploy] = buildAuditBatchCommands("dokploy");
    expect(mediumDokploy.command.length).toBeGreaterThan(mediumBare.command.length);
  });

  it("should use defensive patterns in commands", () => {
    const batches = buildAuditBatchCommands("bare");
    const allCommands = batches.map((b: BatchDef) => b.command).join("\n");
    expect(allCommands).toContain("2>/dev/null");
    expect(allCommands).toMatch(/\|\| echo ['"]N\/A['"]/);
  });
});

// ─── Tier field — exact value assertions ─────────────────────────────────────

describe("BatchDef tier — exact values", () => {
  it("first batch tier is exactly 'fast'", () => {
    const [fast] = buildAuditBatchCommands("bare");
    expect(fast.tier).toBe("fast");
  });

  it("second batch tier is exactly 'medium'", () => {
    const [, medium] = buildAuditBatchCommands("bare");
    expect(medium.tier).toBe("medium");
  });

  it("third batch tier is exactly 'slow'", () => {
    const [, , slow] = buildAuditBatchCommands("bare");
    expect(slow.tier).toBe("slow");
  });

  it("tier values are not 'fast '/'medium '/'slow ' (no trailing space)", () => {
    const batches = buildAuditBatchCommands("bare");
    batches.forEach((b) => {
      expect(b.tier).not.toMatch(/\s/);
    });
  });
});

// ─── BATCH_TIMEOUTS — exact values ───────────────────────────────────────────

describe("BATCH_TIMEOUTS — exact value assertions", () => {
  it("fast timeout is exactly 30000 (not 29999 or 30001)", () => {
    expect(BATCH_TIMEOUTS.fast).toBe(30_000);
    expect(BATCH_TIMEOUTS.fast).not.toBe(29_999);
    expect(BATCH_TIMEOUTS.fast).not.toBe(30_001);
  });

  it("medium timeout is exactly 60000 (not 59999 or 60001)", () => {
    expect(BATCH_TIMEOUTS.medium).toBe(60_000);
    expect(BATCH_TIMEOUTS.medium).not.toBe(59_999);
    expect(BATCH_TIMEOUTS.medium).not.toBe(60_001);
  });

  it("slow timeout is exactly 120000 (not 119999 or 120001)", () => {
    expect(BATCH_TIMEOUTS.slow).toBe(120_000);
    expect(BATCH_TIMEOUTS.slow).not.toBe(119_999);
    expect(BATCH_TIMEOUTS.slow).not.toBe(120_001);
  });

  it("slow timeout is exactly 2x medium timeout", () => {
    expect(BATCH_TIMEOUTS.slow).toBe(BATCH_TIMEOUTS.medium * 2);
  });

  it("medium timeout is exactly 2x fast timeout", () => {
    expect(BATCH_TIMEOUTS.medium).toBe(BATCH_TIMEOUTS.fast * 2);
  });
});

// ─── Section separators — exact NAMED_SEP format ─────────────────────────────

describe("Named section separators — exact format", () => {
  it("SSH section separator is exactly echo '---SECTION:SSH---'", () => {
    const [fast] = buildAuditBatchCommands("bare");
    expect(fast.command).toContain("echo '---SECTION:SSH---'");
  });

  it("FIREWALL section separator is exactly echo '---SECTION:FIREWALL---'", () => {
    const [fast] = buildAuditBatchCommands("bare");
    expect(fast.command).toContain("echo '---SECTION:FIREWALL---'");
  });

  it("DOCKER section separator is exactly echo '---SECTION:DOCKER---'", () => {
    const [, medium] = buildAuditBatchCommands("bare");
    expect(medium.command).toContain("echo '---SECTION:DOCKER---'");
  });

  it("FILESYSTEM section separator is exactly echo '---SECTION:FILESYSTEM---'", () => {
    const [, , slow] = buildAuditBatchCommands("bare");
    expect(slow.command).toContain("echo '---SECTION:FILESYSTEM---'");
  });

  it("CRYPTO section is in slow batch", () => {
    const [, , slow] = buildAuditBatchCommands("bare");
    expect(slow.command).toContain("echo '---SECTION:CRYPTO---'");
  });

  it("MALWARE section is in slow batch", () => {
    const [, , slow] = buildAuditBatchCommands("bare");
    expect(slow.command).toContain("echo '---SECTION:MALWARE---'");
  });

  it("SECRETS section is in slow batch", () => {
    const [, , slow] = buildAuditBatchCommands("bare");
    expect(slow.command).toContain("echo '---SECTION:SECRETS---'");
  });

  it("SUPPLYCHAIN section is in slow batch", () => {
    const [, , slow] = buildAuditBatchCommands("bare");
    expect(slow.command).toContain("echo '---SECTION:SUPPLYCHAIN---'");
  });

  it("FILEINTEGRITY section is in slow batch", () => {
    const [, , slow] = buildAuditBatchCommands("bare");
    expect(slow.command).toContain("echo '---SECTION:FILEINTEGRITY---'");
  });

  it("ACCOUNTS section is in fast batch", () => {
    const [fast] = buildAuditBatchCommands("bare");
    expect(fast.command).toContain("echo '---SECTION:ACCOUNTS---'");
  });

  it("BOOT section is in fast batch", () => {
    const [fast] = buildAuditBatchCommands("bare");
    expect(fast.command).toContain("echo '---SECTION:BOOT---'");
  });

  it("SCHEDULING section is in fast batch", () => {
    const [fast] = buildAuditBatchCommands("bare");
    expect(fast.command).toContain("echo '---SECTION:SCHEDULING---'");
  });

  it("BANNERS section is in fast batch", () => {
    const [fast] = buildAuditBatchCommands("bare");
    expect(fast.command).toContain("echo '---SECTION:BANNERS---'");
  });

  it("TIME section is in medium batch", () => {
    const [, medium] = buildAuditBatchCommands("bare");
    expect(medium.command).toContain("echo '---SECTION:TIME---'");
  });

  it("MAC section is in medium batch", () => {
    const [, medium] = buildAuditBatchCommands("bare");
    expect(medium.command).toContain("echo '---SECTION:MAC---'");
  });

  it("MEMORY section is in medium batch", () => {
    const [, medium] = buildAuditBatchCommands("bare");
    expect(medium.command).toContain("echo '---SECTION:MEMORY---'");
  });

  it("CLOUDMETA section is in medium batch", () => {
    const [, medium] = buildAuditBatchCommands("bare");
    expect(medium.command).toContain("echo '---SECTION:CLOUDMETA---'");
  });

  it("SERVICES section is in medium batch", () => {
    const [, medium] = buildAuditBatchCommands("bare");
    expect(medium.command).toContain("echo '---SECTION:SERVICES---'");
  });
});

// ─── Platform variation — coolify vs dokploy vs bare ─────────────────────────

describe("Platform variation — command content differences", () => {
  it("coolify medium batch includes /data/coolify path", () => {
    const [, medium] = buildAuditBatchCommands("coolify");
    expect(medium.command).toContain("/data/coolify");
  });

  it("dokploy medium batch includes /etc/dokploy path", () => {
    const [, medium] = buildAuditBatchCommands("dokploy");
    expect(medium.command).toContain("/etc/dokploy");
  });

  it("bare platform does NOT include coolify-specific path", () => {
    const [, medium] = buildAuditBatchCommands("bare");
    expect(medium.command).not.toContain("/data/coolify");
  });

  it("bare platform does NOT include dokploy-specific path", () => {
    const [, medium] = buildAuditBatchCommands("bare");
    expect(medium.command).not.toContain("/etc/dokploy");
  });

  it("coolify medium batch includes docker inspect coolify command", () => {
    const [, medium] = buildAuditBatchCommands("coolify");
    expect(medium.command).toContain("docker inspect coolify");
  });

  it("dokploy medium batch includes docker inspect dokploy command", () => {
    const [, medium] = buildAuditBatchCommands("dokploy");
    expect(medium.command).toContain("docker inspect dokploy");
  });

  it("fast batch is identical for all platforms", () => {
    const [fastBare] = buildAuditBatchCommands("bare");
    const [fastCoolify] = buildAuditBatchCommands("coolify");
    const [fastDokploy] = buildAuditBatchCommands("dokploy");
    expect(fastBare.command).toBe(fastCoolify.command);
    expect(fastBare.command).toBe(fastDokploy.command);
  });

  it("slow batch is identical for all platforms", () => {
    const [, , slowBare] = buildAuditBatchCommands("bare");
    const [, , slowCoolify] = buildAuditBatchCommands("coolify");
    const [, , slowDokploy] = buildAuditBatchCommands("dokploy");
    expect(slowBare.command).toBe(slowCoolify.command);
    expect(slowBare.command).toBe(slowDokploy.command);
  });
});

// ─── Command content — specific strings that kill mutations ──────────────────

describe("Command content — mutation-killing exact string assertions", () => {
  it("SSH section reads /etc/ssh/sshd_config", () => {
    const [fast] = buildAuditBatchCommands("bare");
    expect(fast.command).toContain("/etc/ssh/sshd_config");
  });

  it("FIREWALL section checks ufw status verbose", () => {
    const [fast] = buildAuditBatchCommands("bare");
    expect(fast.command).toContain("ufw status verbose");
  });

  it("UPDATES section checks for security updates via apt", () => {
    const [fast] = buildAuditBatchCommands("bare");
    expect(fast.command).toContain("apt list --upgradable");
  });

  it("UPDATES section checks for REBOOT_REQUIRED sentinel", () => {
    const [fast] = buildAuditBatchCommands("bare");
    expect(fast.command).toContain("REBOOT_REQUIRED");
  });

  it("AUTH section reads /etc/pam.d/common-auth", () => {
    const [fast] = buildAuditBatchCommands("bare");
    expect(fast.command).toContain("/etc/pam.d/common-auth");
  });

  it("KERNEL section checks randomize_va_space", () => {
    const [, medium] = buildAuditBatchCommands("bare");
    expect(medium.command).toContain("randomize_va_space");
  });

  it("FILEINTEGRITY section checks for AIDE installation", () => {
    const [, , slow] = buildAuditBatchCommands("bare");
    expect(slow.command).toContain("aide");
  });

  it("MALWARE section checks for rkhunter", () => {
    const [, , slow] = buildAuditBatchCommands("bare");
    expect(slow.command).toContain("rkhunter");
  });

  it("SECRETS section checks for world-readable .env files", () => {
    const [, , slow] = buildAuditBatchCommands("bare");
    expect(slow.command).toContain(".env");
  });

  it("DOCKER section checks daemon.json content", () => {
    const [, medium] = buildAuditBatchCommands("bare");
    expect(medium.command).toContain("/etc/docker/daemon.json");
  });

  it("DOCKER section uses ---DAEMON_JSON--- sentinel", () => {
    const [, medium] = buildAuditBatchCommands("bare");
    expect(medium.command).toContain("---DAEMON_JSON---");
  });

  it("DOCKER section uses ---END_DAEMON_JSON--- closing sentinel", () => {
    const [, medium] = buildAuditBatchCommands("bare");
    expect(medium.command).toContain("---END_DAEMON_JSON---");
  });

  it("LOGGING section checks rsyslog is-active", () => {
    const [, medium] = buildAuditBatchCommands("bare");
    expect(medium.command).toContain("rsyslog");
  });

  it("BOOT section checks grub.cfg permissions", () => {
    const [fast] = buildAuditBatchCommands("bare");
    expect(fast.command).toContain("grub.cfg");
  });

  it("CRYPTO section checks openssl version", () => {
    const [, , slow] = buildAuditBatchCommands("bare");
    expect(slow.command).toContain("openssl version");
  });

  it("SUPPLYCHAIN section checks apt-key list", () => {
    const [, , slow] = buildAuditBatchCommands("bare");
    expect(slow.command).toContain("apt-key list");
  });

  it("BACKUP section uses KASTELL_BACKUP_FOUND sentinel", () => {
    const [, medium] = buildAuditBatchCommands("bare");
    expect(medium.command).toContain("KASTELL_BACKUP_FOUND");
  });

  it("BACKUP section uses KASTELL_BACKUP_MISSING sentinel", () => {
    const [, medium] = buildAuditBatchCommands("bare");
    expect(medium.command).toContain("KASTELL_BACKUP_MISSING");
  });
});

// ─── Idempotency — same platform same result ──────────────────────────────────

describe("Idempotency", () => {
  it("calling buildAuditBatchCommands twice with same platform returns identical results", () => {
    const first = buildAuditBatchCommands("bare");
    const second = buildAuditBatchCommands("bare");
    expect(first[0].command).toBe(second[0].command);
    expect(first[1].command).toBe(second[1].command);
    expect(first[2].command).toBe(second[2].command);
  });

  it("result has exactly 2 keys per BatchDef: tier and command", () => {
    const batches = buildAuditBatchCommands("bare");
    for (const b of batches) {
      const keys = Object.keys(b).sort();
      expect(keys).toEqual(["command", "tier"].sort());
    }
  });
});
