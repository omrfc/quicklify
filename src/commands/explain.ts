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
    if (result.suggestions.length > 0) {
      logger.error(`Unknown check ID: ${checkId}`);
      logger.info(`Did you mean: ${result.suggestions.join(", ")}?`);
    } else {
      logger.error(`Unknown check ID: ${checkId}`);
      logger.info("Run `kastell audit --list-checks` to see all available checks.");
    }
    process.exit(1);
  }

  const format = options.format ?? "terminal";
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
