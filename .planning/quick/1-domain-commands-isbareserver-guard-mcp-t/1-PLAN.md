---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/commands/domain.ts
  - src/mcp/tools/serverSecure.ts
  - src/mcp/tools/serverBackup.ts
  - src/mcp/tools/serverMaintain.ts
  - src/mcp/tools/serverLogs.ts
autonomous: true
requirements: [AUDIT-TD-01, AUDIT-TD-02]

must_haves:
  truths:
    - "Domain CLI command rejects bare servers with clear error before any SSH/DB operation"
    - "MCP domain-* actions reject bare servers with mcpError before Coolify DB calls"
    - "All 4 MCP tools use mcpError() for server-not-found and multiple-server error paths"
    - "serverBackup.ts uses shared requireProviderToken instead of local duplicate"
  artifacts:
    - path: "src/commands/domain.ts"
      provides: "requireCoolifyMode guard before domain operations"
      contains: "requireCoolifyMode"
    - path: "src/mcp/tools/serverSecure.ts"
      provides: "requireCoolifyMode guard for domain-* cases + mcpError consistency"
      contains: "requireCoolifyMode"
    - path: "src/mcp/tools/serverBackup.ts"
      provides: "mcpError for server-not-found + requireProviderToken from utils"
      contains: "requireProviderToken"
    - path: "src/mcp/tools/serverMaintain.ts"
      provides: "mcpError for server-not-found paths"
      contains: "mcpError"
    - path: "src/mcp/tools/serverLogs.ts"
      provides: "mcpError for server-not-found paths"
      contains: "mcpError"
  key_links:
    - from: "src/commands/domain.ts"
      to: "src/utils/modeGuard.js"
      via: "requireCoolifyMode import"
      pattern: "requireCoolifyMode"
    - from: "src/mcp/tools/serverBackup.ts"
      to: "src/mcp/utils.js"
      via: "requireProviderToken import"
      pattern: "requireProviderToken"
---

<objective>
Fix two v1.2.0 milestone audit tech debt items: (1) add bare-mode guard to domain commands (CLI + MCP), (2) replace raw MCP error constructions with shared mcpError() helper across 4 MCP tools.

Purpose: Domain operations interact with Coolify DB (docker exec into coolify-db container) which does not exist on bare servers. Raw error constructions bypass the shared mcpError() helper, causing inconsistent error shape.
Output: 5 modified source files with consistent error handling and mode guards.
</objective>

<execution_context>
@C:/Users/Omrfc/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Omrfc/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/utils/modeGuard.ts
@src/mcp/utils.ts

<interfaces>
<!-- Key types and contracts the executor needs -->

From src/utils/modeGuard.ts:
```typescript
export function isBareServer(server: ServerRecord): boolean;
export function requireCoolifyMode(server: ServerRecord, commandName: string): string | null;
// Returns error message string if bare, null if coolify — caller checks for truthy
```

From src/mcp/utils.ts:
```typescript
export type McpResponse = { content: Array<{ type: "text"; text: string }>; isError?: boolean };
export function mcpSuccess(data: Record<string, unknown>): McpResponse;
export function mcpError(error: string, hint?: string, suggestedActions?: Array<{ command: string; reason: string }>): McpResponse;
export function requireProviderToken(provider: string): { token: string } | { error: McpResponse };
// requireProviderToken returns discriminated union — check "error" in result
```

Pattern from src/commands/update.ts (CLI bare guard):
```typescript
import { requireCoolifyMode } from "../utils/modeGuard.js";
// After resolveServer:
const modeError = requireCoolifyMode(server, "update");
if (modeError) { logger.error(modeError); return; }
```

Pattern from src/mcp/tools/serverMaintain.ts (MCP bare guard):
```typescript
import { requireCoolifyMode } from "../../utils/modeGuard.js";
// Inside case handler:
const modeError = requireCoolifyMode(server, "update");
if (modeError) { return mcpError(modeError, "Use SSH to manage bare servers directly"); }
```

Current raw error pattern being replaced (same in all 4 MCP tools):
```typescript
// server-not-found:
return { content: [{ type: "text", text: JSON.stringify({
  error: `Server not found: ${params.server}`,
  available_servers: servers.map((s) => s.name),
}) }], isError: true };
// multiple-servers:
return { content: [{ type: "text", text: JSON.stringify({
  error: "Multiple servers found. Specify which server to use.",
  available_servers: servers.map((s) => ({ name: s.name, ip: s.ip })),
}) }], isError: true };
```
NOTE on available_servers: mcpError() signature does not support arbitrary keys (per decision [Phase 03-mcp-refactor]). The non-standard `available_servers` field is kept as inline JSON within the error string for the server-not-found case. For the multiple-servers case, include server names in the hint string.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add requireCoolifyMode guard to CLI domain command and MCP domain actions</name>
  <files>src/commands/domain.ts, src/mcp/tools/serverSecure.ts</files>
  <action>
**src/commands/domain.ts:**
1. Add import: `import { requireCoolifyMode } from "../utils/modeGuard.js";`
2. After `const server = await resolveServer(...)` (line 47) and before the switch statement, add the bare-mode guard:
```typescript
const modeError = requireCoolifyMode(server, "domain");
if (modeError) {
  logger.error(modeError);
  return;
}
```
This follows the exact same pattern used in update.ts and maintain.ts.

**src/mcp/tools/serverSecure.ts:**
1. Add import: `import { requireCoolifyMode } from "../../utils/modeGuard.js";`
2. Inside handleServerSecure, BEFORE the switch statement (after the server resolution block, around line 89), add a guard that checks if the action is one of the 4 domain actions AND the server is bare:
```typescript
const domainActions = ["domain-set", "domain-remove", "domain-check", "domain-info"];
if (domainActions.includes(params.action)) {
  const modeError = requireCoolifyMode(server, params.action);
  if (modeError) {
    return mcpError(modeError, "Domain management requires Coolify. Use SSH for bare server DNS configuration.");
  }
}
```
This is placed before the switch so all 4 domain cases are guarded without duplicating the check in each case block.
  </action>
  <verify>
    <automated>cd C:/Users/Omrfc/Documents/quicklify && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>domain.ts has requireCoolifyMode guard after resolveServer; serverSecure.ts has requireCoolifyMode guard before domain-* switch cases; TypeScript compiles without errors.</done>
</task>

<task type="auto">
  <name>Task 2: Replace raw MCP error constructions with mcpError() and wire requireProviderToken</name>
  <files>src/mcp/tools/serverBackup.ts, src/mcp/tools/serverMaintain.ts, src/mcp/tools/serverSecure.ts, src/mcp/tools/serverLogs.ts</files>
  <action>
In all 4 MCP tools, replace the raw `{ content: [...], isError: true }` constructions for the server-not-found and multiple-servers error paths with `mcpError()` calls:

**Pattern replacement for all 4 files** — the `if (!server)` block (after resolveServerForMcp) currently has two raw returns. Replace with:
```typescript
if (!server) {
  if (params.server) {
    return mcpError(
      `Server not found: ${params.server}`,
      `Available servers: ${servers.map((s) => s.name).join(", ")}`,
    );
  }
  return mcpError(
    "Multiple servers found. Specify which server to use.",
    `Available: ${servers.map((s) => s.name).join(", ")}`,
  );
}
```
The `available_servers` data that was previously a separate JSON field is moved into the hint string, since mcpError does not support arbitrary keys per project decision.

Apply this to:
- `src/mcp/tools/serverBackup.ts` (lines ~62-79)
- `src/mcp/tools/serverMaintain.ts` (lines ~45-62)
- `src/mcp/tools/serverSecure.ts` (lines ~72-89)
- `src/mcp/tools/serverLogs.ts` (lines ~53-70)

**Additional for serverBackup.ts only:**
1. Add `requireProviderToken` to the import from `../utils.js`:
   ```typescript
   import { resolveServerForMcp, mcpSuccess, mcpError, requireProviderToken, type McpResponse } from "../utils.js";
   ```
2. Remove the local `requireToken` function at the bottom of the file (lines ~372-381).
3. Replace all 3 calls to `requireToken(server.provider)` with `requireProviderToken(server.provider)`.
4. Remove the now-unused `import { getProviderToken } from "../../core/tokens.js";` since requireProviderToken encapsulates it.

**Additional for serverMaintain.ts:**
Also in the `restart` case (lines ~123-132), the raw token-missing error should use mcpError:
```typescript
const token = getProviderToken(server.provider);
if (!token) {
  return mcpError(
    `No API token found for provider: ${server.provider}`,
    `Set environment variable: ${server.provider.toUpperCase()}_TOKEN`,
  );
}
```
Same for the `maintain` case token check (lines ~185-196):
```typescript
if (!envToken) {
  return mcpError(
    `No API token found for provider: ${server.provider}`,
    `Set environment variable: ${server.provider.toUpperCase()}_TOKEN`,
    [{ command: `server_maintain { action: 'update', server: '${server.name}' }`, reason: "Run update only (no token needed)" }],
  );
}
```
And the manual server error in the `restart` case (lines ~113-121):
```typescript
if (isManual) {
  return mcpError(
    "Cannot reboot manually added server via API",
    `Use SSH: ssh root@${server.ip} reboot`,
  );
}
```
  </action>
  <verify>
    <automated>cd C:/Users/Omrfc/Documents/quicklify && npm run build && npm test 2>&1 | tail -20</automated>
  </verify>
  <done>All 4 MCP tools use mcpError() for every error path (no raw content/isError constructions remain for server-not-found, multiple-servers, token-missing). serverBackup.ts uses shared requireProviderToken from utils.ts with no local requireToken duplicate. All tests pass, build succeeds.</done>
</task>

</tasks>

<verification>
```bash
# 1. Verify no raw isError constructions remain in the server-not-found/token paths
grep -n "isError: true" src/mcp/tools/server{Backup,Maintain,Secure,Logs}.ts

# 2. Verify requireCoolifyMode is called in domain.ts
grep -n "requireCoolifyMode" src/commands/domain.ts

# 3. Verify requireCoolifyMode is called in serverSecure.ts for domain actions
grep -n "requireCoolifyMode" src/mcp/tools/serverSecure.ts

# 4. Verify no local requireToken in serverBackup.ts
grep -n "function requireToken" src/mcp/tools/serverBackup.ts

# 5. Verify requireProviderToken imported in serverBackup.ts
grep -n "requireProviderToken" src/mcp/tools/serverBackup.ts

# 6. Full test suite
npm run build && npm test
```
</verification>

<success_criteria>
- domain.ts blocks bare servers before any domain operation (same pattern as update.ts/maintain.ts)
- serverSecure.ts blocks bare servers for domain-set, domain-remove, domain-check, domain-info MCP actions
- All 4 MCP tools use mcpError() for server-not-found and multiple-servers error responses
- serverBackup.ts uses shared requireProviderToken from mcp/utils.ts (no local duplicate)
- serverMaintain.ts uses mcpError() for token-missing and manual-server error paths
- TypeScript compiles, all 1921+ tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/1-domain-commands-isbareserver-guard-mcp-t/1-SUMMARY.md`
</output>
