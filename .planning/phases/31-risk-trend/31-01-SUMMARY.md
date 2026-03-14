---
phase: 31-risk-trend
plan: "01"
subsystem: audit
tags: [trend, audit-history, chalk, formatters, pure-function]

# Dependency graph
requires:
  - phase: 30-guard-daemon
    provides: MetricSnapshot type in src/types/index.ts for shared context
  - phase: 28-lock
    provides: AuditHistoryEntry shape in src/core/audit/types.ts

provides:
  - TrendCauseLine, TrendEntry, TrendResult types in src/core/audit/types.ts
  - computeTrend() pure function in src/core/audit/history.ts
  - formatTrendTerminal() and formatTrendJson() in src/core/audit/formatters/trend.ts

affects:
  - 31-02: CLI audit --trend/--days flags depend on these exports

# Tech tracking
tech-stack:
  added: []
  patterns: [pure-function-data-layer, tdd-red-green, cause-attribution-sort-by-abs-delta]

key-files:
  created:
    - src/core/audit/formatters/trend.ts
    - tests/unit/audit-trend.test.ts
  modified:
    - src/core/audit/types.ts
    - src/core/audit/history.ts

key-decisions:
  - "computeTrend is a pure function — no I/O, accepts history array + options"
  - "causeList uses union of category keys so new categories appearing mid-history are captured (treated as 0 before)"
  - "serverIp/serverName from first element of original (pre-filter) history array — empty string for empty input"
  - "formatTrendTerminal follows existing diff.ts color convention: >=80 green, >=50 yellow, else red"

patterns-established:
  - "Trend formatter reads TrendResult directly — not imported via formatters/index.ts (index is for AuditResult only)"
  - "Days filter uses Date.now() so jest.useFakeTimers() works for deterministic tests"

requirements-completed: [TREND-01, TREND-02, TREND-03, TREND-04, TREND-05]

# Metrics
duration: 3min
completed: "2026-03-14"
---

# Phase 31 Plan 01: Risk Trend Core Engine Summary

**Pure-function trend computation engine with per-transition category cause attribution and chalk-coloured terminal + JSON formatters**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-14T10:26:54Z
- **Completed:** 2026-03-14T10:29:53Z
- **Tasks:** 2 (Task 1: types + computeTrend; Task 2: formatters)
- **Files modified:** 4

## Accomplishments

- Added TrendCauseLine, TrendEntry, TrendResult interfaces to types.ts — the type contracts all CLI integration will use
- Implemented computeTrend() pure function in history.ts: days filter, oldest-first sort, per-transition delta + cause attribution sorted by abs(delta) descending
- Created formatters/trend.ts with formatTrendTerminal() (chalk-coloured timeline) and formatTrendJson() (valid JSON serialisation)
- 30 new unit tests covering all TREND-01..05 requirements; full suite at 2917 tests, build clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Types + computeTrend + tests (RED+GREEN)** - `25e8ed6` (test/feat)
2. **Task 2: formatters/trend.ts** - `b30ee99` (feat)

_Note: TDD tasks have test commit followed by implementation commit_

## Files Created/Modified

- `src/core/audit/types.ts` - Added TrendCauseLine, TrendEntry, TrendResult interfaces
- `src/core/audit/history.ts` - Added computeTrend() and private buildCauseList() helper
- `src/core/audit/formatters/trend.ts` - New file: formatTrendTerminal() and formatTrendJson()
- `tests/unit/audit-trend.test.ts` - New file: 30 unit tests for all three exports

## Decisions Made

- computeTrend is a pure function (no I/O). History array is passed in directly, keeping it fully testable without mocking the filesystem.
- Missing categories in either before or after side treated as score 0 — allows handling of categories that appear mid-history without crashing.
- formatters/trend.ts is NOT exported through formatters/index.ts — that index is for AuditResult formatters. The audit command in Plan 02 imports directly.
- Score color threshold: >=80 green, >=50 yellow, <50 red (consistent with diff formatter, slightly different from terminal formatter which uses 60 as yellow threshold — matches plan spec).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All TREND-01..05 type contracts and core logic are complete
- Plan 02 (CLI integration) can import computeTrend, formatTrendTerminal, formatTrendJson directly
- audit command needs --trend and --days flags wired to these functions

---
*Phase: 31-risk-trend*
*Completed: 2026-03-14*
