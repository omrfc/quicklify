---
phase: quick
plan: "3"
subsystem: ux-improvements
tags: [ux, error-handling, backup, restore, domain, firewall, dpkg-lock]
dependency-graph:
  requires: []
  provides: [UX-3, UX-4, UX-9, UX-10, UX-11, UX-12]
  affects: [backup, restore, destroy, remove, domain, firewall, init]
tech-stack:
  added: []
  patterns:
    - SSH error pattern matching for dpkg lock
    - Token source tracking variable
    - UFW rule parsing via parseUfwStatus()
    - Backup orphan detection via directory scan
    - Cross-provider and mode-mismatch validation for restore
key-files:
  created: []
  modified:
    - src/utils/errorMapper.ts
    - src/commands/init.ts
    - src/commands/firewall.ts
    - src/commands/domain.ts
    - src/core/backup.ts
    - src/commands/backup.ts
    - src/commands/restore.ts
    - src/commands/destroy.ts
    - src/commands/remove.ts
    - tests/unit/errorMapper.test.ts
    - tests/unit/firewall.test.ts
    - tests/unit/domain.test.ts
    - tests/unit/backup.test.ts
    - tests/unit/restore.test.ts
    - tests/unit/destroy.test.ts
decisions:
  - "Orphan backup cleanup implemented as a 'cleanup' subcommand of backup, not a separate top-level command"
  - "Cross-provider restore is a warning (informational) not a hard block; mode mismatch is a hard block"
  - "Backup cleanup prompt added to both destroy and remove commands at the right success exit points"
metrics:
  duration: ~65 minutes
  completed: "2026-03-01"
  tasks-completed: 3
  files-modified: 13
---

# Phase quick Plan 3: UX Improvements (6 fixes) Summary

Six UX improvements shipped: dpkg lock SSH error message, token source display in init, firewall status rule listing, domain info subcommand, orphan backup cleanup command with destroy/remove prompts, and backup/restore provider+IP display with mode mismatch enforcement.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | UX #3+#4+#9+#10 — errorMapper, init, firewall, domain | 0bdd7b7 | errorMapper.ts, init.ts, firewall.ts, domain.ts + 3 test files |
| 2 | UX #11+#12 — backup cleanup, restore validation, destroy/remove prompts | 0cd5e66 | core/backup.ts, backup.ts, restore.ts, destroy.ts, remove.ts + 3 test files |
| 3 | Full test suite + build verification | (no commit — verification only) | — |

## Changes Summary

### UX #3: dpkg Lock Error Message (errorMapper.ts)

Added pattern before "command not found" in `SSH_ERROR_PATTERNS`:

```typescript
{
  pattern: /dpkg.*lock|locked.*dpkg|Could not get lock/i,
  message: () =>
    "Server is still initializing (dpkg lock active). Wait 1-2 minutes and retry.",
},
```

Users now get a clear retry message instead of raw SSH output when cloud-init is still running.

### UX #4: Token Source Display (init.ts)

Added `tokenSource` variable that captures "from --token flag", "from HETZNER_TOKEN env var" (or provider-specific), or "from interactive prompt". The spinner success message now reads:

```
API token validated (from HETZNER_TOKEN env var)
```

### UX #9: Firewall Status Shows Rules (firewall.ts)

Replaced `firewallStatusCheck` to use `buildUfwStatusCommand()` and `parseUfwStatus()`. When UFW is active, lists all open ports with port/protocol/action/from columns. When no rules configured, says "No rules configured."

### UX #10: Domain Info Subcommand (domain.ts)

Added `"info"` to `validSubcommands`, added `domainInfo()` function that SSH-executes `buildGetFqdnCommand()`, parses FQDN via `parseFqdn()`, and displays: server name+IP, FQDN or "not set", SSL status, URL (FQDN or `http://IP:8000`).

### UX #11: Orphan Backup Cleanup (backup.ts, core/backup.ts, destroy.ts, remove.ts)

- `listOrphanBackups(activeServerNames)` — scans BACKUPS_DIR for subdirectories not in active server list
- `cleanupServerBackups(serverName)` — rmSync recursive delete of server backup directory
- `backupCleanupCommand()` — gets active server names, finds orphans, prompts user to confirm, deletes
- `backup cleanup` subcommand: detected in `backupCommand()` before SSH checks
- `destroy.ts`: `promptBackupCleanup()` called after cloudDeleted path and not-found-on-provider path
- `remove.ts`: inline backup cleanup prompt after local config removal

### UX #12: Provider/IP Display in Backup/Restore (backup.ts, restore.ts)

- Backup success now logs: `Provider: hetzner | IP: 1.2.3.4 | Mode: coolify`
- Restore backup selection shows `[hetzner]` or `[hetzner/bare]` suffix from manifest
- Cross-provider restore shows warning (informational, does not block)
- Mode mismatch (coolify↔bare) is a hard block: "Cannot restore across modes."

## Verification

- **Full test suite**: 1968 tests, 74 suites — all passed
- **TypeScript build**: `tsc` completed without errors
- **ESLint**: no lint errors in `src/`
- **New tests added**: 14 new test cases across backup, restore, destroy, domain, firewall, errorMapper

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript error in backup.test.ts mock assignment**
- **Found during:** Task 2 test verification
- **Issue:** `(inquirer.prompt as jest.Mock) = jest.fn()...` causes TS2352 because the cast is not safe — the types don't sufficiently overlap for direct reassignment
- **Fix:** Added `jest.mock("inquirer")` at top of backup.test.ts and `const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>` typed variable; changed mock assignments to `mockedInquirer.prompt.mockResolvedValue(...)` pattern — consistent with all other test files
- **Files modified:** tests/unit/backup.test.ts
- **Commit:** 0cd5e66 (included in Task 2 commit)

## Self-Check: PASSED

- `0bdd7b7` exists: FOUND
- `0cd5e66` exists: FOUND
- `src/utils/errorMapper.ts` modified: FOUND
- `src/commands/domain.ts` modified: FOUND
- `src/core/backup.ts` modified: FOUND
- `src/commands/destroy.ts` modified: FOUND
- 1968 tests passed: CONFIRMED
- Build clean: CONFIRMED
