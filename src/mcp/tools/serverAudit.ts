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
import { calculateComplianceDetail } from "../../core/audit/compliance/scoring.js";
import { FRAMEWORK_KEY_MAP } from "../../core/audit/compliance/types.js";


export const serverAuditSchema = {
  server: z.string().optional().describe("Server name or IP. Auto-selected if only one server exists."),
  format: z.enum(["summary", "json", "score"]).default("summary")
    .describe("Output format: summary (default), json (full result), score (number only)"),
  framework: z.enum(["cis-level1", "cis-level2", "pci-dss", "hipaa"]).optional()
    .describe("Compliance framework filter. Returns per-control pass/fail summary alongside audit results."),
  explain: z.boolean().optional().describe(
    "When true, include why + fix explanation for each failing check in summary format output. Capped at 10 checks."
  ),
};

export async function handleServerAudit(params: {
  server?: string;
  format?: "summary" | "json" | "score";
  framework?: "cis-level1" | "cis-level2" | "pci-dss" | "hipaa";
  explain?: boolean;
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
      const jsonResult: Record<string, unknown> = { ...auditResult };
      if (params.framework) {
        const fw = FRAMEWORK_KEY_MAP[params.framework];
        const detail = calculateComplianceDetail(auditResult.categories);
        jsonResult.complianceDetail = detail.filter((d) => d.framework === fw);
      }
      return {
        content: [{ type: "text", text: JSON.stringify(jsonResult) }],
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

    // Add compliance summary when framework param provided
    if (params.framework) {
      const fw = FRAMEWORK_KEY_MAP[params.framework];
      const detail = calculateComplianceDetail(auditResult.categories);
      const fwScore = detail.find((d) => d.framework === fw);
      if (fwScore) {
        summaryParts.push(
          "",
          `Compliance (${fwScore.version}):`,
          `  Pass Rate: ${fwScore.passedControls}/${fwScore.totalControls} (${fwScore.passRate}%)`,
          `  Failing: ${fwScore.controls.filter((c) => !c.passed).length} controls`,
        );
      }
    }

    // Explain: append failing check details when explain param is set (summary format only)
    if (params.explain) {
      const failingChecks = auditResult.categories
        .flatMap((c) => c.checks)
        .filter((ch) => !ch.passed && ch.explain);
      if (failingChecks.length > 0) {
        summaryParts.push("", "Failing Checks (with explanations):");
        const maxDisplay = 10;
        for (const ch of failingChecks.slice(0, maxDisplay)) {
          summaryParts.push(`  [${ch.severity}] ${ch.id}: ${ch.name}`);
          summaryParts.push(`    Why: ${ch.explain}`);
        }
        if (failingChecks.length > maxDisplay) {
          summaryParts.push(`  ... and ${failingChecks.length - maxDisplay} more failing checks`);
        }
      }
    }

    summaryParts.push(
      "",
      `Timestamp: ${auditResult.timestamp}`,
    );

    const responseData: Record<string, unknown> = {
      summary: summaryParts.join("\n"),
      overallScore: auditResult.overallScore,
      suggested_actions: [
        { command: `server_audit { server: '${server.name}', format: 'json' }`, reason: "Get full audit details" },
      ],
    };

    if (auditResult.skippedCategories && auditResult.skippedCategories.length > 0) {
      responseData.skippedCategories = auditResult.skippedCategories;
    }

    return mcpSuccess(responseData);
  } catch (error: unknown) {
    return mcpError(getErrorMessage(error));
  }
}
