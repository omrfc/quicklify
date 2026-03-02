---
phase: 04-provider-utility-consolidation
plan: 02
subsystem: infra
tags: [typescript, providers, refactor, security, axios]

# Dependency graph
requires: []
provides:
  - "src/providers/base.ts exports stripSensitiveData as named export"
  - "All 4 provider files import stripSensitiveData from base.ts instead of defining locally"
affects: [phase-05-scp-security, phase-06-deploy-extract]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Shared utility functions placed in base.ts for provider-level reuse"]

key-files:
  created: []
  modified:
    - src/providers/base.ts
    - src/providers/hetzner.ts
    - src/providers/digitalocean.ts
    - src/providers/vultr.ts
    - src/providers/linode.ts

key-decisions:
  - "stripSensitiveData moved to base.ts with axios import — base.ts is now a module with runtime dependency, not purely an interface file"
  - "Combined type+value import into single ESM statement: import { stripSensitiveData, type CloudProvider } from './base.js'"

patterns-established:
  - "Shared provider utilities belong in base.ts, imported by all providers"

requirements-completed: [REF-02]

# Metrics
duration: 3min
completed: 2026-03-02
---

# Phase 04 Plan 02: stripSensitiveData Consolidation Summary

**Security utility `stripSensitiveData` deduplicated from 4 provider files into a single export in `base.ts`, eliminating copy-paste drift risk for axios error header/token stripping.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-02T07:02:36Z
- **Completed:** 2026-03-02T07:05:00Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- Added `import axios from "axios"` and `export function stripSensitiveData` to `src/providers/base.ts`
- Removed the 9-line local `function stripSensitiveData` block from all 4 provider files (hetzner, digitalocean, vultr, linode)
- Updated all 4 provider imports to use `import { stripSensitiveData, type CloudProvider } from "./base.js"`
- All 2047 tests pass; TypeScript compiles clean; ESLint zero warnings; build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Add stripSensitiveData to base.ts and update all providers** - `8b2af50` (refactor)

**Plan metadata:** (pending — added in final commit)

## Files Created/Modified

- `src/providers/base.ts` — Added `import axios from "axios"` and exported `stripSensitiveData` function after the `CloudProvider` interface
- `src/providers/hetzner.ts` — Removed local function definition; updated import to include `stripSensitiveData` from `./base.js`
- `src/providers/digitalocean.ts` — Removed local function definition; updated import to include `stripSensitiveData` from `./base.js`
- `src/providers/vultr.ts` — Removed local function definition; updated import to include `stripSensitiveData` from `./base.js`
- `src/providers/linode.ts` — Removed local function definition; updated import to include `stripSensitiveData` from `./base.js`

## Decisions Made

- `base.ts` transitions from a pure interface file to a module with a runtime axios dependency — this is intentional; base.ts is the natural home for shared provider utilities
- Single ESM import statement style chosen: `import { stripSensitiveData, type CloudProvider }` rather than two separate import lines

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 04-02 complete; `base.ts` now provides both the `CloudProvider` interface and the `stripSensitiveData` utility
- Phase 5 (SCP Security Hardening) can proceed independently
- Phase 6 (init.ts Extract) depends on Phase 4 being complete — Phase 4 is now complete after 04-01 and 04-02

## Self-Check: PASSED

- All 5 provider files found on disk
- Commit `8b2af50` verified in git log
- `grep -rn 'function stripSensitiveData' src/providers/` returns exactly 1 match: `src/providers/base.ts:31`
- All 4 providers confirmed importing `stripSensitiveData` from `./base.js`
- 2047 tests pass, TypeScript compiles clean, ESLint 0 warnings, build succeeds

---
*Phase: 04-provider-utility-consolidation*
*Completed: 2026-03-02*
