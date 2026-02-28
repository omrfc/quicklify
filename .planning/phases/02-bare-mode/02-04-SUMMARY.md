---
phase: 02-bare-mode
plan: 04
subsystem: infra
tags: [typescript, bare-mode, backup, restore, safe-mode, cli]

# Dependency graph
requires:
  - phase: 02-01
    provides: isBareServer utility from modeGuard.ts
  - phase: 02-02
    provides: ServerRecord.mode field saved by init/add commands
provides:
  - createBareBackup(): system config tar backup with mode:'bare' manifest and coolifyVersion:'n/a'
  - restoreBareBackup(): upload+extract bare-config.tar.gz, no Coolify stop/start
  - buildBareConfigTarCommand(): tar targeting /etc/nginx, /etc/ssh, /etc/ufw, /etc/fail2ban, /etc/crontab
  - buildBareRestoreConfigCommand(): tar xzf to /
  - buildBareCleanupCommand(): rm /tmp/bare-config.tar.gz
  - Mode-aware backupCommand: routes bare -> createBareBackup, coolify -> existing inline pg_dump path
  - Mode-aware restoreCommand: SAFE_MODE guard before mode routing, bare -> restoreBareBackup with service hint
affects: [MCP backup tool]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bare backup: single tar download vs Coolify's two-file (DB + config)"
    - "SAFE_MODE guard at command level before mode routing: blocks all restore uniformly"
    - "TDD: RED (test) -> GREEN (impl) per task, each committed atomically"
    - "Separate test files (backup-bare.test.ts, restore-bare.test.ts) to cleanly mock core/backup"

key-files:
  created:
    - tests/unit/core-backup.test.ts
    - tests/unit/backup-bare.test.ts
    - tests/unit/restore-bare.test.ts
  modified:
    - src/core/backup.ts
    - src/commands/backup.ts
    - src/commands/restore.ts

key-decisions:
  - "SAFE_MODE check placed before mode routing in restoreCommand — ensures bare and coolify restore are blocked identically"
  - "Separate test files for bare command routing (backup-bare.test.ts, restore-bare.test.ts) to avoid mock conflicts with existing tests that use inline sshExec"
  - "backupSingleServer (--all path) also routes bare servers via createBareBackup with same spinner pattern"
  - "restoreBareBackup success shows explicit service restart hint: nginx, ssh, ufw, etc."

patterns-established:
  - "Core function routing: isBareServer(server) ? createBareBackup() : inline coolify path"
  - "SAFE_MODE guard position: before server resolution in restore, blocks all modes"

requirements-completed: [BARE-07]

# Metrics
duration: 9m16s
completed: 2026-02-28
---

# Phase 02 Plan 04: Bare Server Backup and Restore Summary

**Bare server backup archives /etc/ system config files (nginx, ssh, ufw, fail2ban, crontab) with a mode:'bare' manifest; restore extracts them back with a service restart hint; SAFE_MODE=true blocks both bare and coolify restore identically**

## Performance

- **Duration:** 9m16s
- **Started:** 2026-02-28T08:02:00Z
- **Completed:** 2026-02-28T08:11:16Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- Added 4 pure functions to `src/core/backup.ts`: `buildBareConfigTarCommand`, `buildBareRestoreConfigCommand`, `buildBareCleanupCommand`, plus two async functions `createBareBackup` and `restoreBareBackup`
- `createBareBackup`: creates single tar archive of /etc/ system config, downloads it, writes manifest with `mode:'bare'` and `coolifyVersion:'n/a'`
- `restoreBareBackup`: uploads bare-config.tar.gz, extracts to /, no Coolify stop/start, path traversal guard
- `backupCommand` routes bare servers via `createBareBackup` (not pg_dump path), in both single-server and `--all` modes
- `restoreCommand` adds SAFE_MODE check at top (before mode routing), then routes bare via `restoreBareBackup`, shows service restart hint on success
- 41 new tests (1830 -> 1871 total, all passing), build and lint clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Add bare backup/restore functions to core/backup.ts** - `f0be232` (feat) - 29 tests
2. **Task 2: Route backup/restore commands by server mode with SAFE_MODE enforcement** - `21649dc` (feat) - 12 tests

_Note: All tasks followed TDD pattern (RED failing test -> GREEN implementation)_

## Files Created/Modified

- `src/core/backup.ts` - Added buildBareConfigTarCommand, buildBareRestoreConfigCommand, buildBareCleanupCommand, createBareBackup, restoreBareBackup
- `src/commands/backup.ts` - Added isBareServer import + createBareBackup import; bare routing in backupSingleServer and backupCommand
- `src/commands/restore.ts` - Added isBareServer import + restoreBareBackup import; SAFE_MODE guard at top; bare routing after confirmation
- `tests/unit/core-backup.test.ts` - NEW: 29 tests for all bare core functions (pure + async)
- `tests/unit/backup-bare.test.ts` - NEW: 6 tests for bare routing in backupCommand
- `tests/unit/restore-bare.test.ts` - NEW: 6 tests for bare routing + SAFE_MODE in restoreCommand

## Decisions Made

- SAFE_MODE guard placed before mode routing in `restoreCommand` so it blocks all restore operations (bare and coolify) with identical error message — no per-mode SAFE_MODE logic needed
- Separate test files `backup-bare.test.ts` and `restore-bare.test.ts` created (not appended to existing files) to avoid mock conflicts: the existing backup/restore tests mock `../../src/utils/ssh` at low level while the new routing tests need to mock `../../src/core/backup` separately
- `backupSingleServer` (used by `--all`) also routes bare via `createBareBackup`, so the mixed bare+coolify `--all` case routes each server correctly
- Bare restore success shows explicit hint: "Restart affected services manually (nginx, ssh, ufw, etc.)" — informs user what services may need restart after config file replacement

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 02 complete: all 4 plans (02-01 through 02-04) delivered the full bare mode feature
- All 1871 tests passing, build and lint clean
- Bare mode backup/restore is the final feature of Phase 02

## Self-Check: PASSED

- src/core/backup.ts: FOUND
- src/commands/backup.ts: FOUND
- src/commands/restore.ts: FOUND
- tests/unit/core-backup.test.ts: FOUND
- tests/unit/backup-bare.test.ts: FOUND
- tests/unit/restore-bare.test.ts: FOUND
- Commit f0be232: FOUND
- Commit 21649dc: FOUND

---
*Phase: 02-bare-mode*
*Completed: 2026-02-28*
