---
phase: 25-audit-diff-and-compare
plan: 01
subsystem: audit
tags: [diff, snapshot, chalk, tdd, pure-functions]

# Dependency graph
requires:
  - phase: 24-audit-snapshots
    provides: saveSnapshot, loadSnapshot, listSnapshots, SnapshotFile, SnapshotListEntry types
provides:
  - diffAudits() pure function classifying check changes as improved/regressed/unchanged/added/removed
  - resolveSnapshotRef() resolving latest/filename/name refs including cross-server
  - formatDiffTerminal() colour-coded chalk output
  - formatDiffJson() JSON serialisation for CI
  - CheckDiffStatus, CheckDiffEntry, AuditDiffResult type definitions
affects:
  - 25-02 (CLI wiring for --diff and --compare flags)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure diff functions: buildCheckMap + union-of-IDs pattern for check classification"
    - "Snapshot ref resolution: latest > filename > name-scan priority chain"

key-files:
  created:
    - src/core/audit/diff.ts
    - tests/unit/audit-diff.test.ts
  modified:
    - src/core/audit/types.ts

key-decisions:
  - "diffAudits keys on check.id (not name/category) to correctly handle cross-category check matching"
  - "resolveSnapshotRef tries filename load before name scan — direct filename is unambiguous"
  - "formatDiffJson is simply JSON.stringify(diff, null, 2) — no transformation needed for CI"
  - "formatDiffTerminal omits Added/Removed sections when empty to reduce noise"

patterns-established:
  - "Diff check classification: buildCheckMap per audit + Set union of IDs + classifyStatus(before, after)"
  - "Snapshot ref chain: latest → last-in-list; otherwise filename-first → name-scan fallback"

requirements-completed:
  - DIFF-01
  - DIFF-02
  - DIFF-03
  - DIFF-04

# Metrics
duration: 15min
completed: 2026-03-11
---

# Phase 25 Plan 01: Audit Diff Engine Summary

**Pure diff engine — diffAudits/resolveSnapshotRef/formatDiffTerminal/formatDiffJson with 26 TDD tests covering all check state transitions and cross-server snapshot resolution**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-11T06:00:00Z
- **Completed:** 2026-03-11T06:15:00Z
- **Tasks:** 2
- **Files modified:** 3 (modified types.ts, created diff.ts, created audit-diff.test.ts)

## Accomplishments
- `diffAudits()` compares two AuditResult objects check-by-check, classifying each as improved/regressed/unchanged/added/removed with correct scoreDelta
- `resolveSnapshotRef()` resolves "latest", filename, and named snapshot refs; fully cross-server aware via serverIp passthrough
- `formatDiffTerminal()` renders colour-coded output with regressions first, improvements second, conditional Added/Removed sections
- `formatDiffJson()` serialises full AuditDiffResult as indented JSON for CI pipelines
- 26 tests, all green; full suite 2564 tests, 0 failures

## Task Commits

1. **Tasks 1+2: Diff engine + formatters (TDD RED→GREEN)** - `6ea8b3a` (feat)

## Files Created/Modified
- `src/core/audit/types.ts` - Added CheckDiffStatus, CheckDiffEntry, AuditDiffResult types
- `src/core/audit/diff.ts` - New: diffAudits, resolveSnapshotRef, formatDiffTerminal, formatDiffJson
- `tests/unit/audit-diff.test.ts` - New: 26 unit tests with snapshot mock, cross-server test

## Decisions Made
- `diffAudits` keys on `check.id` (not name/category) — IDs are canonical identifiers, stable across audits
- `resolveSnapshotRef` tries direct filename load before name scan — direct filename refs are unambiguous; only fall through to scan on null
- `formatDiffJson` uses `JSON.stringify(diff, null, 2)` with no transformation — AuditDiffResult already has the right shape for machine consumption
- Terminal formatter omits Added/Removed sections when empty — reduces output noise in the common case of comparing same-version audits

## Deviations from Plan

None - plan executed exactly as written. Both tasks implemented in one unified TDD RED→GREEN cycle since the test file spans both formatter and diff engine tests.

## Issues Encountered

Minor: TypeScript flagged a duplicate `id` spread in the test helper (`makeCheck`). Fixed by building the base object first, then spreading overrides — same pattern, no behaviour change.

## Next Phase Readiness
- `diff.ts` exports are ready for Plan 25-02 CLI wiring
- `--diff before:after` and `--compare serverA:serverB` flags can import directly from `../../core/audit/diff.js`
- No blockers

---
*Phase: 25-audit-diff-and-compare*
*Completed: 2026-03-11*
