---
phase: 23-infrastructure-foundation
plan: 01
subsystem: infra
tags: [file-locking, rate-limit, retry, mkdir, exponential-backoff, hof]

# Dependency graph
requires: []
provides:
  - "withFileLock HOF for advisory file locking (mkdir-based)"
  - "withRetry HOF for 429 rate limit backoff with Retry-After support"
  - "RetryOptions interface for configuring retry behavior"
affects: [23-02, 23-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "mkdir-based advisory file locking with stale detection"
    - "Exponential backoff with jitter and Retry-After header parsing"

key-files:
  created:
    - src/utils/fileLock.ts
    - src/utils/retry.ts
    - tests/unit/fileLock.test.ts
    - tests/unit/retry.test.ts
  modified: []

key-decisions:
  - "withFileLock uses synchronous mkdirSync/rmdirSync for atomic lock operations, async only for retry delay"
  - "withRetry parses Retry-After as integer first, then Date.parse, then falls back to exponential backoff"

patterns-established:
  - "HOF pattern for cross-cutting infrastructure concerns (locking, retry)"
  - "TDD with fake timers for async utilities involving delays"

requirements-completed: [INFRA-01, INFRA-02, INFRA-04]

# Metrics
duration: 5min
completed: 2026-03-09
---

# Phase 23 Plan 01: Infrastructure Utilities Summary

**withFileLock (mkdir-based advisory locking) and withRetry (429 exponential backoff with Retry-After) standalone HOFs with 17 TDD tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-09T07:46:54Z
- **Completed:** 2026-03-09T07:52:12Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- withFileLock HOF with stale lock detection (30s threshold), EEXIST retry (10 attempts, 200ms), and best-effort release in finally block
- withRetry HOF with exponential backoff + 10% jitter, Retry-After header parsing (integer and HTTP-date), and non-429 passthrough
- Full TDD coverage: 7 fileLock tests + 10 retry tests = 17 tests all green

## Task Commits

Each task was committed atomically:

1. **Task 1: Create withFileLock utility with tests** - `0662a18` (feat)
2. **Task 2: Create withRetry utility with tests** - `c582ed0` (feat)

_Both tasks followed TDD: tests written first (RED), then implementation (GREEN)._

## Files Created/Modified
- `src/utils/fileLock.ts` - withFileLock HOF: mkdir-based advisory file locking with stale detection and retry
- `src/utils/retry.ts` - withRetry HOF: exponential backoff for 429 responses with Retry-After header support
- `tests/unit/fileLock.test.ts` - 7 unit tests covering acquire/release, stale detection, EEXIST retry, exhaustion, error propagation
- `tests/unit/retry.test.ts` - 10 unit tests covering 429 retry, backoff, Retry-After (int/date/invalid), non-429 passthrough, exhaustion

## Decisions Made
- withFileLock uses synchronous mkdirSync/rmdirSync for lock operations (atomic on all filesystems), async wrapper only for retry delay
- withRetry parses Retry-After as integer first, then Date.parse for HTTP-date, then falls back to exponential backoff (defense in depth)
- Used jest.useFakeTimers() with advanceTimersByTimeAsync for testing delay-based async code

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Jest fake timers mock Date.now() which affected stale lock detection tests -- fixed by using `Date.now()` inside mockImplementation callbacks rather than static values at test setup time
- `jest.mock("axios")` does not auto-mock `isAxiosError` as a jest.fn() -- used manual mock factory with explicit `isAxiosError: jest.fn()`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both utilities are standalone modules ready for integration
- Plan 02 will integrate withFileLock into config.ts write operations
- Plan 03 will integrate withRetry into provider API calls
- Build compiles cleanly, no regressions in existing test suite

---
*Phase: 23-infrastructure-foundation*
*Completed: 2026-03-09*
