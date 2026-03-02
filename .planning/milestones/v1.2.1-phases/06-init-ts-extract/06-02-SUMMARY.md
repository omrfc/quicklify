---
phase: 06-init-ts-extract
plan: "02"
subsystem: testing
tags: [jest, unit-tests, deploy, tdd, core-deploy]

requires:
  - phase: 06-01
    provides: deployServer() and uploadSshKeyToProvider() extracted to src/core/deploy.ts

provides:
  - "tests/unit/core-deploy.test.ts: 12 unit tests for deployServer() called directly"
  - "Independent testability of deployment logic separate from the init wizard"

affects:
  - future refactors of src/core/deploy.ts (tests guard regressions)

tech-stack:
  added: []
  patterns: ["createMockProvider() helper for CloudProvider interface mocks", "jest.requireMock() to access mock functions across describe blocks"]

key-files:
  created:
    - tests/unit/core-deploy.test.ts
  modified: []

key-decisions:
  - "Used createMockProvider() helper instead of per-test inline objects for DRY test setup"
  - "CloudProvider mock is an inline object (not jest.mock of the provider module) — deployServer() accepts pre-built provider instances, so no provider factory mocking needed"
  - "4 describe blocks: coolify mode, bare mode, error handling, IP assignment — mirrors plan structure"

patterns-established:
  - "createMockProvider(overrides) pattern: creates CloudProvider mock with sane defaults, accepts partial overrides per test"
  - "jest.requireMock() accessor pattern at file top for strongly-typed mock access inside describe blocks"

requirements-completed:
  - REF-03

duration: 2min
completed: "2026-03-02"
---

# Phase 6 Plan 02: Init.ts Extract — Unit Tests for deployServer() Summary

**12 Jest unit tests for deployServer() calling it directly from src/core/deploy.ts, mocking CloudProvider as an inline object and all side-effect dependencies independently of initCommand**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T08:27:29Z
- **Completed:** 2026-03-02T08:29:17Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `tests/unit/core-deploy.test.ts` with 12 tests organized in 4 describe blocks
- Tests import `deployServer` directly from `src/core/deploy` (not through `initCommand`)
- Covers all required scenarios: happy path coolify, bare mode (6 behaviors), full-setup conditional logic, error path (process.exit), pending IP resolution, noOpen flag
- All 2072 tests pass across 77 suites — zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Write tests/unit/core-deploy.test.ts with deployServer() unit tests** - `27a830d` (test)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `tests/unit/core-deploy.test.ts` — 12 unit tests for deployServer() called directly, 4 describe blocks (coolify, bare, error, IP assignment)

## Decisions Made

- Used `createMockProvider(overrides)` helper instead of per-test inline objects to keep test setup DRY while allowing per-test overrides (e.g., `createServer` rejecting for error tests, `getServerDetails` returning resolved IP for pending IP test)
- CloudProvider mock is an inline object (not a jest.mock() of the provider module) because `deployServer()` accepts a pre-built `providerWithToken` parameter — the provider factory/axios path is bypassed entirely
- Kept mock setup identical to the pattern in `init-bare.test.ts` for consistency across the test suite

## Deviations from Plan

None - plan executed exactly as written. All 12 tests from the behavior spec were implemented and pass.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 6 is now fully complete: Plan 01 extracted `deployServer()` to `src/core/deploy.ts`, Plan 02 added independent unit tests for it
- Phase 6 success criterion #5 (independent testability of deployment logic) is satisfied
- v1.2.1 milestone is complete — all 6 phases done

## Self-Check: PASSED

- `tests/unit/core-deploy.test.ts` — FOUND
- Commit `27a830d` — FOUND
- All 12 tests pass — VERIFIED (2072/2072 suite-wide)
- Direct import of `deployServer` from `src/core/deploy` — VERIFIED

---
*Phase: 06-init-ts-extract*
*Completed: 2026-03-02*
