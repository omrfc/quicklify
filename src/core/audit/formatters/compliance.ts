/**
 * Compliance detail formatter — Framework>Control>Check grouped report.
 * Failing controls show individual check details; passing controls are collapsed.
 */

import chalk from "chalk";
import type { AuditResult } from "../types.js";
import { calculateComplianceDetail } from "../compliance/scoring.js";
import type { FrameworkKey } from "../compliance/mapper.js";
import { scoreColor } from "./shared.js";

/**
 * Format a detailed compliance report grouped by Framework > Control > Check.
 * @param result - Audit result with compliance-enriched checks
 * @param frameworks - Frameworks to include (empty = all)
 */
export function formatComplianceReport(
  result: AuditResult,
  frameworks: FrameworkKey[],
): string {
  const allScores = calculateComplianceDetail(result.categories);
  const filtered =
    frameworks.length > 0
      ? allScores.filter((s) => frameworks.includes(s.framework))
      : allScores;

  const lines: string[] = [];
  lines.push("");
  lines.push(chalk.bold.cyan("Compliance Report"));
  lines.push(chalk.gray(`Server: ${result.serverName} (${result.serverIp})`));
  lines.push(chalk.gray(`Overall Score: ${result.overallScore}/100`));
  lines.push("");

  for (const score of filtered) {
    const colorFn = scoreColor(score.passRate);
    lines.push(chalk.bold(score.version));
    lines.push(
      `  Pass Rate: ${colorFn(`${score.passedControls}/${score.totalControls}`)} (${score.passRate}%)`,
    );
    if (score.partialCount > 0) {
      lines.push(
        chalk.yellow(
          `  ${score.partialCount} control(s) with partial coverage — manual review recommended`,
        ),
      );
    }
    lines.push("");

    // Failing controls — show each check
    const failing = score.controls.filter((c) => !c.passed);
    if (failing.length > 0) {
      lines.push(chalk.red(`  Failing Controls (${failing.length}):`));
      for (const ctrl of failing) {
        const partialNote = ctrl.hasPartial ? chalk.yellow(" [partial]") : "";
        lines.push(`    ${chalk.bold(ctrl.controlId)}: ${ctrl.description}${partialNote}`);
        for (const check of ctrl.checks) {
          const icon = check.passed ? chalk.green("PASS") : chalk.red("FAIL");
          lines.push(`      ${icon} ${check.id} — ${check.name}`);
        }
      }
      lines.push("");
    }

    // Passing controls — collapsed to one line each
    const passing = score.controls.filter((c) => c.passed);
    if (passing.length > 0) {
      lines.push(chalk.green(`  Passing Controls (${passing.length}):`));
      for (const ctrl of passing) {
        lines.push(
          `    ${chalk.green("PASS")} ${ctrl.controlId}: ${ctrl.description} (${ctrl.checks.length} check${ctrl.checks.length !== 1 ? "s" : ""})`,
        );
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
