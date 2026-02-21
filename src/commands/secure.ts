import inquirer from "inquirer";
import { resolveServer } from "../utils/serverSelect.js";
import { checkSshAvailable, sshExec } from "../utils/ssh.js";
import { logger, createSpinner } from "../utils/logger.js";
import type { SshdSetting, SecureAuditResult } from "../types/index.js";

export function parseSshdConfig(content: string): SshdSetting[] {
  const settings: SshdSetting[] = [];
  const checks: { key: string; secureValue: string }[] = [
    { key: "PasswordAuthentication", secureValue: "no" },
    { key: "PermitRootLogin", secureValue: "prohibit-password" },
    { key: "PubkeyAuthentication", secureValue: "yes" },
    { key: "MaxAuthTries", secureValue: "3" },
  ];

  for (const check of checks) {
    const regex = new RegExp(`^\\s*${check.key}\\s+(.+)`, "m");
    const match = content.match(regex);

    if (match) {
      const value = match[1].trim();
      settings.push({
        key: check.key,
        value,
        status: value.toLowerCase() === check.secureValue.toLowerCase() ? "secure" : "insecure",
      });
    } else {
      settings.push({
        key: check.key,
        value: "",
        status: "missing",
      });
    }
  }

  return settings;
}

export function parseAuditResult(stdout: string): SecureAuditResult {
  const sections = stdout.split("---SEPARATOR---");
  const sshdContent = sections[0] || "";
  const fail2banStatus = sections[1] || "";
  const sshdSettings = parseSshdConfig(sshdContent);

  // Find specific settings
  const passwordAuth = sshdSettings.find((s) => s.key === "PasswordAuthentication") || {
    key: "PasswordAuthentication",
    value: "",
    status: "missing" as const,
  };
  const rootLogin = sshdSettings.find((s) => s.key === "PermitRootLogin") || {
    key: "PermitRootLogin",
    value: "",
    status: "missing" as const,
  };

  // Parse fail2ban
  const fail2banInstalled = fail2banStatus.includes("active") || fail2banStatus.includes("inactive");
  const fail2banActive = fail2banStatus.includes("active (running)");

  // Parse SSH port
  const portMatch = sshdContent.match(/^\s*Port\s+(\d+)/m);
  const sshPort = portMatch ? parseInt(portMatch[1], 10) : 22;

  return {
    passwordAuth,
    rootLogin,
    fail2ban: { installed: fail2banInstalled, active: fail2banActive },
    sshPort,
  };
}

export function buildHardeningCommand(options?: { port?: number }): string {
  const commands = [
    "cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak",
    `sed -i 's/^#\\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config`,
    `sed -i 's/^#\\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config`,
    `sed -i 's/^#\\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config`,
    `sed -i 's/^#\\?MaxAuthTries.*/MaxAuthTries 3/' /etc/ssh/sshd_config`,
  ];

  if (options?.port && options.port !== 22) {
    commands.push(`sed -i 's/^#\\?Port.*/Port ${options.port}/' /etc/ssh/sshd_config`);
  }

  // Ubuntu/Debian uses 'ssh', RHEL/CentOS uses 'sshd'
  commands.push("systemctl restart sshd 2>/dev/null || systemctl restart ssh");
  return commands.join(" && ");
}

export function buildFail2banCommand(): string {
  return [
    "apt-get install -y fail2ban",
    `cat > /etc/fail2ban/jail.local << 'JAIL'
[sshd]
enabled = true
port = ssh
filter = sshd
backend = systemd
maxretry = 5
bantime = 3600
findtime = 600
JAIL`,
    "systemctl enable fail2ban",
    "systemctl restart fail2ban",
  ].join(" && ");
}

export function buildAuditCommand(): string {
  return `cat /etc/ssh/sshd_config && echo '---SEPARATOR---' && systemctl status fail2ban 2>&1 || true`;
}

export function buildKeyCheckCommand(): string {
  return "test -f /root/.ssh/authorized_keys && wc -l < /root/.ssh/authorized_keys || echo 0";
}

export async function secureCommand(
  subcommand?: string,
  query?: string,
  options?: { port?: string; dryRun?: boolean },
): Promise<void> {
  if (!checkSshAvailable()) {
    logger.error("SSH client not found. Please install OpenSSH.");
    return;
  }

  const validSubcommands = ["setup", "status", "audit"];
  const sub = subcommand || "status";

  if (!validSubcommands.includes(sub)) {
    logger.error(`Invalid subcommand: ${sub}. Choose from: ${validSubcommands.join(", ")}`);
    return;
  }

  const server = await resolveServer(query, "Select a server for security management:");
  if (!server) return;

  const dryRun = options?.dryRun || false;

  switch (sub) {
    case "setup":
      await secureSetup(server.ip, server.name, options, dryRun);
      break;
    case "status":
      await secureStatus(server.ip, server.name);
      break;
    case "audit":
      await secureAudit(server.ip, server.name);
      break;
  }
}

async function secureSetup(
  ip: string,
  name: string,
  options?: { port?: string },
  dryRun?: boolean,
): Promise<void> {
  // Step 1: Check SSH keys exist
  const keyCheckResult = await sshExec(ip, buildKeyCheckCommand());
  const keyCount = parseInt(keyCheckResult.stdout.trim(), 10);

  if (isNaN(keyCount) || keyCount === 0) {
    logger.error("No SSH keys found in /root/.ssh/authorized_keys");
    logger.error("You MUST add an SSH key before disabling password authentication.");
    logger.info("Run: ssh-copy-id root@" + ip);
    return;
  }

  const port = options?.port ? parseInt(options.port, 10) : undefined;
  if (options?.port && (!port || port < 1 || port > 65535)) {
    logger.error("Invalid --port. Must be 1-65535.");
    return;
  }

  const hardenCmd = buildHardeningCommand(port ? { port } : undefined);
  const fail2banCmd = buildFail2banCommand();

  if (dryRun) {
    logger.title("Dry Run - Security Setup");
    logger.info(`Server: ${name} (${ip})`);
    logger.info(`SSH keys found: ${keyCount}`);
    console.log();
    logger.info("SSH Hardening commands:");
    for (const cmd of hardenCmd.split(" && ")) {
      logger.step(cmd);
    }
    console.log();
    logger.info("Fail2ban commands:");
    for (const cmd of fail2banCmd.split(" && ")) {
      logger.step(cmd.length > 80 ? cmd.substring(0, 80) + "..." : cmd);
    }
    console.log();
    logger.warning("No changes applied. Remove --dry-run to execute.");
    return;
  }

  // Double confirmation (like destroy command)
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `This will harden SSH on "${name}" (${ip}). Password login will be DISABLED. Continue?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info("Security setup cancelled.");
    return;
  }

  const { confirmName } = await inquirer.prompt([
    {
      type: "input",
      name: "confirmName",
      message: `Type the server name "${name}" to confirm:`,
    },
  ]);

  if (confirmName.trim() !== name) {
    logger.error("Server name does not match. Setup cancelled.");
    return;
  }

  // Step 2: Apply SSH hardening
  const spinner = createSpinner("Applying SSH hardening...");
  spinner.start();

  try {
    const hardenResult = await sshExec(ip, hardenCmd);
    if (hardenResult.code !== 0) {
      spinner.fail("Failed to apply SSH hardening");
      if (hardenResult.stderr) logger.error(hardenResult.stderr);
      return;
    }
    spinner.succeed("SSH hardened successfully");
  } catch (error: unknown) {
    spinner.fail("Failed to apply SSH hardening");
    logger.error(error instanceof Error ? error.message : String(error));
    return;
  }

  // Step 3: Install fail2ban
  const f2bSpinner = createSpinner("Installing fail2ban...");
  f2bSpinner.start();

  try {
    const f2bResult = await sshExec(ip, fail2banCmd);
    if (f2bResult.code !== 0) {
      f2bSpinner.warn("Fail2ban installation had issues (non-fatal)");
      if (f2bResult.stderr) logger.warning(f2bResult.stderr);
    } else {
      f2bSpinner.succeed("Fail2ban installed and configured");
    }
  } catch (error: unknown) {
    f2bSpinner.warn("Fail2ban installation failed (non-fatal)");
    logger.warning(error instanceof Error ? error.message : String(error));
  }

  logger.success(`Security setup complete for ${name}`);
  if (port && port !== 22) {
    logger.warning(`SSH port changed to ${port}. Use: ssh -p ${port} root@${ip}`);
  }
}

async function secureStatus(ip: string, name: string): Promise<void> {
  const spinner = createSpinner(`Checking security status of ${name}...`);
  spinner.start();

  try {
    const result = await sshExec(ip, buildAuditCommand());
    if (result.code !== 0 && !result.stdout) {
      spinner.fail("Failed to check security status");
      if (result.stderr) logger.error(result.stderr);
      return;
    }

    const audit = parseAuditResult(result.stdout);
    spinner.succeed(`Security status for ${name} (${ip})`);

    console.log();
    const passIcon = (status: string) =>
      status === "secure" ? "\u2714" : status === "insecure" ? "\u2716" : "?";

    logger.info(`Password Auth:  ${passIcon(audit.passwordAuth.status)} ${audit.passwordAuth.value || "not set"}`);
    logger.info(`Root Login:     ${passIcon(audit.rootLogin.status)} ${audit.rootLogin.value || "not set"}`);
    logger.info(`Fail2ban:       ${audit.fail2ban.installed ? (audit.fail2ban.active ? "\u2714 active" : "\u2716 inactive") : "\u2716 not installed"}`);
    logger.info(`SSH Port:       ${audit.sshPort}`);
  } catch (error: unknown) {
    spinner.fail("Failed to check security status");
    logger.error(error instanceof Error ? error.message : String(error));
  }
}

async function secureAudit(ip: string, name: string): Promise<void> {
  const spinner = createSpinner(`Running security audit on ${name}...`);
  spinner.start();

  try {
    const result = await sshExec(ip, buildAuditCommand());
    if (result.code !== 0 && !result.stdout) {
      spinner.fail("Failed to run security audit");
      if (result.stderr) logger.error(result.stderr);
      return;
    }

    const audit = parseAuditResult(result.stdout);
    spinner.succeed(`Security audit for ${name} (${ip})`);

    // Score calculation
    let score = 0;
    const maxScore = 4;
    if (audit.passwordAuth.status === "secure") score++;
    if (audit.rootLogin.status === "secure") score++;
    if (audit.fail2ban.active) score++;
    if (audit.sshPort !== 22) score++;

    console.log();
    logger.title(`Security Score: ${score}/${maxScore}`);

    // Detailed report
    const check = (ok: boolean, msg: string) =>
      ok ? logger.success(msg) : logger.warning(msg);

    check(
      audit.passwordAuth.status === "secure",
      `Password Authentication: ${audit.passwordAuth.value || "not set"} ${audit.passwordAuth.status === "secure" ? "(OK)" : "(should be 'no')"}`,
    );
    check(
      audit.rootLogin.status === "secure",
      `Root Login: ${audit.rootLogin.value || "not set"} ${audit.rootLogin.status === "secure" ? "(OK)" : "(should be 'prohibit-password')"}`,
    );
    check(
      audit.fail2ban.active,
      `Fail2ban: ${audit.fail2ban.installed ? (audit.fail2ban.active ? "active (OK)" : "installed but inactive") : "not installed"}`,
    );
    check(audit.sshPort !== 22, `SSH Port: ${audit.sshPort} ${audit.sshPort !== 22 ? "(non-default, OK)" : "(default port 22)"}`);

    if (score < maxScore) {
      console.log();
      logger.info("Run 'quicklify secure setup' to improve your security score.");
    }
  } catch (error: unknown) {
    spinner.fail("Failed to run security audit");
    logger.error(error instanceof Error ? error.message : String(error));
  }
}
