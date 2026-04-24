import { z } from "zod";
import { findCheckById } from "../../core/audit/explainCheck.js";
import { mcpError, mcpSuccess } from "../utils.js";

export const serverExplainSchema = z.object({
  checkId: z.string().describe("Audit check ID to explain (e.g. SSH-PASSWORD-AUTH). Case-insensitive, fuzzy matching supported."),
});

type ServerExplainParams = z.infer<typeof serverExplainSchema>;

export async function serverExplainHandler(params: ServerExplainParams) {
  const result = findCheckById(params.checkId);

  if (!result.match) {
    const suggestions = result.suggestions.length > 0
      ? ` Did you mean: ${result.suggestions.join(", ")}?`
      : "";
    return mcpError(
      `Unknown check ID: ${params.checkId}.${suggestions}`,
      "Use server_audit with listChecks action or kastell audit --list-checks to see all available check IDs.",
    );
  }

  return mcpSuccess({ ...result.match });
}
