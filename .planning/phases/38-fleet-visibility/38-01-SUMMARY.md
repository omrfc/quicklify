---
phase: 38-fleet-visibility
plan: 01
subsystem: fleet
tags: [p-limit, promise-allsettled, ssh-health, audit-history, commander, chalk]

requires:
  - phase: 36-notification-module
    provides: notify.ts pattern for core module + thin command wrapper
  - phase: 37-doctor-fix
    provides: clean core/ structure with no commands/ imports

provides:
  - src/core/health.ts — checkServerHealth extracted from commands/ (HealthResult interface)
  - src/core/fleet.ts — runFleet with p-limit(5) parallel probing, sortRows, getLatestAuditScore
  - src/commands/fleet.ts — thin CLI wrapper with --json and --sort flags
  - FleetRow and FleetOptions types in src/types/index.ts
  - 20 new tests (fleet.test.ts + health-core.test.ts)

affects: [38-02-mcp-fleet, 39-guard-notify, 40-shell-completions]

tech-stack:
  added: [p-limit@6.x]
  patterns: [p-limit(5)+Promise.allSettled for parallel SSH, core re-export bridge from commands/]

key-files:
  created:
    - src/core/health.ts
    - src/core/fleet.ts
    - src/commands/fleet.ts
    - tests/unit/fleet.test.ts
    - tests/unit/health-core.test.ts
    - tests/__mocks__/p-limit.cjs
  modified:
    - src/commands/health.ts
    - src/types/index.ts
    - src/index.ts
    - jest.config.cjs
    - package.json

key-decisions:
  - "checkServerHealth moved to core/health.ts; commands/health.ts re-exports for backward compat — re-export bridge pattern (Phase 34 precedent)"
  - "p-limit pure ESM requires CJS mock in tests/__mocks__/p-limit.cjs mapped in jest.config.cjs"
  - "jest.resetAllMocks() in beforeEach clears mock implementations — re-setup createSpinner+isBareServer+sshExec in beforeEach after reset"
  - "FleetRow status: healthy=ONLINE, unhealthy=DEGRADED, unreachable/host-key-mismatch=OFFLINE"
  - "sortRows falls back to 'name' for unknown fields — defensive sort, validated inside sortRows not at call site"

patterns-established:
  - "Core health probe pattern: checkServerHealth in core/, commands/ thin wrapper re-exports"
  - "Fleet aggregation: p-limit(5) + Promise.allSettled — rejected tasks become OFFLINE rows"
  - "ESM package mock: use .cjs manual mock mapped via moduleNameMapper in jest.config.cjs"

requirements-completed: [FLEET-01, FLEET-02, FLEET-03, FLEET-04]

duration: 30min
completed: 2026-03-14
---

# Phase 38 Plan 01: Fleet Core + CLI Command Summary

**`kastell fleet` command with p-limit(5) parallel SSH probing, cached audit scores, table/JSON output, and sort options — FLEET-01 through FLEET-04 satisfied**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-03-14T19:48:32Z
- **Completed:** 2026-03-14T20:18:00Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Extracted `checkServerHealth` from commands/ to `src/core/health.ts` with backward-compat re-export in commands/health.ts
- Built `src/core/fleet.ts` with `runFleet` (p-limit(5) + Promise.allSettled), `sortRows`, `getLatestAuditScore`
- Added `src/commands/fleet.ts` thin wrapper with `--json` and `--sort` options, registered in index.ts
- Added 20 new tests (15 fleet + 5 health-core), full suite 3131 tests green

## Task Commits

1. **Task 1: Extract checkServerHealth to core/ and build fleet core module** - `6b4a91f` (feat)
2. **Task 2: CLI fleet command wrapper and index.ts registration** - `89c6c0a` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/core/health.ts` - checkServerHealth and HealthResult (extracted from commands/)
- `src/core/fleet.ts` - runFleet, sortRows, getLatestAuditScore core logic
- `src/commands/fleet.ts` - thin Commander wrapper (--json, --sort)
- `src/commands/health.ts` - now imports from core/health.ts + re-exports for backward compat
- `src/types/index.ts` - FleetRow and FleetOptions interfaces added
- `src/index.ts` - fleetCommand registration after notifyCommand
- `tests/unit/fleet.test.ts` - 15 tests covering runFleet, sortRows, getLatestAuditScore
- `tests/unit/health-core.test.ts` - 5 tests verifying core/health.ts exports
- `tests/__mocks__/p-limit.cjs` - CJS pass-through mock for p-limit ESM package
- `jest.config.cjs` - added p-limit moduleNameMapper entry
- `package.json` / `package-lock.json` - p-limit dependency

## Decisions Made

- p-limit is pure ESM; requires a `.cjs` mock file mapped via `moduleNameMapper` in jest.config.cjs. The existing `.ts` mock pattern doesn't work because the file gets loaded before ts-jest transform when mapped as a module.
- `jest.resetAllMocks()` in `beforeEach` resets all mock implementations, not just call counts. Mock factories (createSpinner, isBareServer) need to be re-initialized in `beforeEach` after reset.
- `sortRows` handles unknown field fallback internally — no need to validate at call site in `runFleet`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added p-limit CJS mock for Jest ESM incompatibility**
- **Found during:** Task 1 (fleet test execution)
- **Issue:** p-limit@6 is pure ESM; Jest with CJS transform cannot parse `import` statements in node_modules
- **Fix:** Created `tests/__mocks__/p-limit.cjs` with pass-through limiter; added moduleNameMapper entry in jest.config.cjs
- **Files modified:** tests/__mocks__/p-limit.cjs, jest.config.cjs
- **Verification:** All 15 fleet tests pass
- **Committed in:** 6b4a91f (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed jest.resetAllMocks() clearing mock implementations**
- **Found during:** Task 1 (health-core and fleet tests)
- **Issue:** `jest.resetAllMocks()` in `beforeEach` cleared `createSpinner`, `isBareServer`, and `isHostKeyMismatch` implementations, causing crashes and wrong test behavior
- **Fix:** Move mock implementations to `beforeEach` setup after reset call; import `createSpinner` and `modeGuard` explicitly to re-setup
- **Files modified:** tests/unit/fleet.test.ts, tests/unit/health-core.test.ts
- **Verification:** All tests pass with correct behavior
- **Committed in:** 6b4a91f (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes essential for test infrastructure. No scope creep.

## Issues Encountered

- `commands/health.ts` re-export broke the file's internal reference to `checkServerHealth` — required adding explicit local import before the re-export. Fixed immediately (Rule 3).

## Next Phase Readiness

- Core fleet module complete — `runFleet` ready to be called from MCP tool in phase 38-02
- No blockers; all 3131 tests green, build clean
- `kastell fleet --help` shows correct options: `--json` and `--sort <field>`

## Self-Check: PASSED

- src/core/health.ts: FOUND
- src/core/fleet.ts: FOUND
- src/commands/fleet.ts: FOUND
- Commit 6b4a91f: FOUND
- Commit 89c6c0a: FOUND

---
*Phase: 38-fleet-visibility*
*Completed: 2026-03-14*
