---
phase: quick-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/commands/init.ts
  - src/commands/health.ts
  - src/commands/firewall.ts
  - src/commands/restart.ts
  - src/core/firewall.ts
  - src/utils/ssh.ts
  - src/index.ts
  - tests/unit/init-bare.test.ts
  - tests/unit/firewall.test.ts
  - tests/unit/health-command.test.ts
  - tests/unit/restart.test.ts
  - tests/unit/ssh-utils.test.ts
autonomous: true
requirements: [BUG-1, BUG-2, BUG-5, BUG-6, BUG-7, BUG-8, BUG-13]
must_haves:
  truths:
    - "Bare mode --full-setup runs firewall + secure after server creation"
    - "--name flag skips interactive name prompt in all init code paths"
    - "Bare mode init waits for cloud-init to finish before returning"
    - "health command accepts optional server argument"
    - "Firewall setup on bare servers opens only 80, 443, 22 (not Coolify ports)"
    - "restart command shows SSH info for bare servers instead of Coolify URL"
    - "MCP SSH operations resolve ssh binary path on Windows"
  artifacts:
    - path: "src/commands/init.ts"
      provides: "Bare --full-setup, --name fix, cloud-init wait"
    - path: "src/core/firewall.ts"
      provides: "buildBareFirewallSetupCommand and BARE_PORTS constant"
    - path: "src/utils/ssh.ts"
      provides: "resolveSshPath for MCP SSH ENOENT fix"
    - path: "src/index.ts"
      provides: "health command argument definition"
  key_links:
    - from: "src/commands/init.ts"
      to: "src/core/firewall.ts"
      via: "buildBareFirewallSetupCommand import"
      pattern: "buildBareFirewallSetupCommand"
    - from: "src/utils/ssh.ts"
      to: "child_process.spawn"
      via: "resolveSshPath for binary lookup"
      pattern: "resolveSshPath"
---

<objective>
Fix 7 bugs found during v1.2.0 testing: bare mode --full-setup, --name flag, cloud-init wait, health argument, firewall bare ports, restart bare message, and MCP SSH ENOENT.

Purpose: Make v1.2.0 release-ready by closing all known bugs before npm publish.
Output: All 7 bugs fixed with tests passing.
</objective>

<execution_context>
@C:/Users/Omrfc/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Omrfc/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/commands/init.ts
@src/commands/health.ts
@src/commands/firewall.ts
@src/commands/restart.ts
@src/core/firewall.ts
@src/utils/ssh.ts
@src/index.ts
@src/utils/modeGuard.ts
@src/mcp/tools/serverLogs.ts

<interfaces>
From src/core/firewall.ts:
```typescript
export const PROTECTED_PORTS = [22];
export const COOLIFY_PORTS = [80, 443, 8000, 6001, 6002];
export function buildFirewallSetupCommand(): string;
export function setupFirewall(ip: string): Promise<FirewallResult>;
```

From src/utils/ssh.ts:
```typescript
export function checkSshAvailable(): boolean;
export function sshExec(ip: string, command: string): Promise<{ code: number; stdout: string; stderr: string }>;
export function sshConnect(ip: string): Promise<number>;
export function sshStream(ip: string, command: string): Promise<number>;
export function sanitizedEnv(): NodeJS.ProcessEnv;
export function assertValidIp(ip: string): void;
```

From src/utils/modeGuard.ts:
```typescript
export function isBareServer(server: ServerRecord): boolean;
export function requireCoolifyMode(server: ServerRecord, commandName: string): string | null;
```

From src/commands/init.ts:
```typescript
export async function initCommand(options: InitOptions = {}): Promise<void>;
// deployServer is a private async function inside init.ts
```

From src/commands/health.ts:
```typescript
export async function healthCommand(): Promise<void>;
export async function checkServerHealth(server: ServerRecord): Promise<HealthResult>;
```

From src/index.ts (health registration):
```typescript
program.command("health").description("Check health of all registered servers").action(healthCommand);
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix init.ts bugs (BUG-1, BUG-2, BUG-5) and core/firewall.ts bare ports (BUG-7)</name>
  <files>src/commands/init.ts, src/core/firewall.ts, src/commands/firewall.ts, tests/unit/init-bare.test.ts, tests/unit/firewall.test.ts</files>
  <action>
**BUG-1: Bare mode --full-setup not working (init.ts lines 442-454)**

The bare mode early-return at line 453 exits before the fullSetup block at line 457. Fix by moving the fullSetup logic BEFORE the bare early-return block, or restructuring so bare mode also runs fullSetup when requested.

In `deployServer()` in init.ts:
1. After `saveServer()` (line 440), BEFORE the bare early-return block (line 442):
   - Add cloud-init wait for bare mode (BUG-5 fix, see below)
   - Add fullSetup handling for bare mode: if `isBare && fullSetup`, wait for cloud-init, then run `firewallSetup()` and `secureSetup()` (same pattern as Coolify fullSetup but with bare-aware firewall)
2. The bare early-return block should only trigger when NOT doing fullSetup, OR should come after fullSetup is handled

Concrete approach — restructure the bare section (lines 442-454) to:
```typescript
if (isBare) {
  // Wait for cloud-init to finish (BUG-5)
  if (hasValidIp) {
    const cloudInitSpinner = createSpinner("Waiting for cloud-init to finish...");
    cloudInitSpinner.start();
    try {
      const ciResult = await sshExec(server.ip, "cloud-init status --wait");
      if (ciResult.code === 0) {
        cloudInitSpinner.succeed("Cloud-init completed");
      } else {
        cloudInitSpinner.warn("Cloud-init may not have finished — continuing anyway");
      }
    } catch {
      cloudInitSpinner.warn("Could not check cloud-init status — continuing anyway");
    }
  }

  // Full setup: firewall + secure (BUG-1)
  if (fullSetup && hasValidIp) {
    try { spawnSync("ssh-keygen", ["-R", server.ip], { stdio: "ignore" }); } catch { /* harmless */ }
    logger.title("Running full setup (firewall + security)...");
    try {
      await firewallSetup(server.ip, serverName, false);
    } catch (error: unknown) {
      logger.warning(`Firewall setup failed: ${getErrorMessage(error)}`);
    }
    try {
      await secureSetup(server.ip, serverName, undefined, false, true);
    } catch (error: unknown) {
      logger.warning(`Security setup failed: ${getErrorMessage(error)}`);
    }
  } else if (fullSetup && !hasValidIp) {
    logger.warning("Skipping full setup: server IP not available.");
  }

  // Show bare server info
  logger.title("Bare Server Ready!");
  console.log();
  logger.success("Bare server ready!");
  logger.info(`SSH: ssh root@${server.ip}`);
  logger.info(`IP: ${server.ip}`);
  logger.info("Mode: bare (no platform installed)");
  console.log();
  if (!fullSetup) {
    logger.info("  Secure your server:");
    logger.step(`     quicklify firewall setup ${serverName}`);
    logger.step(`     quicklify secure setup ${serverName}`);
    console.log();
  }
  logger.info("  Server saved to local config. Use 'quicklify list' to see all servers.");
  console.log();
  return;
}
```

Note: The `sshExec` import is already used elsewhere in the codebase. Add import of `sshExec` from `../utils/ssh.js` in init.ts.

**BUG-2: --name flag ignored in interactive path (init.ts line 171)**

In the interactive while-loop (lines 151-201), step 6 (line 170-178) calls `getServerNameConfig()` without checking if `options.name` is already provided. Fix step 6:
```typescript
case 6: {
  if (options.name) {
    serverName = options.name;
    step = 7;
    break;
  }
  const n = await getServerNameConfig();
  if (n === BACK_SIGNAL) {
    step = 5;
    break;
  }
  serverName = n;
  step = 7;
  break;
}
```

**BUG-5: Cloud-init wait for bare mode**
Already handled in BUG-1 fix above. The cloud-init wait uses SSH to run `cloud-init status --wait` which blocks until cloud-init finishes. This prevents dpkg lock conflicts when --full-setup tries to install UFW immediately. For Coolify mode, `waitForCoolify` already provides sufficient delay. Add the SSH `cloud-init status --wait` only for bare mode, wrapped in try/catch (server may not have cloud-init).

**BUG-7: Firewall bare ports (core/firewall.ts)**

In `src/core/firewall.ts`:
1. Add `export const BARE_PORTS = [80, 443];` (SSH 22 is added separately in the setup command)
2. Add `export function buildBareFirewallSetupCommand(): string` that builds UFW commands with only BARE_PORTS + SSH (no 8000, 6001, 6002)
3. The new function follows same pattern as `buildFirewallSetupCommand()`:
```typescript
export function buildBareFirewallSetupCommand(): string {
  const commands = [
    "apt-get install -y ufw",
    "ufw default deny incoming",
    "ufw default allow outgoing",
    ...BARE_PORTS.map((p) => `ufw allow ${p}/tcp`),
    "ufw allow 22/tcp",
    'echo "y" | ufw enable',
  ];
  return commands.join(" && ");
}
```

In `src/commands/firewall.ts`:
1. Import `BARE_PORTS` and `buildBareFirewallSetupCommand` from core/firewall.ts
2. Add to re-exports: `export { BARE_PORTS, buildBareFirewallSetupCommand }`
3. Modify `firewallSetup()` function to accept an optional `mode` parameter. When the server is resolved, detect bare mode and use `buildBareFirewallSetupCommand()` instead. BUT — `firewallSetup` currently takes `(ip, name, dryRun)` and is called from init.ts too. So add a 4th optional param `isBare?: boolean`:
```typescript
export async function firewallSetup(ip: string, name: string, dryRun: boolean, isBare?: boolean): Promise<void> {
  const command = isBare ? buildBareFirewallSetupCommand() : buildFirewallSetupCommand();
  // rest stays same, but update success message:
  if (isBare) {
    logger.success(`UFW enabled with web ports (${BARE_PORTS.join(", ")}) + SSH (22)`);
  } else {
    logger.success(`UFW enabled with Coolify ports (${COOLIFY_PORTS.join(", ")}) + SSH (22)`);
  }
}
```

4. In `firewallCommand()`, when subcommand is "setup", detect if server is bare and pass `isBare` to `firewallSetup`:
```typescript
case "setup": {
  const bare = isBareServer(server);
  await firewallSetup(server.ip, server.name, dryRun, bare);
  break;
}
```
Import `isBareServer` from `../utils/modeGuard.js`. Note: `resolveServer` already returns a full ServerRecord.

5. In init.ts, when calling `firewallSetup` for bare mode fullSetup, pass `true` for isBare:
```typescript
await firewallSetup(server.ip, serverName, false, true);
```

**Tests:**
- In `tests/unit/init-bare.test.ts`: Add test for bare mode + fullSetup calling firewallSetup and secureSetup. Add test for --name flag skipping prompt.
- In `tests/unit/firewall.test.ts`: Add tests for `BARE_PORTS`, `buildBareFirewallSetupCommand()`, and `firewallSetup` with isBare=true.
  </action>
  <verify>
    <automated>npx jest tests/unit/init-bare.test.ts tests/unit/firewall.test.ts --no-coverage 2>&1 | tail -20</automated>
  </verify>
  <done>
    - BUG-1: `initCommand({ mode: "bare", fullSetup: true, ... })` calls firewallSetup and secureSetup
    - BUG-2: `initCommand({ name: "my-server", ... })` does NOT trigger getServerNameConfig prompt in interactive path
    - BUG-5: Bare mode init runs `cloud-init status --wait` via SSH before returning
    - BUG-7: `buildBareFirewallSetupCommand()` produces only ports 80, 443, 22 (no 8000, 6001, 6002). `firewallSetup` with isBare=true uses bare command
    - All existing tests still pass
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix health argument, restart bare message, and MCP SSH path (BUG-6, BUG-8, BUG-13)</name>
  <files>src/index.ts, src/commands/restart.ts, src/utils/ssh.ts, tests/unit/restart.test.ts, tests/unit/health-command.test.ts, tests/unit/ssh-utils.test.ts</files>
  <action>
**BUG-6: health command missing server argument (src/index.ts)**

Change the health command registration in `src/index.ts` from:
```typescript
program.command("health").description("Check health of all registered servers").action(healthCommand);
```
to:
```typescript
program.command("health [query]").description("Check health of all registered servers").action(healthCommand);
```

Then update `src/commands/health.ts` to accept the optional query parameter:
```typescript
export async function healthCommand(query?: string): Promise<void> {
```

When `query` is provided, filter to matching server(s) using `findServer` from config.ts. When no query, check all servers (current behavior). The function signature change is backward compatible.

Update `src/index.ts` action to pass query:
```typescript
.action((query?: string) => healthCommand(query));
```

In `healthCommand`:
```typescript
export async function healthCommand(query?: string): Promise<void> {
  let servers = getServers();
  if (servers.length === 0) {
    logger.info("No servers found. Deploy one with: quicklify init");
    return;
  }

  // If query provided, filter to matching server
  if (query) {
    const found = findServer(query);
    if (!found) {
      logger.error(`Server not found: ${query}`);
      return;
    }
    servers = [found];
  }
  // ... rest unchanged
```
Import `findServer` from `../utils/config.js`.

**BUG-8: restart bare message (src/commands/restart.ts)**

In `restartCommand`, at line 55 after server comes back online, the message always shows Coolify URL:
```typescript
logger.info(`Access Coolify: http://${server.ip}:8000`);
```

Fix by detecting bare mode:
```typescript
import { isBareServer } from "../utils/modeGuard.js";
// ... in the success block:
if (isBareServer(server)) {
  logger.info(`SSH: ssh root@${server.ip}`);
} else {
  logger.info(`Access Coolify: http://${server.ip}:8000`);
}
```

**BUG-13: MCP SSH ENOENT (src/utils/ssh.ts)**

The issue: MCP runtime (Claude Desktop, Cursor, etc.) spawns the MCP server as a child process. On Windows, the MCP host may not inherit the full system PATH, so `spawn("ssh", ...)` fails with ENOENT because it can't find the ssh binary.

Fix in `src/utils/ssh.ts`:
1. Add a `resolveSshPath()` function that tries common SSH locations on Windows when the default `ssh` is not found:
```typescript
import { execSync, spawn, spawnSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

let cachedSshPath: string | null = null;

export function resolveSshPath(): string {
  if (cachedSshPath) return cachedSshPath;

  // Try default PATH first
  try {
    execSync("ssh -V", { stdio: "pipe" });
    cachedSshPath = "ssh";
    return cachedSshPath;
  } catch {
    // Not in PATH, try common locations
  }

  // Windows common SSH locations
  if (process.platform === "win32") {
    const candidates = [
      join(process.env.SystemRoot || "C:\\Windows", "System32", "OpenSSH", "ssh.exe"),
      join(process.env.ProgramFiles || "C:\\Program Files", "OpenSSH", "ssh.exe"),
      join(process.env.LOCALAPPDATA || "", "Programs", "Git", "usr", "bin", "ssh.exe"),
      join(process.env.ProgramFiles || "C:\\Program Files", "Git", "usr", "bin", "ssh.exe"),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        cachedSshPath = candidate;
        return cachedSshPath;
      }
    }
  }

  // Fallback — return "ssh" and let it fail with a clearer error
  cachedSshPath = "ssh";
  return cachedSshPath;
}
```

2. Update `checkSshAvailable()` to also use `resolveSshPath()` and cache result.

3. Update `sshConnect`, `sshStream`, and `sshExec` to use `resolveSshPath()` instead of hardcoded `"ssh"`:
```typescript
const sshBin = resolveSshPath();
const child = spawn(sshBin, ["-o", "StrictHostKeyChecking=accept-new", `root@${ip}`], { ... });
```

4. Similarly update `checkSshAvailable`:
```typescript
export function checkSshAvailable(): boolean {
  try {
    const sshBin = resolveSshPath();
    execSync(`"${sshBin}" -V`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
```

5. Export `resolveSshPath` so it can be tested.

**Tests:**
- `tests/unit/health-command.test.ts`: Add test that healthCommand accepts a query string and filters to that server.
- `tests/unit/restart.test.ts`: Add test that bare server restart shows SSH info instead of Coolify URL.
- `tests/unit/ssh-utils.test.ts`: Add test for `resolveSshPath()` returning "ssh" when available in PATH.
  </action>
  <verify>
    <automated>npx jest tests/unit/health-command.test.ts tests/unit/restart.test.ts tests/unit/ssh-utils.test.ts --no-coverage 2>&1 | tail -20</automated>
  </verify>
  <done>
    - BUG-6: `quicklify health my-server` works without "too many arguments" error, filters to that server
    - BUG-8: Bare server restart shows `SSH: ssh root@IP` not `Access Coolify: http://IP:8000`
    - BUG-13: `sshExec` and friends use `resolveSshPath()` which checks common Windows SSH locations. MCP SSH calls work when PATH is incomplete
    - All existing tests still pass
  </done>
</task>

<task type="auto">
  <name>Task 3: Full test suite validation</name>
  <files></files>
  <action>
Run `npm run build && npm test` to verify all 7 bug fixes pass without breaking existing functionality. Fix any regressions. Ensure 80%+ coverage is maintained.
  </action>
  <verify>
    <automated>npm run build && npm test 2>&1 | tail -30</automated>
  </verify>
  <done>
    - Build succeeds with zero errors
    - All test suites pass (74+ suites, 1920+ tests)
    - Coverage stays above 80%
    - No regressions in existing functionality
  </done>
</task>

</tasks>

<verification>
1. `npm run build` — zero TypeScript errors
2. `npm test` — all suites pass, no regressions
3. Specific bug verification:
   - BUG-1: init-bare tests confirm fullSetup calls firewallSetup+secureSetup
   - BUG-2: init test confirms --name skips prompt
   - BUG-5: init-bare test confirms cloud-init wait via sshExec
   - BUG-6: health-command test confirms query parameter works
   - BUG-7: firewall test confirms bare ports exclude 8000/6001/6002
   - BUG-8: restart test confirms bare mode SSH message
   - BUG-13: ssh-utils test confirms resolveSshPath function
</verification>

<success_criteria>
- All 7 bugs fixed and verified by tests
- Build passes cleanly
- Full test suite passes with no regressions
- Coverage maintained at 80%+
</success_criteria>

<output>
After completion, create `.planning/quick/2-bug-fixes-1-init-full-setup-bare-mode-2-/2-SUMMARY.md`
</output>
