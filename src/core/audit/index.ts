/**
 * Audit runner orchestrator.
 * Builds SSH commands, executes them, parses results, and calculates scores.
 *
 * Plan 02 will fill in the actual check parsers — currently uses an empty registry.
 */

import type { KastellResult } from "../../types/index.js";
import type { AuditResult, AuditCategory, CheckParser } from "./types.js";
import { buildAuditBatchCommands, SECTION_INDICES } from "./commands.js";
import { calculateCategoryScore, calculateOverallScore } from "./scoring.js";
import { sshExec } from "../../utils/ssh.js";

/** Separator used between sections in SSH batch output */
const SEPARATOR = "---SEPARATOR---";

/**
 * Category registry — maps category names to their section index and parser.
 * Plan 02 will replace the placeholder parsers with real implementations.
 */
interface CategoryEntry {
  name: string;
  sectionIndex: number;
  parser: CheckParser;
}

/** Placeholder parser that returns no checks — replaced by Plan 02 */
const noopParser: CheckParser = () => [];

const CATEGORY_REGISTRY: CategoryEntry[] = [
  { name: "SSH", sectionIndex: SECTION_INDICES.SSH, parser: noopParser },
  { name: "Firewall", sectionIndex: SECTION_INDICES.FIREWALL, parser: noopParser },
  { name: "Updates", sectionIndex: SECTION_INDICES.UPDATES, parser: noopParser },
  { name: "Auth", sectionIndex: SECTION_INDICES.AUTH, parser: noopParser },
  { name: "Docker", sectionIndex: SECTION_INDICES.DOCKER, parser: noopParser },
  { name: "Network", sectionIndex: SECTION_INDICES.NETWORK, parser: noopParser },
  { name: "Filesystem", sectionIndex: SECTION_INDICES.FILESYSTEM, parser: noopParser },
  { name: "Logging", sectionIndex: SECTION_INDICES.LOGGING, parser: noopParser },
  { name: "Kernel", sectionIndex: SECTION_INDICES.KERNEL, parser: noopParser },
];

/** Number of sections in batch 1 */
const BATCH1_SECTION_COUNT = 4;

/**
 * Parse batch SSH output into indexed sections.
 * Each batch's output is split by ---SEPARATOR--- and mapped to global section indices.
 */
function parseBatchOutput(
  outputs: string[],
): Map<number, string> {
  const sections = new Map<number, string>();

  for (let batchIdx = 0; batchIdx < outputs.length; batchIdx++) {
    const parts = outputs[batchIdx].split(SEPARATOR);
    const baseIndex = batchIdx === 0 ? 0 : BATCH1_SECTION_COUNT;

    for (let i = 0; i < parts.length; i++) {
      sections.set(baseIndex + i, parts[i].trim());
    }
  }

  return sections;
}

/**
 * Run a full server security audit.
 *
 * 1. Build SSH batch commands for the target platform
 * 2. Execute each batch via SSH (with per-batch error handling)
 * 3. Split output into sections and route to category parsers
 * 4. Calculate per-category and overall scores
 * 5. Return AuditResult wrapped in KastellResult
 */
export async function runAudit(
  ip: string,
  serverName: string,
  platform: string,
): Promise<KastellResult<AuditResult>> {
  try {
    const batchCommands = buildAuditBatchCommands(platform);
    const batchOutputs: string[] = [];

    // Execute each batch — handle partial failures gracefully
    for (const cmd of batchCommands) {
      try {
        const result = await sshExec(ip, cmd);
        batchOutputs.push(result.stdout);
      } catch {
        // If a batch fails, push empty string so section indexing stays aligned
        batchOutputs.push("");
      }
    }

    // Parse outputs into indexed sections
    const sections = parseBatchOutput(batchOutputs);

    // Run each category parser against its section
    const categories: AuditCategory[] = CATEGORY_REGISTRY.map((entry) => {
      const sectionOutput = sections.get(entry.sectionIndex) ?? "";
      const checks = entry.parser(sectionOutput, platform);
      const { score, maxScore } = calculateCategoryScore(checks);

      return {
        name: entry.name,
        checks,
        score,
        maxScore,
      };
    });

    const overallScore = calculateOverallScore(categories);

    const auditResult: AuditResult = {
      serverName,
      serverIp: ip,
      platform: platform as AuditResult["platform"],
      timestamp: new Date().toISOString(),
      categories,
      overallScore,
      quickWins: [], // Plan 03+ will populate quick wins
    };

    return { success: true, data: auditResult };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Audit failed: ${message}`,
      hint: "Ensure SSH access to the server is configured correctly",
    };
  }
}
