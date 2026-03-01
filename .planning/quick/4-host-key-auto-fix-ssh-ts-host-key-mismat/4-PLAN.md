---
phase: quick-4
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/ssh.ts
  - src/commands/health.ts
  - tests/unit/ssh-utils.test.ts
  - tests/unit/health.test.ts
autonomous: true
requirements: [HOST-KEY-AUTO-FIX]
must_haves:
  truths:
    - "sshExec auto-removes stale host key and retries on host key mismatch"
    - "sshConnect auto-removes stale host key and retries on host key mismatch"
    - "sshStream auto-removes stale host key and retries on host key mismatch"
    - "Health check reports host key mismatch distinctly from unreachable"
    - "Auto-fix only retries once to avoid infinite loops"
  artifacts:
    - path: "src/utils/ssh.ts"
      provides: "removeStaleHostKey helper + retry logic in sshExec/sshConnect/sshStream"
      exports: ["removeStaleHostKey", "sshExec", "sshConnect", "sshStream"]
    - path: "src/commands/health.ts"
      provides: "Host key mismatch detection in health check output"
      contains: "host key"
    - path: "tests/unit/ssh-utils.test.ts"
      provides: "Tests for host key auto-fix retry behavior"
      contains: "host key"
  key_links:
    - from: "src/utils/ssh.ts"
      to: "child_process.execSync"
      via: "ssh-keygen -R <ip> for stale key removal"
      pattern: "ssh-keygen.*-R"
    - from: "src/utils/ssh.ts"
      to: "sshExec/sshConnect/sshStream"
      via: "stderr pattern detection + removeStaleHostKey + single retry"
      pattern: "Host key verification failed|REMOTE HOST IDENTIFICATION"
---

<objective>
Add automatic host key mismatch detection and auto-fix to all SSH functions in ssh.ts. When SSH fails due to a stale known_hosts entry (common when cloud providers reuse IPs), automatically run `ssh-keygen -R <ip>` and retry once. Also enhance the health command to report host key mismatch as a distinct status.

Purpose: Cloud providers frequently reuse IPs. Without this fix, SSH operations silently fail (MCP returns unhelpful errors, health checks show "unreachable" instead of the real cause). The init.ts already has this pattern manually — this centralizes it.
Output: Updated ssh.ts with auto-fix retry, updated health.ts with mismatch reporting, comprehensive tests.
</objective>

<execution_context>
@C:/Users/Omrfc/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Omrfc/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/utils/ssh.ts
@src/commands/health.ts
@src/core/status.ts
@src/utils/errorMapper.ts
@tests/unit/ssh-utils.test.ts

<interfaces>
<!-- Existing ssh.ts exports that will be modified -->
From src/utils/ssh.ts:
```typescript
export function resolveSshPath(): string;
export function checkSshAvailable(): boolean;
export function assertValidIp(ip: string): void;
export function sanitizedEnv(): NodeJS.ProcessEnv;
export function sshConnect(ip: string): Promise<number>;
export function sshStream(ip: string, command: string): Promise<number>;
export function sshExec(ip: string, command: string): Promise<{ code: number; stdout: string; stderr: string }>;
```

From src/utils/errorMapper.ts (line 117-119 — existing pattern):
```typescript
{
  pattern: /Host key verification failed/i,
  message: (ip) => `Host key changed. Run: ssh-keygen -R ${ip || "<server-ip>"} then retry.`,
}
```

From src/commands/init.ts (lines 496, 538 — existing manual pattern):
```typescript
spawnSync("ssh-keygen", ["-R", server.ip], { stdio: "ignore" });
```

From src/commands/health.ts:
```typescript
export interface HealthResult {
  server: ServerRecord;
  status: "healthy" | "unhealthy" | "unreachable";
  responseTime: number;
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add removeStaleHostKey helper and auto-retry to all SSH functions</name>
  <files>src/utils/ssh.ts, tests/unit/ssh-utils.test.ts</files>
  <behavior>
    - Test: removeStaleHostKey calls execSync with ssh-keygen -R and the IP
    - Test: removeStaleHostKey does not throw when ssh-keygen fails (try/catch)
    - Test: sshExec retries once when stderr contains "Host key verification failed"
    - Test: sshExec does NOT retry on other SSH errors (permission denied, timeout)
    - Test: sshExec does NOT retry more than once (no infinite loop)
    - Test: sshExec returns the retry result (not the original failure) on host key fix
    - Test: sshConnect retries once on host key mismatch (exit code 255 + stderr detection)
    - Test: sshStream retries once on host key mismatch (exit code 255 + stderr detection)
  </behavior>
  <action>
1. Add `removeStaleHostKey(ip: string): void` exported function to ssh.ts:
   - Calls `execSync(`ssh-keygen -R ${ip}`, { stdio: "ignore" })` (same pattern as init.ts:496)
   - Wrap in try/catch, silently ignore errors (ssh-keygen not available or no entry)
   - Validate IP with assertValidIp before running (prevent command injection)

2. Modify `sshExec` to detect host key mismatch and auto-retry:
   - After the Promise resolves, check if `stderr` contains "Host key verification failed" OR "REMOTE HOST IDENTIFICATION HAS CHANGED" (case-insensitive)
   - If detected: call `removeStaleHostKey(ip)`, then retry the same sshExec call ONCE
   - Use an internal `_sshExecInner` or a `retry` boolean parameter (default false) to prevent recursion beyond 1 retry
   - Return the retry result

3. Modify `sshConnect` to detect host key mismatch:
   - sshConnect uses `stdio: "inherit"` so stderr is not captured. Change approach: use `-o BatchMode=yes` on retry detection is not possible since stderr goes to terminal.
   - Better approach: For sshConnect and sshStream, do a **pre-check** before spawning. Before the `spawn` call, run a quick `sshExec(ip, "echo ok")` style check? No, too expensive.
   - Simplest correct approach: Change sshConnect to capture stderr in a separate pipe just for detection purposes, while still inheriting stdin/stdout. Use `stdio: ["inherit", "inherit", "pipe"]` — stdin+stdout inherited (interactive), stderr piped for detection.
   - After close, if exit code is non-zero AND stderr contains host key pattern: call `removeStaleHostKey(ip)`, spawn again (retry once). Use a `retried` flag.
   - IMPORTANT: Keep existing behavior — return exit code as number.

4. Modify `sshStream` with the same pattern as sshConnect:
   - Change `stdio: "inherit"` to `["inherit", "inherit", "pipe"]` to capture stderr
   - Detect host key mismatch in stderr, call removeStaleHostKey, retry once
   - Return the retry's exit code

5. Update tests in tests/unit/ssh-utils.test.ts:
   - Add `describe("removeStaleHostKey")` with tests for success and failure cases
   - Add host key retry tests for sshExec, sshConnect, sshStream
   - Use existing mock patterns (EventEmitter-based mock process)
   - For retry tests: first spawn call emits host key error in stderr + close(255), mock execSync for ssh-keygen -R, second spawn call succeeds with close(0)
   - Verify execSync called with ssh-keygen -R args
   - Verify spawn called twice (original + retry)
   - Verify no retry on non-host-key errors (spawn called once)

NOTE: sshConnect and sshStream currently use `stdio: "inherit"`. Changing to `["inherit", "inherit", "pipe"]` means stderr won't be visible to the user during normal operation. This is acceptable because:
- SSH errors in stderr are transient messages (host key warnings, connection errors)
- The errorMapper already handles these patterns for user-facing display
- The auto-fix benefit outweighs the loss of raw stderr display during interactive SSH

ALTERNATIVE if stderr visibility is critical: Keep `stdio: "inherit"` for sshConnect (interactive sessions), only add retry to sshExec and sshStream. sshConnect is for interactive SSH sessions where the user sees the error directly and can fix manually. sshStream is for command streaming (logs --follow etc) where auto-fix is more important. USE THIS ALTERNATIVE — sshConnect should remain fully interactive with inherited stdio. Only modify sshStream and sshExec.
  </action>
  <verify>
    <automated>cd C:/Users/Omrfc/Documents/quicklify && npx jest tests/unit/ssh-utils.test.ts --no-coverage --verbose 2>&1 | tail -40</automated>
  </verify>
  <done>
    - removeStaleHostKey exported and tested
    - sshExec auto-detects host key mismatch in stderr, removes stale key, retries once
    - sshStream auto-detects host key mismatch in piped stderr, removes stale key, retries once
    - sshConnect left unchanged (interactive session — user sees error directly)
    - No infinite retry loops (single retry guard)
    - All existing tests still pass
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add host key mismatch reporting to health command</name>
  <files>src/commands/health.ts, tests/unit/health.test.ts</files>
  <behavior>
    - Test: HealthResult status includes "host-key-mismatch" as a possible value
    - Test: checkServerHealth returns "host-key-mismatch" when sshExec stderr contains host key pattern
    - Test: healthCommand displays host key mismatch with distinct icon and actionable message
    - Test: healthCommand summary counts host key mismatches separately
    - Test: bare server health check uses sshExec to detect SSH reachability and host key issues
  </behavior>
  <action>
1. Update HealthResult interface in health.ts:
   - Add `"host-key-mismatch"` to status union: `"healthy" | "unhealthy" | "unreachable" | "host-key-mismatch"`

2. Update `checkServerHealth` function:
   - For Coolify servers: keep existing `checkCoolifyHealth` logic (HTTP check, no SSH involved)
   - For bare servers: instead of skipping, use `sshExec(server.ip, "echo ok")` to check SSH reachability
     - If code === 0: status = "healthy"
     - If stderr matches host key pattern: status = "host-key-mismatch"
     - Otherwise: status = "unreachable"
   - Import `sshExec` from `../utils/ssh.js`

3. Update `healthCommand` display:
   - Remove the bare server skip loop (`for (const bare of bareServers)` warning block)
   - Process ALL servers (both coolify and bare)
   - Add display case for "host-key-mismatch": icon `⚠ host key changed`, time = "n/a"
   - After table, if any host key mismatches: show actionable hint: `"Run: ssh-keygen -R <ip> to fix host key mismatch (or it will auto-fix on next SSH operation)"`
   - Update summary to count host key mismatches

4. Update/create tests in tests/unit/health.test.ts:
   - Mock `sshExec` from utils/ssh
   - Test bare server health check returns "healthy" when sshExec succeeds
   - Test bare server health check returns "host-key-mismatch" when stderr has pattern
   - Test bare server health check returns "unreachable" on other failures
   - Test display output includes host key hint when mismatch detected
   - Keep existing Coolify health check tests passing
  </action>
  <verify>
    <automated>cd C:/Users/Omrfc/Documents/quicklify && npx jest tests/unit/health.test.ts --no-coverage --verbose 2>&1 | tail -40</automated>
  </verify>
  <done>
    - Bare servers no longer skipped in health command — checked via SSH
    - Host key mismatch reported as distinct status with actionable fix hint
    - Summary counts include host key mismatch count
    - Coolify health checks unchanged (HTTP-based)
    - All health tests pass
  </done>
</task>

</tasks>

<verification>
```bash
cd C:/Users/Omrfc/Documents/quicklify && npm run build && npm test 2>&1 | tail -20
```
All 1968+ tests pass, build succeeds, no regressions.
</verification>

<success_criteria>
- sshExec and sshStream automatically fix host key mismatch and retry (once) without user intervention
- sshConnect remains fully interactive (no stdio change)
- Health command checks bare servers via SSH and reports host key mismatch distinctly
- Health command shows actionable fix hint for host key issues
- No infinite retry loops — single retry guard enforced
- All existing tests pass + new tests for host key behavior
- Build succeeds
</success_criteria>

<output>
After completion, create `.planning/quick/4-host-key-auto-fix-ssh-ts-host-key-mismat/4-SUMMARY.md`
</output>
