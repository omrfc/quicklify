---
phase: 02-bare-mode
plan: 02
subsystem: infra
tags: [typescript, bare-mode, cloud-init, provisioning, cli]

# Dependency graph
requires:
  - phase: 02-01
    provides: ServerMode type, getBareCloudInit(), InitOptions.mode, mode guard utilities
  - phase: 01-cli-core-refactor
    provides: Clean CLI/core architecture, ProvisionConfig, AddServerParams interfaces
provides:
  - provisionServer() with mode-aware cloud-init selection (bare vs coolify)
  - ServerRecord saved with mode field in both provision and add flows
  - initCommand with mode='bare' path (no waitForCoolify, no openBrowser, shows SSH info)
  - addServerRecord with mode='bare' path (skips Coolify SSH verification)
  - --mode flag on both init and add CLI commands
affects: [02-03-PLAN.md, 02-04-PLAN.md, status command, backup command, MCP server provision]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mode-aware cloud-init: mode === 'bare' ? getBareCloudInit() : getCoolifyCloudInit()"
    - "Mode saved to ServerRecord in all provision/add paths"
    - "Bare init early-return: after server save, show SSH info and return (skip Coolify flow)"
    - "Bare add: mode guard before Coolify SSH verification block"
    - "TDD: RED (test) -> GREEN (impl) per task, each committed atomically"

key-files:
  created:
    - tests/unit/provision-bare.test.ts
    - tests/unit/init-bare.test.ts
    - tests/unit/manage-bare.test.ts
    - tests/unit/add-bare.test.ts
  modified:
    - src/core/provision.ts
    - src/commands/init.ts
    - src/core/manage.ts
    - src/commands/add.ts
    - src/index.ts

key-decisions:
  - "deployServer() in init.ts takes mode as string param (not ServerMode type) to avoid import cycle — cast at use site"
  - "Bare init early-return pattern: saves server record then returns immediately after SSH info display (no shared success block refactor needed)"
  - "addServerRecord mode guard placed before SSH block, not inside skipVerify check — bare mode is architecturally distinct from skip-verify"
  - "--mode option added to both init and add commands; add command description updated from 'Coolify server' to 'server'"

patterns-established:
  - "Mode propagation: thread mode from CLI options -> command function -> core function -> ServerRecord"
  - "Bare mode short-circuit: check isBare early, skip Coolify-specific logic, return with SSH output"

requirements-completed: [BARE-01]

# Metrics
duration: 7m43s
completed: 2026-02-28
---

# Phase 02 Plan 02: Bare Mode Provisioning and Add Commands Summary

**`quicklify init --mode bare` and `quicklify add --mode bare` implemented — bare servers provision without Coolify, skip health checks and browser, save mode:'bare' to ServerRecord**

## Performance

- **Duration:** 7m43s
- **Started:** 2026-02-28T07:32:16Z
- **Completed:** 2026-02-28T07:39:59Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 9

## Accomplishments
- Added `mode` to `ProvisionConfig` interface; `provisionServer()` now selects `getBareCloudInit` vs `getCoolifyCloudInit` based on mode
- `provisionServer()` saves `mode` field on `ServerRecord` (coolify by default for backward compat)
- `initCommand` threads `mode` through `deployServer()` — bare path skips `waitForCoolify`, skips `openBrowser`, shows SSH connection info
- Added `mode` to `AddServerParams`; `addServerRecord()` skips Coolify SSH verification entirely when `mode='bare'`
- `addCommand` threads `mode` to core, uses mode-aware default name prompt (`bare-server` vs `coolify-server`)
- `--mode <mode>` option registered on both `init` and `add` CLI commands in `index.ts`
- Added 20 new tests (1781 → 1801 total), all passing; coverage maintained at 95.77% statements

## Task Commits

Each task was committed atomically:

1. **Task 1: Add bare mode to provisioning (core + CLI init + index.ts)** - `69005d2` (feat)
2. **Task 2: Add bare mode to add command (core manage + CLI add + index.ts)** - `0f7c5d3` (feat)

_Note: All tasks followed TDD pattern (RED failing test -> GREEN implementation)_

## Files Created/Modified
- `src/core/provision.ts` - Added mode to ProvisionConfig; mode-aware cloud-init selection; mode saved to ServerRecord
- `src/commands/init.ts` - Import getBareCloudInit; thread mode through deployServer(); bare mode early-return with SSH info
- `src/core/manage.ts` - Added mode to AddServerParams; skip Coolify verification for bare mode; mode saved to ServerRecord
- `src/commands/add.ts` - Added mode to AddOptions; pass mode to addServerRecord; mode-aware default name prompt
- `src/index.ts` - Register --mode option on both init and add commands
- `tests/unit/provision-bare.test.ts` - NEW: 6 tests for bare mode cloud-init selection and ServerRecord mode field
- `tests/unit/init-bare.test.ts` - NEW: 6 tests for init bare mode (no waitForCoolify, no openBrowser, SSH info, saveServer with mode)
- `tests/unit/manage-bare.test.ts` - NEW: 4 tests for addServerRecord bare mode (skip verification, mode:'bare' saved)
- `tests/unit/add-bare.test.ts` - NEW: 4 tests for addCommand bare mode (mode passed through, success output)

## Decisions Made
- `deployServer()` takes `mode` as `string` (not `ServerMode`) to avoid tightening the function signature unnecessarily — cast via `mode === "bare"` boolean
- Bare init uses early-return pattern after saving server — simpler than adding mode conditionals to the existing Coolify success block
- `addServerRecord` mode guard is before the SSH block (not nested inside `skipVerify`) because bare mode is architecturally distinct from verification-skipping
- `add` command description updated from "Add an existing Coolify server..." to "Add an existing server..." to reflect bare mode support

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `quicklify init --mode bare` and `quicklify add --mode bare` fully functional
- Both commands save `mode:'bare'` to `ServerRecord` — Plans 02-03 and 02-04 can read mode field to gate Coolify-specific commands
- `requireCoolifyMode()` from Plan 01 is ready for Plans 02-03/02-04 to use as command guard
- All 1801 tests passing, coverage at 95.77% statements / 85.93% branches

## Self-Check: PASSED

- src/core/provision.ts: FOUND
- src/commands/init.ts: FOUND
- src/core/manage.ts: FOUND
- src/commands/add.ts: FOUND
- src/index.ts: FOUND
- tests/unit/provision-bare.test.ts: FOUND
- tests/unit/init-bare.test.ts: FOUND
- tests/unit/manage-bare.test.ts: FOUND
- tests/unit/add-bare.test.ts: FOUND
- Commit 69005d2: FOUND
- Commit 0f7c5d3: FOUND

---
*Phase: 02-bare-mode*
*Completed: 2026-02-28*
