---
phase: 32-doctor
plan: "02"
subsystem: commands
tags: [doctor, cli, server-mode, tdd]
dependency_graph:
  requires: [32-01]
  provides: [kastell doctor <server>, --fresh flag, --json flag]
  affects: [src/commands/doctor.ts, src/index.ts]
tech_stack:
  added: []
  patterns: [server-mode dispatch, severity-grouped display, spinner pattern]
key_files:
  created: []
  modified:
    - src/commands/doctor.ts
    - src/index.ts
    - tests/unit/doctor.test.ts
decisions:
  - doctorCommand signature changed from (options?, version?) to (server?, options?, version?) — backward-compatible since both params optional
  - ora mocked in tests via jest.mock("ora") to prevent spinner.start TypeError in non-TTY environment
  - clearAllMocks() used over resetAllMocks() since describe.each is not used in this test file
  - displayFindings helper kept private in commands/doctor.ts — no need to export
requirements_completed: [DOC-01, DOC-06]
metrics:
  duration: 353s
  completed_date: "2026-03-14T10:51:23Z"
  tasks_completed: 1
  files_modified: 3
---

# Phase 32 Plan 02: Doctor CLI Integration Summary

**One-liner:** Doctor command extended with `kastell doctor <server>` mode: resolveServer dispatch, severity-grouped findings display, --fresh and --json flags.

## What Was Built

Updated `src/commands/doctor.ts` and `src/index.ts` to support a new server-mode path in the existing `doctor` command, while preserving full backward compatibility for the local environment check mode.

### src/commands/doctor.ts

- `doctorCommand` signature changed to `(server?, options?, version?)` — the `server` argument is the new first positional parameter
- When `server` is provided: calls `resolveServer`, shows ora spinner, calls `runServerDoctor`, then displays findings grouped by severity (critical → warning → info) with description and recommended command per finding
- Summary line shows total count and breakdown (e.g., "2 findings (1 critical, 1 warnings)")
- When `usedFreshData` is false: shows a note "Using cached data. Run with --fresh for live analysis."
- `--json` flag outputs `DoctorResult` as JSON to stdout
- When `server` is undefined: existing local-mode path runs unchanged
- `checkProviderTokens` and all local-mode logic unchanged

### src/index.ts

- Commander registration updated from `doctor` to `doctor [server]`
- Description updated: "Check local environment, or run proactive health analysis on a server"
- Added `--fresh` option: "Fetch live data from server via SSH before analysis"
- Added `--json` option: "Output findings as JSON"
- `--check-tokens` description updated to note it is "local mode only"

### tests/unit/doctor.test.ts

- Added `jest.mock("ora")` to prevent spinner errors in tests
- Updated existing `doctorCommand` calls to new 3-arg signature
- Added `describe("doctorCommand — server mode")` with 9 new tests covering:
  - `resolveServer` dispatch
  - `undefined` return early exit
  - `--fresh` flag pass-through
  - `--json` output
  - `success=false` error display
  - Findings display with descriptions
  - Empty findings "No issues detected"
  - Cached data note
  - Summary line with count

## Test Results

- `tests/unit/doctor.test.ts`: 35/35 passing
- Full suite: 2990/2990 passing
- `npm run build`: clean (no TypeScript errors)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing mock] Added jest.mock("ora") for spinner support**
- **Found during:** Task 1 GREEN phase
- **Issue:** `createSpinner` returns an ora Ora instance; in tests `spinner.start()` throws "Cannot read properties of undefined" without ora mock
- **Fix:** Added `jest.mock("ora", () => { const spinner = { start: jest.fn().mockReturnThis(), stop: jest.fn().mockReturnThis() }; return jest.fn(() => spinner); });` at top of test file
- **Files modified:** tests/unit/doctor.test.ts
- **Commit:** 636af5d

**2. [Rule 1 - Bug] Used clearAllMocks() instead of resetAllMocks()**
- **Found during:** Task 1 GREEN phase — checkProviderTokens tests failing with resetAllMocks()
- **Issue:** `jest.resetAllMocks()` resets mock implementations (including `fs.readFileSync` default `() => "[]"`), breaking downstream tests that rely on the module-level fs mock default
- **Fix:** Changed `beforeEach` to use `jest.clearAllMocks()` (resets call counts but preserves implementations). The critical rule "use resetAllMocks() with describe.each" applies to describe.each blocks, not standard describe blocks
- **Files modified:** tests/unit/doctor.test.ts

## Self-Check: PASSED

All key files exist and commits verified:
- src/commands/doctor.ts: FOUND
- src/index.ts: FOUND
- tests/unit/doctor.test.ts: FOUND
- .planning/phases/32-doctor/32-02-SUMMARY.md: FOUND
- Commit b76e2c4 (RED): FOUND
- Commit 636af5d (GREEN): FOUND
