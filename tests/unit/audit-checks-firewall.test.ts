import { parseFirewallChecks } from "../../src/core/audit/checks/firewall.js";

describe("parseFirewallChecks", () => {
  const activeSecureOutput = [
    "Status: active",
    "Logging: on (low)",
    "Default: deny (incoming), allow (outgoing), disabled (routed)",
    "",
    "To                         Action      From",
    "--                         ------      ----",
    "22/tcp                     ALLOW IN    Anywhere",
    "80/tcp                     ALLOW IN    Anywhere",
    "443/tcp                    ALLOW IN    Anywhere",
    // nft output
    "table inet filter {",
    "  chain input {",
    "    type filter hook input priority 0; policy drop;",
    "  }",
    "}",
    // iptables INPUT chain with DROP policy
    "Chain INPUT (policy DROP 0 packets, 0 bytes)",
    "num  target     prot opt source               destination",
    "1    ACCEPT     all  --  0.0.0.0/0            0.0.0.0/0            state RELATED,ESTABLISHED",
    "2    ACCEPT     tcp  --  0.0.0.0/0            0.0.0.0/0            tcp dpt:22",
    "Chain OUTPUT (policy ACCEPT 0 packets, 0 bytes)",
    // iptables rule count line
    "15",
    // fail2ban status
    "Status",
    "|- Number of jail: 2",
    "|  `- Jail list: sshd, apache",
    "|- Number of peers: 0",
    // rate limiting
    "ACCEPT     tcp  --  0.0.0.0/0  0.0.0.0/0  limit: avg 3/min burst 3",
    // FORWARD chain policy (FW-FORWARD-CHAIN-DENY)
    "Chain FORWARD (policy DROP 0 packets, 0 bytes)",
    // ip6tables INPUT line count (FW-IPV6-DISABLED-OR-FILTERED) — number > 3
    "5",
    // conntrack max (FW-CONNTRACK-MAX) — a number in 1000-10M range >= 65536
    "131072",
    // LOG rule count (FW-LOG-DROPPED) — a small number 0-100 > 0
    "3",
  ].join("\n");

  const inactiveOutput = "Status: inactive";

  it("should return 17 checks for active firewall with deny default", () => {
    const checks = parseFirewallChecks(activeSecureOutput, "bare");
    expect(checks).toHaveLength(17);
    checks.forEach((check) => {
      expect(check.category).toBe("Firewall");
      expect(check.id).toMatch(/^FW-[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)+$/);
    });
  });

  it("should return FW-UFW-ACTIVE and FW-DEFAULT-DENY passed for active deny-incoming firewall", () => {
    const checks = parseFirewallChecks(activeSecureOutput, "bare");
    const fw01 = checks.find((c) => c.id === "FW-UFW-ACTIVE");
    const fw02 = checks.find((c) => c.id === "FW-DEFAULT-DENY");
    expect(fw01!.passed).toBe(true);
    expect(fw02!.passed).toBe(true);
  });

  it("should return FW-UFW-ACTIVE failed when firewall is inactive", () => {
    const checks = parseFirewallChecks(inactiveOutput, "bare");
    const fw01 = checks.find((c) => c.id === "FW-UFW-ACTIVE");
    expect(fw01!.passed).toBe(false);
    expect(fw01!.severity).toBe("critical");
  });

  it("should return FW-SSH-ALLOWED passed when SSH port is in rules", () => {
    const checks = parseFirewallChecks(activeSecureOutput, "bare");
    const fw03 = checks.find((c) => c.id === "FW-SSH-ALLOWED");
    expect(fw03!.passed).toBe(true);
  });

  it("should return FW-NO-WIDE-OPEN passed when no wide-open 0.0.0.0/0 on non-SSH ports", () => {
    const checks = parseFirewallChecks(activeSecureOutput, "bare");
    const fw04 = checks.find((c) => c.id === "FW-NO-WIDE-OPEN");
    expect(fw04!.passed).toBe(true);
  });

  it("should return FW-NO-WIDE-OPEN failed when 0.0.0.0/0 rule on non-SSH port exists", () => {
    const wideOpen = [
      "Status: active",
      "Default: deny (incoming), allow (outgoing), disabled (routed)",
      "To                         Action      From",
      "--                         ------      ----",
      "3306/tcp                   ALLOW IN    0.0.0.0/0",
    ].join("\n");
    const checks = parseFirewallChecks(wideOpen, "bare");
    const fw04 = checks.find((c) => c.id === "FW-NO-WIDE-OPEN");
    expect(fw04!.passed).toBe(false);
  });

  it("should return FW-INPUT-CHAIN-DENY passed when iptables INPUT policy is DROP", () => {
    const checks = parseFirewallChecks(activeSecureOutput, "bare");
    const fw09 = checks.find((c) => c.id === "FW-INPUT-CHAIN-DENY");
    expect(fw09!.passed).toBe(true);
    expect(fw09!.severity).toBe("critical");
  });

  it("should return FW-INPUT-CHAIN-DENY failed when iptables INPUT policy is ACCEPT", () => {
    const acceptPolicy = [
      "Status: active",
      "Chain INPUT (policy ACCEPT 0 packets, 0 bytes)",
    ].join("\n");
    const checks = parseFirewallChecks(acceptPolicy, "bare");
    const fw09 = checks.find((c) => c.id === "FW-INPUT-CHAIN-DENY");
    expect(fw09!.passed).toBe(false);
  });

  it("should return FW-FAIL2BAN-ACTIVE passed when fail2ban reports jails", () => {
    const checks = parseFirewallChecks(activeSecureOutput, "bare");
    const fw07 = checks.find((c) => c.id === "FW-FAIL2BAN-ACTIVE");
    expect(fw07!.passed).toBe(true);
    expect(fw07!.severity).toBe("warning");
  });

  it("should return FW-RATE-LIMIT passed when rate limiting rules present", () => {
    const checks = parseFirewallChecks(activeSecureOutput, "bare");
    const fw12 = checks.find((c) => c.id === "FW-RATE-LIMIT");
    expect(fw12!.passed).toBe(true);
  });

  it("FW-FORWARD-CHAIN-DENY passes when FORWARD chain policy is DROP", () => {
    const checks = parseFirewallChecks(activeSecureOutput, "bare");
    const check = checks.find((c) => c.id === "FW-FORWARD-CHAIN-DENY");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  it("FW-NO-WILDCARD-ACCEPT passes when no ACCEPT all wildcard rule", () => {
    const checks = parseFirewallChecks(activeSecureOutput, "bare");
    const check = checks.find((c) => c.id === "FW-NO-WILDCARD-ACCEPT");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  it("should handle N/A output gracefully", () => {
    const checks = parseFirewallChecks("N/A", "bare");
    expect(checks).toHaveLength(17);
    const fw01 = checks.find((c) => c.id === "FW-UFW-ACTIVE");
    expect(fw01!.passed).toBe(false);
  });

  it("FW-CONNTRACK-MAX passes when conntrack max is >= 65536", () => {
    const checks = parseFirewallChecks(activeSecureOutput, "bare");
    const check = checks.find((c) => c.id === "FW-CONNTRACK-MAX");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
    expect(check!.currentValue).toMatch(/131072/);
  });

  it("FW-CONNTRACK-MAX fails when conntrack max is below 65536", () => {
    const output = activeSecureOutput.replace("\n131072\n", "\n1024\n");
    const checks = parseFirewallChecks(output, "bare");
    const check = checks.find((c) => c.id === "FW-CONNTRACK-MAX");
    expect(check!.passed).toBe(false);
  });

  it("FW-LOG-DROPPED passes when LOG rule count > 0", () => {
    const checks = parseFirewallChecks(activeSecureOutput, "bare");
    const check = checks.find((c) => c.id === "FW-LOG-DROPPED");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
    expect(check!.currentValue).toMatch(/LOG rule/);
  });

  it("FW-LOG-DROPPED fails when only 0 LOG rules", () => {
    // Use output with ONLY conntrack_max and 0 LOG rules (no other small numbers)
    const output = "Status: active\nDefault: deny (incoming), allow (outgoing), disabled (routed)\nChain INPUT (policy DROP 0 packets, 0 bytes)\n131072\n0";
    const checks = parseFirewallChecks(output, "bare");
    const check = checks.find((c) => c.id === "FW-LOG-DROPPED");
    expect(check!.passed).toBe(false);
  });
});
