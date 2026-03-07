---
phase: 11-dokploy-lifecycle-completion
plan: 02
subsystem: commands
tags: [adapter-dispatch, dokploy, coolify, update, maintain, logs, platform-generic]

requires:
  - phase: 11-dokploy-lifecycle-completion
    provides: PlatformAdapter with update() and getLogCommand() methods, pollHealth()
provides:
  - Platform-generic maintainServer() using adapter.update() and pollHealth()
  - Adapter-dispatched update command without platform conditionals
  - Dokploy log service support with cross-platform validation
  - Zero "not yet supported" Dokploy guards in codebase
affects: [phase-12-bug-fixes, phase-13-dx, phase-14-tui]

tech-stack:
  added: []
  patterns: [adapter-dispatch in commands, dynamic step names via adapter.name, cross-platform log validation]

key-files:
  created: []
  modified:
    - src/core/maintain.ts
    - src/core/logs.ts
    - src/core/status.ts
    - src/commands/update.ts
    - src/commands/maintain.ts
    - src/commands/logs.ts
    - src/mcp/tools/serverMaintain.ts
    - tests/unit/maintain.test.ts
    - tests/unit/update.test.ts
    - tests/unit/logs.test.ts
    - tests/unit/mcp-server-maintain.test.ts

key-decisions:
  - "checkCoolifyHealth() kept in status.ts with @deprecated tag -- still has callers in health.ts, status.ts, MCP serverInfo"
  - "Cross-platform log validation: coolify service on dokploy server (and vice versa) returns clear error"
  - "MCP serverMaintain update action uses adapter dispatch, not executeCoolifyUpdate"

patterns-established:
  - "Adapter dispatch in commands: resolve platform -> getAdapter(platform) -> adapter.method()"
  - "Dynamic display names: adapter.name.charAt(0).toUpperCase() + adapter.name.slice(1)"
  - "Cross-platform validation: check platform vs service mismatch before executing"

requirements-completed: [DOKP-01, DOKP-02, DOKP-03]

duration: 13min
completed: 2026-03-07
---

# Phase 11 Plan 02: Adapter Dispatch and Dokploy Guard Removal Summary

**Platform-generic commands using adapter dispatch -- update/maintain/logs work for both Coolify and Dokploy with zero platform conditionals**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-07T08:49:16Z
- **Completed:** 2026-03-07T09:01:57Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- maintainServer() refactored to use adapter.update() and pollHealth(adapter, ...) -- works for both platforms
- All "not yet supported" and "Coming in v1.4" Dokploy guards removed from codebase
- commands/update.ts, maintain.ts, logs.ts all use adapter dispatch with platform-aware messages
- "dokploy" added as LogService type with Docker Swarm service log command
- Cross-platform log validation prevents invalid service/platform combinations
- Full test suite: 84 suites, 2212 tests pass, build clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor core/maintain.ts and core/logs.ts** (TDD)
   - `42e3648` (test: RED -- failing tests for adapter dispatch)
   - `a449fac` (feat: GREEN -- implement adapter dispatch in core)
2. **Task 2: Refactor commands and remove Dokploy guards** (TDD)
   - `5687e3a` (test: RED -- failing tests for command adapter dispatch)
   - `9a35c73` (feat: GREEN -- implement command refactoring)

## Files Created/Modified
- `src/core/maintain.ts` - Removed executeCoolifyUpdate/pollCoolifyHealth, maintainServer uses adapter dispatch
- `src/core/logs.ts` - Added "dokploy" to LogService type and buildLogCommand switch
- `src/core/status.ts` - checkCoolifyHealth marked @deprecated (kept for legacy callers)
- `src/commands/update.ts` - Uses adapter.update() with platform-aware messages, no skip guards
- `src/commands/maintain.ts` - Uses adapter dispatch for update + health check, dynamic step names
- `src/commands/logs.ts` - Supports "dokploy" service, cross-platform validation, platform-aware defaults
- `src/mcp/tools/serverMaintain.ts` - Update action uses adapter dispatch
- `tests/unit/maintain.test.ts` - Adapter-based tests for maintainServer with Dokploy
- `tests/unit/update.test.ts` - Dokploy server update tests (no skip)
- `tests/unit/logs.test.ts` - Dokploy service tests, cross-platform error tests
- `tests/unit/mcp-server-maintain.test.ts` - Updated to mock adapter instead of removed functions

## Decisions Made
- checkCoolifyHealth() kept in status.ts despite being deprecated -- health.ts, status.ts, and MCP serverInfo.ts still use it directly. Full migration deferred.
- Cross-platform log validation added: prevents using coolify service on dokploy server and vice versa with clear error messages.
- MCP serverMaintain update action updated to use adapter dispatch alongside CLI commands.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated MCP serverMaintain.ts for adapter dispatch**
- **Found during:** Task 1
- **Issue:** mcp/tools/serverMaintain.ts imported executeCoolifyUpdate which was removed
- **Fix:** Updated to use getAdapter(platform).update() with platform-aware success message
- **Files modified:** src/mcp/tools/serverMaintain.ts
- **Verification:** mcp-server-maintain tests pass
- **Committed in:** a449fac (Task 1 commit)

**2. [Rule 3 - Blocking] Updated mcp-server-maintain.test.ts mocks**
- **Found during:** Task 1
- **Issue:** Test file imported executeCoolifyUpdate and pollCoolifyHealth which no longer exist
- **Fix:** Removed direct function tests, updated maintainServer tests to mock adapter via adapterFactory
- **Files modified:** tests/unit/mcp-server-maintain.test.ts
- **Verification:** All 32 MCP maintain tests pass
- **Committed in:** a449fac (Task 1 commit)

**3. [Rule 1 - Bug] checkCoolifyHealth kept in status.ts**
- **Found during:** Task 1
- **Issue:** Plan said to remove checkCoolifyHealth from status.ts if no callers remain, but health.ts, status.ts, and mcp/serverInfo.ts still call it directly
- **Fix:** Kept function, added @deprecated JSDoc comment instead
- **Files modified:** src/core/status.ts
- **Committed in:** a449fac (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All auto-fixes necessary for compilation and test correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 11 (Dokploy Lifecycle Completion) is fully complete
- All Dokploy lifecycle commands work: update, maintain, logs
- Ready for Phase 12 (Bug Fixes) -- SCP Windows, locale, sshd_config

---
*Phase: 11-dokploy-lifecycle-completion*
*Completed: 2026-03-07*

## Self-Check: PASSED

All 11 files verified present. All 4 commits (42e3648, a449fac, 5687e3a, 9a35c73) verified in git log.
