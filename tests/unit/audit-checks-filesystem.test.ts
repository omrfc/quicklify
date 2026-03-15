import { parseFilesystemChecks } from "../../src/core/audit/checks/filesystem.js";

describe("parseFilesystemChecks", () => {
  // Secure output includes data from all 9 filesystemSection() commands:
  // 1. World-writable files in /etc /usr (none)
  // 2. SUID binaries (typical safe set)
  // 3. /tmp permissions (sticky bit)
  // 4. Disk usage (low)
  // 5. findmnt output (with noexec/nosuid on all relevant mounts)
  // 6. /dev/shm stat
  // 7. umask
  // 8. home dir permissions (find output)
  // 9. /var/tmp stat
  const secureOutput = [
    // World-writable files (none)
    "N/A",
    // SUID binaries (typical safe set)
    "/usr/bin/passwd\n/usr/bin/sudo\n/usr/bin/chfn",
    // /tmp permissions
    "1777 root root",
    // Disk usage
    "Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1        50G   20G   28G  42% /",
    // findmnt output with noexec/nosuid on relevant mounts (includes /var/log as separate mount)
    "/home rw,nosuid,noexec,relatime\n/var/tmp rw,nosuid,noexec,relatime\n/dev/shm rw,nosuid,noexec\n/tmp rw,nosuid,noexec,relatime\n/var/log rw,nosuid,noexec,relatime\n/media rw,nodev,relatime\n/boot rw,nosuid,noexec,relatime",
    // /dev/shm stat
    "1777 root root",
    // umask
    "0022",
    // home dir permissions (750 = not world-readable)
    "750 /home/user1\n750 /home/user2",
    // /var/tmp stat
    "1777 root root",
  ].join("\n");

  const insecureOutput = [
    // World-writable files found
    "/etc/cron.d/something\n/etc/sensitive\n/usr/local/bin/app",
    // Many SUID binaries
    Array(15).fill("/usr/bin/something").join("\n"),
    // /tmp permissions (no sticky bit)
    "0777 root root",
    // Disk usage high
    "Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1        50G   48G    1G  96% /",
    // findmnt output — no noexec/nosuid
    "/home rw,relatime\n/var/tmp rw,relatime\n/dev/shm rw\n/tmp rw,relatime",
    // /dev/shm stat
    "777 root root",
    // umask (permissive)
    "0000",
    // home dir permissions (755 = world-readable)
    "755 /home/user1\n755 /home/user2",
    // /var/tmp stat
    "1777 root root",
  ].join("\n");

  it("should return 18 checks", () => {
    const checks = parseFilesystemChecks(secureOutput, "bare");
    expect(checks).toHaveLength(18);
    checks.forEach((check) => {
      expect(check.category).toBe("Filesystem");
      expect(check.id).toMatch(/^FS-[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)+$/);
    });
  });

  it("should return FS-TMP-STICKY-BIT passed when /tmp has sticky bit (1777)", () => {
    const checks = parseFilesystemChecks(secureOutput, "bare");
    const fs01 = checks.find((c: { id: string }) => c.id === "FS-TMP-STICKY-BIT");
    expect(fs01!.passed).toBe(true);
  });

  it("should return FS-TMP-STICKY-BIT failed when /tmp has 0777 (no sticky bit)", () => {
    const checks = parseFilesystemChecks(insecureOutput, "bare");
    const fs01 = checks.find((c: { id: string }) => c.id === "FS-TMP-STICKY-BIT");
    expect(fs01!.passed).toBe(false);
  });

  it("should return FS-NO-WORLD-WRITABLE passed when no world-writable files", () => {
    const checks = parseFilesystemChecks(secureOutput, "bare");
    const fs02 = checks.find((c: { id: string }) => c.id === "FS-NO-WORLD-WRITABLE");
    expect(fs02!.passed).toBe(true);
  });

  it("should return FS-NO-WORLD-WRITABLE failed when world-writable files exist", () => {
    const checks = parseFilesystemChecks(insecureOutput, "bare");
    const fs02 = checks.find((c: { id: string }) => c.id === "FS-NO-WORLD-WRITABLE");
    expect(fs02!.passed).toBe(false);
  });

  it("should return FS-HOME-NOEXEC passed when /home mount has noexec", () => {
    const checks = parseFilesystemChecks(secureOutput, "bare");
    const check = checks.find((c: { id: string }) => c.id === "FS-HOME-NOEXEC");
    expect(check!.passed).toBe(true);
  });

  it("should return FS-HOME-NOEXEC failed when /home mount lacks noexec", () => {
    const checks = parseFilesystemChecks(insecureOutput, "bare");
    const check = checks.find((c: { id: string }) => c.id === "FS-HOME-NOEXEC");
    expect(check!.passed).toBe(false);
  });

  it("should return FS-TMP-NOEXEC passed when /tmp mount has noexec", () => {
    const checks = parseFilesystemChecks(secureOutput, "bare");
    const check = checks.find((c: { id: string }) => c.id === "FS-TMP-NOEXEC");
    expect(check!.passed).toBe(true);
  });

  it("should return FS-TMP-NOEXEC failed when /tmp mount lacks noexec", () => {
    const checks = parseFilesystemChecks(insecureOutput, "bare");
    const check = checks.find((c: { id: string }) => c.id === "FS-TMP-NOEXEC");
    expect(check!.passed).toBe(false);
  });

  it("should return FS-UMASK-RESTRICTIVE passed with umask 0022", () => {
    const checks = parseFilesystemChecks(secureOutput, "bare");
    const check = checks.find((c: { id: string }) => c.id === "FS-UMASK-RESTRICTIVE");
    expect(check!.passed).toBe(true);
  });

  it("should return FS-UMASK-RESTRICTIVE failed with permissive umask 0000", () => {
    const checks = parseFilesystemChecks(insecureOutput, "bare");
    const check = checks.find((c: { id: string }) => c.id === "FS-UMASK-RESTRICTIVE");
    expect(check!.passed).toBe(false);
  });

  it("should return FS-HOME-PERMISSIONS passed when home dirs are mode 750", () => {
    const checks = parseFilesystemChecks(secureOutput, "bare");
    const check = checks.find((c: { id: string }) => c.id === "FS-HOME-PERMISSIONS");
    expect(check!.passed).toBe(true);
  });

  it("should return FS-HOME-PERMISSIONS failed when home dirs are world-readable (755)", () => {
    const checks = parseFilesystemChecks(insecureOutput, "bare");
    const check = checks.find((c: { id: string }) => c.id === "FS-HOME-PERMISSIONS");
    expect(check!.passed).toBe(false);
  });

  it("should return FS-NODEV-REMOVABLE passed when /media mount has nodev", () => {
    const checks = parseFilesystemChecks(secureOutput, "bare");
    const check = checks.find((c: { id: string }) => c.id === "FS-NODEV-REMOVABLE");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  it("should return FS-VAR-LOG-SEPARATE passed when /var/log is a separate mount", () => {
    const checks = parseFilesystemChecks(secureOutput, "bare");
    const check = checks.find((c: { id: string }) => c.id === "FS-VAR-LOG-SEPARATE");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  it("should return FS-BOOT-NOSUID passed when /boot mount has nosuid", () => {
    const checks = parseFilesystemChecks(secureOutput, "bare");
    const check = checks.find((c: { id: string }) => c.id === "FS-BOOT-NOSUID");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  it("should handle N/A output gracefully", () => {
    const checks = parseFilesystemChecks("N/A", "bare");
    expect(checks).toHaveLength(18);
  });
});
