---
phase: 03-mcp-refactor
plan: "01"
subsystem: mcp
tags: [mcp, utilities, bug-fix, tdd, shared-utils]
dependency_graph:
  requires: []
  provides: [mcp-utils-module, safe-mode-fix, dynamic-version]
  affects: [src/mcp/utils.ts, src/commands/restore.ts, src/mcp/server.ts]
tech_stack:
  added: []
  patterns: [discriminated-union-return, spread-conditional-fields]
key_files:
  created:
    - src/mcp/utils.ts
    - tests/unit/mcp-utils.test.ts
    - tests/unit/restore-safemode.test.ts
  modified:
    - src/commands/restore.ts
    - src/mcp/server.ts
    - tests/unit/restore-bare.test.ts
decisions:
  - "McpResponse type exported from utils.ts so tool handlers can use it in Plans 02 and 03"
  - "requireProviderToken returns discriminated union { token } | { error: McpResponse } for clean call-site pattern"
  - "isSafeMode() imported from core/manage.ts (canonical) — restore.ts no longer reads env var directly"
  - "server.ts uses ESM-compatible __dirname via fileURLToPath + dirname(import.meta.url)"
metrics:
  duration: 4m45s
  completed_date: "2026-02-28"
  tasks_completed: 2
  files_modified: 6
---

# Phase 3 Plan 1: Shared MCP Utilities and Bug Fixes Summary

**One-liner:** Shared MCP utility module (`resolveServerForMcp`, `mcpSuccess`, `mcpError`, `requireProviderToken`) with P0 SAFE_MODE bug fix and dynamic version loading.

## What Was Built

### Task 1: src/mcp/utils.ts — Shared MCP Utility Module

Created `src/mcp/utils.ts` with four exported helpers that Plans 02 and 03 will use to eliminate duplication across all 7 MCP tool handlers:

**`resolveServerForMcp(params, servers)`**
- If `params.server` is set, delegates to `findServer()` (by name or IP)
- Auto-selects if exactly 1 server in list
- Returns `undefined` when ambiguous (0 or 2+ servers without explicit param)

**`mcpSuccess(data)`**
- Returns `{ content: [{ type: "text", text: JSON.stringify(data) }] }`
- Standardizes all success responses across MCP tools

**`mcpError(error, hint?, suggestedActions?)`**
- Returns `{ content: [...], isError: true }`
- Conditionally spreads `hint` and `suggested_actions` (never adds undefined keys)

**`requireProviderToken(provider)`**
- Returns discriminated union: `{ token: string }` or `{ error: McpResponse }`
- Callers pattern: `const result = requireProviderToken("hetzner"); if ("error" in result) return result.error;`

**`McpResponse` type exported** for use in tool handler return types.

### Task 2: Bug Fixes

**restore.ts P0 SAFE_MODE bug (line 48):**
- BEFORE: `if (process.env.SAFE_MODE === "true")` — checked wrong env var
- AFTER: `if (isSafeMode())` — delegates to canonical `core/manage.ts` function
- Error message updated: now references `QUICKLIFY_SAFE_MODE` not `SAFE_MODE`

**server.ts hardcoded version:**
- BEFORE: `const pkg = { name: "quicklify-mcp", version: "1.1.0" }`
- AFTER: Reads `package.json` at runtime via `readFileSync` + ESM `__dirname` pattern
- Ensures MCP server always reports the correct npm package version

## Tests

| File | Tests | Result |
|------|-------|--------|
| tests/unit/mcp-utils.test.ts | 16 | PASS |
| tests/unit/restore-safemode.test.ts | 5 | PASS |
| tests/unit/restore-bare.test.ts (updated) | 6 | PASS |
| **Total suite** | 1892 | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed restore-bare.test.ts tests that tested old broken behavior**
- **Found during:** Task 2 regression check (`npm test`)
- **Issue:** 2 tests in `restore-bare.test.ts` set `process.env.SAFE_MODE = "true"` expecting it to block restore — this tested the old wrong code path
- **Fix:** Updated both tests to set `process.env.QUICKLIFY_SAFE_MODE = "true"` to align with the corrected `isSafeMode()` canonical behavior; added `afterEach` cleanup for `QUICKLIFY_SAFE_MODE`
- **Files modified:** `tests/unit/restore-bare.test.ts`
- **Commit:** f426480

## Self-Check

### Files Exist
- [x] `src/mcp/utils.ts` — created
- [x] `tests/unit/mcp-utils.test.ts` — created
- [x] `tests/unit/restore-safemode.test.ts` — created

### Commits Exist
- [x] b0d2a2a — `feat(03-01): create shared MCP utility module src/mcp/utils.ts`
- [x] f426480 — `fix(03-01): fix SAFE_MODE bug in restore.ts and dynamic version in server.ts`

### Verification Commands Passed
- [x] `npm run build` — TypeScript compiles without errors
- [x] `npx jest tests/unit/mcp-utils.test.ts tests/unit/restore-safemode.test.ts --no-coverage` — 21 tests pass
- [x] `npm test` — 1892 tests pass, 0 failures
- [x] `grep -n "process.env.SAFE_MODE" src/commands/restore.ts` — no matches
- [x] `grep -n "version.*1.1.0" src/mcp/server.ts` — no matches

## Self-Check: PASSED
