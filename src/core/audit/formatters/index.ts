/**
 * Audit formatters — single entry point for all output formats.
 */

import type { AuditResult } from "../types.js";
import { formatTerminal } from "./terminal.js";

export interface AuditCliOptions {
  json?: boolean;
  badge?: boolean;
  report?: string;     // "html" | "md"
  summary?: boolean;
  scoreOnly?: boolean;
  explain?: boolean;
}

/**
 * Select the appropriate formatter based on CLI options.
 * Returns an async function that takes AuditResult and produces a string.
 */
export async function selectFormatter(
  options: AuditCliOptions,
): Promise<(result: AuditResult) => string> {
  if (options.json) {
    const { formatJson } = await import("./json.js");
    return formatJson;
  }

  if (options.badge) {
    const { formatBadge } = await import("./badge.js");
    return formatBadge;
  }

  if (options.report === "html") {
    const { formatHtmlReport } = await import("./report.js");
    return formatHtmlReport;
  }

  if (options.report === "md") {
    const { formatMdReport } = await import("./report.js");
    return formatMdReport;
  }

  if (options.summary) {
    const { formatSummary } = await import("./summary.js");
    return formatSummary;
  }

  // Default: terminal output
  return (result) => formatTerminal(result, options);
}

export { formatTerminal } from "./terminal.js";
export { formatJson } from "./json.js";
export { formatBadge } from "./badge.js";
export { formatHtmlReport, formatMdReport } from "./report.js";
export { formatSummary } from "./summary.js";
