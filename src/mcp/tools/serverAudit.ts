import { z } from "zod";
import { getServers } from "../../utils/config.js";
import { runAudit } from "../../core/audit/index.js";
import {
  resolveServerForMcp,
  mcpSuccess,
  mcpError,
  type McpResponse,
} from "../utils.js";
import { getErrorMessage } from "../../utils/errorMapper.js";

export const serverAuditSchema = {
  server: z.string().optional().describe("Server name or IP. Auto-selected if only one server exists."),
  format: z.enum(["summary", "json", "score"]).default("summary")
    .describe("Output format: summary (default), json (full result), score (number only)"),
};

export async function handleServerAudit(params: {
  server?: string;
  format?: "summary" | "json" | "score";
}): Promise<McpResponse> {
  try {
    const servers = getServers();
    if (servers.length === 0) {
      return mcpError("No servers found", undefined, [
        { command: "kastell add", reason: "Add a server first" },
      ]);
    }

    const server = resolveServerForMcp(params, servers);
    if (!server) {
      if (params.server) {
        return mcpError(
          `Server not found: ${params.server}`,
          `Available servers: ${servers.map((s) => s.name).join(", ")}`,
        );
      }
      return mcpError(
        "Multiple servers found. Specify which server to audit.",
        `Available: ${servers.map((s) => s.name).join(", ")}`,
      );
    }

    const platform = server.platform ?? server.mode ?? "bare";
    const result = await runAudit(server.ip, server.name, platform);

    if (!result.success || !result.data) {
      return mcpError(
        result.error ?? "Audit failed",
        result.hint,
      );
    }

    const auditResult = result.data;
    const format = params.format ?? "summary";

    if (format === "json") {
      return {
        content: [{ type: "text", text: JSON.stringify(auditResult) }],
      };
    }

    if (format === "score") {
      return mcpSuccess({ score: auditResult.overallScore });
    }

    // summary format: compact text for AI consumption
    const categoryLines = auditResult.categories.map(
      (c) => `  ${c.name}: ${c.score}/${c.maxScore}`,
    );

    const quickWinLines = auditResult.quickWins.slice(0, 3).map(
      (qw) => `  - ${qw.description} (${qw.currentScore} -> ${qw.projectedScore})`,
    );

    const summaryParts = [
      `Server: ${auditResult.serverName} (${auditResult.serverIp})`,
      `Platform: ${auditResult.platform}`,
      `Overall Score: ${auditResult.overallScore}/100`,
      "",
      "Categories:",
      ...categoryLines,
    ];

    if (quickWinLines.length > 0) {
      summaryParts.push("", "Top Quick Wins:", ...quickWinLines);
    }

    summaryParts.push(
      "",
      `Timestamp: ${auditResult.timestamp}`,
    );

    return mcpSuccess({
      summary: summaryParts.join("\n"),
      overallScore: auditResult.overallScore,
      suggested_actions: [
        { command: `server_audit { server: '${server.name}', format: 'json' }`, reason: "Get full audit details" },
      ],
    });
  } catch (error: unknown) {
    return mcpError(getErrorMessage(error));
  }
}
