import { resolveServer } from "../utils/serverSelect.js";
import { checkSshAvailable, sshExec } from "../utils/ssh.js";
import { logger, createSpinner } from "../utils/logger.js";

const COOLIFY_SOURCE_DIR = "/data/coolify/source";
const COOLIFY_DB_CONTAINER = "coolify-db";
const COOLIFY_DB_USER = "coolify";
const COOLIFY_DB_NAME = "coolify";

export function isValidDomain(domain: string): boolean {
  // RFC 1035 compliant domain validation
  const pattern = /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.[a-zA-Z0-9-]{1,63})*\.[a-zA-Z]{2,}$/;
  return pattern.test(domain);
}

export function sanitizeDomain(input: string): string {
  let domain = input.trim();
  // Strip protocol prefix
  domain = domain.replace(/^https?:\/\//, "");
  // Strip trailing slash
  domain = domain.replace(/\/+$/, "");
  // Strip port
  domain = domain.replace(/:\d+$/, "");
  return domain;
}

export function buildSetFqdnCommand(domain: string, ssl: boolean): string {
  const protocol = ssl ? "https" : "http";
  const url = `${protocol}://${domain}`;
  return [
    `docker exec ${COOLIFY_DB_CONTAINER} psql -U ${COOLIFY_DB_USER} -d ${COOLIFY_DB_NAME} -c "UPDATE instance_settings SET fqdn='${url}' WHERE id=0;"`,
    `cd ${COOLIFY_SOURCE_DIR} && docker compose -f docker-compose.yml -f docker-compose.prod.yml restart coolify`,
  ].join(" && ");
}

export function buildGetFqdnCommand(): string {
  return `docker exec ${COOLIFY_DB_CONTAINER} psql -U ${COOLIFY_DB_USER} -d ${COOLIFY_DB_NAME} -t -c "SELECT fqdn FROM instance_settings WHERE id=0;"`;
}

export function buildCoolifyCheckCommand(): string {
  return `docker ps --filter name=${COOLIFY_DB_CONTAINER} --format '{{.Names}}' 2>/dev/null`;
}

export function buildDnsCheckCommand(domain: string): string {
  // dig first, fallback to getent ahosts (always available on Linux)
  return `dig +short A ${domain} 2>/dev/null || getent ahosts ${domain} 2>/dev/null | head -1 | awk '{print $1}'`;
}

export function parseDnsResult(stdout: string): string | null {
  // dig +short returns just IP addresses, getent returns IP + hostname
  const ipMatch = stdout.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
  return ipMatch ? ipMatch[1] : null;
}

export function parseFqdn(stdout: string): string | null {
  // psql -t output: just the value with possible leading/trailing whitespace
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  return trimmed;
}

export async function domainCommand(
  subcommand?: string,
  query?: string,
  options?: { domain?: string; ssl?: boolean; dryRun?: boolean },
): Promise<void> {
  if (!checkSshAvailable()) {
    logger.error("SSH client not found. Please install OpenSSH.");
    return;
  }

  const validSubcommands = ["add", "remove", "check", "list"];
  const sub = subcommand || "list";

  if (!validSubcommands.includes(sub)) {
    logger.error(`Invalid subcommand: ${sub}. Choose from: ${validSubcommands.join(", ")}`);
    return;
  }

  const server = await resolveServer(query, "Select a server for domain management:");
  if (!server) return;

  const dryRun = options?.dryRun || false;

  switch (sub) {
    case "add":
      await domainAdd(server.ip, server.name, options, dryRun);
      break;
    case "remove":
      await domainRemove(server.ip, server.name, dryRun);
      break;
    case "check":
      await domainCheck(server.ip, options);
      break;
    case "list":
      await domainList(server.ip, server.name);
      break;
  }
}

async function domainAdd(
  ip: string,
  name: string,
  options?: { domain?: string; ssl?: boolean },
  dryRun?: boolean,
): Promise<void> {
  if (!options?.domain) {
    logger.error("Missing --domain. Usage: quicklify domain add <server> --domain example.com");
    return;
  }

  const domain = sanitizeDomain(options.domain);
  if (!isValidDomain(domain)) {
    logger.error(`Invalid domain: ${domain}`);
    return;
  }

  const ssl = options?.ssl !== false; // default true
  const command = buildSetFqdnCommand(domain, ssl);

  if (dryRun) {
    logger.title("Dry Run - Add Domain");
    logger.info(`Server: ${name} (${ip})`);
    logger.info(`Domain: ${domain}`);
    logger.info(`SSL: ${ssl ? "enabled" : "disabled"}`);
    console.log();
    logger.info("Commands to execute:");
    for (const cmd of command.split(" && ")) {
      logger.step(cmd.trim());
    }
    console.log();
    logger.warning("No changes applied. Remove --dry-run to execute.");
    return;
  }

  const spinner = createSpinner(`Setting domain to ${domain}...`);
  spinner.start();

  try {
    // Check if coolify-db container is running
    const checkResult = await sshExec(ip, buildCoolifyCheckCommand());
    if (!checkResult.stdout.includes(COOLIFY_DB_CONTAINER)) {
      spinner.fail("Coolify database container not found");
      logger.error("Is Coolify installed and running on this server?");
      logger.info("Run: quicklify status <server> to check");
      return;
    }

    const result = await sshExec(ip, command);
    if (result.code !== 0) {
      spinner.fail("Failed to set domain");
      if (result.stderr) logger.error(result.stderr);
      return;
    }

    spinner.succeed(`Domain set to ${domain} on ${name}`);
    const protocol = ssl ? "https" : "http";
    logger.success(`Coolify is now accessible at ${protocol}://${domain}`);
    logger.info("Make sure your DNS A record points to " + ip);
  } catch (error: unknown) {
    spinner.fail("Failed to set domain");
    logger.error(error instanceof Error ? error.message : String(error));
  }
}

async function domainRemove(ip: string, name: string, dryRun: boolean): Promise<void> {
  const command = buildSetFqdnCommand(`${ip}:8000`, false);

  if (dryRun) {
    logger.title("Dry Run - Remove Domain");
    logger.info(`Server: ${name} (${ip})`);
    logger.info(`Will reset to: http://${ip}:8000`);
    console.log();
    logger.info("Commands to execute:");
    for (const cmd of command.split(" && ")) {
      logger.step(cmd.trim());
    }
    console.log();
    logger.warning("No changes applied. Remove --dry-run to execute.");
    return;
  }

  const spinner = createSpinner("Removing domain...");
  spinner.start();

  try {
    const result = await sshExec(ip, command);
    if (result.code !== 0) {
      spinner.fail("Failed to remove domain");
      if (result.stderr) logger.error(result.stderr);
      return;
    }

    spinner.succeed(`Domain removed from ${name}`);
    logger.success(`Coolify is now accessible at http://${ip}:8000`);
  } catch (error: unknown) {
    spinner.fail("Failed to remove domain");
    logger.error(error instanceof Error ? error.message : String(error));
  }
}

async function domainCheck(ip: string, options?: { domain?: string }): Promise<void> {
  if (!options?.domain) {
    logger.error("Missing --domain. Usage: quicklify domain check <server> --domain example.com");
    return;
  }

  const domain = sanitizeDomain(options.domain);
  if (!isValidDomain(domain)) {
    logger.error(`Invalid domain: ${domain}`);
    return;
  }

  const spinner = createSpinner(`Checking DNS for ${domain}...`);
  spinner.start();

  try {
    const result = await sshExec(ip, buildDnsCheckCommand(domain));
    const resolvedIp = parseDnsResult(result.stdout);

    if (!resolvedIp) {
      spinner.fail(`No A record found for ${domain}`);
      logger.info("Add an A record pointing to " + ip);
      return;
    }

    if (resolvedIp === ip) {
      spinner.succeed(`DNS OK: ${domain} → ${resolvedIp}`);
    } else {
      spinner.warn(`DNS mismatch: ${domain} → ${resolvedIp} (expected ${ip})`);
      logger.info("Update your A record to point to " + ip);
    }
  } catch (error: unknown) {
    spinner.fail("Failed to check DNS");
    logger.error(error instanceof Error ? error.message : String(error));
  }
}

async function domainList(ip: string, name: string): Promise<void> {
  const spinner = createSpinner(`Fetching domain from ${name}...`);
  spinner.start();

  try {
    const result = await sshExec(ip, buildGetFqdnCommand());
    if (result.code !== 0) {
      spinner.fail("Failed to fetch domain");
      if (result.stderr) logger.error(result.stderr);
      return;
    }

    const fqdn = parseFqdn(result.stdout);
    if (fqdn) {
      spinner.succeed(`Current domain for ${name}`);
      logger.info(`FQDN: ${fqdn}`);
    } else {
      spinner.succeed(`No custom domain set for ${name}`);
      logger.info(`Default: http://${ip}:8000`);
    }
  } catch (error: unknown) {
    spinner.fail("Failed to fetch domain");
    logger.error(error instanceof Error ? error.message : String(error));
  }
}
