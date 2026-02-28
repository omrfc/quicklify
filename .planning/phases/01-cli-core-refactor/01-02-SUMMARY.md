---
phase: 01-cli-core-refactor
plan: 02
subsystem: cli
tags: [typescript, refactor, commands, core, secure, firewall, domain]

# Dependency graph
requires:
  - phase: 01-cli-core-refactor
    plan: 01
    provides: "src/constants.ts with COOLIFY_DB_CONTAINER and other shared constants"
provides:
  - "commands/secure.ts as thin CLI wrapper — pure functions imported from core/secure.ts"
  - "commands/firewall.ts as thin CLI wrapper — pure functions imported from core/firewall.ts"
  - "commands/domain.ts as thin CLI wrapper — pure functions imported from core/domain.ts"
affects: [01-03, 01-04, 01-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Import-then-re-export pattern: commands/ import from core/ and re-export for backward compatibility"
    - "CLI commands are thin wrappers: only CLI-specific code (prompts, spinners, output) in commands/"

key-files:
  created: []
  modified:
    - src/commands/secure.ts
    - src/commands/firewall.ts
    - src/commands/domain.ts

key-decisions:
  - "Re-export pure functions from commands/ for backward test compatibility rather than updating test imports"
  - "Import COOLIFY_DB_CONTAINER from constants.ts in commands/domain.ts (for container name string matching in domainAdd)"

patterns-established:
  - "Import + re-export pattern: `import { X } from core/...; export { X };` keeps local scope AND public API intact"
  - "Unused type imports removed when function bodies that used those types are extracted to core/"

requirements-completed: [REF-01, REF-03, REF-04, REF-05]

# Metrics
duration: 6m7s
completed: 2026-02-28
---

# Phase 01 Plan 02: Secure/Firewall/Domain Command Deduplication Summary

**Eliminated 100% of duplicated pure functions across commands/secure.ts, commands/firewall.ts, and commands/domain.ts by importing from their core/ counterparts — removing 22 duplicate function/constant definitions in 3 files**

## Performance

- **Duration:** 6m7s
- **Started:** 2026-02-28T06:02:04Z
- **Completed:** 2026-02-28T06:08:12Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Removed 6 pure function definitions from commands/secure.ts (imported from core/secure.ts)
- Removed 8 pure function/constant definitions from commands/firewall.ts (imported from core/firewall.ts)
- Removed 4 local constants and 9 pure function definitions from commands/domain.ts (imported from core/domain.ts + constants.ts)
- All 1758 tests continue to pass across 64 suites

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor commands/secure.ts** - `6c5232e` (refactor)
2. **Task 2: Refactor commands/firewall.ts** - `4b5c657` (refactor)
3. **Task 3: Refactor commands/domain.ts** - `58912e5` (refactor)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `src/commands/secure.ts` - Removed 6 locally-defined pure functions; now imports+re-exports from core/secure.ts
- `src/commands/firewall.ts` - Removed 8 locally-defined constants/pure functions; now imports+re-exports from core/firewall.ts
- `src/commands/domain.ts` - Removed 4 constants and 9 pure functions; now imports from core/domain.ts and constants.ts

## Decisions Made
- **Re-export pattern instead of updating tests:** Tests import pure functions from commands/ (e.g., `import { parseSshdConfig } from "../../src/commands/secure"`). Rather than updating all test imports, used `import { X } from core; export { X };` to maintain the public API of command files. This is the correct approach — tests are contracts, not internals.
- **COOLIFY_DB_CONTAINER import from constants.ts:** The `domainAdd` function in commands/domain.ts uses `COOLIFY_DB_CONTAINER` for a stdout string check (`checkResult.stdout.includes(COOLIFY_DB_CONTAINER)`). This constant was imported from `../constants.js` (where plan 01-01 centralized it) rather than duplicating it locally again.
- **Removed unused type imports:** After removing pure function bodies from command files, the `import type { SshdSetting, SecureAuditResult }` in commands/secure.ts became unused and was removed to keep the file clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Re-export pure functions from command files for backward test compatibility**
- **Found during:** Task 1 (Refactor commands/secure.ts)
- **Issue:** Test file `tests/unit/secure.test.ts` imports `parseSshdConfig`, `parseAuditResult`, `buildHardeningCommand`, `buildFail2banCommand`, `buildAuditCommand`, `buildKeyCheckCommand` directly from `commands/secure`. After removing these definitions, the test suite failed with TS2459 "declared locally but not exported" errors.
- **Fix:** Added `export { parseSshdConfig, parseAuditResult, ... };` after the import statement in each command file, re-exporting the names from core/. Same pattern applied to firewall and domain.
- **Files modified:** src/commands/secure.ts, src/commands/firewall.ts, src/commands/domain.ts
- **Verification:** All 1758 tests pass after the fix
- **Committed in:** `6c5232e`, `4b5c657`, `58912e5` (included in task commits)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing backward-compatibility re-exports)
**Impact on plan:** Auto-fix essential for test suite integrity. No scope creep — re-exports are the idiomatic way to maintain a public API while delegating implementation to core/.

## Issues Encountered
- None beyond the re-export deviation above.

## Next Phase Readiness
- commands/secure.ts, commands/firewall.ts, commands/domain.ts are now thin wrappers — zero locally-defined pure functions
- Pattern established: commands/ = CLI concerns only (prompts, spinners, output formatting); core/ = pure logic
- Ready for plan 01-03: refactor add/destroy/health/restart commands to use core/

---
*Phase: 01-cli-core-refactor*
*Completed: 2026-02-28*
