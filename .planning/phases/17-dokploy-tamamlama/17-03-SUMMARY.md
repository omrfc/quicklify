---
phase: 17-dokploy-tamamlama
plan: 03
subsystem: adapters
tags: [dokploy, coolify, restore, adapter-pattern, platform-routing]

# Dependency graph
requires:
  - phase: 17-01
    provides: DokployAdapter.restoreBackup() and CoolifyAdapter.restoreBackup() implementations
  - phase: 17-02
    provides: detectPlatform SSH auto-detection
provides:
  - Restore command delegates actual restore to adapter.restoreBackup() instead of inline SSH
  - Platform-aware restore with Dokploy Swarm commands and Coolify Compose commands
affects: [19-refactoring]

# Tech tracking
tech-stack:
  added: []
  patterns: [adapter-delegation-in-commands]

key-files:
  created: []
  modified:
    - src/commands/restore.ts
    - tests/unit/restore.test.ts

key-decisions:
  - "Kept re-exports of build*Command functions for backward compatibility"
  - "Mocked adapters/factory with explicit resolvePlatform to avoid isBareServer false positive in tests"

patterns-established:
  - "Adapter delegation: commands call getAdapter(platform).method() instead of inline SSH"

requirements-completed: [DOK-02]

# Metrics
duration: 18min
completed: 2026-03-08
---

# Phase 17 Plan 03: Restore Command Adapter Delegation Summary

**Wired restore command actual path to adapter.restoreBackup() replacing 148 lines of inline Coolify SSH commands with platform-aware delegation**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-08T10:40:31Z
- **Completed:** 2026-03-08T10:58:44Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Replaced inline Coolify SSH restore steps (upload, stop, restore-db, restore-config, start, cleanup) with single adapter.restoreBackup() call
- Dokploy restore now executes Docker Swarm commands via DokployAdapter instead of failing with Coolify compose commands
- Coolify restore backward compat preserved via CoolifyAdapter (manifests without platform field default to coolify)
- Platform-specific success URL shown (Dokploy :3000, Coolify :8000)
- Net reduction of 519 lines (-686 removed, +167 added)

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace inline Coolify restore with adapter delegation** - `c2c80fe` (feat)

## Files Created/Modified
- `src/commands/restore.ts` - Replaced 148 lines of inline SSH restore with adapter.restoreBackup() delegation, added getAdapter import
- `tests/unit/restore.test.ts` - Replaced 24 inline-restore tests with 7 adapter-delegated tests, added adapters/factory mock

## Decisions Made
- Kept all re-exports (buildStop/Start/Db/Restore/Config/Cleanup, scpUpload, tryRestartCoolify) for backward compatibility
- Kept sshExec-unrelated imports (scpUpload, tryRestartCoolify) in import block since they're re-exported
- Removed sshExec import since it's no longer used directly in the command
- Mocked adapters/factory with explicit resolvePlatform return to prevent isBareServer from returning true in tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed isBareServer false positive from factory mock**
- **Found during:** Task 1 (test execution)
- **Issue:** Mocking `adapters/factory` caused `resolvePlatform` (imported by `modeGuard.ts`) to return undefined, making `isBareServer` return true for all servers, routing all restore tests to bare server path (timeout)
- **Fix:** Used manual mock factory for `adapters/factory` with `resolvePlatform: jest.fn().mockReturnValue("coolify")`
- **Files modified:** tests/unit/restore.test.ts
- **Verification:** All 38 tests pass, no timeouts
- **Committed in:** c2c80fe

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for test correctness. No scope creep.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Dokploy adapter functionality complete (backup, restore, health, status, update, cloud-init, detectPlatform)
- Phase 17 fully complete: Plans 01 (adapter impl), 02 (detectPlatform), 03 (restore wiring)
- Ready for Phase 19 (Refactoring) or Phase 20 (Audit)

---
*Phase: 17-dokploy-tamamlama*
*Completed: 2026-03-08*
