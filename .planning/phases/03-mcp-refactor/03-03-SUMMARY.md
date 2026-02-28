---
phase: 03-mcp-refactor
plan: "03"
subsystem: mcp-tools
tags: [mcp, bare-mode, refactor, tdd]
dependency_graph:
  requires: [03-01, 02-03, 02-04]
  provides: [bare-mode-mcp-backup, bare-mode-mcp-maintain, bare-mode-mcp-logs, mcp-shared-utils-complete]
  affects: [src/mcp/tools/serverBackup.ts, src/mcp/tools/serverMaintain.ts, src/mcp/tools/serverLogs.ts, src/mcp/tools/serverSecure.ts, src/mcp/server.ts]
tech_stack:
  added: []
  patterns: [shared-mcp-utils, bare-mode-routing, mode-guard, tdd-red-green-refactor]
key_files:
  created: []
  modified:
    - src/mcp/tools/serverBackup.ts
    - src/mcp/tools/serverMaintain.ts
    - src/mcp/tools/serverLogs.ts
    - src/mcp/tools/serverSecure.ts
    - src/mcp/server.ts
    - tests/unit/mcp-server-backup.test.ts
    - tests/unit/mcp-server-maintain.test.ts
    - tests/unit/mcp-server-logs.test.ts
    - tests/unit/mcp-server-secure.test.ts
decisions:
  - "serverMaintain update/maintain: bare mode blocked before SAFE_MODE check (mode guard first)"
  - "serverMaintain restart: no mode guard — cloud API reboot is mode-independent"
  - "serverLogs logs: bare + service=coolify returns error (consistent with CLI logsCommand Phase 2)"
  - "serverLogs monitor: no mode guard — system metrics are mode-independent"
  - "serverSecure: no logic changes — all secure/firewall/domain operations work on bare servers"
  - "serverBackup bare restore: adds hint about restarting services post-restore"
  - "requireToken helper: inline instead of requireProviderToken from utils (avoids import duplication in snapshot actions)"
metrics:
  duration: "7m36s"
  completed_date: "2026-02-28"
  tasks_completed: 2
  files_modified: 9
---

# Phase 3 Plan 3: MCP Backup/Maintain/Logs/Secure Bare Mode Summary

Bare mode routing and shared utility adoption for serverBackup, serverMaintain, serverLogs, and serverSecure MCP tools. Updated server.ts tool descriptions to mention bare mode capabilities. All 4 tools now use shared resolveServerForMcp/mcpSuccess/mcpError from mcp/utils.ts.

## What Was Built

### Task 1: serverBackup and serverMaintain bare mode

**serverBackup.ts:**
- `backup-create`: routes bare servers to `createBareBackup()`, Coolify servers to `createBackup()`
- `backup-restore`: routes bare servers to `restoreBareBackup()` with a service restart hint on success
- `backup-list`: mode-independent (backup directory is server-name based)
- All snapshot actions: token check uses inline `requireToken()` helper
- Replaced local `resolveServer` with `resolveServerForMcp` from `mcp/utils`
- Replaced inline JSON.stringify patterns with `mcpSuccess`/`mcpError`

**serverMaintain.ts:**
- `update` action: blocked for bare servers via `requireCoolifyMode()` (clear error + SSH hint)
- `maintain` action: blocked for bare servers via `requireCoolifyMode()` (before SAFE_MODE check)
- `restart` action: allowed for bare servers — cloud API reboot is mode-independent
- Replaced local `resolveServer` with `resolveServerForMcp` from `mcp/utils`
- Replaced inline JSON.stringify patterns with `mcpSuccess`/`mcpError`

### Task 2: serverLogs, serverSecure, and server.ts descriptions

**serverLogs.ts:**
- `logs` action: bare server + service `"coolify"` → `mcpError` with hint to use `"system"`/`"docker"`
- `logs` action: bare server + service `"system"` or `"docker"` → works normally
- `monitor` action: works for all server modes (system metrics are mode-independent)
- Replaced local `resolveServer` with `resolveServerForMcp` from `mcp/utils`

**serverSecure.ts:**
- No logic changes — all secure/firewall/domain operations work on bare servers per Phase 2 design
- Replaced local `resolveServer` with `resolveServerForMcp` from `mcp/utils`
- All inline JSON.stringify patterns replaced with `mcpSuccess`/`mcpError`

**server.ts descriptions updated:**
- `server_info`: mentions Coolify/bare status and SSH access for bare servers
- `server_manage`: mentions bare server registration and `mode:'bare'` parameter
- `server_maintain`: lists which actions are Coolify-only vs mode-independent
- `server_backup`: explains Coolify DB backup vs system config backup for bare servers
- `server_provision`: mentions `mode:'bare'` option for generic VPS
- `server_logs`: mentions coolify service restriction for bare servers

## Deviations from Plan

None — plan executed exactly as written. The `requireToken` helper was implemented inline in `serverBackup.ts` rather than importing `requireProviderToken` from `utils.ts` to keep the snapshot action token checks consistent with existing behavior. This is a cosmetic choice, not a behavior change.

## Test Results

- Task 1 tests: 114 passed (mcp-server-backup + mcp-server-maintain)
- Task 2 tests: 144 passed (mcp-server-logs + mcp-server-secure)
- Full suite: 1915 tests, 74 suites — all pass, no regressions

## Commits

- `008e275` — feat(03-03): add bare mode routing to serverBackup and serverMaintain tools
- `e451ead` — feat(03-03): add bare mode to serverLogs, refactor serverSecure, update server.ts descriptions

## Self-Check: PASSED

Verified:
- `grep -rn "function resolveServer" src/mcp/tools/` → 0 matches (all replaced)
- `grep -n "bare" src/mcp/server.ts` → 5 lines confirm bare mode in all relevant descriptions
- `npm run build` → clean TypeScript compilation
- `npm test` → 1915 passed, 0 failed
