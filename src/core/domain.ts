import { sshExec, assertValidIp } from "../utils/ssh.js";
import { getErrorMessage, mapSshError } from "../utils/errorMapper.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const COOLIFY_SOURCE_DIR = "/data/coolify/source";
const COOLIFY_DB_CONTAINER = "coolify-db";
const COOLIFY_DB_USER = "coolify";
const COOLIFY_DB_NAME = "coolify";

// ─── Pure Functions ─────────────────────────────────────────────────────────

export function isValidDomain(domain: string): boolean {
  const pattern = /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.[a-zA-Z0-9-]{1,63})*\.[a-zA-Z]{2,}$/;
  return pattern.test(domain);
}

export function sanitizeDomain(input: string): string {
  let domain = input.trim();
  domain = domain.replace(/^https?:\/\//, "");
  domain = domain.replace(/\/+$/, "");
  domain = domain.replace(/:\d+$/, "");
  return domain;
}

export function escapePsqlString(input: string): string {
  return input.replace(/'/g, "''");
}

export function buildSetFqdnCommand(domain: string, ssl: boolean): string {
  if (/[^a-zA-Z0-9.:_-]/.test(domain)) {
    throw new Error(`Invalid domain for FQDN command: ${domain}`);
  }
  const protocol = ssl ? "https" : "http";
  const url = escapePsqlString(`${protocol}://${domain}`);
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
  const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, "");
  return `dig +short A ${safeDomain} 2>/dev/null || getent ahosts ${safeDomain} 2>/dev/null | head -1 | awk '{print $1}'`;
}

export function parseDnsResult(stdout: string): string | null {
  const ipMatch = stdout.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
  return ipMatch ? ipMatch[1] : null;
}

export function parseFqdn(stdout: string): string | null {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  return trimmed;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DomainResult {
  success: boolean;
  error?: string;
  hint?: string;
}

export interface DomainInfoResult {
  fqdn: string | null;
  error?: string;
  hint?: string;
}

export interface DnsCheckResult {
  resolvedIp: string | null;
  match: boolean;
  error?: string;
  hint?: string;
}

// ─── Async Wrappers ─────────────────────────────────────────────────────────

export async function setDomain(
  ip: string,
  domain: string,
  ssl: boolean = true,
): Promise<DomainResult> {
  assertValidIp(ip);

  const cleanDomain = sanitizeDomain(domain);
  if (!isValidDomain(cleanDomain)) {
    return { success: false, error: `Invalid domain: ${cleanDomain}` };
  }

  try {
    // Check if coolify-db container is running
    const checkResult = await sshExec(ip, buildCoolifyCheckCommand());
    if (!checkResult.stdout.includes(COOLIFY_DB_CONTAINER)) {
      return {
        success: false,
        error: "Coolify database container not found. Is Coolify installed and running?",
      };
    }

    const command = buildSetFqdnCommand(cleanDomain, ssl);
    const result = await sshExec(ip, command);
    if (result.code !== 0) {
      return {
        success: false,
        error: `Failed to set domain (exit code ${result.code})`,
      };
    }

    return { success: true };
  } catch (error: unknown) {
    const hint = mapSshError(error, ip);
    return {
      success: false,
      error: getErrorMessage(error),
      ...(hint ? { hint } : {}),
    };
  }
}

export async function removeDomain(ip: string): Promise<DomainResult> {
  assertValidIp(ip);

  try {
    // Check if coolify-db container is running
    const checkResult = await sshExec(ip, buildCoolifyCheckCommand());
    if (!checkResult.stdout.includes(COOLIFY_DB_CONTAINER)) {
      return {
        success: false,
        error: "Coolify database container not found. Is Coolify installed and running?",
      };
    }

    const command = buildSetFqdnCommand(`${ip}:8000`, false);
    const result = await sshExec(ip, command);
    if (result.code !== 0) {
      return {
        success: false,
        error: `Failed to remove domain (exit code ${result.code})`,
      };
    }

    return { success: true };
  } catch (error: unknown) {
    const hint = mapSshError(error, ip);
    return {
      success: false,
      error: getErrorMessage(error),
      ...(hint ? { hint } : {}),
    };
  }
}

export async function getDomain(ip: string): Promise<DomainInfoResult> {
  assertValidIp(ip);

  try {
    const result = await sshExec(ip, buildGetFqdnCommand());
    if (result.code !== 0) {
      return {
        fqdn: null,
        error: `Failed to get domain (exit code ${result.code})`,
      };
    }

    return { fqdn: parseFqdn(result.stdout) };
  } catch (error: unknown) {
    const hint = mapSshError(error, ip);
    return {
      fqdn: null,
      error: getErrorMessage(error),
      ...(hint ? { hint } : {}),
    };
  }
}

export async function checkDns(ip: string, domain: string): Promise<DnsCheckResult> {
  assertValidIp(ip);

  const cleanDomain = sanitizeDomain(domain);
  if (!isValidDomain(cleanDomain)) {
    return { resolvedIp: null, match: false, error: `Invalid domain: ${cleanDomain}` };
  }

  try {
    const result = await sshExec(ip, buildDnsCheckCommand(cleanDomain));
    const resolvedIp = parseDnsResult(result.stdout);

    if (!resolvedIp) {
      return {
        resolvedIp: null,
        match: false,
        hint: `No A record found for ${cleanDomain}. Add an A record pointing to ${ip}`,
      };
    }

    return {
      resolvedIp,
      match: resolvedIp === ip,
      ...(resolvedIp !== ip
        ? { hint: `DNS mismatch: ${cleanDomain} → ${resolvedIp} (expected ${ip}). Update your A record.` }
        : {}),
    };
  } catch (error: unknown) {
    const hint = mapSshError(error, ip);
    return {
      resolvedIp: null,
      match: false,
      error: getErrorMessage(error),
      ...(hint ? { hint } : {}),
    };
  }
}
