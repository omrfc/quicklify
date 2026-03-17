/**
 * Display-only filter for AuditResult.
 * Pure functions — no side effects, no mutation.
 * Filters affect what is displayed; history/snapshot always store unfiltered data.
 */

import type { AuditResult } from "./types.js";

export interface AuditFilter {
  category?: string; // comma-separated, case-insensitive
  severity?: string; // single value: "critical" | "warning" | "info"
}

/**
 * Filter an AuditResult for display purposes only.
 * - category: comma-separated list of category names (case-insensitive)
 * - severity: single severity level ("critical" | "warning" | "info")
 * - Both active: AND logic (intersection)
 * - overallScore is always preserved unchanged
 */
export function filterAuditResult(result: AuditResult, filter: AuditFilter): AuditResult {
  if (!filter.category && !filter.severity) return result;

  const cats = filter.category
    ? filter.category.split(",").map((c) => c.trim().toLowerCase())
    : null;

  const filteredCategories = result.categories
    .map((cat) => {
      if (cats && !cats.includes(cat.name.toLowerCase())) return null;
      const checks = filter.severity
        ? cat.checks.filter((ch) => ch.severity === filter.severity)
        : cat.checks;
      return checks.length > 0 ? { ...cat, checks } : null;
    })
    .filter((cat): cat is NonNullable<typeof cat> => cat !== null);

  // overallScore stays unchanged — filter only affects display
  return { ...result, categories: filteredCategories };
}

/**
 * Build a human-readable annotation describing the active filter.
 * Returns "" when no filter is active.
 * Example: " (showing category: ssh, severity: critical)"
 */
export function buildFilterAnnotation(filter: AuditFilter): string {
  const parts: string[] = [];
  if (filter.category) parts.push(`category: ${filter.category}`);
  if (filter.severity) parts.push(`severity: ${filter.severity}`);
  return parts.length > 0 ? ` (showing ${parts.join(", ")})` : "";
}
