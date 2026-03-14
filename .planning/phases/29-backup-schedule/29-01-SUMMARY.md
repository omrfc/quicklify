---
phase: 29-backup-schedule
plan: "01"
subsystem: infra
tags: [ssh, cron, flock, schedules-json, backup, idempotent]

requires:
  - phase: 28-lock
    provides: SSH heredoc + idempotent cron command builder patterns

provides:
  - scheduleBackup: deploy backup script + install cron entry via SSH, save to schedules.json
  - listBackupSchedule: read active cron entry from VPS + local schedules.json
  - removeBackupSchedule: remove cron entry from VPS + delete from schedules.json
  - buildDeployBackupScriptCommand: heredoc deploying /root/kastell-backup.sh with flock overlap protection
  - buildInstallCronCommand: marker-comment idempotent cron install (grep-v + echo pipeline)
  - buildListCronCommand / buildRemoveCronCommand: SSH crontab queries
  - getSchedules / saveSchedule / removeSchedule: schedules.json persistence layer
  - validateCronExpr: 5-field minimal cron validation

affects:
  - 29-02 (backup CLI: Plan 02 wires these functions to --schedule option)
  - 30-guard (follows schedules.json pattern for its own cron tracking)

tech-stack:
  added: []
  patterns:
    - "Marker-comment idempotent cron: grep-v '# kastell-backup' + echo | crontab - guarantees one entry"
    - "SSH heredoc script deployment: cat <<'KASTELL_EOF' > /root/script.sh pattern"
    - "flock file-descriptor form: exec 200>/tmp/lock; flock -n 200 holds lock for script lifetime"
    - "schedules.json keyed by server name: separate from servers.json, mode 0o600"
    - "Runtime bare vs Coolify detection: docker ps | grep coolify at script run time"

key-files:
  created:
    - src/core/backupSchedule.ts
    - tests/unit/backup-schedule.test.ts
  modified: []

key-decisions:
  - "schedules.json stored separately from servers.json — avoids schema mutation and migration risk"
  - "Runtime runtime detection in backup script (docker ps | grep coolify) rather than writing platform-specific scripts"
  - "validateCronExpr does minimal 5-field check only — VPS crontab binary is authoritative validator"
  - "saveSchedule uses mkdirSync with recursive:true to ensure CONFIG_DIR exists before write"

patterns-established:
  - "Command builder pure functions (no SSH) + async orchestrator functions (use sshExec)"
  - "assertValidIp called at top of every async orchestrator before any SSH"
  - "schedules.json: getSchedules() returns {} on missing/invalid; saveSchedule/removeSchedule merge-and-write"

requirements-completed: [BKUP-01, BKUP-02, BKUP-03, BKUP-04, BKUP-05]

duration: 5min
completed: 2026-03-14
---

# Phase 29 Plan 01: Backup Schedule Core Module Summary

**SSH-based cron scheduling with flock overlap protection, marker-comment idempotency, and local schedules.json persistence — all business logic for `kastell backup --schedule`**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-14T07:36:25Z
- **Completed:** 2026-03-14T07:40:51Z
- **Tasks:** 1 (TDD: test commit + implementation commit)
- **Files modified:** 2

## Accomplishments

- `buildDeployBackupScriptCommand` deploys `/root/kastell-backup.sh` via SSH heredoc with `flock -n 200` overlap protection and runtime bare/Coolify detection
- `buildInstallCronCommand` implements BKUP-04 idempotency: marker-comment grep-v + echo pipeline guarantees exactly one cron entry regardless of how many times called
- `scheduleBackup`, `listBackupSchedule`, `removeBackupSchedule` orchestrate SSH operations with assertValidIp guard, local persistence, and clean error paths
- `getSchedules`, `saveSchedule`, `removeSchedule` manage `~/.kastell/schedules.json` with mode 0o600 security
- 50 unit tests covering all behaviors, error paths, and edge cases — full suite 2783/2783 green

## Task Commits

Each TDD phase committed atomically:

1. **RED — Failing tests** - `05417a2` (test)
2. **GREEN — Implementation** - `1e85e03` (feat)

## Files Created/Modified

- `src/core/backupSchedule.ts` — All business logic: types, command builders, schedule persistence, validators, orchestrators
- `tests/unit/backup-schedule.test.ts` — 50 unit tests covering BKUP-01 through BKUP-05

## Decisions Made

- `schedules.json` stored at `~/.kastell/schedules.json` separately from `servers.json` — no schema migration, stable ServerRecord type
- Runtime bare/Coolify detection in the backup shell script (`docker ps | grep coolify`) rather than writing two separate scripts — more robust if server type changes after scheduling
- Minimal `validateCronExpr` (5-field check) client-side; VPS `crontab -` is authoritative — non-zero exit surfaced via sshExec.code
- `mkdirSync({ recursive: true })` before each write to ensure CONFIG_DIR exists on first use

## Deviations from Plan

None — plan executed exactly as written. The plan specified test path `src/core/__tests__/backupSchedule.test.ts` but jest.config.cjs roots at `tests/` — used `tests/unit/backup-schedule.test.ts` (consistent with all other tests and RESEARCH.md).

## Issues Encountered

- Test used `toHaveBeenCalledBefore` matcher which does not exist in this Jest setup — fixed to use `toHaveBeenCalledWith` only
- `assertValidIp` inside an `async` function converts sync throw to rejected Promise — test updated to use `rejects.toThrow` (consistent with async behavior, different from `sshConnect` which is non-async)

## Next Phase Readiness

- Plan 02 can import all 3 orchestrators + types from `src/core/backupSchedule.ts`
- Phase 30 (Guard) can follow `schedules.json` pattern for its own cron tracking
- All BKUP-01..05 requirements covered by this module; CLI wiring is Plan 02's scope

---
*Phase: 29-backup-schedule*
*Completed: 2026-03-14*
