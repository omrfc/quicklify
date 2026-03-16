/**
 * VPS detection and adjustment utilities.
 * Extracts VPS type from SSH batch output and downgrades
 * physical-hardware checks to info severity on VPS environments.
 */

import type { AuditCategory, Severity } from "./types.js";

/**
 * Extracts VPS type from combined SSH batch output strings.
 * Looks for `VPS_TYPE:<type>` emitted by the Cloud Metadata section
 * (systemd-detect-virt). Returns null on bare metal or when no match found.
 *
 * @param batchOutputs - Array of raw SSH batch output strings
 * @returns VPS type string (e.g. "kvm", "xen") or null for bare metal
 */
export function extractVpsType(batchOutputs: string[]): string | null {
  for (const output of batchOutputs) {
    const match = output.match(/VPS_TYPE:(\S+)/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Downgrades vpsIrrelevant checks to severity "info" when running on VPS.
 * Returns categories unchanged (adjustedCount = 0) on bare metal.
 * Never mutates input — returns new category/check objects.
 *
 * @param categories - Parsed audit categories
 * @param vpsType - VPS type from extractVpsType(); null = bare metal
 * @returns New categories array and count of downgraded checks
 */
export function applyVpsAdjustments(
  categories: AuditCategory[],
  vpsType: string | null,
): { categories: AuditCategory[]; adjustedCount: number } {
  if (vpsType === null) {
    return { categories, adjustedCount: 0 };
  }

  let adjustedCount = 0;
  const infoSeverity: Severity = "info";

  const adjustedCategories = categories.map((cat) => {
    const hasRelevant = cat.checks.some((c) => c.vpsIrrelevant === true && c.severity !== infoSeverity);
    if (!hasRelevant) return cat;

    return {
      ...cat,
      checks: cat.checks.map((check) => {
        if (check.vpsIrrelevant === true && check.severity !== infoSeverity) {
          adjustedCount++;
          return { ...check, severity: infoSeverity };
        }
        return check;
      }),
    };
  });

  return { categories: adjustedCategories, adjustedCount };
}
