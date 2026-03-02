---
phase: 06-init-ts-extract
plan: "01"
subsystem: core/deploy
tags: [refactor, extract, architecture]
dependency_graph:
  requires: [04-01]
  provides: [src/core/deploy.ts]
  affects: [src/commands/init.ts, tests/unit/init-bare.test.ts, tests/unit/init-fullsetup.test.ts]
tech_stack:
  added: []
  patterns: [commands-thin-wrapper, core-business-logic]
key_files:
  created:
    - src/core/deploy.ts
  modified:
    - src/commands/init.ts
decisions:
  - "deployServer() and uploadSshKeyToProvider() extracted verbatim — no logic changes, only import path adjustments"
  - "Cross-directory imports from core/ to commands/ use ../commands/firewall.js and ../commands/secure.js"
  - "Jest mocks in test files (../../src/commands/firewall etc.) continue to work unchanged because they resolve to the same module"
  - "createSpinner kept in init.ts imports because tokenSpinner is used in initCommand()"
metrics:
  duration: "~5 min"
  completed: "2026-03-02"
  tasks_completed: 2
  files_modified: 2
---

# Phase 6 Plan 01: init.ts Extract Summary

**One-liner:** Extracted deployServer() and uploadSshKeyToProvider() (~360 lines) from src/commands/init.ts into new src/core/deploy.ts as named exports, reducing init.ts from 612 to 243 lines while preserving all test behavior.

## What Was Built

New `src/core/deploy.ts` module containing:
- `uploadSshKeyToProvider(provider: CloudProvider): Promise<string[]>` — finds/generates SSH key, uploads to provider, returns key IDs
- `deployServer(providerChoice, providerWithToken, region, serverSize, serverName, fullSetup?, noOpen?, mode?): Promise<void>` — full deployment logic: SSH key upload, VPS creation with retry loop (name conflict, location disabled, type unavailable), boot wait, IP wait, Coolify health check, server record save, bare mode cloud-init wait, full-setup (firewall + secure), success output with onboarding steps

Updated `src/commands/init.ts`:
- Reduced from 612 to 243 lines (60% reduction)
- Now a thin wizard wrapper: YAML config loading, template validation, provider selection, token resolution/validation, interactive region/size/name navigation with back-navigation loop, confirmation dialog, then delegates to `deployServer()`
- Both existing call sites to `deployServer()` unchanged (lines 199 and 232)

## Verification Results

All success criteria met:

| Check | Result |
|-------|--------|
| `wc -l src/commands/init.ts` | 243 lines (under 350) |
| `export async function deployServer` in deploy.ts | Found at line 51 |
| `export async function uploadSshKeyToProvider` in deploy.ts | Found at line 22 |
| `import { deployServer } from "../core/deploy.js"` in init.ts | Found at line 17 |
| 2 call sites to `deployServer()` in init.ts | Found at lines 199, 232 |
| TypeScript build | Clean (zero errors) |
| Test suite | 2060 passed, 76 suites, 0 failures |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: Create src/core/deploy.ts | e254964 | feat(06-01): create src/core/deploy.ts with extracted deployServer() and uploadSshKeyToProvider() |
| Task 2: Update src/commands/init.ts | 36b1cbc | refactor(06-01): slim down src/commands/init.ts to thin wizard wrapper |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

Files created:
- [x] `src/core/deploy.ts` — exists, 379 insertions

Files modified:
- [x] `src/commands/init.ts` — 243 lines, imports deployServer from ../core/deploy.js

Commits:
- [x] e254964 — feat(06-01): create src/core/deploy.ts
- [x] 36b1cbc — refactor(06-01): slim down src/commands/init.ts

## Self-Check: PASSED
