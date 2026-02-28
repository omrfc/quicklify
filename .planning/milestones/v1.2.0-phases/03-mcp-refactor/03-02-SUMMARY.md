---
phase: 03-mcp-refactor
plan: "02"
subsystem: mcp
tags: [mcp, bare-mode, tdd, refactor, serverInfo, serverProvision, serverManage]
dependency_graph:
  requires: [mcp-utils-module]
  provides: [mcp-bare-mode-provision, mcp-bare-mode-manage, mcp-bare-mode-info]
  affects:
    - src/mcp/tools/serverProvision.ts
    - src/mcp/tools/serverManage.ts
    - src/mcp/tools/serverInfo.ts
tech_stack:
  added: []
  patterns: [tdd-red-green, shared-mcp-utils, mode-routing, ssh-health-check]
key_files:
  created: []
  modified:
    - src/mcp/tools/serverProvision.ts
    - src/mcp/tools/serverManage.ts
    - src/mcp/tools/serverInfo.ts
    - tests/unit/mcp-server-provision.test.ts
    - tests/unit/mcp-server-manage.test.ts
    - tests/unit/mcp-server-info.test.ts
decisions:
  - "serverInfo health routes bare servers to SSH reachability (sshExec echo ok) rather than checkCoolifyHealth"
  - "health summary adds bare count separate from running/notReachable — bare servers are not reachability failures"
  - "formatServerList and formatStatusResult return Record<string,unknown> objects instead of JSON strings for mcpSuccess compatibility"
  - "remove action non-standard error fields (available_servers) kept as inline JSON — mcpError signature does not support arbitrary keys"
  - "Task 1 (serverProvision/serverManage) was already committed as part of feat(03-03) which ran concurrently; this plan records the serverInfo work"
metrics:
  duration: 10m48s
  completed_date: "2026-02-28"
  tasks_completed: 2
  files_modified: 6
---

# Phase 3 Plan 2: Bare Mode for serverProvision, serverManage, and serverInfo Summary

**One-liner:** Bare mode parameter support in serverProvision/serverManage MCP tools and SSH-based health routing in serverInfo, using shared mcpSuccess/mcpError utilities throughout.

## What Was Built

### Task 1: serverProvision and serverManage Bare Mode Support

**serverProvision.ts:**
- Added `mode: z.enum(["coolify","bare"]).default("coolify")` to schema
- Handler passes `mode` to `provisionServer()` core call
- Success response: bare mode shows SSH connect hint (`ssh root@IP`) instead of Coolify health check
- Success response: `mode` field included in server object
- Full switch from inline JSON to `mcpSuccess`/`mcpError` from `../utils.js`
- SAFE_MODE error now uses `mcpError()` instead of inline JSON

**serverManage.ts:**
- Added `mode: z.enum(["coolify","bare"]).default("coolify")` to schema
- `add` action passes `mode` to `addServerRecord()`
- `add` success: bare mode omits health check suggested action; `mode` field in server object
- `remove`/`destroy` actions: switch to `mcpSuccess`/`mcpError` where possible
- `destroy` SAFE_MODE error uses `mcpError()` for consistency
- Non-standard error fields (e.g. `available_servers`) remain as inline JSON (mcpError does not accept arbitrary keys)

Note: Task 1 was already committed as part of `feat(03-03)` which was run before this plan. The TDD tests were written, passed, and are included in this plan's test files.

### Task 2: serverInfo Bare Mode Awareness

**serverInfo.ts:**
- Import `isBareServer` from `../../utils/modeGuard.js`
- Import `sshExec` from `../../utils/ssh.js`
- Import `mcpSuccess`, `mcpError` from `../utils.js`

**list action:**
- `formatServerList` includes `mode: s.mode ?? 'coolify'` in each server object
- Returns `Record<string,unknown>` (wrapped in `mcpSuccess`)

**status action:**
- `formatStatusResult` includes `mode: result.server.mode ?? 'coolify'` in each result
- Core's `checkServerStatus` already returns `coolifyStatus: 'n/a'` for bare servers
- `mcpSuccess` wrapper for all success responses

**health action — single server:**
- `isBareServer(server)` check before health routing
- Bare: `sshExec(server.ip, "echo ok")` wrapped in try/catch → returns `{ server, ip, mode: 'bare', sshReachable: bool, suggested_actions }`
- Coolify: existing `checkCoolifyHealth` flow unchanged
- No `coolifyUrl`/`coolifyStatus` fields for bare servers

**health action — all servers:**
- `Promise.all` map branches on `isBareServer`: SSH check vs Coolify health check
- Each result includes `mode` field
- Summary: `{ total, running, notReachable, bare }` — bare count is separate category
- `suggestedActions` based on unreachable Coolify servers only (bare SSH failures not auto-action worthy)

## Tests

| File | New Tests | Total Tests | Result |
|------|-----------|-------------|--------|
| tests/unit/mcp-server-provision.test.ts | 4 | ~52 | PASS |
| tests/unit/mcp-server-manage.test.ts | 2 | ~44 | PASS |
| tests/unit/mcp-server-info.test.ts | 6 | 25 | PASS |
| **Full suite** | 29 new | 1921 | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] remove action "missing server" response preserved inline JSON**
- **Found during:** Task 1 GREEN phase
- **Issue:** Existing test asserts `data.available_servers.toHaveLength(1)` on remove-missing-server error. `mcpError()` does not support arbitrary extra fields.
- **Fix:** Kept inline JSON for the `remove` missing-server error path; used `mcpError()` everywhere else in the handler
- **Files modified:** `src/mcp/tools/serverManage.ts`

**2. [Rule 3 - Blocking] Task 1 already committed in feat(03-03)**
- **Found during:** Task 1 commit attempt
- **Issue:** The `feat(03-03)` commit had already modified `serverProvision.ts` and `serverManage.ts` with the bare mode changes needed for Task 1, plus added tests to `mcp-server-provision.test.ts` and `mcp-server-manage.test.ts`. Nothing to re-commit.
- **Fix:** Recognized duplication, skipped Task 1 re-implementation, proceeded to Task 2 which was genuinely missing
- **Files modified:** None (already done)

## Self-Check

### Files Exist
- [x] `src/mcp/tools/serverInfo.ts` — modified with bare mode routing
- [x] `src/mcp/tools/serverProvision.ts` — mode param added (in feat(03-03))
- [x] `src/mcp/tools/serverManage.ts` — mode param added (in feat(03-03))
- [x] `tests/unit/mcp-server-info.test.ts` — 6 new bare mode tests

### Commits Exist
- [x] 008e275 — `feat(03-03): add bare mode routing to serverBackup and serverMaintain tools` (also contains Task 1 changes)
- [x] 5a78155 — `feat(03-02): add bare mode awareness to serverInfo MCP tool`

### Verification Commands Passed
- [x] `npm run build` — TypeScript compiles without errors
- [x] `npx jest tests/unit/mcp-server-provision.test.ts tests/unit/mcp-server-manage.test.ts tests/unit/mcp-server-info.test.ts --no-coverage` — 121 tests pass
- [x] `npm test` — 1921 tests pass, 0 failures

## Self-Check: PASSED
