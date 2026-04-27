import { z } from "zod";
import { findCheckById, formatSuggestions } from "../../core/audit/explainCheck.js";
import { mcpError, mcpSuccess } from "../utils.js";

export const serverExplainSchema = z.object({
  checkId: z.string().describe("Audit check ID to explain (e.g. SSH-PASSWORD-AUTH). Case-insensitive, fuzzy matching supported."),
});

type ServerExplainParams = z.infer<typeof serverExplainSchema>;

export async function serverExplainHandler(params: ServerExplainParams) {
  const result = findCheckById(params.checkId);

  if (!result.match) {
    return mcpError(
      `Unknown check ID: ${params.checkId}. ${formatSuggestions(result.suggestions)}`,
      "Use server_audit with listChecks action or kastell audit --list-checks to see all available check IDs.",
    );
  }

  return mcpSuccess({ ...result.match });
}
