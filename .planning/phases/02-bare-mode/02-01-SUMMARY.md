---
phase: 02-bare-mode
plan: 01
subsystem: infra
tags: [typescript, cloud-init, server-mode, ufw, fail2ban]

# Dependency graph
requires:
  - phase: 01-cli-core-refactor
    provides: Clean CLI/core architecture, ServerRecord type, config utilities
provides:
  - ServerMode type ('coolify' | 'bare')
  - ServerRecord with optional mode field
  - BackupManifest with optional mode field
  - InitOptions with optional mode field
  - getBareCloudInit() function for hardening-only cloud-init
  - getServerMode() utility returning effective server mode
  - isBareServer() utility for mode detection
  - requireCoolifyMode() guard returning error string for bare servers
  - getServers() backward-compatible mode defaulting to 'coolify'
affects: [02-02-PLAN.md, 02-03-PLAN.md, 02-04-PLAN.md, init command, add command, status command, backup command]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Backward compat via spread + default: { ...s, mode: s.mode || 'coolify' } in getServers()"
    - "Mode guard pattern: getServerMode/isBareServer/requireCoolifyMode as composable utilities"
    - "TDD: RED (test) → GREEN (impl) per task, each committed atomically"

key-files:
  created:
    - src/utils/modeGuard.ts
    - tests/unit/modeGuard.test.ts
  modified:
    - src/types/index.ts
    - src/utils/cloudInit.ts
    - src/utils/config.ts
    - tests/unit/config.test.ts
    - tests/unit/cloudInit.test.ts

key-decisions:
  - "ServerMode type exported separately for reuse by modeGuard, init, add, and other consumers"
  - "getServers() normalizes mode at read time so all consumers always see a mode field"
  - "requireCoolifyMode returns string | null (not throws) to let callers handle output format"
  - "Bare cloud-init uses UFW only (no iptables fallback) since hardening-only servers don't need Coolify's broad compat"

patterns-established:
  - "Mode defaulting: Always use s.mode || 'coolify' for backward compat with legacy records"
  - "Mode guard: Import from src/utils/modeGuard.ts for consistent mode checks across commands"

requirements-completed: [BARE-08, BARE-09]

# Metrics
duration: 4m12s
completed: 2026-02-28
---

# Phase 02 Plan 01: Foundation Types, Utilities, and Bare Cloud-Init Summary

**ServerMode type, backward-compatible mode defaulting in getServers(), getBareCloudInit() with UFW hardening, and modeGuard utilities (getServerMode/isBareServer/requireCoolifyMode) establishing the bare mode foundation**

## Performance

- **Duration:** 4m12s
- **Started:** 2026-02-28T07:16:44Z
- **Completed:** 2026-02-28T07:20:56Z
- **Tasks:** 3 (all TDD)
- **Files modified:** 7

## Accomplishments
- Added `ServerMode = 'coolify' | 'bare'` type and optional `mode` field to `ServerRecord`, `BackupManifest`, and `InitOptions`
- Updated `getServers()` to normalize all loaded records to have a mode field (backward compat, no migration needed)
- Created `getBareCloudInit()` — installs fail2ban, ufw, unattended-upgrades with ports 22/80/443 only, zero Coolify references
- Created `src/utils/modeGuard.ts` with three composable guard functions for all subsequent plans to use
- Added 26 new tests (1755 → 1781 total, all passing), build and lint clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Add mode field to ServerRecord and update config backward compat** - `87f606e` (feat)
2. **Task 2: Create bare cloud-init script** - `1f4cadc` (feat)
3. **Task 3: Create mode guard utility module** - `fd223b7` (feat)

_Note: All tasks followed TDD pattern (RED failing test → GREEN implementation)_

## Files Created/Modified
- `src/types/index.ts` - Added ServerMode type, mode field on ServerRecord/BackupManifest/InitOptions
- `src/utils/config.ts` - Updated getServers() to normalize mode for backward compat
- `src/utils/cloudInit.ts` - Added getBareCloudInit() for hardening-only cloud-init
- `src/utils/modeGuard.ts` - NEW: getServerMode, isBareServer, requireCoolifyMode utilities
- `tests/unit/config.test.ts` - Updated existing test + 4 new mode-related tests
- `tests/unit/cloudInit.test.ts` - Updated import + 12 new getBareCloudInit tests
- `tests/unit/modeGuard.test.ts` - NEW: 11 tests for all modeGuard behaviors

## Decisions Made
- `ServerMode` exported as a separate type alias so it can be imported independently without pulling in full `ServerRecord`
- `getServers()` normalizes at read time (not write time) — legacy records on disk stay unchanged, only normalized in memory
- `requireCoolifyMode()` returns `string | null` instead of throwing — callers (CLI commands) format their own error output
- Bare cloud-init uses UFW only (not iptables fallback) since it targets modern Ubuntu servers; simpler and sufficient

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All type contracts established: `ServerMode`, `ServerRecord.mode`, `BackupManifest.mode`, `InitOptions.mode`
- `getBareCloudInit` ready for use in Plan 02 (init command bare provisioning path)
- `isBareServer` / `requireCoolifyMode` ready for use in Plans 02-04 (command-level mode gating)
- `getServers()` backward compat means no migration needed when plans add bare servers to servers.json

## Self-Check: PASSED

- src/types/index.ts: FOUND
- src/utils/cloudInit.ts: FOUND
- src/utils/modeGuard.ts: FOUND
- src/utils/config.ts: FOUND
- Commit 87f606e: FOUND
- Commit 1f4cadc: FOUND
- Commit fd223b7: FOUND

---
*Phase: 02-bare-mode*
*Completed: 2026-02-28*
