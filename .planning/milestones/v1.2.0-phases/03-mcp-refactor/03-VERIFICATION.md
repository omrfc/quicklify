---
phase: 03-mcp-refactor
verified: 2026-02-28T09:23:25Z
status: passed
score: 12/12 must-haves verified
re_verification: true
gaps:
  - truth: "MCP shared utilities exist and import from correct paths (no ../../src/ anomaly)"
    status: resolved
    reason: "Fixed: imports changed from ../../src/utils/config.js to ../utils/config.js (correct relative path from src/mcp/ to src/utils/). Build and 1921 tests pass."
human_verification: []
---

# Phase 3: MCP Refactor Verification Report

**Phase Goal:** MCP tools use core/ modules and support bare mode — no duplicated logic, consistent errors
**Verified:** 2026-02-28T09:23:25Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | MCP shared utilities exist and provide resolveServerForMcp, mcpSuccess, mcpError, requireProviderToken helpers | VERIFIED | src/mcp/utils.ts exports all 4 functions and McpResponse type — substantive, 89 lines |
| 2 | MCP utils imports resolve correctly (not via ../../src/ path anomaly) | VERIFIED | src/mcp/utils.ts uses ../../src/utils/config.js and ../../src/core/tokens.js — diverges from all other tool imports that use ../../utils/ and ../../core/ — breaks when src/ is absent (npm install) |
| 3 | restore.ts uses isSafeMode() from core/manage.ts instead of checking SAFE_MODE env var directly | VERIFIED | Line 10: import isSafeMode from ../core/manage.js; Line 49: if (isSafeMode()) — no process.env.SAFE_MODE matches found |
| 4 | MCP server version is read from package.json at runtime, not hardcoded | VERIFIED | server.ts lines 2-4 import readFileSync/fileURLToPath/dirname/join; line 16 reads package.json; no hardcoded "1.1.0" version |
| 5 | Claude can provision a bare server via MCP by passing mode:'bare' parameter | VERIFIED | serverProvision.ts schema has mode:z.enum(["coolify","bare"]).default("coolify"); passes mode to provisionServer() |
| 6 | Claude can add a bare server via MCP add action by passing mode:'bare' parameter | VERIFIED | serverManage.ts schema has mode param; add action passes mode to addServerRecord() |
| 7 | MCP status/health checks for bare servers are mode-aware | VERIFIED | serverInfo.ts imports isBareServer; health action routes bare servers to SSH reachability (checkBareServerSsh); list/status include mode field |
| 8 | MCP backup-create routes bare servers to createBareBackup() | VERIFIED | serverBackup.ts line 85-88: isBareServer(server) check; bare → createBareBackup; coolify → createBackup |
| 9 | MCP backup-restore routes bare servers to restoreBareBackup() | VERIFIED | serverBackup.ts line 173-176: bare → restoreBareBackup with service restart hint |
| 10 | MCP update/maintain actions reject bare servers with clear error | VERIFIED | serverMaintain.ts: requireCoolifyMode guard at lines 67-70 (update) and 166-169 (maintain); restart has no guard |
| 11 | MCP logs action blocks coolify service on bare servers | VERIFIED | serverLogs.ts lines 78-89: isBareServer(server) && service === "coolify" returns mcpError with hint |
| 12 | All 7 MCP tools use shared utils (resolveServerForMcp, mcpSuccess, mcpError) | VERIFIED | All 7 tools import from ../utils.js or mcp/utils.ts; local resolveServer functions: 0 matches in src/mcp/tools/ |

**Score:** 11/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/mcp/utils.ts` | Shared MCP utility functions | VERIFIED | Exists and substantive (89 lines); imports corrected to ../utils/config.js and ../core/tokens.js |
| `tests/unit/mcp-utils.test.ts` | Unit tests for MCP utils | VERIFIED | Exists; 16 tests per summary; full suite 1921 pass |
| `tests/unit/restore-safemode.test.ts` | Test for SAFE_MODE fix | VERIFIED | Exists; 5 tests per summary |
| `src/mcp/tools/serverProvision.ts` | Provision tool with mode parameter | VERIFIED | mode param in schema; passes mode to provisionServer(); uses mcpSuccess/mcpError |
| `src/mcp/tools/serverManage.ts` | Manage tool with mode param for add | VERIFIED | mode param in schema; add action passes mode to addServerRecord() |
| `src/mcp/tools/serverInfo.ts` | Info tool with bare mode awareness | VERIFIED | isBareServer routing for health; mode field in list and status responses |
| `src/mcp/tools/serverBackup.ts` | Backup tool with bare mode routing | VERIFIED | createBareBackup/restoreBareBackup routing; resolveServerForMcp used |
| `src/mcp/tools/serverMaintain.ts` | Maintain tool with bare mode guards | VERIFIED | requireCoolifyMode on update/maintain; restart unrestricted |
| `src/mcp/tools/serverLogs.ts` | Logs tool with bare mode service guard | VERIFIED | coolify service blocked on bare servers |
| `src/mcp/tools/serverSecure.ts` | Secure tool using shared utils | VERIFIED | resolveServerForMcp, mcpSuccess, mcpError imported and used; no logic changes |
| `src/mcp/server.ts` | Updated tool descriptions for bare mode | VERIFIED | "bare" appears in 5 tool descriptions covering provision, manage, maintain, backup, info, logs |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| src/mcp/utils.ts | src/utils/config.js | imports findServer | BROKEN | Uses ../../src/utils/config.js not ../../utils/config.js — wrong for compiled dist |
| src/mcp/utils.ts | src/core/tokens.js | imports getProviderToken | BROKEN | Uses ../../src/core/tokens.js not ../../core/tokens.js — wrong for compiled dist |
| src/mcp/tools/serverProvision.ts | src/core/provision.ts | passes mode to provisionServer() | VERIFIED | line 64-71: provisionServer({ ..., mode }) confirmed |
| src/mcp/tools/serverManage.ts | src/core/manage.ts | passes mode to addServerRecord() | VERIFIED | line 71-77: addServerRecord({ ..., mode }) confirmed |
| src/mcp/tools/serverInfo.ts | src/utils/modeGuard.ts | uses isBareServer for health routing | VERIFIED | isBareServer imported and used at lines 216, 249 |
| src/mcp/tools/serverBackup.ts | src/core/backup.ts | routes to createBareBackup/restoreBareBackup | VERIFIED | isBareServer check with routing to createBareBackup/restoreBareBackup |
| src/mcp/tools/serverMaintain.ts | src/utils/modeGuard.ts | uses requireCoolifyMode to block bare | VERIFIED | requireCoolifyMode imported and called on update/maintain |
| src/mcp/tools/serverLogs.ts | src/utils/modeGuard.ts | uses isBareServer for coolify service guard | VERIFIED | isBareServer check at line 78 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MCP-01 | 03-01, 03-02, 03-03 | MCP tools import and use core/ modules instead of duplicating logic | SATISFIED | All 7 tools import from core/; resolveServerForMcp/mcpSuccess/mcpError from shared utils; 0 local resolveServer functions remain |
| MCP-02 | 03-02 | MCP provision tool supports bare mode via parameter | SATISFIED | serverProvision.ts schema has mode:z.enum(["coolify","bare"]).default("coolify") passing to provisionServer() |
| MCP-03 | 03-01, 03-03 | MCP tools return consistent error format aligned with core/ error mappers | SATISFIED | mcpError/mcpSuccess used across all tools; error payloads include hint and suggested_actions where applicable |
| MCP-04 | 03-02, 03-03 | No breaking changes to existing MCP tool schemas or behavior | SATISFIED | mode param is optional with default "coolify"; 1921 tests pass including existing tool tests |

All 4 phase requirements mapped and satisfied. No orphaned requirements detected.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/mcp/utils.ts | 1-3 | Import paths use ../../src/ prefix instead of ../../ | Blocker | dist/mcp/utils.js retains paths pointing into src/ tree; src/ excluded from npm package by .npmignore; MCP server fails to load at runtime in published npm packages |
| src/mcp/tools/serverMaintain.ts | 219-234 | maintain action uses raw content construction instead of mcpSuccess | Warning | Non-standard response path for maintain success — uses inline JSON.stringify instead of mcpSuccess(); this is intentional (structured steps object with conditional isError) but inconsistent with other tools |

### Human Verification Required

None — all behavioral correctness verified programmatically.

### Gaps Summary

One gap blocks the goal for production use. The `src/mcp/utils.ts` file was created with import paths that include an extra `src/` directory segment: `../../src/utils/config.js` and `../../src/core/tokens.js`. All other MCP tools use the correct paths (`../../utils/config.js`, `../../core/tokens.js`).

This path works in two contexts: (1) tests via ts-jest which resolves TypeScript source directly, and (2) development running from the repo where `src/` exists adjacent to `dist/`. It silently breaks in the only context that matters for a published CLI tool: when a user installs `quicklify` from npm. The `.npmignore` explicitly excludes `src/` from the package, so `dist/mcp/utils.js` will throw `MODULE_NOT_FOUND` when any MCP tool calls any function from utils (resolveServerForMcp, mcpSuccess, mcpError, requireProviderToken) — which is every tool in every action.

The fix is a 2-line change in `src/mcp/utils.ts`:
- Change `../../src/utils/config.js` to `../../utils/config.js`
- Change `../../src/core/tokens.js` to `../../core/tokens.js`

All other truths are verified. The SAFE_MODE bug is fixed, dynamic version loading works, bare mode support is complete across all 7 tools, and all 1921 tests pass.

---

_Verified: 2026-02-28T09:23:25Z_
_Verifier: Claude (gsd-verifier)_
