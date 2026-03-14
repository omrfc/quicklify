#!/usr/bin/env node
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server.js";
import { migrateConfigIfNeeded } from "../utils/migration.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "..", "package.json"), "utf-8")) as { version: string };

async function main(): Promise<void> {
  migrateConfigIfNeeded();
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is now listening on stdin/stdout via JSON-RPC
  // All logging must go to stderr (stdout is reserved for MCP protocol)
  process.stderr.write(`kastell-mcp v${pkg.version} started\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`Fatal: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
