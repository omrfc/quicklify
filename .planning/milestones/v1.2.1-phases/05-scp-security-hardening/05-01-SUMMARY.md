---
phase: 05-scp-security-hardening
plan: "01"
subsystem: infra
tags: [scp, security, mcp, backup, timeout, child_process]

# Dependency graph
requires:
  - phase: 04-provider-utility-consolidation
    provides: constants.ts structure (SCP_TIMEOUT_MS added after BOOT_INTERVAL)
provides:
  - scpDownload() hardened with stdin=ignore, BatchMode=yes, 5-minute timeout
  - scpUpload() hardened with stdin=ignore, BatchMode=yes, 5-minute timeout
  - SCP_TIMEOUT_MS = 300_000 exported from src/constants.ts
affects:
  - 06-init-extract
  - any future backup/restore work touching core/backup.ts

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SCP spawn options: stdio=['ignore','pipe','pipe'] — stdin never inherited for MCP safety"
    - "SCP args: -o BatchMode=yes BEFORE -o StrictHostKeyChecking=accept-new"
    - "Timeout pattern: setTimeout + child.kill(SIGTERM) + reject; clearTimeout on close/error"
    - "TDD: fake timer + Promise.resolve() flush for testing async timeout rejection"

key-files:
  created: []
  modified:
    - src/constants.ts
    - src/core/backup.ts
    - tests/unit/core-backup.test.ts

key-decisions:
  - "Error message uses 'timeout' (not 'timed out') so /timeout/i regex matches correctly in tests"
  - "timeoutMs added as optional 4th parameter to scpDownload/scpUpload for testability — existing callers unaffected (use default)"
  - "clearTimeout called on both 'close' and 'error' events — prevents ghost timer firing after normal exit"
  - "Promise constructor semantics: resolve/reject after first call are no-ops — safe to register multiple event listeners"

patterns-established:
  - "Pattern: Fake timer timeout tests — use jest.useFakeTimers() + advanceTimersByTime() + await Promise.resolve() to flush microtasks before catching rejection"

requirements-completed:
  - SEC-01
  - SEC-02

# Metrics
duration: 7min
completed: 2026-03-02
---

# Phase 05 Plan 01: SCP Security Hardening Summary

**scpDownload/scpUpload hardened with stdin=ignore, BatchMode=yes, and 5-minute SIGTERM timeout to prevent MCP stream corruption and CLI hang on unreachable hosts**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-02T07:49:37Z
- **Completed:** 2026-03-02T07:56:05Z
- **Tasks:** 3 (TDD RED + GREEN + full suite verification)
- **Files modified:** 3

## Accomplishments
- SEC-01: stdin changed from "inherit" to "ignore" in both SCP functions — prevents MCP JSON-RPC stream corruption when SCP is spawned in MCP mode
- SEC-02: Added -o BatchMode=yes to both SCP arg arrays — prevents SCP from blocking on interactive prompts (password, host key) in non-interactive environments
- SEC-02: Added 300-second SIGTERM timeout with cleanup — prevents indefinite CLI hang when remote host becomes unreachable mid-transfer
- SCP_TIMEOUT_MS = 300_000 constant added to src/constants.ts and imported by backup.ts
- 8 new test assertions covering all three security properties; all 2060 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add SCP_TIMEOUT_MS constant and failing tests (RED)** - `3a1116a` (test)
2. **Task 2: Harden scpDownload/scpUpload — stdin ignore, BatchMode, timeout (GREEN)** - `35a5943` (feat)
3. **Task 3: Full test suite verification** - no commit needed (verification only, no file changes)

## Files Created/Modified
- `src/constants.ts` - Added `SCP_TIMEOUT_MS = 300_000` constant after BOOT_INTERVAL
- `src/core/backup.ts` - Hardened scpDownload() and scpUpload(): stdio['ignore'], BatchMode=yes, timeout+kill
- `tests/unit/core-backup.test.ts` - Added scpDownload/scpUpload imports + 8 new security test assertions

## Decisions Made
- Error message uses "timeout" literal (not "timed out") so `/timeout/i` regex matches — "timed out" contains "timed" + space + "out" which does not match the regex literal "timeout"
- `timeoutMs` added as optional 4th param (default = SCP_TIMEOUT_MS) for testability — all existing call sites pass 3 args and use the default
- `clearTimeout` registered on both `close` and `error` events to prevent ghost timer after normal process exit
- Fake timer test pattern: `jest.advanceTimersByTime(N)` + `await Promise.resolve()` to flush microtasks before checking caught error

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed timeout test regex mismatch**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** Plan specified `await expect(promise).rejects.toThrow(/timeout/i)` but error message was "SCP download timed out after Xms". The word "timed" is not "timeout" — regex did not match.
- **Fix:** Changed error message in backup.ts from "timed out" to "timeout" (`SCP download timeout after Xms`). Also refined test pattern to `await Promise.resolve()` + `.catch()` for reliable fake-timer async testing.
- **Files modified:** src/core/backup.ts (error messages), tests/unit/core-backup.test.ts (test pattern)
- **Verification:** All 8 new tests pass GREEN
- **Committed in:** 35a5943 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug: regex mismatch in timeout error message)
**Impact on plan:** Fix was necessary for test correctness. Error message "timeout" is equally clear to "timed out". No scope creep.

## Issues Encountered
- Linter/formatter reverted backup.ts edits mid-execution (tool notification showed revert). Re-applied changes via Write tool with complete file rewrite. No data lost.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 5 Plan 01 complete — SCP security hardening done
- Phase 6 (init.ts Extract) can proceed independently
- No blockers or concerns

---
*Phase: 05-scp-security-hardening*
*Completed: 2026-03-02*
