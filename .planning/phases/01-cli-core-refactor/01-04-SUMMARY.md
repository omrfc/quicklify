---
phase: 01-cli-core-refactor
plan: "04"
subsystem: commands/backup,restore,maintain,update,snapshot,monitor
tags:
  - refactor
  - core-delegation
  - backup
  - restore
  - maintain
  - update
  - snapshot
  - monitor
dependency_graph:
  requires:
    - "01-01"
    - "01-02"
  provides:
    - "backup.ts imports pure functions from core/backup.ts"
    - "restore.ts imports restore functions from core/backup.ts"
    - "maintain.ts delegates update/health-poll to core/maintain.ts"
    - "update.ts delegates Coolify update to core/maintain.ts"
    - "snapshot.ts delegates all snapshot operations to core/snapshot.ts"
  affects:
    - src/commands/backup.ts
    - src/commands/restore.ts
    - src/commands/maintain.ts
    - src/commands/update.ts
    - src/commands/snapshot.ts
    - src/commands/monitor.ts
tech_stack:
  added: []
  patterns:
    - "re-export pattern for backward test compatibility"
    - "core delegation with CLI-level orchestration preserved"
key_files:
  created: []
  modified:
    - src/commands/backup.ts
    - src/commands/restore.ts
    - src/commands/maintain.ts
    - src/commands/update.ts
    - src/commands/snapshot.ts
decisions:
  - "backup.ts: static import + re-export from core/backup.ts to maintain test mock compatibility with spawn"
  - "restore.ts: imports listBackups/getBackupDir from commands/backup.ts (not core) to preserve test mock on commands/backup"
  - "maintain.ts: keeps createProviderWithToken for CLI-specific steps (snapshot step 0, status check, reboot, final check); delegates executeCoolifyUpdate and pollCoolifyHealth to core"
  - "maintain.ts: does NOT call core/maintain.ts::maintainServer() because command has different MaintainResult interface and richer 5-step flow with interactive snapshot prompt"
  - "update.ts: delegates sshExec(COOLIFY_UPDATE_CMD) to executeCoolifyUpdate() from core/maintain.ts"
  - "snapshot.ts: fully delegates createSnapshot/listSnapshots/deleteSnapshot to core/snapshot.ts"
  - "monitor.ts: verified already thin (imports parseMetrics from core/logs.ts) — no changes needed"
metrics:
  duration: "10m3s"
  completed_date: "2026-02-28"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 5
---

# Phase 1 Plan 04: Backup/Restore/Maintain/Update/Snapshot/Monitor Command Refactoring Summary

**One-liner:** Delegated backup pure functions, restore logic, Coolify update execution, health polling, and snapshot CRUD operations from command files to core/ modules via import/re-export pattern.

## What Was Done

Refactored 5 command files to eliminate duplicated business logic by delegating to their corresponding core/ modules. One command (monitor.ts) was verified already thin.

### Task 1: backup.ts and restore.ts

**backup.ts changes:**
- Removed 6 duplicated pure function definitions: `formatTimestamp`, `getBackupDir`, `buildPgDumpCommand`, `buildConfigTarCommand`, `buildCleanupCommand`, `buildCoolifyVersionCommand`
- Removed `listBackups` and `scpDownload` definitions
- Added static import from `../core/backup.js` and re-exports all 8 functions
- The `backupCommand` function now uses the imported functions instead of local definitions
- Backward compatibility preserved: tests importing pure functions from `commands/backup` still work

**restore.ts changes:**
- Removed 7 duplicated function definitions: `buildStopCoolifyCommand`, `buildStartCoolifyCommand`, `buildStartDbCommand`, `buildRestoreDbCommand`, `buildRestoreConfigCommand`, `buildCleanupCommand`, `scpUpload`
- Removed `loadManifest` and `tryRestartCoolify` definitions
- Added import from `../core/backup.js` and re-exports all functions
- Still imports `listBackups`/`getBackupDir` from `./backup.js` (not core directly) to preserve Jest mock compatibility in restore.test.ts

### Task 2: maintain.ts, update.ts, snapshot.ts, monitor.ts

**maintain.ts changes:**
- Removed inline `checkCoolifyHealth` (axios-based boolean return) and `pollCoolifyHealth` functions
- Imported `pollCoolifyHealth` from `core/maintain.ts` (returns boolean, calls core/status.ts internally)
- Imported `executeCoolifyUpdate` from `core/maintain.ts` (wraps sshExec + COOLIFY_UPDATE_CMD)
- Removed `sshExec` and `COOLIFY_UPDATE_CMD` imports
- `axios` import removed (was only needed for inline health check)
- Steps 4+5 (reboot + final check) kept inline with `createProviderWithToken` since command has interactive snapshot step 0 and different MaintainResult interface

**update.ts changes:**
- Removed `sshExec` and `COOLIFY_UPDATE_CMD` imports
- Replaced `await sshExec(serverIp, COOLIFY_UPDATE_CMD)` with `await executeCoolifyUpdate(serverIp)` from core/maintain.ts
- Updated result handling to use `UpdateResult` fields (success, output, error)

**snapshot.ts changes:**
- Removed direct `createProviderWithToken` usage for snapshot operations
- Imported `createSnapshot`, `listSnapshots`, `deleteSnapshot` from `core/snapshot.ts`
- All three subcommands (create, list, delete) now delegate to core functions
- `createProviderWithToken` kept only for cost estimate display (pre-create UX step)

**monitor.ts:**
- Verified already thin — only imports `parseMetrics` from `core/logs.ts` and handles CLI I/O
- No changes needed

## Deviations from Plan

### Auto-fixed Issues

None.

### Design Decisions

**1. [Deviation] maintain.ts keeps createProviderWithToken**

The plan said to remove `createProviderWithToken` from maintain.ts. However, the maintain command has:
- Step 0: Interactive snapshot creation using `provider.getSnapshotCostEstimate` and `provider.createSnapshot`
- Step 1: Server status check via `provider.getServerStatus`
- Steps 4+5: Reboot and polling via `provider.rebootServer` + `provider.getServerStatus`

These are CLI-specific flows. The `core/maintain.ts::maintainServer()` wraps the same logic but with different step reporting. Changing to use `maintainServer()` would require rewriting the command's `MaintainResult` interface and `showReport()` function, which was scoped to Plan 01-05 if needed.

**2. [Deviation] maintain.ts does not use core/maintain.ts::maintainServer()**

The plan suggested calling `maintainServer()` and mapping results. The command's 5-step flow with interactive prompts (snapshot step) and the `MaintainResult` interface are too different from core's structure. Instead, we use the two extracted primitives (`executeCoolifyUpdate`, `pollCoolifyHealth`) that provide the main value (removing sshExec and axios from command).

**3. [Deviation] restore.ts still imports from commands/backup.ts**

`restore.ts` imports `listBackups` and `getBackupDir` from `./backup.js` rather than from `core/backup.ts` directly. This is required because `restore.test.ts` mocks `../../src/commands/backup`. If restore imported from core directly, the test mock would not intercept those calls. The re-export chain (`core/backup.ts` → `commands/backup.ts` → `commands/restore.ts`) maintains correctness.

## Test Results

- All 1755 tests pass across 64 test suites
- Backup: 162 tests pass
- Restore: 162 tests pass
- Maintain: 59 tests pass
- Update: 37 tests pass
- Snapshot: 23 tests pass
- Monitor: 18 tests pass

## Self-Check: PASSED

All modified files verified on disk. Both task commits (e5345da, f67b948) confirmed in git history.
