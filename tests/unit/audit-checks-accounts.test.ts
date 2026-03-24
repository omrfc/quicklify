import { parseAccountsChecks } from "../../src/core/audit/checks/accounts.js";

describe("parseAccountsChecks", () => {
  const validOutput = [
    // /etc/passwd data (user:uid:shell)
    "root:0:/bin/bash",
    "daemon:1:/usr/sbin/nologin",
    "bin:2:/usr/sbin/nologin",
    "sys:3:/usr/sbin/nologin",
    "nobody:65534:/usr/sbin/nologin",
    "admin:1000:/bin/bash",
    // /etc/shadow data (user:hash)
    "root:$6$abc::",
    "daemon:*::",
    "admin:$6$xyz::",
    // Home dir ownership
    "/home/admin admin",
    // Dangerous files
    "NONE",
    // System accounts with shells
    "sync:/bin/sync",
    // Total user count (standalone number > 5, must come before "700" to avoid false match)
    "25",
    // Root home perms
    "700",
    // login.defs
    "PASS_MAX_DAYS 365",
    "PASS_MIN_DAYS 1",
    "UMASK 027",
    // Duplicate UIDs
    "NONE",
    // lastlog output (no inactive accounts — N/A means not available)
    "N/A",
    // Home directory permissions (not world-writable)
    "750 /home/admin",
    // login.defs UID/GID range (ACCT-LOGIN-DEFS-UID-MAX)
    "UID_MIN 1000",
    "UID_MAX 60000",
    "GID_MIN 1000",
    "GID_MAX 60000",
    // Login shell count (ACCT-LOGIN-SHELL-AUDIT) — standalone number <= 10
    "3",
    // Duplicate GIDs (ACCT-GID-CONSISTENCY) — NONE means clean
    "NONE",
  ].join("\n");

  const insecureOutput = [
    // Extra UID 0 account
    "root:0:/bin/bash",
    "backdoor:0:/bin/bash",
    "admin:1000:/bin/bash",
    // Shadow with empty password
    "root:$6$abc::",
    "testuser:::",
    // Home dir mismatch
    "/home/admin root",
    // Dangerous files present
    "-rw-r--r-- 1 root root 0 .rhosts",
    "-rw-r--r-- 1 root root 0 .netrc",
    "-rw-r--r-- 1 root root 0 hosts.equiv",
    // System account with bash
    "games:/bin/bash",
    // Root home world-readable
    "755",
    // Weak password policy
    "PASS_MAX_DAYS 99999",
    "PASS_MIN_DAYS 0",
    "UMASK 022",
    // Duplicate UIDs
    "dup1:1000",
    "dup2:1000",
  ].join("\n");

  it("should return 22 checks for the Accounts category", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    expect(checks).toHaveLength(22);
    checks.forEach((c) => expect(c.category).toBe("Accounts"));
  });

  it("all check IDs should start with ACCT-", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    checks.forEach((c) => expect(c.id).toMatch(/^ACCT-/));
  });

  it("all checks should have explain > 20 chars and fixCommand defined", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    checks.forEach((c) => {
      expect(c.explain!.length).toBeGreaterThan(20);
      expect(c.fixCommand).toBeDefined();
      expect(c.fixCommand!.length).toBeGreaterThan(0);
    });
  });

  it("ACCT-NO-EXTRA-UID0 passes when only root has UID 0", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-EXTRA-UID0");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  it("ACCT-NO-EXTRA-UID0 fails when extra UID 0 exists", () => {
    const checks = parseAccountsChecks(insecureOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-EXTRA-UID0");
    expect(check!.passed).toBe(false);
  });

  it("ACCT-NO-EMPTY-PASSWORD fails when empty password hash found", () => {
    const checks = parseAccountsChecks(insecureOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-EMPTY-PASSWORD");
    expect(check!.passed).toBe(false);
  });

  it("ACCT-NO-RHOSTS passes when no .rhosts found", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-RHOSTS");
    expect(check!.passed).toBe(true);
  });

  it("ACCT-NO-RHOSTS fails when .rhosts present", () => {
    const checks = parseAccountsChecks(insecureOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-RHOSTS");
    expect(check!.passed).toBe(false);
  });

  it("ACCT-SYSTEM-SHELL passes when system accounts use nologin", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-SYSTEM-SHELL");
    expect(check!.passed).toBe(true);
  });

  it("ACCT-SYSTEM-SHELL fails when system account has /bin/bash", () => {
    const checks = parseAccountsChecks(insecureOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-SYSTEM-SHELL");
    expect(check!.passed).toBe(false);
  });

  it("ACCT-MAX-PASSWORD-DAYS fails when set to 99999", () => {
    const checks = parseAccountsChecks(insecureOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-MAX-PASSWORD-DAYS");
    expect(check!.passed).toBe(false);
  });

  it("should handle N/A output gracefully", () => {
    const checks = parseAccountsChecks("N/A", "bare");
    expect(checks).toHaveLength(22);
    checks.forEach((c) => {
      expect(c.passed).toBe(false);
      expect(c.currentValue).toBe("Unable to determine");
    });
  });

  it("should handle empty string output gracefully", () => {
    const checks = parseAccountsChecks("", "bare");
    expect(checks).toHaveLength(22);
    checks.forEach((c) => expect(c.passed).toBe(false));
  });

  it("ACCT-TOTAL-USERS-REASONABLE passes when user count is a number > 5 and < 50", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-TOTAL-USERS-REASONABLE");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  it("ACCT-NO-WORLD-WRITABLE-HOME passes when no world-writable home dirs", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-WORLD-WRITABLE-HOME");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  it("severity budget: <= 40% critical checks", () => {
    const checks = parseAccountsChecks("", "bare");
    const criticalCount = checks.filter((c) => c.severity === "critical").length;
    const ratio = criticalCount / checks.length;
    expect(ratio).toBeLessThanOrEqual(0.4);
  });

  it("ACCT-LOGIN-DEFS-UID-MAX passes when UID_MIN >= 1000 and UID_MAX >= 60000", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-LOGIN-DEFS-UID-MAX");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
    expect(check!.currentValue).toMatch(/UID_MIN=1000/);
  });

  it("ACCT-LOGIN-DEFS-UID-MAX fails when UID_MIN < 1000", () => {
    const output = validOutput.replace("UID_MIN 1000", "UID_MIN 500");
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-LOGIN-DEFS-UID-MAX");
    expect(check!.passed).toBe(false);
  });

  it("ACCT-LOGIN-SHELL-AUDIT passes when login shell count <= 10", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-LOGIN-SHELL-AUDIT");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
    expect(check!.currentValue).toMatch(/3 accounts/);
  });

  it("ACCT-LOGIN-SHELL-AUDIT fails when login shell count > 10", () => {
    const output = validOutput.replace("\n3\n", "\n15\n");
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-LOGIN-SHELL-AUDIT");
    expect(check!.passed).toBe(false);
  });

  it("ACCT-GID-CONSISTENCY passes when duplicate GID check returns NONE", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-GID-CONSISTENCY");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  it("ACCT-GID-CONSISTENCY fails when duplicate GIDs found", () => {
    // Use a minimal output without any NONE sentinel but with duplicate GID numbers
    const output = "root:0:/bin/bash\nadmin:1000:/bin/bash\nroot:$6$abc::\n/home/admin admin\n25\n700\nPASS_MAX_DAYS 90\nPASS_MIN_DAYS 1\n1000\n1001";
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-GID-CONSISTENCY");
    expect(check!.passed).toBe(false);
  });

  // --- Branch coverage: ACCT-NO-EMPTY-PASSWORD pass case ---
  it("ACCT-NO-EMPTY-PASSWORD passes when all accounts have password hashes", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-EMPTY-PASSWORD");
    expect(check!.passed).toBe(true);
    expect(check!.currentValue).toBe("No empty password hashes");
  });

  it("ACCT-NO-EMPTY-PASSWORD currentValue lists users with empty passwords", () => {
    const checks = parseAccountsChecks(insecureOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-EMPTY-PASSWORD");
    expect(check!.currentValue).toMatch(/Empty password: testuser/);
  });

  // --- Branch coverage: ACCT-HOSTS-EQUIV (not tested at all) ---
  it("ACCT-HOSTS-EQUIV passes when no hosts.equiv present", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-HOSTS-EQUIV");
    expect(check!.passed).toBe(true);
    expect(check!.currentValue).toBe("No hosts.equiv file");
  });

  it("ACCT-HOSTS-EQUIV fails when hosts.equiv file is found", () => {
    const checks = parseAccountsChecks(insecureOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-HOSTS-EQUIV");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toBe("/etc/hosts.equiv found");
  });

  // --- Branch coverage: ACCT-NO-NETRC ---
  it("ACCT-NO-NETRC passes when no .netrc present", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-NETRC");
    expect(check!.passed).toBe(true);
    expect(check!.currentValue).toBe("No .netrc files");
  });

  it("ACCT-NO-NETRC fails when .netrc present", () => {
    const checks = parseAccountsChecks(insecureOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-NETRC");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toBe(".netrc file found");
  });

  // --- Branch coverage: ACCT-NO-FORWARD ---
  it("ACCT-NO-FORWARD passes when no .forward present", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-FORWARD");
    expect(check!.passed).toBe(true);
    expect(check!.currentValue).toBe("No .forward files");
  });

  it("ACCT-NO-FORWARD fails when .forward file is found", () => {
    // Must not contain "NONE" or "No such file" for the check to detect .forward
    const output = "root:0:/bin/bash\nroot:$6$abc::\n-rw-r--r-- 1 root root 0 .forward\n25\n700";
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-FORWARD");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toBe(".forward file found");
  });

  // --- Branch coverage: ACCT-ROOT-HOME-PERMS ---
  it("ACCT-ROOT-HOME-PERMS passes when others have no access", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-ROOT-HOME-PERMS");
    expect(check!.passed).toBe(true);
    expect(check!.currentValue).toMatch(/\/root permissions: 700/);
  });

  it("ACCT-ROOT-HOME-PERMS fails when others can access", () => {
    const checks = parseAccountsChecks(insecureOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-ROOT-HOME-PERMS");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toMatch(/others can access/);
  });

  it("ACCT-ROOT-HOME-PERMS fails when permissions cannot be read", () => {
    // Output with no valid 3-4 digit permission number on its own line
    const output = "root:0:/bin/bash\nroot:$6$abc::\nNONE\nno-perms-here";
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-ROOT-HOME-PERMS");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toBe("Unable to read /root permissions");
  });

  // --- Branch coverage: ACCT-NO-DUPLICATE-UID ---
  it("ACCT-NO-DUPLICATE-UID passes when no duplicates", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-DUPLICATE-UID");
    expect(check!.passed).toBe(true);
    expect(check!.currentValue).toBe("No duplicate UIDs found");
  });

  it("ACCT-NO-DUPLICATE-UID fails when duplicates found", () => {
    const checks = parseAccountsChecks(insecureOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-DUPLICATE-UID");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toMatch(/Duplicate UIDs/);
  });

  // --- Branch coverage: ACCT-HOME-OWNERSHIP ---
  it("ACCT-HOME-OWNERSHIP passes when all homes correctly owned", () => {
    // Minimal output with only home ownership line to avoid cross-line regex match
    const output = "/home/admin admin\n/home/bob bob\nroot:$6$abc::";
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-HOME-OWNERSHIP");
    expect(check!.passed).toBe(true);
    expect(check!.currentValue).toBe("All home directories correctly owned");
  });

  it("ACCT-HOME-OWNERSHIP fails when ownership is mismatched", () => {
    const checks = parseAccountsChecks(insecureOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-HOME-OWNERSHIP");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toMatch(/Mismatched/);
  });

  // --- Branch coverage: ACCT-SHADOW-PERMS ---
  it("ACCT-SHADOW-PERMS passes when shadow data is readable by root", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-SHADOW-PERMS");
    expect(check!.passed).toBe(true);
    expect(check!.currentValue).toBe("/etc/shadow readable by root only");
  });

  it("ACCT-SHADOW-PERMS fails when Permission denied", () => {
    const output = "Permission denied\nNONE";
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-SHADOW-PERMS");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toBe("/etc/shadow access issue detected");
  });

  // --- Branch coverage: ACCT-MAX-PASSWORD-DAYS ---
  it("ACCT-MAX-PASSWORD-DAYS passes when <= 365 and > 0", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-MAX-PASSWORD-DAYS");
    expect(check!.passed).toBe(true);
    expect(check!.currentValue).toBe("PASS_MAX_DAYS = 365");
  });

  it("ACCT-MAX-PASSWORD-DAYS fails when PASS_MAX_DAYS not configured", () => {
    const output = "root:0:/bin/bash\nNONE";
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-MAX-PASSWORD-DAYS");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toBe("PASS_MAX_DAYS not configured");
  });

  it("ACCT-MAX-PASSWORD-DAYS fails when days is 0", () => {
    const output = validOutput.replace("PASS_MAX_DAYS 365", "PASS_MAX_DAYS 0");
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-MAX-PASSWORD-DAYS");
    expect(check!.passed).toBe(false);
  });

  // --- Branch coverage: ACCT-MIN-PASSWORD-DAYS ---
  it("ACCT-MIN-PASSWORD-DAYS passes when > 0", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-MIN-PASSWORD-DAYS");
    expect(check!.passed).toBe(true);
    expect(check!.currentValue).toBe("PASS_MIN_DAYS = 1");
  });

  it("ACCT-MIN-PASSWORD-DAYS fails when 0", () => {
    const checks = parseAccountsChecks(insecureOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-MIN-PASSWORD-DAYS");
    expect(check!.passed).toBe(false);
  });

  it("ACCT-MIN-PASSWORD-DAYS fails when not configured", () => {
    const output = "root:0:/bin/bash\nNONE";
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-MIN-PASSWORD-DAYS");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toBe("PASS_MIN_DAYS not configured");
  });

  // --- Branch coverage: ACCT-INACTIVE-LOCK ---
  it("ACCT-INACTIVE-LOCK passes when INACTIVE is configured", () => {
    const output = validOutput + "\nINACTIVE = 30";
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-INACTIVE-LOCK");
    expect(check!.passed).toBe(true);
    expect(check!.currentValue).toBe("Inactive lockout configured");
  });

  it("ACCT-INACTIVE-LOCK passes when useradd -f is configured", () => {
    const output = validOutput + "\nuseradd -D -f 30";
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-INACTIVE-LOCK");
    expect(check!.passed).toBe(true);
  });

  it("ACCT-INACTIVE-LOCK fails when no inactive lockout policy", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-INACTIVE-LOCK");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toBe("No inactive account lockout policy");
  });

  // --- Branch coverage: ACCT-DEFAULT-UMASK ---
  it("ACCT-DEFAULT-UMASK passes with 027", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-DEFAULT-UMASK");
    expect(check!.passed).toBe(true);
    expect(check!.currentValue).toBe("UMASK = 027");
  });

  it("ACCT-DEFAULT-UMASK passes with 077", () => {
    const output = validOutput.replace("UMASK 027", "UMASK 077");
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-DEFAULT-UMASK");
    expect(check!.passed).toBe(true);
    expect(check!.currentValue).toBe("UMASK = 077");
  });

  it("ACCT-DEFAULT-UMASK fails with 022", () => {
    const checks = parseAccountsChecks(insecureOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-DEFAULT-UMASK");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toBe("UMASK = 022");
  });

  it("ACCT-DEFAULT-UMASK fails when UMASK not configured", () => {
    const output = "root:0:/bin/bash\nNONE";
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-DEFAULT-UMASK");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toBe("UMASK not configured in login.defs");
  });

  // --- Branch coverage: ACCT-NO-EMPTY-HOME ---
  it("ACCT-NO-EMPTY-HOME passes when fewer than 10 users with login shells", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-EMPTY-HOME");
    expect(check!.passed).toBe(true);
  });

  it("ACCT-NO-EMPTY-HOME filters out root and underscore-prefixed users", () => {
    // root and _apt should be filtered, only testuser remains
    const output = "root:0:/bin/bash\n_apt:100:/bin/bash\ntestuser:1001:/bin/bash\n25\n700\nNONE";
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-EMPTY-HOME");
    expect(check!.passed).toBe(true);
    expect(check!.currentValue).toMatch(/1 user\(s\) with login shells/);
  });

  // --- Branch coverage: ACCT-INACTIVE-ACCOUNTS ---
  it("ACCT-INACTIVE-ACCOUNTS passes when N/A", () => {
    const checks = parseAccountsChecks(validOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-INACTIVE-ACCOUNTS");
    expect(check!.passed).toBe(true);
    expect(check!.currentValue).toBe("Inactive account check not available");
  });

  it("ACCT-INACTIVE-ACCOUNTS passes when fewer than 5 inactive", () => {
    // Only lastlog-style lines (no N/A), fewer than 5 non-empty non-header lines
    const output = "Username Port From Latest\nuser1 pts/0 192.168.1.1 Mon Jan 1\nuser2 pts/0 192.168.1.2 Mon Jan 2";
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-INACTIVE-ACCOUNTS");
    expect(check!.passed).toBe(true);
    expect(check!.currentValue).toMatch(/2 accounts.*acceptable/);
  });

  it("ACCT-INACTIVE-ACCOUNTS fails when 5+ accounts inactive", () => {
    const inactiveLines = Array.from({ length: 6 }, (_, i) =>
      `user${i} pts/0 192.168.1.${i} Mon Jan ${i + 1}`
    ).join("\n");
    const output = validOutput.replace("N/A", inactiveLines);
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-INACTIVE-ACCOUNTS");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toMatch(/review recommended/);
  });

  // --- Branch coverage: ACCT-TOTAL-USERS-REASONABLE ---
  it("ACCT-TOTAL-USERS-REASONABLE fails when user count >= 50", () => {
    const output = validOutput.replace("\n25\n", "\n55\n");
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-TOTAL-USERS-REASONABLE");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toMatch(/excessive/);
  });

  it("ACCT-TOTAL-USERS-REASONABLE fails when user count not determinable", () => {
    // No standalone number > 5 in output
    const output = "root:0:/bin/bash\nNONE\nabc";
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-TOTAL-USERS-REASONABLE");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toBe("User count not determinable");
  });

  // --- Branch coverage: ACCT-NO-WORLD-WRITABLE-HOME ---
  it("ACCT-NO-WORLD-WRITABLE-HOME fails when world-writable dirs exist", () => {
    const output = validOutput + "\n777 /home/vulnerable";
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-WORLD-WRITABLE-HOME");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toMatch(/world-writable/);
  });

  it("ACCT-NO-WORLD-WRITABLE-HOME passes for perms ending in 0,1,4,5", () => {
    const output = "750 /home/user1\n755 /home/user2\n700 /home/user3\n701 /home/user4";
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-WORLD-WRITABLE-HOME");
    expect(check!.passed).toBe(true);
  });

  // --- Branch coverage: ACCT-LOGIN-DEFS-UID-MAX ---
  it("ACCT-LOGIN-DEFS-UID-MAX fails when UID_MAX < 60000", () => {
    const output = validOutput.replace("UID_MAX 60000", "UID_MAX 10000");
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-LOGIN-DEFS-UID-MAX");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toMatch(/non-standard/);
  });

  it("ACCT-LOGIN-DEFS-UID-MAX fails when UID_MIN or UID_MAX missing", () => {
    const output = "root:0:/bin/bash\nNONE";
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-LOGIN-DEFS-UID-MAX");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toBe("UID_MIN or UID_MAX not found in login.defs");
  });

  // --- Branch coverage: ACCT-LOGIN-SHELL-AUDIT ---
  it("ACCT-LOGIN-SHELL-AUDIT fails when shell count not determinable", () => {
    // Output with no standalone numbers in 0-500 range
    const output = "root:0:/bin/bash\nNONE\nabc";
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-LOGIN-SHELL-AUDIT");
    expect(check!.passed).toBe(false);
    expect(check!.currentValue).toBe("Login shell count not determinable");
  });

  // --- Branch coverage: ACCT-NO-EXTRA-UID0 currentValue when extras found ---
  it("ACCT-NO-EXTRA-UID0 currentValue lists extra UID 0 accounts", () => {
    const checks = parseAccountsChecks(insecureOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-EXTRA-UID0");
    expect(check!.currentValue).toMatch(/Extra UID 0: backdoor/);
  });

  // --- Branch coverage: ACCT-SYSTEM-SHELL currentValue when system accounts have shells ---
  it("ACCT-SYSTEM-SHELL currentValue lists system accounts with shells", () => {
    const checks = parseAccountsChecks(insecureOutput, "bare");
    const check = checks.find((c) => c.id === "ACCT-SYSTEM-SHELL");
    expect(check!.currentValue).toMatch(/System accounts with shells:/);
    expect(check!.currentValue).toMatch(/games/);
  });

  // --- Branch coverage: .rhosts with "No such file" should pass ---
  it("ACCT-NO-RHOSTS passes when output contains .rhosts with 'No such file'", () => {
    const output = validOutput + "\n.rhosts: No such file or directory";
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-RHOSTS");
    expect(check!.passed).toBe(true);
  });

  // --- Branch coverage: platform parameter (coolify/dokploy) ---
  it("works with coolify platform parameter", () => {
    const checks = parseAccountsChecks(validOutput, "coolify");
    expect(checks).toHaveLength(22);
    expect(checks[0].category).toBe("Accounts");
  });

  it("works with dokploy platform parameter", () => {
    const checks = parseAccountsChecks(validOutput, "dokploy");
    expect(checks).toHaveLength(22);
  });

  // --- Branch coverage: ACCT-NO-WORLD-WRITABLE-HOME perms with last digit 2,3,6 ---
  it("ACCT-NO-WORLD-WRITABLE-HOME detects permission ending in 2 (write)", () => {
    const output = "752 /home/user1";
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-WORLD-WRITABLE-HOME");
    expect(check!.passed).toBe(false);
  });

  it("ACCT-NO-WORLD-WRITABLE-HOME detects permission ending in 3", () => {
    const output = "753 /home/user1";
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-WORLD-WRITABLE-HOME");
    expect(check!.passed).toBe(false);
  });

  it("ACCT-NO-WORLD-WRITABLE-HOME detects permission ending in 6", () => {
    const output = "756 /home/user1";
    const checks = parseAccountsChecks(output, "bare");
    const check = checks.find((c) => c.id === "ACCT-NO-WORLD-WRITABLE-HOME");
    expect(check!.passed).toBe(false);
  });
});
