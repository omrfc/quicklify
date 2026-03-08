---
phase: 20-kastell-audit
plan: 03
subsystem: audit
tags: [cli-command, formatters, svg-badge, terminal-output, html-report]

requires:
  - phase: 20-kastell-audit plan 01
    provides: AuditResult/AuditCategory/AuditCheck types, runAudit orchestrator, scoring engine
  - phase: 20-kastell-audit plan 02
    provides: 9 category check parsers, parseAllChecks, 46 security checks
provides:
  - "kastell audit CLI command with --json, --badge, --report, --summary, --score-only, --host, --threshold"
  - "5 output formatters: terminal, JSON, badge (SVG), HTML report, markdown report, summary dashboard"
  - "Formatter selection via async selectFormatter based on CLI flags"
affects: [20-04 (fix engine uses formatters), 20-05 (MCP tool uses formatters)]

tech-stack:
  added: []
  patterns: [async-formatter-selection, shields-io-svg-badge, self-contained-html-report]

key-files:
  created:
    - src/commands/audit.ts
    - src/core/audit/formatters/terminal.ts
    - src/core/audit/formatters/json.ts
    - src/core/audit/formatters/badge.ts
    - src/core/audit/formatters/report.ts
    - src/core/audit/formatters/summary.ts
    - src/core/audit/formatters/index.ts
    - tests/unit/audit-command.test.ts
    - tests/unit/audit-formatter-terminal.test.ts
    - tests/unit/audit-formatter-json.test.ts
    - tests/unit/audit-formatter-badge.test.ts
    - tests/unit/audit-formatter-report.test.ts
    - tests/unit/audit-formatter-summary.test.ts
  modified:
    - src/index.ts

key-decisions:
  - "Async selectFormatter with dynamic imports to lazy-load non-default formatters"
  - "SVG badge uses shields.io layout with green/yellow/red thresholds at 80/60"
  - "HTML report is fully self-contained with inline CSS, no external dependencies"
  - "Command uses server.platform with fallback to server.mode for backward compat"

patterns-established:
  - "selectFormatter(options) async pattern for CLI flag to formatter mapping"
  - "Formatter function signature: (result: AuditResult) => string"
  - "Progress bar characters: filled block + light shade for visual scoring"

requirements-completed: [AUD-CLI, AUD-FMT]

duration: 9min
completed: 2026-03-08
---

# Phase 20 Plan 03: CLI Command & Output Formatters Summary

**Audit CLI command with 6 output modes (terminal/JSON/SVG badge/HTML/Markdown/summary dashboard) and --host/--threshold for CI/CD integration**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-08T15:15:53Z
- **Completed:** 2026-03-08T15:24:46Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- `kastell audit [server]` command registered with all CLI options (--json, --badge, --report, --summary, --score-only, --host, --threshold, --fix, --watch, --category)
- Terminal formatter with colored category table, emoji severity, failed check details, and quick wins section
- SVG badge formatter producing shields.io-style badges with score-based color coding
- HTML report formatter as self-contained single file with inline CSS
- Markdown report formatter with check tables per category
- Summary dashboard with compact progress bars per category
- 41 new tests across 6 test files, all passing. Full suite: 2455/2455 (110 suites)

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1: CLI command + terminal formatter**
   - `c3ef65e` (test) - failing tests for audit command and terminal formatter
   - `8b5a8d0` (feat) - implement audit CLI command and terminal formatter
2. **Task 2: JSON, badge, report, summary formatters**
   - `d9ca027` (test) - failing tests for json, badge, report, summary formatters
   - `e2d8fea` (feat) - implement json, badge, report, summary formatters

## Files Created/Modified
- `src/commands/audit.ts` - Thin CLI command with --host parsing, --threshold exit code, formatter delegation
- `src/core/audit/formatters/terminal.ts` - Default colored table output with emoji severity and quick wins
- `src/core/audit/formatters/json.ts` - Pretty-printed JSON.stringify of AuditResult
- `src/core/audit/formatters/badge.ts` - shields.io-style SVG badge with score color coding
- `src/core/audit/formatters/report.ts` - Self-contained HTML report + Markdown report with check tables
- `src/core/audit/formatters/summary.ts` - Compact dashboard with progress bars per category
- `src/core/audit/formatters/index.ts` - Async selectFormatter + re-exports for all formatters
- `src/index.ts` - Registered audit command in CLI entry point
- `tests/unit/audit-command.test.ts` - 10 command tests (formatter selection, --host, --threshold, failure)
- `tests/unit/audit-formatter-terminal.test.ts` - 7 terminal formatter tests
- `tests/unit/audit-formatter-json.test.ts` - 3 JSON formatter tests
- `tests/unit/audit-formatter-badge.test.ts` - 6 badge SVG tests
- `tests/unit/audit-formatter-report.test.ts` - 10 report tests (HTML + Markdown)
- `tests/unit/audit-formatter-summary.test.ts` - 5 summary dashboard tests

## Decisions Made
- Used async `selectFormatter()` with dynamic imports to keep non-default formatters lazy-loaded
- SVG badge follows shields.io layout with green (#4c1) >= 80, yellow (#dfb317) >= 60, red (#e05d44) < 60
- HTML report is fully self-contained (inline CSS, no external resources) for easy sharing
- Command uses `server.platform ?? server.mode ?? "bare"` for backward compatibility with older ServerRecord entries

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created stub formatters for TypeScript compilation**
- **Found during:** Task 1 (command implementation)
- **Issue:** formatters/index.ts has dynamic imports of json/badge/report/summary modules that don't exist yet, causing ts-jest type errors even with mocking
- **Fix:** Created minimal stub files for each formatter that Task 2 replaces with full implementations
- **Files modified:** json.ts, badge.ts, report.ts, summary.ts (all stubs)
- **Verification:** Command tests pass with mocked formatters, stubs replaced in Task 2
- **Committed in:** 8b5a8d0 (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed pre-existing history.ts build error**
- **Found during:** Task 1 (build verification)
- **Issue:** Untracked `src/core/audit/history.ts` had `HISTORY_FILE` references instead of `getHistoryPath()` calls, breaking `npm run build`
- **Fix:** File was auto-corrected (likely by linter) between reads; verified build passes
- **Files modified:** src/core/audit/history.ts (not committed - pre-existing untracked file)
- **Verification:** `npm run build` succeeds

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Stub creation was necessary for TypeScript compilation. History.ts fix was pre-existing. No scope creep.

## Issues Encountered
- Tests are in `tests/unit/` (project convention) not `src/core/audit/__tests__/` (plan convention) - consistent with Plans 01 and 02

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All formatters available for Plan 04 (fix engine) and Plan 05 (MCP tool)
- selectFormatter pattern can be extended with new output modes
- CLI command ready for --fix and --watch implementation in Plan 04

## Self-Check: PASSED

All 14 files verified present. All 4 commits verified in git log. 2455/2455 tests pass (110 suites).

---
*Phase: 20-kastell-audit*
*Completed: 2026-03-08*
