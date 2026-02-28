---
phase: quick-2
plan: "01"
subsystem: "CLI Commands & SSH Utilities"
tags: [bug-fix, bare-mode, init, firewall, health, restart, ssh, mcp]
dependency_graph:
  requires: []
  provides: [BUG-1, BUG-2, BUG-5, BUG-6, BUG-7, BUG-8, BUG-13]
  affects: [src/commands/init.ts, src/commands/firewall.ts, src/commands/health.ts, src/commands/restart.ts, src/utils/ssh.ts, src/core/firewall.ts, src/index.ts]
tech_stack:
  added: []
  patterns: [resolveSshPath caching, bare-mode conditional logic, optional command args]
key_files:
  created: []
  modified:
    - src/core/firewall.ts
    - src/commands/firewall.ts
    - src/commands/init.ts
    - src/commands/health.ts
    - src/commands/restart.ts
    - src/utils/ssh.ts
    - src/index.ts
    - tests/unit/init-bare.test.ts
    - tests/unit/firewall.test.ts
    - tests/unit/health-command.test.ts
    - tests/unit/restart.test.ts
    - tests/unit/ssh-utils.test.ts
decisions:
  - "resolveSshPath uses module-level cache (let cachedSshPath) to avoid redundant execSync calls on every SSH operation"
  - "firewallSetup accepts optional isBare param rather than separate function to minimize API surface change"
  - "bare cloud-init wait wrapped in try/catch so SSH unavailability never blocks init completion"
  - "health command query uses findServer (exact+fuzzy match) consistent with other commands"
metrics:
  duration: "~18 minutes"
  completed_date: "2026-02-28"
  tasks: 3
  files_modified: 13
---

# Phase quick-2 Plan 01: Bug Fixes (BUG-1 through BUG-13) Summary

**One-liner:** Fixed 7 pre-release bugs: bare --full-setup flow, --name flag skip, cloud-init wait, health query arg, bare firewall ports, restart bare message, and MCP SSH ENOENT via resolveSshPath.

## Tasks Completed

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Fix init.ts (BUG-1, BUG-2, BUG-5) and core/firewall.ts bare ports (BUG-7) | Done | 7f73f9c |
| 2 | Fix health argument, restart bare message, MCP SSH path (BUG-6, BUG-8, BUG-13) | Done | 9bb0d21 |
| 3 | Full test suite validation | Done | (no code changes) |

## Bug Fixes

### BUG-1: Bare mode --full-setup not working

**Root cause:** `deployServer()` had an early `return` inside the `if (isBare)` block at line 453, before the `fullSetup` logic block at line 457. Bare servers never reached the firewall+secure setup.

**Fix:** Restructured the bare mode section to:
1. Wait for cloud-init (BUG-5, see below)
2. Run `firewallSetup(ip, name, false, true)` + `secureSetup(...)` when `fullSetup && hasValidIp`
3. Show appropriate success message
4. Return

Both calls are wrapped in try/catch so a failing setup never prevents the server from being saved and reported.

### BUG-2: --name flag ignored in interactive path

**Root cause:** The interactive while-loop's `case 6:` unconditionally called `getServerNameConfig()` even when `options.name` was already provided.

**Fix:** Added `if (options.name) { serverName = options.name; step = 7; break; }` at the top of `case 6:` in the interactive path.

### BUG-5: Bare mode cloud-init wait

**Root cause:** No mechanism existed to wait for `cloud-init` to finish on bare servers before returning. When `--full-setup` tried to immediately run UFW setup, `dpkg lock` conflicts occurred.

**Fix:** Added `sshExec(server.ip, "cloud-init status --wait")` call immediately after server boot in the bare mode section. Wrapped in try/catch — if the server doesn't have cloud-init or SSH isn't ready, it logs a warning and continues.

### BUG-6: Health command server argument

**Root cause:** `src/index.ts` registered `program.command("health")` (no args), so passing a server name resulted in "too many arguments" error.

**Fix:**
- Changed registration to `program.command("health [query]")` with `.action((query?: string) => healthCommand(query))`
- Updated `healthCommand(query?: string)` to call `findServer(query)` when query is provided, showing an error if not found

### BUG-7: Firewall bare mode opens Coolify ports

**Root cause:** `firewallSetup()` always used `buildFirewallSetupCommand()` which opens ports 80, 443, 8000, 6001, 6002. Bare servers don't run Coolify and don't need 8000/6001/6002.

**Fix:**
- Added `BARE_PORTS = [80, 443]` constant to `src/core/firewall.ts`
- Added `buildBareFirewallSetupCommand()` which opens only 80/tcp, 443/tcp, 22/tcp
- Updated `firewallSetup(ip, name, dryRun, isBare?)` with optional 4th param
- `firewallCommand` "setup" case now detects `isBareServer(server)` and passes it through
- `init.ts` calls `firewallSetup(..., true)` for bare fullSetup

### BUG-8: Restart shows Coolify URL for bare servers

**Root cause:** `restartCommand` always printed `Access Coolify: http://${server.ip}:8000` after a successful restart, regardless of server mode.

**Fix:** Added `isBareServer(server)` check. Bare servers now show `SSH: ssh root@${server.ip}`.

### BUG-13: MCP SSH ENOENT on Windows

**Root cause:** MCP server processes (Claude Desktop, Cursor) spawn with a restricted PATH that may not include SSH. `spawn("ssh", ...)` fails with ENOENT.

**Fix:** Added `resolveSshPath()` to `src/utils/ssh.ts`:
1. Tries `execSync("ssh -V")` — if it works, returns `"ssh"`
2. On Windows, checks common locations: `%SystemRoot%\System32\OpenSSH\ssh.exe`, `%ProgramFiles%\OpenSSH\ssh.exe`, `%LOCALAPPDATA%\Programs\Git\usr\bin\ssh.exe`, `%ProgramFiles%\Git\usr\bin\ssh.exe`
3. Falls back to `"ssh"` (lets the error be more specific)
4. Caches result in module-level variable for performance

All SSH functions (`sshConnect`, `sshStream`, `sshExec`, `checkSshAvailable`) now use `resolveSshPath()`.

## Test Results

```
Test Suites: 74 passed, 74 total
Tests:       1948 passed, 1948 total
Coverage:    95.41% statements, 85.71% branches, 97.52% functions, 96.14% lines
Build:       Zero TypeScript errors
```

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `src/core/firewall.ts` — BARE_PORTS and buildBareFirewallSetupCommand exported
- [x] `src/commands/firewall.ts` — firewallSetup isBare param, firewallCommand detects bare
- [x] `src/commands/init.ts` — BUG-1/2/5 all fixed, sshExec imported
- [x] `src/commands/health.ts` — healthCommand(query?) with findServer filtering
- [x] `src/commands/restart.ts` — isBareServer check on success message
- [x] `src/utils/ssh.ts` — resolveSshPath() function, all SSH functions updated
- [x] `src/index.ts` — health [query] registration
- [x] All 5 test files updated with new tests for each bug fix
- [x] Build: zero errors
- [x] Tests: 1948 passed, 74 suites, 0 failures
- [x] Coverage: 95.41% (above 80% threshold)
- [x] Commits: 7f73f9c (Task 1), 9bb0d21 (Task 2)
