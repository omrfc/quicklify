/**
 * Check registry — maps section names to parser functions.
 * Routes batched SSH output to the correct category parser by named separator.
 */

import type { AuditCategory, CheckParser, ComplianceRef } from "../types.js";
import { calculateCategoryScore } from "../scoring.js";
import { AUDIT_CATEGORIES } from "./shared/categories.js";
import { parseSSHChecks } from "./ssh.js";
import { parseFirewallChecks } from "./firewall.js";
import { parseUpdatesChecks } from "./updates.js";
import { parseAuthChecks } from "./auth.js";
import { parseDockerChecks } from "./docker.js";
import { parseNetworkChecks } from "./network.js";
import { parseFilesystemChecks } from "./filesystem.js";
import { parseLoggingChecks } from "./logging.js";
import { parseKernelChecks } from "./kernel.js";
import { parseAccountsChecks } from "./accounts.js";
import { parseServicesChecks } from "./services.js";
import { parseBootChecks } from "./boot.js";
import { parseSchedulingChecks } from "./scheduling.js";
import { parseTimeChecks } from "./time.js";
import { parseBannersChecks } from "./banners.js";
import { parseCryptoChecks } from "./crypto.js";
import { parseFileIntegrityChecks } from "./fileintegrity.js";
import { parseMalwareChecks } from "./malware.js";
import { parseMACChecks } from "./mac.js";
import { parseMemoryChecks } from "./memory.js";
import { parseSecretsChecks } from "./secrets.js";
import { parseCloudMetaChecks } from "./cloudmeta.js";
import { parseSupplyChainChecks } from "./supplychain.js";
import { parseBackupChecks } from "./backup.js";
import { parseResourceLimitsChecks } from "./resourcelimits.js";
import { parseIncidentReadyChecks } from "./incidentready.js";
import { parseDnsChecks } from "./dns.js";
import { parseTlsChecks } from "./tls.js";
import { parseHttpHeadersChecks } from "./httpHeaders.js";
import { parseNginxChecks } from "./nginx.js";
import { parseDdosChecks } from "./ddos.js";

export interface CategoryEntry {
  name: string;
  sectionName: string;
  parser: CheckParser;
}

/** Check registry — maps section names to parser functions */
export const CHECK_REGISTRY: CategoryEntry[] = [
  { name: AUDIT_CATEGORIES.SSH, sectionName: "SSH", parser: parseSSHChecks },
  { name: AUDIT_CATEGORIES.FIREWALL, sectionName: "FIREWALL", parser: parseFirewallChecks },
  { name: AUDIT_CATEGORIES.UPDATES, sectionName: "UPDATES", parser: parseUpdatesChecks },
  { name: AUDIT_CATEGORIES.AUTH, sectionName: "AUTH", parser: parseAuthChecks },
  { name: AUDIT_CATEGORIES.DOCKER, sectionName: "DOCKER", parser: parseDockerChecks },
  { name: AUDIT_CATEGORIES.NETWORK, sectionName: "NETWORK", parser: parseNetworkChecks },
  { name: AUDIT_CATEGORIES.FILESYSTEM, sectionName: "FILESYSTEM", parser: parseFilesystemChecks },
  { name: AUDIT_CATEGORIES.LOGGING, sectionName: "LOGGING", parser: parseLoggingChecks },
  { name: AUDIT_CATEGORIES.KERNEL, sectionName: "KERNEL", parser: parseKernelChecks },
  { name: AUDIT_CATEGORIES.ACCOUNTS, sectionName: "ACCOUNTS", parser: parseAccountsChecks },
  { name: AUDIT_CATEGORIES.SERVICES, sectionName: "SERVICES", parser: parseServicesChecks },
  { name: AUDIT_CATEGORIES.BOOT, sectionName: "BOOT", parser: parseBootChecks },
  { name: AUDIT_CATEGORIES.SCHEDULING, sectionName: "SCHEDULING", parser: parseSchedulingChecks },
  { name: AUDIT_CATEGORIES.TIME, sectionName: "TIME", parser: parseTimeChecks },
  { name: AUDIT_CATEGORIES.BANNERS, sectionName: "BANNERS", parser: parseBannersChecks },
  { name: AUDIT_CATEGORIES.CRYPTO, sectionName: "CRYPTO", parser: parseCryptoChecks },
  { name: AUDIT_CATEGORIES.FILE_INTEGRITY, sectionName: "FILEINTEGRITY", parser: parseFileIntegrityChecks },
  { name: AUDIT_CATEGORIES.MALWARE, sectionName: "MALWARE", parser: parseMalwareChecks },
  { name: AUDIT_CATEGORIES.MAC, sectionName: "MAC", parser: parseMACChecks },
  { name: AUDIT_CATEGORIES.MEMORY, sectionName: "MEMORY", parser: parseMemoryChecks },
  { name: AUDIT_CATEGORIES.SECRETS, sectionName: "SECRETS", parser: parseSecretsChecks },
  { name: AUDIT_CATEGORIES.CLOUD_METADATA, sectionName: "CLOUDMETA", parser: parseCloudMetaChecks },
  { name: AUDIT_CATEGORIES.SUPPLY_CHAIN, sectionName: "SUPPLYCHAIN", parser: parseSupplyChainChecks },
  { name: AUDIT_CATEGORIES.BACKUP_HYGIENE, sectionName: "BACKUP", parser: parseBackupChecks },
  { name: AUDIT_CATEGORIES.RESOURCE_LIMITS, sectionName: "RESOURCELIMITS", parser: parseResourceLimitsChecks },
  { name: AUDIT_CATEGORIES.INCIDENT_READINESS, sectionName: "INCIDENTREADY", parser: parseIncidentReadyChecks },
  { name: AUDIT_CATEGORIES.DNS_SECURITY, sectionName: "DNS", parser: parseDnsChecks },
  { name: AUDIT_CATEGORIES.TLS_HARDENING, sectionName: "TLSHARDENING", parser: parseTlsChecks },
  { name: AUDIT_CATEGORIES.HTTP_HEADERS, sectionName: "HTTPHEADERS", parser: parseHttpHeadersChecks },
  { name: AUDIT_CATEGORIES.WAF, sectionName: "NGINX", parser: parseNginxChecks },
  { name: AUDIT_CATEGORIES.DDOS, sectionName: "DDOS", parser: parseDdosChecks },
];

/** Named separator pattern used between sections in SSH batch output */
const SECTION_PATTERN = /---SECTION:([A-Z_]+)---/;

/**
 * Build a map of section name → section content from a batch output string.
 * Splits on named separators using a capturing group so names and content alternate.
 */
function buildSectionMap(batchOutput: string): Map<string, string> {
  const map = new Map<string, string>();
  const parts = batchOutput.split(SECTION_PATTERN);

  // parts: [ text-before-first-sep, NAME1, content1, NAME2, content2, ... ]
  // With capturing group split: index 0 is pre-separator text, then name/content pairs
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const sectionName = parts[i];
    const sectionContent = parts[i + 1].trim();
    map.set(sectionName, sectionContent);
  }

  return map;
}

/**
 * Parse all batch outputs into AuditCategory arrays.
 *
 * 1. Concatenates all batch outputs into a unified section map
 * 2. Routes by section name (---SECTION:NAME---) to the correct parser
 * 3. Calls each parser with its section output (empty string if section absent)
 * 4. Wraps results into AuditCategory objects with calculateCategoryScore
 */
export function parseAllChecks(
  batchOutputs: string[],
  platform: string,
): AuditCategory[] {
  // Build unified section map from all batches
  const sections = new Map<string, string>();

  for (const output of batchOutputs) {
    const batchMap = buildSectionMap(output);
    for (const [name, content] of batchMap) {
      sections.set(name, content);
    }
  }

  // Run each category parser against its named section
  return CHECK_REGISTRY.map((entry) => {
    const sectionOutput = sections.get(entry.sectionName) ?? "";
    const checks = entry.parser(sectionOutput, platform);
    const { score, maxScore } = calculateCategoryScore(checks);

    return {
      name: entry.name,
      checks,
      score,
      maxScore,
    };
  });
}

/**
 * Inject compliance references into parsed audit categories.
 * Called after parseAllChecks() — returns new objects, never mutates originals.
 */
export function mergeComplianceRefs(
  categories: AuditCategory[],
  map: Record<string, ComplianceRef[]>,
): AuditCategory[] {
  return categories.map((cat) => ({
    ...cat,
    checks: cat.checks.map((check) => {
      const refs = map[check.id];
      if (!refs || refs.length === 0) return check;
      return { ...check, complianceRefs: refs };
    }),
  }));
}
