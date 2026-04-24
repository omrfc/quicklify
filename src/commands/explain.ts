import {
  findCheckById,
  formatExplainTerminal,
  formatExplainJson,
  formatExplainMarkdown,
} from "../core/audit/explainCheck.js";
import { logger } from "../utils/logger.js";

interface ExplainOptions {
  format?: "terminal" | "json" | "md";
}

export async function explainCommand(
  checkId: string,
  options: ExplainOptions,
): Promise<void> {
  const result = findCheckById(checkId);

  if (!result.match) {
    logger.error(`Unknown check ID: ${checkId}`);
    logger.info(
      result.suggestions.length > 0
        ? `Did you mean: ${result.suggestions.join(", ")}?`
        : "Run `kastell audit --list-checks` to see all available checks.",
    );
    process.exit(1);
  }

  const validFormats = ["terminal", "json", "md"] as const;
  const format = options.format ?? "terminal";
  if (!validFormats.includes(format as typeof validFormats[number])) {
    logger.error(`Invalid format: ${format}. Use terminal, json, or md.`);
    process.exit(1);
  }
  switch (format) {
    case "json":
      console.log(formatExplainJson(result.match));
      break;
    case "md":
      console.log(formatExplainMarkdown(result.match));
      break;
    default:
      console.log(formatExplainTerminal(result.match));
      break;
  }
}
