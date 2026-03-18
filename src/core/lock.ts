import { sshExec, assertValidIp } from "../utils/ssh.js";
import { buildHardeningCommand, buildFail2banCommand, buildKeyCheckCommand } from "./secure.js";
import { buildFirewallSetupCommand } from "./firewall.js";
import { runAudit } from "./audit/index.js";
import { raw, type SshCommand } from "../utils/sshCommand.js";
import type { Platform } from "../types/index.js";
import { LOCK_FIREWALL_TIMEOUT_MS, LOCK_UPGRADES_TIMEOUT_MS, LOCK_PACKAGES_TIMEOUT_MS } from "../constants.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LockOptions {
  production?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

export interface LockStepResult {
  // Group 1: SSH & Auth
  sshHardening: boolean;
  fail2ban: boolean;
  banners: boolean;
  accountLock: boolean;
  // Group 2: Firewall & Network
  ufw: boolean;
  cloudMeta: boolean;
  dns: boolean;
  // Group 3: System
  sysctl: boolean;
  unattendedUpgrades: boolean;
  aptValidation: boolean;
  resourceLimits: boolean;
  serviceDisable: boolean;
  backupPermissions: boolean;
  // Group 4: Monitoring
  auditd: boolean;
  logRetention: boolean;
  aide: boolean;
}

export interface LockResult {
  success: boolean;
  steps: LockStepResult;
  stepErrors?: Partial<Record<keyof LockStepResult, string>>;
  scoreBefore?: number;
  scoreAfter?: number;
  error?: string;
  hint?: string;
}

// ─── Command Builders ────────────────────────────────────────────────────────

export function buildSysctlHardeningCommand(): SshCommand {
  const settings = [
    "net.ipv4.conf.all.accept_redirects=0",
    "net.ipv4.conf.default.accept_redirects=0",
    "net.ipv4.conf.all.accept_source_route=0",
    "net.ipv4.conf.default.accept_source_route=0",
    "net.ipv4.conf.all.log_martians=1",
    "net.ipv4.tcp_syncookies=1",
    "kernel.randomize_va_space=2",
    "net.ipv4.icmp_echo_ignore_broadcasts=1",
  ].join("\\n");

  return raw(
    [
      `printf '${settings}\\n' > /etc/sysctl.d/99-kastell.conf`,
      "sysctl -p /etc/sysctl.d/99-kastell.conf 2>/dev/null || true",
    ].join(" && "),
  );
}

export function buildUnattendedUpgradesCommand(): SshCommand {
  const periodicConfig = [
    'APT::Periodic::Update-Package-Lists "1";',
    'APT::Periodic::Unattended-Upgrade "1";',
    'APT::Periodic::AutocleanInterval "7";',
  ].join("\\n");

  return raw(
    [
      "DEBIAN_FRONTEND=noninteractive apt-get install -y unattended-upgrades",
      `printf '${periodicConfig}\\n' > /etc/apt/apt.conf.d/20auto-upgrades`,
    ].join(" && "),
  );
}

export function buildLoginBannersCommand(): SshCommand {
  const bannerText = "Authorized access only. All activity is monitored and logged.";
  return raw(
    [
      `printf '${bannerText}\\n' > /etc/issue`,
      `printf '${bannerText}\\n' > /etc/issue.net`,
      `grep -qE '^Banner' /etc/ssh/sshd_config || echo 'Banner /etc/issue.net' >> /etc/ssh/sshd_config`,
      "systemctl restart ssh 2>/dev/null || systemctl restart sshd",
    ].join(" && "),
  );
}

export function buildAuditdCommand(): SshCommand {
  const rules = [
    "-w /etc/passwd -p wa -k identity",
    "-w /etc/shadow -p wa -k identity",
    "-w /etc/sudoers -p wa -k sudoers",
    "-w /etc/sudoers.d/ -p wa -k sudoers",
    "-a always,exit -F arch=b64 -S setuid -k privilege_escalation",
    "-a always,exit -F arch=b64 -S setgid -k privilege_escalation",
    "-e 2",
  ].join("\\n");

  return raw(
    [
      "DEBIAN_FRONTEND=noninteractive apt-get install -y auditd audispd-plugins",
      "systemctl enable auditd && systemctl start auditd",
      `printf '${rules}\\n' > /etc/audit/rules.d/99-kastell.rules`,
      "augenrules --load 2>/dev/null || true",
    ].join(" && "),
  );
}

export function buildResourceLimitsCommand(): SshCommand {
  const limitsContent = [
    "* soft nproc 1024",
    "* hard nproc 2048",
    "* soft nofile 65536",
    "* hard nofile 65536",
    "root soft nproc unlimited",
    "root hard nproc unlimited",
  ].join("\\n");

  return raw(`printf '${limitsContent}\\n' > /etc/security/limits.d/99-kastell.conf`);
}

export function buildServiceDisableCommand(): SshCommand {
  const services = ["bluetooth", "avahi-daemon", "cups", "rpcbind"];
  const disableScript = services
    .map(
      (s) =>
        `systemctl list-unit-files '${s}.service' 2>/dev/null | grep -q '${s}' && systemctl stop ${s} && systemctl disable ${s} 2>/dev/null || true`,
    )
    .join("; ");
  return raw(disableScript);
}

export function buildAptValidationCommand(): SshCommand {
  const aptConf = [
    'APT::Get::AllowUnauthenticated "false";',
    'Acquire::AllowInsecureRepositories "false";',
    'Acquire::AllowDowngradeToInsecureRepositories "false";',
  ].join("\\n");

  return raw(`printf '${aptConf}\\n' > /etc/apt/apt.conf.d/99-kastell-apt.conf`);
}

export function buildLogRetentionCommand(): SshCommand {
  const logrotateConf = [
    "/var/log/syslog",
    "{",
    "    daily",
    "    missingok",
    "    rotate 90",
    "    compress",
    "    delaycompress",
    "    notifempty",
    "    postrotate",
    "        /usr/lib/rsyslog/rsyslog-rotate",
    "    endscript",
    "}",
  ].join("\\n");

  return raw(
    [
      "systemctl enable rsyslog 2>/dev/null || true",
      "systemctl start rsyslog 2>/dev/null || true",
      `printf '${logrotateConf}\\n' > /etc/logrotate.d/99-kastell-syslog`,
    ].join(" && "),
  );
}

export function buildCloudMetaBlockCommand(): SshCommand {
  return raw(
    [
      "ufw deny out to 169.254.169.254",
      "ufw deny in from 169.254.169.254",
    ].join(" && "),
  );
}

export function buildAccountLockCommand(): SshCommand {
  return raw(
    [
      "for user in $(awk -F: '($3 >= 1000 && $3 < 65534 && ($7 == \"/bin/bash\" || $7 == \"/bin/sh\")) {print $1}' /etc/passwd); do",
      "  if ! who | grep -q \"^$user \"; then",
      "    passwd -l $user 2>/dev/null || true",
      "  fi",
      "done",
    ].join(" "),
  );
}

export function buildAideInitCommand(): SshCommand {
  const cronLine = "0 5 * * * root aide --check 2>/dev/null | mail -s 'AIDE check' root";
  return raw(
    [
      "DEBIAN_FRONTEND=noninteractive apt-get install -y aide",
      "nohup aide --init > /var/log/aide-init.log 2>&1 &",
      `echo '${cronLine}' > /etc/cron.d/kastell-aide`,
    ].join(" && "),
  );
}

export function buildBackupPermissionsCommand(): SshCommand {
  return raw(
    [
      "DEBIAN_FRONTEND=noninteractive apt-get install -y rsync",
      "mkdir -p /var/backups",
      "chmod 700 /var/backups",
      "chown root:root /var/backups",
    ].join(" && "),
  );
}

export function buildDnsSecurityCommand(): SshCommand {
  const dropinContent = ["[Resolve]", "DNSSEC=yes", "DNSOverTLS=opportunistic"].join("\\n");

  return raw(
    [
      "cp /etc/systemd/resolved.conf /etc/systemd/resolved.conf.kastell.bak 2>/dev/null || true",
      "mkdir -p /etc/systemd/resolved.conf.d",
      `printf '${dropinContent}\\n' > /etc/systemd/resolved.conf.d/99-kastell-dns.conf`,
      "systemctl restart systemd-resolved",
      "dig google.com +timeout=5 +tries=1 @127.0.0.53 >/dev/null 2>&1",
    ].join(" && "),
  );
}

export function buildDnsRollbackCommand(): SshCommand {
  return raw(
    [
      "rm -f /etc/systemd/resolved.conf.d/99-kastell-dns.conf",
      "systemctl restart systemd-resolved",
    ].join(" && "),
  );
}

// ─── Helper ──────────────────────────────────────────────────────────────────

async function runLockStep(
  ip: string,
  command: SshCommand,
  opts?: { timeoutMs?: number },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await sshExec(ip, command, opts);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

export async function applyLock(
  ip: string,
  name: string,
  platform: Platform | undefined,
  options: LockOptions,
): Promise<LockResult> {
  assertValidIp(ip);

  const steps: LockStepResult = {
    sshHardening: false,
    fail2ban: false,
    banners: false,
    accountLock: false,
    ufw: false,
    cloudMeta: false,
    dns: false,
    sysctl: false,
    unattendedUpgrades: false,
    aptValidation: false,
    resourceLimits: false,
    serviceDisable: false,
    backupPermissions: false,
    auditd: false,
    logRetention: false,
    aide: false,
  };

  const stepErrors: Partial<Record<keyof LockStepResult, string>> = {};

  // Dry run: preview only, no SSH
  if (options.dryRun) {
    return {
      success: true,
      steps,
    };
  }

  const auditPlatform = platform ?? "bare";

  // Pre-audit (non-fatal)
  let scoreBefore: number | undefined;
  try {
    const preAudit = await runAudit(ip, name, auditPlatform);
    if (preAudit.success && preAudit.data) {
      scoreBefore = preAudit.data.overallScore;
    }
  } catch {
    // Non-fatal — continue without score
  }

  // Step 0: SSH key check — abort if no keys
  try {
    const keyResult = await sshExec(ip, buildKeyCheckCommand());
    const keyCount = parseInt(keyResult.stdout.trim(), 10);
    if (isNaN(keyCount) || keyCount === 0) {
      return {
        success: false,
        steps,
        error: "No SSH keys found in /root/.ssh/authorized_keys. Cannot disable password authentication without SSH keys — this would permanently lock you out.",
        hint: `Add an SSH key first: ssh-copy-id root@${ip}`,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      steps,
      error: `SSH key check failed: ${message}`,
    };
  }

  // ── Group 1: SSH & Auth ──────────────────────────────────────────────────

  // Step 1: SSH hardening (critical)
  try {
    await sshExec(ip, buildHardeningCommand());
    steps.sshHardening = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stepErrors.sshHardening = message;
  }

  // Step 2: fail2ban (non-fatal)
  try {
    await sshExec(ip, buildFail2banCommand());
    steps.fail2ban = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stepErrors.fail2ban = message;
  }

  // Step 3: Login banners
  const bannersResult = await runLockStep(ip, buildLoginBannersCommand());
  steps.banners = bannersResult.ok;
  if (!bannersResult.ok) stepErrors.banners = bannersResult.error!;

  // Step 4: Account locking
  const accountLockResult = await runLockStep(ip, buildAccountLockCommand());
  steps.accountLock = accountLockResult.ok;
  if (!accountLockResult.ok) stepErrors.accountLock = accountLockResult.error!;

  // ── Group 2: Firewall & Network ──────────────────────────────────────────

  // Step 5: UFW firewall (non-fatal), 60s timeout for apt
  try {
    await sshExec(ip, buildFirewallSetupCommand(platform), { timeoutMs: LOCK_FIREWALL_TIMEOUT_MS });
    steps.ufw = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stepErrors.ufw = message;
  }

  // Step 6: Cloud metadata — conditional on UFW
  if (steps.ufw) {
    const cloudMetaResult = await runLockStep(ip, buildCloudMetaBlockCommand());
    steps.cloudMeta = cloudMetaResult.ok;
    if (!cloudMetaResult.ok) stepErrors.cloudMeta = cloudMetaResult.error!;
  } else {
    stepErrors.cloudMeta = "UFW required";
  }

  // Step 7: DNS security — with rollback on failure
  const dnsResult = await runLockStep(ip, buildDnsSecurityCommand(), { timeoutMs: 15_000 });
  steps.dns = dnsResult.ok;
  if (!dnsResult.ok) {
    stepErrors.dns = dnsResult.error!;
    await runLockStep(ip, buildDnsRollbackCommand());
  }

  // ── Group 3: System ──────────────────────────────────────────────────────

  // Step 8: sysctl hardening (non-fatal)
  try {
    await sshExec(ip, buildSysctlHardeningCommand());
    steps.sysctl = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stepErrors.sysctl = message;
  }

  // Step 9: unattended-upgrades (non-fatal), 120s timeout for apt
  try {
    await sshExec(ip, buildUnattendedUpgradesCommand(), { timeoutMs: LOCK_UPGRADES_TIMEOUT_MS });
    steps.unattendedUpgrades = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stepErrors.unattendedUpgrades = message;
  }

  // Step 10: APT validation
  const aptResult = await runLockStep(ip, buildAptValidationCommand());
  steps.aptValidation = aptResult.ok;
  if (!aptResult.ok) stepErrors.aptValidation = aptResult.error!;

  // Step 11: Resource limits
  const limitsResult = await runLockStep(ip, buildResourceLimitsCommand());
  steps.resourceLimits = limitsResult.ok;
  if (!limitsResult.ok) stepErrors.resourceLimits = limitsResult.error!;

  // Step 12: Service disabling
  const serviceResult = await runLockStep(ip, buildServiceDisableCommand());
  steps.serviceDisable = serviceResult.ok;
  if (!serviceResult.ok) stepErrors.serviceDisable = serviceResult.error!;

  // Step 13: Backup permissions
  const backupResult = await runLockStep(ip, buildBackupPermissionsCommand(), { timeoutMs: LOCK_PACKAGES_TIMEOUT_MS });
  steps.backupPermissions = backupResult.ok;
  if (!backupResult.ok) stepErrors.backupPermissions = backupResult.error!;

  // ── Group 4: Monitoring ──────────────────────────────────────────────────

  // Step 14: auditd
  const auditdResult = await runLockStep(ip, buildAuditdCommand(), { timeoutMs: LOCK_PACKAGES_TIMEOUT_MS });
  steps.auditd = auditdResult.ok;
  if (!auditdResult.ok) stepErrors.auditd = auditdResult.error!;

  // Step 15: Log retention
  const logResult = await runLockStep(ip, buildLogRetentionCommand());
  steps.logRetention = logResult.ok;
  if (!logResult.ok) stepErrors.logRetention = logResult.error!;

  // Step 16: AIDE (fire-and-forget)
  const aideResult = await runLockStep(ip, buildAideInitCommand(), { timeoutMs: LOCK_PACKAGES_TIMEOUT_MS });
  steps.aide = aideResult.ok;
  if (!aideResult.ok) stepErrors.aide = aideResult.error!;

  // Post-audit (non-fatal)
  let scoreAfter: number | undefined;
  try {
    const postAudit = await runAudit(ip, name, auditPlatform);
    if (postAudit.success && postAudit.data) {
      scoreAfter = postAudit.data.overallScore;
    }
  } catch {
    // Non-fatal
  }

  return {
    success: steps.sshHardening,
    steps,
    ...(Object.keys(stepErrors).length > 0 && { stepErrors }),
    scoreBefore,
    scoreAfter,
  };
}
