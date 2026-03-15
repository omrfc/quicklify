/**
 * File Integrity security check parser.
 * Parses AIDE/Tripwire installation, AIDE database init, cron scheduling,
 * auditd installation/status, and audit rules into 8 security checks.
 */

import type { AuditCheck, CheckParser, Severity } from "../types.js";

interface FileIntegrityCheckDef {
  id: string;
  name: string;
  severity: Severity;
  check: (output: string) => { passed: boolean; currentValue: string };
  expectedValue: string;
  fixCommand: string;
  explain: string;
}

const FILEINTEGRITY_CHECKS: FileIntegrityCheckDef[] = [
  {
    id: "FINT-AIDE-INSTALLED",
    name: "AIDE Installed",
    severity: "warning",
    check: (output) => {
      const installed = /^ii\s+aide\b/m.test(output);
      return {
        passed: installed,
        currentValue: installed ? "AIDE is installed" : "AIDE not installed",
      };
    },
    expectedValue: "AIDE (Advanced Intrusion Detection Environment) installed",
    fixCommand: "apt install aide -y && aideinit && mv /var/lib/aide/aide.db.new /var/lib/aide/aide.db",
    explain: "AIDE monitors file integrity by comparing file hashes against a known-good baseline, detecting unauthorized changes to critical system files.",
  },
  {
    id: "FINT-TRIPWIRE-INSTALLED",
    name: "Tripwire Installed",
    severity: "info",
    check: (output) => {
      const installed = /^ii\s+tripwire\b/m.test(output);
      return {
        passed: installed,
        currentValue: installed ? "Tripwire is installed" : "Tripwire not installed",
      };
    },
    expectedValue: "Tripwire installed (alternative file integrity monitor)",
    fixCommand: "apt install tripwire -y && tripwire --init",
    explain: "Tripwire is an alternative file integrity monitoring tool. Either AIDE or Tripwire provides file integrity monitoring capability.",
  },
  {
    id: "FINT-AIDE-DB-EXISTS",
    name: "AIDE Database Initialized",
    severity: "warning",
    check: (output) => {
      const exists = /AIDE_DB_EXISTS/.test(output);
      return {
        passed: exists,
        currentValue: exists ? "AIDE database exists and initialized" : "AIDE database not initialized",
      };
    },
    expectedValue: "AIDE database file exists at /var/lib/aide/aide.db or aide.db.gz",
    fixCommand: "aideinit && mv /var/lib/aide/aide.db.new /var/lib/aide/aide.db",
    explain: "The AIDE database stores file integrity baselines. Without it, AIDE cannot detect unauthorized changes even if installed.",
  },
  {
    id: "FINT-AIDE-CRON",
    name: "AIDE Scheduled Check",
    severity: "warning",
    check: (output) => {
      const noAideCron = /NO_AIDE_CRON/.test(output);
      const hasAideCron = !noAideCron && /aide/i.test(output);
      return {
        passed: hasAideCron,
        currentValue: hasAideCron ? "AIDE cron schedule found" : "No AIDE cron job configured",
      };
    },
    expectedValue: "Cron job for AIDE scheduled check exists",
    fixCommand: "echo '0 3 * * * root /usr/sbin/aide --check' > /etc/cron.d/aide && chmod 644 /etc/cron.d/aide",
    explain: "AIDE must run on a schedule to continuously detect unauthorized changes. A missing cron job means integrity violations may go undetected.",
  },
  {
    id: "FINT-AUDITD-INSTALLED",
    name: "auditd Installed",
    severity: "warning",
    check: (output) => {
      const installed = /^ii\s+auditd\b/m.test(output);
      return {
        passed: installed,
        currentValue: installed ? "auditd is installed" : "auditd not installed",
      };
    },
    expectedValue: "auditd (Linux Audit daemon) installed",
    fixCommand: "apt install auditd audispd-plugins -y && systemctl enable auditd && systemctl start auditd",
    explain: "auditd provides comprehensive audit logging for system calls and file access, essential for detecting and investigating security incidents.",
  },
  {
    id: "FINT-AUDITD-RUNNING",
    name: "auditd Running",
    severity: "warning",
    check: (output) => {
      const active = /\bactive\b/.test(output) && !/\binactive\b/.test(output);
      return {
        passed: active,
        currentValue: active ? "auditd is active" : "auditd is not running",
      };
    },
    expectedValue: "auditd service is active and running",
    fixCommand: "systemctl enable auditd && systemctl start auditd",
    explain: "An installed but inactive auditd provides no security monitoring. auditd must be running to capture audit events.",
  },
  {
    id: "FINT-AUDIT-PASSWD-RULE",
    name: "/etc/passwd Changes Audited",
    severity: "warning",
    check: (output) => {
      const hasRule = /\/etc\/passwd/.test(output) && !/NO_RULES/.test(output);
      return {
        passed: hasRule,
        currentValue: hasRule ? "Audit rule for /etc/passwd exists" : "No audit rule for /etc/passwd",
      };
    },
    expectedValue: "auditctl rule watching /etc/passwd for changes",
    fixCommand: "echo '-w /etc/passwd -p wa -k identity' >> /etc/audit/rules.d/kastell.rules && augenrules --load",
    explain: "Auditing changes to /etc/passwd detects unauthorized account creation, modification, or deletion events.",
  },
  {
    id: "FINT-AUDIT-SHADOW-RULE",
    name: "/etc/shadow Changes Audited",
    severity: "warning",
    check: (output) => {
      const hasRule = /\/etc\/shadow/.test(output) && !/NO_RULES/.test(output);
      return {
        passed: hasRule,
        currentValue: hasRule ? "Audit rule for /etc/shadow exists" : "No audit rule for /etc/shadow",
      };
    },
    expectedValue: "auditctl rule watching /etc/shadow for changes",
    fixCommand: "echo '-w /etc/shadow -p wa -k identity' >> /etc/audit/rules.d/kastell.rules && augenrules --load",
    explain: "Auditing /etc/shadow detects unauthorized password changes or credential manipulation that could indicate a compromise.",
  },
];

export const parseFileIntegrityChecks: CheckParser = (
  sectionOutput: string,
  _platform: string,
): AuditCheck[] => {
  const isNA =
    !sectionOutput ||
    sectionOutput.trim() === "N/A" ||
    sectionOutput.trim() === "";
  const output = isNA ? "" : sectionOutput;

  return FILEINTEGRITY_CHECKS.map((def) => {
    if (isNA) {
      return {
        id: def.id,
        category: "File Integrity",
        name: def.name,
        severity: def.severity,
        passed: false,
        currentValue: "Unable to determine",
        expectedValue: def.expectedValue,
        fixCommand: def.fixCommand,
        explain: def.explain,
      };
    }
    const { passed, currentValue } = def.check(output);
    return {
      id: def.id,
      category: "File Integrity",
      name: def.name,
      severity: def.severity,
      passed,
      currentValue,
      expectedValue: def.expectedValue,
      fixCommand: def.fixCommand,
      explain: def.explain,
    };
  });
};
