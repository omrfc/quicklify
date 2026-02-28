---
phase: quick
plan: 1
subsystem: cli-commands, mcp-tools
tags: [bare-mode, mcp, error-handling, domain, refactor]
dependency_graph:
  requires: [src/utils/modeGuard.ts, src/mcp/utils.ts]
  provides: [domain bare-mode guard, consistent MCP error shape]
  affects: [src/commands/domain.ts, src/mcp/tools/serverSecure.ts, src/mcp/tools/serverBackup.ts, src/mcp/tools/serverMaintain.ts, src/mcp/tools/serverLogs.ts]
tech_stack:
  added: []
  patterns: [requireCoolifyMode guard, mcpError() shared helper, requireProviderToken shared helper]
key_files:
  created: []
  modified:
    - src/commands/domain.ts
    - src/mcp/tools/serverSecure.ts
    - src/mcp/tools/serverBackup.ts
    - src/mcp/tools/serverMaintain.ts
    - src/mcp/tools/serverLogs.ts
    - tests/unit/domain.test.ts
    - tests/unit/mcp-server-backup.test.ts
    - tests/unit/mcp-server-maintain.test.ts
    - tests/unit/mcp-server-logs.test.ts
    - tests/unit/mcp-server-secure.test.ts
decisions:
  - "BARE-06 test updated: domain now blocks bare servers (guard added), so the regression test inverts expectation — sshExec must NOT be called"
  - "available_servers JSON field removed from server-not-found/multiple-servers error responses; server names moved into mcpError hint string per Phase 03 decision"
  - "serverBackup.ts local requireToken function removed; shared requireProviderToken from mcp/utils.ts used instead — error message phrasing kept identical"
metrics:
  duration: 328s
  completed_date: "2026-02-28"
  tasks_completed: 2
  files_modified: 10
requirements: [AUDIT-TD-01, AUDIT-TD-02]
---

# Quick Task 1: Domain Commands isBareServer Guard + MCP Error Consistency Summary

**One-liner:** Domain CLI/MCP commands now reject bare servers via requireCoolifyMode; all 4 MCP tools use shared mcpError() for server-not-found and multiple-servers error paths; serverBackup.ts eliminates local requireToken duplicate in favor of shared requireProviderToken.

## Objective

Fix two v1.2.0 milestone audit tech debt items:
1. Add bare-mode guard to domain commands (CLI + MCP) — domain operations exec into Coolify DB container which does not exist on bare servers
2. Replace raw `{ content: [...], isError: true }` constructions with shared `mcpError()` helper across 4 MCP tools for consistent error shape

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add requireCoolifyMode guard to CLI domain command and MCP domain actions | c1237b3 | src/commands/domain.ts, src/mcp/tools/serverSecure.ts |
| 2 | Replace raw MCP error constructions with mcpError() and wire requireProviderToken | c9c635c | src/mcp/tools/serverBackup.ts, serverMaintain.ts, serverSecure.ts, serverLogs.ts + 5 test files |

## Changes Detail

### Task 1: Bare-Mode Guard

**src/commands/domain.ts:**
- Added `import { requireCoolifyMode } from "../utils/modeGuard.js"`
- Added guard after `resolveServer()`, before switch: `const modeError = requireCoolifyMode(server, "domain"); if (modeError) { logger.error(modeError); return; }`
- Follows identical pattern as `update.ts` and `maintain.ts`

**src/mcp/tools/serverSecure.ts:**
- Added `import { requireCoolifyMode } from "../../utils/modeGuard.js"`
- Added pre-switch guard block for all 4 domain actions (`domain-set`, `domain-remove`, `domain-check`, `domain-info`):
  ```typescript
  const domainActions = ["domain-set", "domain-remove", "domain-check", "domain-info"];
  if (domainActions.includes(params.action)) {
    const modeError = requireCoolifyMode(server, params.action);
    if (modeError) {
      return mcpError(modeError, "Domain management requires Coolify. Use SSH for bare server DNS configuration.");
    }
  }
  ```

### Task 2: mcpError() Consistency + requireProviderToken

**All 4 MCP tools (serverBackup, serverMaintain, serverSecure, serverLogs):**
- Replaced raw `{ content: [{ type: "text", text: JSON.stringify({ error: ..., available_servers: ... }) }], isError: true }` blocks with `mcpError()` calls
- Server names moved from `available_servers` JSON field to `hint` string parameter

**serverBackup.ts (additional):**
- Removed `import { getProviderToken } from "../../core/tokens.js"` (no longer needed)
- Added `requireProviderToken` to import from `"../utils.js"`
- Replaced all 3 `requireToken(server.provider)` calls with `requireProviderToken(server.provider)`
- Removed local `requireToken` function (15 lines eliminated)

**serverMaintain.ts (additional):**
- Replaced raw `isManual` server error in `restart` case with `mcpError("Cannot reboot manually added server via API", "Use SSH: ...")`
- Replaced raw token-missing error in `restart` case with `mcpError(...)`
- Replaced raw token-missing error in `maintain` case (with `suggested_actions`) with `mcpError(...)`

## Test Updates

Tests asserting on the old `available_servers` JSON field were updated to check `hint` string instead:

| Test File | Old assertion | New assertion |
|-----------|---------------|---------------|
| mcp-server-backup.test.ts | `data.available_servers.toHaveLength(2)` | `data.hint.toContain("Available:")` |
| mcp-server-maintain.test.ts | `data.available_servers.toHaveLength(2)` | `data.hint.toContain("Available:")` |
| mcp-server-logs.test.ts | `data.available_servers.toHaveLength(2)` / `.toContain("coolify-test")` | `data.hint.toContain("Available:")` / `.toContain("coolify-test")` |
| mcp-server-secure.test.ts | `data.available_servers.toContain("coolify-test")` | `data.hint.toContain("coolify-test")` |

**domain.test.ts BARE-06 regression:** Test expectation inverted — domain now blocks bare servers, so `sshExec` must NOT be called and error output must contain "domain".

## Verification

```
# 1. No raw isError constructions in server-not-found/multiple-servers paths — PASSED
# 2. requireCoolifyMode in domain.ts — FOUND at lines 6, 51
# 3. requireCoolifyMode in serverSecure.ts — FOUND at lines 26, 88
# 4. No local requireToken in serverBackup.ts — PASSED (empty result)
# 5. requireProviderToken in serverBackup.ts — FOUND at lines 23, 232, 272, 327
# 6. npm run build — PASSED (0 errors)
# 7. npm test — PASSED (1921/1921 tests, 74 suites)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test suite failures after mcpError() migration**
- **Found during:** Task 2 verification
- **Issue:** 6 tests across 5 files were checking for the old `available_servers` JSON field which no longer exists in `mcpError()` output; BARE-06 regression test expected bare domain to work (before guard was added)
- **Fix:** Updated test assertions to check `hint` string (which contains available server names); updated BARE-06 test to expect guard behavior (no sshExec call)
- **Files modified:** tests/unit/domain.test.ts, mcp-server-backup.test.ts, mcp-server-maintain.test.ts, mcp-server-logs.test.ts, mcp-server-secure.test.ts
- **Commit:** c9c635c (included with Task 2 commit)

## Self-Check: PASSED

- src/commands/domain.ts: FOUND
- src/mcp/tools/serverSecure.ts: FOUND
- src/mcp/tools/serverBackup.ts: FOUND
- src/mcp/tools/serverMaintain.ts: FOUND
- src/mcp/tools/serverLogs.ts: FOUND
- Commit c1237b3: FOUND
- Commit c9c635c: FOUND
- All 1921 tests pass
- Build succeeds (tsc --noEmit clean)
