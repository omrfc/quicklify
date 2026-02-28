# Phase 3: MCP Refactor - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

MCP tools route through core/ modules and support bare mode via parameter. No duplicated logic between MCP and CLI paths. Consistent error format across all 7 MCP tools. No breaking changes to existing MCP tool schemas or behavior.

Requirements: MCP-01, MCP-02, MCP-03, MCP-04

</domain>

<decisions>
## Implementation Decisions

### Bare mode MCP flow
- Provision tool: add optional `mode: z.enum(['coolify','bare']).default('coolify')` parameter — backward compatible, existing calls unaffected
- Add tool (serverManage): add optional `mode` parameter with same schema — manually added servers can also be bare
- Health check: bare servers get SSH reachability check instead of Coolify health — return `{ sshReachable: true/false, mode: 'bare' }`, no Coolify URL
- Backup: bare servers route to `createBareBackup` (system config backup from Phase 2 core/) instead of `createBackup` (Coolify DB dump)
- Restore: bare servers route to bare restore path in core/
- Status: bare servers skip Coolify health in status results, show cloud status + mode field

### Error consistency
- Standard error response shape enforced across ALL tools: `{ error: string, hint?: string, suggested_actions?: Array<{ command: string, reason: string }> }`
- Standard success response shape: `{ success: true, message: string, [domain-specific data], suggested_actions: [...] }`
- Use `mapProviderError`/`mapSshError` from errorMapper in MCP tool catch blocks for user-friendly messages
- Fix `restore.ts:48` bug: replace `process.env.SAFE_MODE === "true"` with `isSafeMode()` from core/manage.ts (uses canonical `QUICKLIFY_SAFE_MODE`)

### Duplicate code cleanup
- Create `src/mcp/utils.ts` with shared MCP utilities:
  - `resolveServerForMcp(params, servers)` — unified server lookup (replaces 4+ duplicate helpers)
  - `requireServer(params)` — guard that returns server or standard MCP error response
  - `requireProviderToken(server)` — token check with standard MCP error on missing
  - `mcpSuccess(data)` — wraps data in `{ content: [{ type: 'text', text: JSON.stringify(data) }] }` format
  - `mcpError(error, hint?, actions?)` — wraps error in standard MCP error response with `isError: true`
- All 7 tool handlers refactored to use these shared utilities

### Tool descriptions
- Mode-aware descriptions: mention both Coolify and bare mode where relevant (e.g., "Coolify or bare server")
- Provision description: "Provision a server on a cloud provider. Default: Coolify auto-install. Pass mode:'bare' for generic VPS without Coolify."
- Annotations (readOnlyHint, destructiveHint, etc.) remain unchanged — they describe tool behavior, not mode
- Version in server.ts: read from package.json at runtime instead of hardcoded '1.1.0'

### Claude's Discretion
- Exact implementation of `src/mcp/utils.ts` function signatures and internals
- Whether to merge `resolveServerForMcp` and `requireServer` into a single function or keep separate
- Error mapper integration depth — which specific errors to map vs use generic getErrorMessage
- Ordering and grouping of refactoring work across plans

</decisions>

<specifics>
## Specific Ideas

- The 3 broken MCP flows (provision without mode, health without bare guard, backup without bare branch) are the critical fixes identified in milestone audit
- SAFE_MODE bug in restore.ts is a P0 fix — security guard using wrong env variable name
- MCP tools already import from core/ extensively — this phase is cleanup + bare mode plumbing, not a rewrite

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `core/manage.ts:isSafeMode()` — canonical SAFE_MODE check, already used by most MCP tools
- `core/provision.ts:provisionServer()` — already called by MCP provision, needs mode parameter passthrough
- `core/backup.ts:createBackup()` and `createBareBackup()` — Coolify vs bare backup, both in core/
- `core/status.ts:checkCoolifyHealth()` and `checkServerStatus()` — need bare server guard
- `utils/errorMapper.ts:mapProviderError/mapSshError/getErrorMessage` — error mapping utilities
- `utils/config.ts:getServers/findServer` — server registry access

### Established Patterns
- MCP tools follow schema + handler pattern: `export const schema = {...}; export async function handle...(params)`
- Response format: `{ content: [{ type: 'text', text: JSON.stringify(data) }], isError?: boolean }`
- Server resolution: check params.server → findServer() → fallback to single server
- Token resolution: getProviderToken(provider) → error if missing
- SAFE_MODE guard at top of destructive operations

### Integration Points
- `src/mcp/server.ts` — tool registration (descriptions, schemas, annotations)
- `src/mcp/tools/*.ts` — 7 tool handlers that need refactoring
- `src/types/index.ts` — ServerRecord type (already has `mode` field from Phase 2)
- `src/core/backup.ts` — bare backup functions added in Phase 2
- `src/commands/restore.ts:48` — SAFE_MODE bug fix location

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-mcp-refactor*
*Context gathered: 2026-02-28*
