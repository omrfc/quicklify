---
phase: 28-lock
plan: "02"
subsystem: commands/lock
tags: [lock, cli, command, tdd, hardening]
dependency_graph:
  requires:
    - src/core/lock.ts (applyLock, LockResult, LockOptions — Plan 01)
    - src/utils/serverSelect.ts (resolveServer)
    - src/utils/ssh.ts (checkSshAvailable)
    - src/utils/logger.ts (logger, createSpinner)
  provides:
    - src/commands/lock.ts (lockCommand)
    - src/index.ts (lock command registration)
  affects:
    - CLI: kastell lock [query] --production --dry-run --force
tech_stack:
  added: []
  patterns:
    - TDD (RED → GREEN)
    - Thin command wrapper pattern (commands/ delegates to core/)
    - Production flag guard (safety gate for destructive ops)
    - Per-step result display
    - Audit score delta display
key_files:
  created:
    - src/commands/lock.ts
    - tests/unit/lock-command.test.ts
  modified:
    - src/index.ts
decisions:
  - Pass server.platform (not server.mode) to applyLock — Platform is "coolify"|"dokploy", ServerMode is "coolify"|"bare"
  - Confirmation prompt skipped for --force; not tested directly (integration-level concern per plan spec)
  - spinner.stop() used instead of spinner.succeed/fail — overall success/failure reported via logger
metrics:
  duration: "210s"
  completed_date: "2026-03-14"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
requirements_completed: [LOCK-01, LOCK-05]
---

# Phase 28 Plan 02: Lock CLI Command Summary

**One-liner:** Thin `lockCommand` wrapper with --production guard, spinner UX, per-step result display, and audit score delta, registered as `kastell lock [query]` in the CLI entry point.

## What Was Built

### src/commands/lock.ts

Exports `lockCommand(query, options)` — the thin CLI layer:

1. **Production flag guard** — returns early with error if `--production` not set
2. **SSH availability check** — returns early if `checkSshAvailable()` is false
3. **Server resolution** — calls `resolveServer(query, "Select a server to lock:")`
4. **Dry-run path** — calls `applyLock` with `dryRun: true`, no spinner
5. **Confirmation prompt** — inquirer confirm dialog (skipped with `--force`)
6. **Spinner UX** — ora spinner during `applyLock` execution
7. **Per-step display** — 5 steps shown as success/error with `logger.success`/`logger.error`
8. **Audit score delta** — `"Audit score: {before} -> {after} (+/-{delta})"` when both scores present
9. **Overall result** — success or error message

### src/index.ts

Lock command registered with Commander.js:
```
kastell lock [query]
  --production   Apply all hardening measures (SSH, fail2ban, UFW, sysctl, auto-updates)
  --dry-run      Preview changes without applying
  --force        Skip confirmation prompt
```

### tests/unit/lock-command.test.ts

13 unit tests covering:
- No `--production` flag: logger.error, applyLock not called
- SSH not available: logger.error, applyLock not called
- Server not found: applyLock not called
- `--dry-run`: applyLock called with `dryRun: true`, no spinner
- `--force`: applyLock called directly without prompt
- Successful lock: spinner used, all 5 step results displayed, score delta displayed
- Failed lock: error message from result.error displayed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] server.mode vs server.platform type mismatch**
- **Found during:** Task 1 GREEN phase (TypeScript compile error)
- **Issue:** Plan specified passing `server.mode` to `applyLock`, but `applyLock` takes `Platform | undefined`. `ServerMode` is `"coolify" | "bare"` while `Platform` is `"coolify" | "dokploy"` — `"bare"` is not assignable to `Platform`
- **Fix:** Changed to pass `server.platform` (optional field, undefined for bare servers — correct behavior)
- **Files modified:** src/commands/lock.ts, tests/unit/lock-command.test.ts
- **Commit:** c62c2c6

## Self-Check: PASSED

- src/commands/lock.ts: FOUND
- tests/unit/lock-command.test.ts: FOUND
- src/index.ts: modified with lock registration — FOUND
- Commit c4b3c4c (RED tests): FOUND
- Commit c62c2c6 (GREEN implementation): FOUND
- Commit 8beef50 (CLI registration): FOUND
- All 13 lock-command tests pass
- Full test suite: 2733 tests pass (126 suites)
- Build: clean
- Lint: clean
- `kastell lock --help` shows --production, --dry-run, --force options
