---
phase: 20-kastell-audit
plan: 01
subsystem: audit
tags: [ssh, security-audit, scoring, typescript]

requires: []
provides:
  - "Audit type contracts (Severity, AuditCheck, AuditCategory, AuditResult, QuickWin, AuditHistoryEntry, CheckParser)"
  - "SSH batch command builder with 9 section categories"
  - "Severity-weighted scoring engine"
  - "Audit runner skeleton with placeholder parser registry"
affects: [20-02, 20-03, 20-04, 20-05]

tech-stack:
  added: []
  patterns: [severity-weighted-scoring, ssh-batch-sections, separator-delimited-output, category-registry-pattern]

key-files:
  created:
    - src/core/audit/types.ts
    - src/core/audit/commands.ts
    - src/core/audit/scoring.ts
    - src/core/audit/index.ts
    - tests/unit/audit-types.test.ts
    - tests/unit/audit-commands.test.ts
    - tests/unit/audit-scoring.test.ts
  modified: []

key-decisions:
  - "2 SSH batches: batch 1 for fast config reads (SSH/Firewall/Updates/Auth), batch 2 for slower probes (Docker/Network/Filesystem/Logging/Kernel)"
  - "Severity weights critical=3, warning=2, info=1 for proportional scoring"
  - "Placeholder parser registry with noopParser — Plan 02 fills in real parsers"
  - "Graceful partial failure: if one SSH batch fails, still process successful batches"

patterns-established:
  - "SECTION_INDICES constant for deterministic section-to-parser mapping"
  - "CheckParser type signature: (sectionOutput: string, platform: string) => AuditCheck[]"
  - "Category registry pattern for parser dispatch"

requirements-completed: [AUD-CORE, AUD-PLATFORM]

duration: 6min
completed: 2026-03-08
---

# Phase 20 Plan 01: Audit Engine Foundation Summary

**Severity-weighted scoring engine with 9-category SSH batch command builder and runAudit orchestrator skeleton**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-08T14:53:32Z
- **Completed:** 2026-03-08T14:59:24Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Full audit type contract covering all interfaces consumed by Plans 02-06
- SSH batch command builder producing 2 defensive batches across 9 security categories
- Scoring engine with severity weighting (critical=3, warning=2, info=1)
- Runner skeleton that orchestrates: build commands -> SSH exec -> parse sections -> score -> return KastellResult

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1: Audit types + SSH batch command builder**
   - `8efca93` (test) - failing tests for types and commands
   - `b3b1472` (feat) - implement types.ts and commands.ts
2. **Task 2: Scoring engine + audit runner skeleton**
   - `4b5854e` (test) - failing tests for scoring engine
   - `55f1ab1` (feat) - implement scoring.ts and index.ts

## Files Created/Modified
- `src/core/audit/types.ts` - All audit type contracts (Severity, AuditCheck, AuditCategory, AuditResult, QuickWin, AuditHistoryEntry, CheckParser)
- `src/core/audit/commands.ts` - SSH batch command builder with SECTION_INDICES and platform-aware sections
- `src/core/audit/scoring.ts` - Severity-weighted category scoring and overall score calculation
- `src/core/audit/index.ts` - runAudit orchestrator with placeholder parser registry
- `tests/unit/audit-types.test.ts` - Type shape validation tests (8 tests)
- `tests/unit/audit-commands.test.ts` - Command builder tests (6 tests)
- `tests/unit/audit-scoring.test.ts` - Scoring engine tests (9 tests)

## Decisions Made
- Split into 2 SSH batches (fast config reads vs slower active probes) to minimize SSH round trips while keeping reasonable command lengths
- Severity weights critical=3, warning=2, info=1 — simple proportional system that makes critical failures dominate scores
- Used placeholder noopParser registry that Plan 02 replaces — allows runner to compile and be testable now
- Per-batch try/catch with empty string fallback keeps section indexing aligned even on partial failure

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tests root directory mismatch**
- **Found during:** Task 1 (test creation)
- **Issue:** Plan specified `src/core/audit/__tests__/` but jest.config.cjs roots at `tests/` directory
- **Fix:** Placed tests in `tests/unit/audit-*.test.ts` following project convention
- **Files modified:** tests/unit/audit-types.test.ts, tests/unit/audit-commands.test.ts, tests/unit/audit-scoring.test.ts
- **Verification:** All tests discovered and pass
- **Committed in:** 8efca93, 4b5854e

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Test location adjusted to match project jest configuration. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All type contracts stable for Plan 02 (check parsers) to implement CheckParser functions
- SECTION_INDICES provides deterministic mapping for parsers
- Scoring engine ready to receive real AuditCheck data
- Runner skeleton ready for parser registry to be populated

## Self-Check: PASSED

All 7 files verified present. All 4 commits verified in git log. 2319/2319 tests pass (23 new).

---
*Phase: 20-kastell-audit*
*Completed: 2026-03-08*
