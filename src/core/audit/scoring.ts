/**
 * Audit scoring engine.
 * Calculates per-category and overall scores with severity weighting.
 */

import type { AuditCheck, AuditCategory, Severity } from "./types.js";

/** Severity weights: critical checks matter more than info checks */
const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

/**
 * Calculate score for a single category based on its checks.
 * Score = (sum of passed check weights / sum of all check weights) * 100
 *
 * @returns score (0-100) and maxScore (always 100 if checks exist, 0 if empty)
 */
export function calculateCategoryScore(
  checks: AuditCheck[],
): { score: number; maxScore: number } {
  if (checks.length === 0) {
    return { score: 0, maxScore: 0 };
  }

  let totalWeight = 0;
  let passedWeight = 0;

  for (const check of checks) {
    const weight = SEVERITY_WEIGHTS[check.severity];
    totalWeight += weight;
    if (check.passed) {
      passedWeight += weight;
    }
  }

  const score = Math.round((passedWeight / totalWeight) * 100);
  return { score, maxScore: 100 };
}

/**
 * Calculate overall audit score from category scores.
 * Equal weight per category — simple average, rounded to nearest integer.
 */
export function calculateOverallScore(categories: AuditCategory[]): number {
  if (categories.length === 0) {
    return 0;
  }

  const sum = categories.reduce((acc, cat) => acc + cat.score, 0);
  return Math.round(sum / categories.length);
}
