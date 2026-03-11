---
phase: 24-audit-snapshots
plan: 02
subsystem: cli
tags: [audit, snapshot, commander, chalk]

# Dependency graph
requires:
  - phase: 24-01
    provides: saveSnapshot, listSnapshots from core/audit/snapshot.ts
provides:
  - --snapshot [name] option wires audit result to snapshot persistence
  - --snapshots option lists saved snapshots without running audit
  - AuditCommandOptions extended with snapshot? and snapshots? fields
affects: [25-audit-diff, future audit phases using snapshot comparison]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Early return pattern: --snapshots exits before audit execution"
    - "Post-audit hook: --snapshot saves after history, before formatter"

key-files:
  created:
    - tests/unit/audit-command-snapshot.test.ts
  modified:
    - src/commands/audit.ts
    - src/index.ts

key-decisions:
  - "Test file placed at tests/unit/ (not src/commands/__tests__/) to match Jest roots configuration"
  - "saveSnapshot returns void (not Promise<string>), so success message uses server name not file path"
  - "listSnapshots is async in implementation (not sync as plan stated), awaited accordingly"
  - "snapshot option uses undefined check (not boolean check) to allow false-y string values"

patterns-established:
  - "Snapshot wiring: import from core/audit/snapshot.js, call after saveAuditHistory"
  - "List mode: resolve server first, then call listSnapshots(ip) and return early"

requirements-completed: [SNAP-01, SNAP-02, SNAP-03]

# Metrics
duration: 12min
completed: 2026-03-11
---

# Phase 24 Plan 02: Audit Snapshot CLI Wiring Summary

**--snapshot and --snapshots CLI options wired to core snapshot module, with 7 integration tests covering both save and list paths**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-11T06:05:00Z
- **Completed:** 2026-03-11T06:17:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `kastell audit <server> --snapshot` saves an auto-named snapshot after audit completes
- `kastell audit <server> --snapshot pre-upgrade` saves a named snapshot
- `kastell audit <server> --snapshots` lists saved snapshots without running an audit
- 7 integration tests confirm all wiring paths (list empty, list with entries, save boolean, save named, call order)

## Task Commits

Each task was committed atomically:

1. **Task 1: Register --snapshot and --snapshots options** - `aa18bce` (feat)
2. **Task 2: Add integration tests for audit command snapshot wiring** - `e533e86` (test)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/commands/audit.ts` - Added snapshot/snapshots options to interface, early-exit --snapshots mode, --snapshot save after history
- `src/index.ts` - Registered `--snapshot [name]` and `--snapshots` Commander options
- `tests/unit/audit-command-snapshot.test.ts` - 7 integration tests for wiring

## Decisions Made

- Test file at `tests/unit/` (not `src/commands/__tests__/`) per project Jest roots config
- `saveSnapshot` returns void in actual implementation, so success message uses server name instead of file path
- `listSnapshots` is async in snapshot.ts, awaited in audit command
- `options.snapshot !== undefined` check (not `options.snapshot`) allows string values like `"pre-upgrade"` to pass through

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adapted for actual saveSnapshot/listSnapshots signatures**
- **Found during:** Task 1 (examining snapshot.ts from Plan 01)
- **Issue:** Plan interface showed `saveSnapshot` returning `Promise<string>` and `listSnapshots` as synchronous, but the actual implementation returns `Promise<void>` and `Promise<SnapshotListEntry[]>` respectively
- **Fix:** Used `await listSnapshots(ip)` (async), logged server name instead of file path for `--snapshot` success message
- **Files modified:** src/commands/audit.ts
- **Verification:** Build passes with no type errors
- **Committed in:** aa18bce (Task 1 commit)

**2. [Rule 3 - Blocking] Changed test path to match Jest roots config**
- **Found during:** Task 2 (plan specified `src/commands/__tests__/audit-snapshot.test.ts`)
- **Issue:** Jest roots is set to `tests/` only; tests in `src/` directory are not discovered
- **Fix:** Created test at `tests/unit/audit-command-snapshot.test.ts` instead
- **Files modified:** tests/unit/audit-command-snapshot.test.ts
- **Verification:** `npx jest tests/unit/audit-command-snapshot` — 7/7 pass
- **Committed in:** e533e86 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 signature mismatch, 1 path correction)
**Impact on plan:** Both corrections required for correctness. No scope creep.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Snapshot save and list fully wired and tested
- Phase 24 complete: persistence module (Plan 01) + CLI wiring (Plan 02) both shipped
- Ready for Phase 25 when roadmap calls for audit diff/compare features

---
*Phase: 24-audit-snapshots*
*Completed: 2026-03-11*
