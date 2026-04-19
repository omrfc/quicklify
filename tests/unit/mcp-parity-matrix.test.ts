import { readFileSync } from "fs";
import { join } from "path";

describe("MCP/CLI Parity Matrix — audit/fix features", () => {
  const serverTs = readFileSync(join(__dirname, "../../src/mcp/server.ts"), "utf-8");
  const auditMcpTs = readFileSync(join(__dirname, "../../src/mcp/tools/serverAudit.ts"), "utf-8");
  const fixMcpTs = readFileSync(join(__dirname, "../../src/mcp/tools/serverFix.ts"), "utf-8");

  describe("server_audit parity", () => {
    const requiredParams = ["category", "severity", "snapshot", "compare", "threshold", "profile"];

    for (const param of requiredParams) {
      it(`schema includes '${param}' parameter`, () => {
        expect(auditMcpTs).toContain(`${param}:`);
      });
    }
  });

  describe("server_fix parity", () => {
    it("MCP fix supports checks parameter", () => {
      expect(fixMcpTs).toContain("checks:");
    });
  });

  describe("MCP tool descriptions stay under 2KB", () => {
    const toolDescriptions = serverTs.match(/\.describe\("([^"]+)"/g) || [];
    const registerDescriptions = serverTs.match(/description:\s*"([^"]+)"/g) || [];
    const allDescs = [...toolDescriptions, ...registerDescriptions];

    it("no description exceeds 2048 characters", () => {
      const tooLong = allDescs.filter((d) => d.length > 2048);
      expect(tooLong).toEqual([]);
    });
  });
});