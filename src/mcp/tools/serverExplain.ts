import { z } from "zod";
import { findCheckById } from "../../core/audit/explainCheck.js";

export const serverExplainSchema = z.object({
  checkId: z.string().describe("Audit check ID to explain (e.g. SSH-PASSWORD-AUTH). Case-insensitive, fuzzy matching supported."),
});

type ServerExplainParams = z.infer<typeof serverExplainSchema>;

export async function serverExplainHandler(params: ServerExplainParams) {
  const result = findCheckById(params.checkId);

  if (!result.match) {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          error: `Unknown check ID: ${params.checkId}`,
          suggestions: result.suggestions,
          hint: "Use server_audit with listChecks action or kastell audit --list-checks to see all available check IDs.",
        }),
      }],
      isError: true,
    };
  }

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify(result.match, null, 2),
    }],
  };
}
