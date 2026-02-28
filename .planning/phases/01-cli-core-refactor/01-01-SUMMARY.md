---
phase: 01-cli-core-refactor
plan: "01"
subsystem: shared-constants
tags: [constants, types, refactor, dry]
dependency_graph:
  requires: []
  provides: [src/constants.ts, QuicklifyResult<T>]
  affects: [src/commands/init.ts, src/core/provision.ts, src/commands/maintain.ts, src/commands/update.ts, src/core/maintain.ts, src/commands/status.ts, src/core/domain.ts, src/types/index.ts]
tech_stack:
  added: []
  patterns: [Single source of truth for constants, Result<T> pattern for core/ functions]
key_files:
  created: [src/constants.ts]
  modified: [src/types/index.ts, src/commands/init.ts, src/core/provision.ts, src/commands/maintain.ts, src/commands/update.ts, src/core/maintain.ts, src/commands/status.ts, src/core/domain.ts]
decisions:
  - "Centralized all 10 shared constants (IP_WAIT, COOLIFY_MIN_WAIT, BOOT_MAX_ATTEMPTS, BOOT_INTERVAL, COOLIFY_UPDATE_CMD, COOLIFY_RESTART_CMD, COOLIFY_SOURCE_DIR, COOLIFY_DB_CONTAINER, COOLIFY_DB_USER, COOLIFY_DB_NAME) into src/constants.ts"
  - "QuicklifyResult<T = void> uses generic T for data field — allows typed return values in subsequent plans while remaining backward-compatible with existing domain-specific result types"
metrics:
  duration: 4m24s
  completed_date: "2026-02-28"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 9
requirements_satisfied: [REF-02, REF-03, REF-04, REF-05]
---

# Phase 1 Plan 01: Constants Extraction and Result Type Summary

**One-liner:** Centralized 10 duplicated constants into `src/constants.ts` and added `QuicklifyResult<T>` generic Result type to `src/types/index.ts` as foundation for subsequent refactoring plans.

## What Was Built

### src/constants.ts (new)

Single source of truth for all shared constants previously duplicated across commands/ and core/:

- `IP_WAIT` — provider-specific IP assignment wait config (was in init.ts and provision.ts)
- `COOLIFY_MIN_WAIT` — provider-specific Coolify health check delay (was in init.ts)
- `BOOT_MAX_ATTEMPTS`, `BOOT_INTERVAL` — server boot polling config (was in provision.ts)
- `COOLIFY_UPDATE_CMD` — Coolify install script curl command (was in commands/maintain.ts, commands/update.ts, core/maintain.ts)
- `COOLIFY_RESTART_CMD` — Docker compose restart command (was in commands/status.ts)
- `COOLIFY_SOURCE_DIR`, `COOLIFY_DB_CONTAINER`, `COOLIFY_DB_USER`, `COOLIFY_DB_NAME` — Coolify DB/path constants (was in core/domain.ts)

### src/types/index.ts (modified)

Added `QuicklifyResult<T>` generic Result type at end of file:

```typescript
export interface QuicklifyResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  hint?: string;
}
```

This implements the architectural decision: "Result pattern kullanılacak ({ success: boolean, data?, error? }) — exception fırlatılmayacak". Subsequent plans will use this type when refactoring core/ functions.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | a310e22 | feat(01-01): extract shared constants to src/constants.ts |
| Task 2 | 3e1a1cd | feat(01-01): add QuicklifyResult<T> generic type to src/types/index.ts |

## Verification Results

- `npm run build` — PASSED (TypeScript compilation clean)
- `npm test` — PASSED (1758/1758 tests, 64 suites)
- `grep -r "const IP_WAIT" src/` — Only `src/constants.ts`
- `grep -r "const COOLIFY_UPDATE_CMD" src/` — Only `src/constants.ts`
- `grep -r "const COOLIFY_RESTART_CMD" src/` — Only `src/constants.ts`
- `QuicklifyResult` exported from `src/types/index.ts` at line 140

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/constants.ts` exists: FOUND
- `src/types/index.ts` contains `QuicklifyResult`: FOUND (line 140)
- Commit a310e22: FOUND
- Commit 3e1a1cd: FOUND
- All 10 constants in constants.ts: VERIFIED
- No local duplicates in any consumer file: VERIFIED
- Zero test regressions: VERIFIED (1758/1758)
