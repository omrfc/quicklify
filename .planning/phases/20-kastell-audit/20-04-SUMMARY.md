---
phase: 20-kastell-audit
plan: 04
subsystem: audit
tags: [fix-engine, history, trend-detection, quick-wins, ssh, security]

requires:
  - phase: 20-kastell-audit (plan 01)
    provides: AuditResult types, scoring engine, audit runner
  - phase: 20-kastell-audit (plan 02)
    provides: Check parsers with fixCommand fields
provides:
  - Fix engine with interactive and dry-run modes
  - Audit history persistence with trend detection
  - Quick win calculator with projected scores
affects: [20-kastell-audit plan 05 (CLI command/MCP integration)]

tech-stack:
  added: []
  patterns: [lazy path resolution for testability, atomic file write with temp+rename, severity-weighted impact calculation]

key-files:
  created:
    - src/core/audit/fix.ts
    - src/core/audit/history.ts
    - src/core/audit/quickwin.ts
    - tests/unit/audit-fix.test.ts
    - tests/unit/audit-history.test.ts
    - tests/unit/audit-quickwin.test.ts
  modified: []

key-decisions:
  - "Lazy getHistoryPath() instead of module-level constant for testability with mocked CONFIG_DIR"
  - "Atomic write via temp file + renameSync for audit-history.json integrity"
  - "Pre-condition checks for SSH password disable (verify authorized_keys exists) and firewall changes (verify SSH port in rules)"
  - "Quick wins calculate individual check impact rather than grouped category impact for granular ranking"

patterns-established:
  - "Pre-condition pattern: dangerous fixes check prerequisites before execution"
  - "Severity-grouped prompting: batch fixes by severity level for user confirmation"

requirements-completed: [AUD-FIX, AUD-HIST]

duration: 5min
completed: 2026-03-08
---

# Phase 20 Plan 04: Fix Engine, History, and Quick Wins Summary

**Interactive fix engine with dry-run preview, audit history with trend detection, and quick win calculator ranking fixes by severity-weighted score impact**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-08T15:16:25Z
- **Completed:** 2026-03-08T15:21:46Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Fix engine groups failed checks by severity, prompts per group, executes via SSH with pre-condition safety checks
- Audit history persists to ~/.kastell/audit-history.json with 50-entry cap per server and atomic writes
- Trend detection compares current score to most recent audit (improvement/regression/unchanged/first audit)
- Quick win calculator ranks fixes by severity-weighted impact with projected scores

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix engine + dry-run** - `e2e6fa4` (feat)
2. **Task 2: History/trend detection + quick win calculator** - `f9bf4f9` (feat)

_Note: TDD tasks combined RED+GREEN into single commits since tests and implementation were tightly coupled._

## Files Created/Modified
- `src/core/audit/fix.ts` - Interactive fix engine with previewFixes and runFix
- `src/core/audit/history.ts` - Audit history persistence with trend detection
- `src/core/audit/quickwin.ts` - Quick win calculator with projected scores
- `tests/unit/audit-fix.test.ts` - 9 tests for fix engine
- `tests/unit/audit-history.test.ts` - 11 tests for history and trends
- `tests/unit/audit-quickwin.test.ts` - 7 tests for quick wins

## Decisions Made
- Used lazy `getHistoryPath()` instead of module-level constant to support CONFIG_DIR mocking in tests
- Atomic write via temp file + renameSync for audit-history.json integrity
- Pre-condition checks prevent SSH lockout (verify authorized_keys before disabling password auth)
- Quick wins use individual check impact (not grouped) for more granular ranking
- Tests placed in `tests/unit/` following project convention (plan referenced `src/core/audit/__tests__/`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test file location adjusted to project convention**
- **Found during:** Task 1 (fix engine tests)
- **Issue:** Plan specified `src/core/audit/__tests__/` but project uses `tests/unit/` (jest roots config)
- **Fix:** Created tests in `tests/unit/audit-*.test.ts` instead
- **Files modified:** tests/unit/audit-fix.test.ts, tests/unit/audit-history.test.ts, tests/unit/audit-quickwin.test.ts
- **Verification:** All 27 tests pass
- **Committed in:** e2e6fa4, f9bf4f9

**2. [Rule 3 - Blocking] Lazy path resolution for history file**
- **Found during:** Task 2 (history tests)
- **Issue:** Module-level `join(homedir(), ".kastell")` computed before os mock was set up, causing "path must be string" error
- **Fix:** Used CONFIG_DIR from utils/config.ts with lazy getHistoryPath() function
- **Files modified:** src/core/audit/history.ts
- **Verification:** All history tests pass with mocked CONFIG_DIR
- **Committed in:** f9bf4f9

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for tests to run. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Fix engine, history, and quick wins ready for CLI command integration (Plan 05)
- All exports match plan frontmatter: runFix, previewFixes, saveAuditHistory, loadAuditHistory, detectTrend, calculateQuickWins

---
*Phase: 20-kastell-audit*
*Completed: 2026-03-08*
