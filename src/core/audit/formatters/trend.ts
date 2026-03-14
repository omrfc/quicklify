/**
 * Formatters for risk trend output.
 * Provides terminal (chalk-coloured) and JSON output for TrendResult.
 */

import chalk from "chalk";
import type { TrendResult } from "../types.js";

/** Score color based on value — matches existing audit formatter convention */
function scoreColor(score: number): (text: string) => string {
  if (score >= 80) return chalk.green;
  if (score >= 50) return chalk.yellow;
  return chalk.red;
}

/**
 * Format TrendResult for terminal display.
 * Shows a chronological timeline with per-entry score, delta, and cause lines.
 */
export function formatTrendTerminal(result: TrendResult): string {
  const lines: string[] = [];

  lines.push(chalk.cyan.bold("── Kastell Risk Trend ───────────────────────────────────"));
  lines.push(chalk.gray(`Server: ${result.serverName} (${result.serverIp})`));
  lines.push("");

  if (result.entries.length === 0) {
    lines.push(chalk.dim("No audit history found for the specified period."));
    lines.push("");
    return lines.join("\n");
  }

  for (const entry of result.entries) {
    const date = new Date(entry.timestamp).toLocaleDateString();
    const colorFn = scoreColor(entry.score);
    const scoreStr = colorFn(`${entry.score}/100`);

    let deltaStr: string;
    if (entry.delta === null) {
      deltaStr = chalk.dim("(first)");
    } else if (entry.delta > 0) {
      deltaStr = chalk.green(`+${entry.delta}`);
    } else if (entry.delta < 0) {
      deltaStr = chalk.red(`${entry.delta}`);
    } else {
      deltaStr = chalk.dim("±0");
    }

    lines.push(`  ${chalk.bold(date)}  ${scoreStr}  ${deltaStr}`);

    for (const cause of entry.causeList) {
      const sign = cause.delta > 0 ? "+" : "";
      lines.push(
        chalk.dim(
          `    ${cause.category}: ${cause.scoreBefore} -> ${cause.scoreAfter} (${sign}${cause.delta})`,
        ),
      );
    }
  }

  lines.push("");
  lines.push(chalk.cyan.bold("─────────────────────────────────────────────────────────"));
  lines.push("");

  return lines.join("\n");
}

/**
 * Format TrendResult as a JSON string.
 * Produces valid JSON matching TrendResult shape (TREND-04).
 */
export function formatTrendJson(result: TrendResult): string {
  return JSON.stringify(result, null, 2);
}
