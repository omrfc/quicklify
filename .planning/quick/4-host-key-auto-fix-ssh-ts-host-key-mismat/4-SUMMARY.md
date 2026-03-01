---
phase: quick-4
plan: 1
subsystem: ssh-utils, health-command
tags: [ssh, host-key, auto-fix, health, bare-mode, tdd]
dependency_graph:
  requires: []
  provides:
    - removeStaleHostKey exported from src/utils/ssh.ts
    - sshExec/sshStream auto-retry on host key mismatch
    - health command bare server SSH reachability check
    - host-key-mismatch status in HealthResult
  affects:
    - src/utils/ssh.ts
    - src/commands/health.ts
    - tests/unit/ssh-utils.test.ts
    - tests/unit/health.test.ts
    - tests/unit/health-command.test.ts
tech_stack:
  added: []
  patterns:
    - retried=false guard parameter to prevent infinite retry recursion
    - stdio: ["inherit", "inherit", "pipe"] for sshStream to capture stderr while keeping stdout inherited
key_files:
  created:
    - tests/unit/health.test.ts
  modified:
    - src/utils/ssh.ts
    - src/commands/health.ts
    - tests/unit/ssh-utils.test.ts
    - tests/unit/health-command.test.ts
decisions:
  - sshConnect left with stdio:"inherit" (interactive session — user sees errors directly, no auto-fix needed)
  - sshStream changed to ["inherit","inherit","pipe"] to capture stderr for host key detection (stdout still goes to terminal)
  - retried=false parameter (not internal _inner function) used as retry guard — simpler, same effect
  - Bare server health: sshExec("echo ok") is the SSH reachability probe (lightweight, no side effects)
  - host-key-mismatch added as 4th status to HealthResult union (not merged with unreachable for distinct UX messaging)
metrics:
  duration: "7m31s"
  completed: "2026-03-01T11:05:55Z"
  tasks_completed: 2
  files_modified: 5
---

# Phase quick-4 Plan 1: Host Key Auto-Fix in SSH Functions Summary

Host key mismatch auto-fix via ssh-keygen -R retry in sshExec/sshStream, plus bare server SSH health checks with distinct host-key-mismatch status reporting in the health command.

## What Was Built

### Task 1: removeStaleHostKey + auto-retry in sshExec/sshStream

Added `removeStaleHostKey(ip: string): void` to `src/utils/ssh.ts`:
- Validates IP with `assertValidIp()` before running (injection prevention)
- Calls `execSync("ssh-keygen -R <ip>", { stdio: "ignore" })`
- Silently catches all errors (ssh-keygen not available or no entry)

Modified `sshExec` to detect host key mismatch in stderr and retry once:
- Detects pattern: `/Host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED/i`
- Uses `retried=false` parameter as guard against infinite recursion
- Calls `removeStaleHostKey(ip)` then `sshExec(ip, command, true)`
- Returns retry result (not original failure)

Modified `sshStream` with same retry logic:
- Changed `stdio: "inherit"` to `["inherit", "inherit", "pipe"]` to capture stderr for detection
- stdout still goes to terminal (inherited), only stderr is piped
- Same retry guard pattern as sshExec

`sshConnect` left unchanged — interactive SSH sessions where user sees terminal output directly.

### Task 2: host-key-mismatch in health command

Extended `HealthResult.status` union with `"host-key-mismatch"`.

Updated `checkServerHealth` for bare servers:
- Was: skip with warning
- Now: `sshExec(server.ip, "echo ok")` — code 0 -> healthy, host key pattern in stderr -> host-key-mismatch, else -> unreachable

Updated `healthCommand`:
- Removed bare server skip/warn loop — all servers processed together
- Table displays `"⚠ host key changed"` with `"n/a"` response time for mismatches
- Post-table hint: `"Run: ssh-keygen -R <ip> to fix host key mismatch (or it will auto-fix on next SSH operation)"`
- Summary counts: `N healthy, N host key changed` (separate bucket)

## Tests

### New Tests (Task 1 — ssh-utils.test.ts)
11 new tests added:
- `removeStaleHostKey`: calls ssh-keygen -R with IP, silently ignores errors, throws on invalid IP
- `sshExec host key retry`: retries on "Host key verification failed", retries on "REMOTE HOST IDENTIFICATION HAS CHANGED", no retry on other errors, no retry more than once (infinite loop prevention), returns retry result
- `sshStream host key retry`: retries on host key pattern, no retry on other errors

### New Tests (Task 2 — health.test.ts)
11 new tests added:
- Bare server checkServerHealth: healthy/host-key-mismatch/unreachable/throws cases
- Coolify server checkServerHealth: unchanged (uses checkCoolifyHealth HTTP, not sshExec)
- healthCommand display: host key icon, actionable hint, summary counts, bare servers no longer skipped

### Updated Tests (Task 2 — health-command.test.ts)
- Added `jest.mock("../../src/utils/ssh")` to prevent real SSH calls in tests
- 3 "bare server guard" (skip) tests replaced with 3 "bare server SSH health check" tests reflecting new behavior

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing sshStream tests to match stdio change**
- **Found during:** Task 1 GREEN phase
- **Issue:** Existing test `"should spawn ssh with command and inherit stdio"` checked for `stdio: "inherit"` but sshStream now uses `["inherit", "inherit", "pipe"]`
- **Fix:** Updated test assertion to `expect.objectContaining({ stdio: ["inherit", "inherit", "pipe"] })`
- **Files modified:** tests/unit/ssh-utils.test.ts

**2. [Rule 1 - Bug] Fixed null exit code handling in sshStream**
- **Found during:** Task 1 GREEN phase
- **Issue:** Changed `code ?? 0` to `code ?? 1` in sshStream initially, but existing test "should return 0 when close code is null" expected 0 (correct: null means success)
- **Fix:** Reverted to `code ?? 0` for sshStream null exit code

**3. [Rule 1 - Bug] Updated health-command.test.ts bare server tests**
- **Found during:** Task 2 GREEN phase
- **Issue:** 3 existing "skip bare servers" tests failed because behavior intentionally changed to SSH-check bare servers
- **Fix:** Added `jest.mock("../../src/utils/ssh")` and rewrote 3 tests to test new SSH-check behavior

## Verification

```
Tests:       1989 passed, 1989 total (was 1968 before)
Test Suites: 75 passed, 75 total
Build:       tsc succeeds, no TypeScript errors
```

## Self-Check: PASSED

- FOUND: src/utils/ssh.ts
- FOUND: src/commands/health.ts
- FOUND: tests/unit/ssh-utils.test.ts
- FOUND: tests/unit/health.test.ts
- FOUND: commit 7d76c68 (Task 1)
- FOUND: commit 3dc56cb (Task 2)
- All key patterns verified: removeStaleHostKey, ssh-keygen -R, host-key-mismatch, retried guard
