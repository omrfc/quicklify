---
phase: quick-3
plan: 3
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/errorMapper.ts
  - src/commands/init.ts
  - src/commands/firewall.ts
  - src/commands/domain.ts
  - src/commands/backup.ts
  - src/commands/restore.ts
  - src/commands/destroy.ts
  - src/commands/remove.ts
  - src/core/backup.ts
  - src/index.ts
  - src/types/index.ts
  - tests/unit/errorMapper.test.ts
  - tests/unit/firewall.test.ts
  - tests/unit/domain.test.ts
  - tests/unit/backup.test.ts
  - tests/unit/restore.test.ts
  - tests/unit/destroy.test.ts
autonomous: true
must_haves:
  truths:
    - "dpkg lock SSH error returns user-friendly retry message"
    - "Token validation message shows source (env var, --token flag, or config prompt)"
    - "Firewall status shows active rules list, not just 'active/inactive'"
    - "domain info subcommand shows current FQDN for a Coolify server"
    - "backup cleanup command removes orphan backups for deleted servers"
    - "destroy and remove commands prompt to clean up backups"
    - "backup list and restore show provider+IP from manifest"
    - "Cross-provider restore shows warning, mode mismatch blocks restore"
  artifacts:
    - path: "src/utils/errorMapper.ts"
      provides: "dpkg lock SSH error pattern"
      contains: "dpkg"
    - path: "src/commands/init.ts"
      provides: "Token source display"
      contains: "from"
    - path: "src/commands/firewall.ts"
      provides: "Enhanced firewall status with rules"
      contains: "parseUfwStatus"
    - path: "src/commands/domain.ts"
      provides: "domain info subcommand"
      contains: "info"
    - path: "src/commands/backup.ts"
      provides: "backup cleanup command"
      contains: "cleanup"
  key_links:
    - from: "src/commands/firewall.ts"
      to: "src/core/firewall.ts"
      via: "parseUfwStatus reuse"
      pattern: "parseUfwStatus"
    - from: "src/commands/domain.ts"
      to: "src/core/domain.ts"
      via: "buildGetFqdnCommand reuse"
      pattern: "buildGetFqdnCommand"
---

<objective>
Implement 6 UX improvements for Quicklify CLI: dpkg lock error message (#3), token source display (#4), firewall status rules (#9), domain info subcommand (#10), orphan backup cleanup (#11), and backup provider/IP display (#12).

Purpose: Improve user experience with more informative messages, missing subcommands, and backup hygiene features.
Output: Updated CLI commands with better UX across error handling, status display, and backup management.
</objective>

<execution_context>
@C:/Users/Omrfc/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Omrfc/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/utils/errorMapper.ts
@src/commands/init.ts
@src/commands/firewall.ts
@src/commands/domain.ts
@src/commands/backup.ts
@src/commands/restore.ts
@src/commands/destroy.ts
@src/commands/remove.ts
@src/core/backup.ts
@src/core/firewall.ts
@src/core/domain.ts
@src/index.ts
@src/types/index.ts
@src/utils/config.ts

<interfaces>
From src/utils/errorMapper.ts:
```typescript
export function mapSshError(error: unknown, ip?: string): string;
// SSH_ERROR_PATTERNS array of {pattern: RegExp, message: (ip?) => string}
```

From src/core/firewall.ts:
```typescript
export function parseUfwStatus(stdout: string): FirewallStatus;
export function buildUfwStatusCommand(): string;
```

From src/core/domain.ts:
```typescript
export function buildGetFqdnCommand(): string;
export function parseFqdn(stdout: string): string | null;
```

From src/core/backup.ts:
```typescript
export function getBackupDir(serverName: string): string;
export function listBackups(serverName: string): string[];
export function loadManifest(backupPath: string): BackupManifest | undefined;
```

From src/types/index.ts:
```typescript
export interface BackupManifest {
  serverName: string;
  provider: string;
  timestamp: string;
  coolifyVersion: string;
  files: string[];
  mode?: ServerMode;
}
export interface ServerRecord {
  id: string; name: string; provider: string; ip: string;
  region: string; size: string; createdAt: string; mode?: ServerMode;
}
```

From src/utils/config.ts:
```typescript
export const BACKUPS_DIR: string; // join(homedir(), ".quicklify", "backups")
export function getServers(): ServerRecord[];
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: UX #3 dpkg lock + UX #4 token source + UX #9 firewall status rules + UX #10 domain info</name>
  <files>
    src/utils/errorMapper.ts
    src/commands/init.ts
    src/commands/firewall.ts
    src/commands/domain.ts
    src/index.ts
    tests/unit/errorMapper.test.ts
    tests/unit/firewall.test.ts
    tests/unit/domain.test.ts
  </files>
  <action>
**UX #3 — dpkg lock error pattern:**
In `src/utils/errorMapper.ts`, add a new entry to the `SSH_ERROR_PATTERNS` array (before the "command not found" pattern):
```typescript
{
  pattern: /dpkg.*lock|locked.*dpkg|Could not get lock/i,
  message: () =>
    "Server is still initializing (dpkg lock active). Wait 1-2 minutes and retry.",
},
```
Add a test case in `tests/unit/errorMapper.test.ts` that verifies `mapSshError(new Error("Could not get lock /var/lib/dpkg/lock-frontend"))` returns the dpkg message.

**UX #4 — Token source display:**
In `src/commands/init.ts`, change the token validation succeed message at line 139 from:
```typescript
tokenSpinner.succeed("API token validated");
```
to include the source. Determine the source based on which branch was taken:
- If `options.token` was truthy: `"API token validated (from --token flag)"`
- If env var was used (the `else if` branches for HETZNER_TOKEN, etc.): `"API token validated (from ${envVarName} env var)"` where envVarName is the actual env var name like `HETZNER_TOKEN`, `DIGITALOCEAN_TOKEN`, `VULTR_TOKEN`, or `LINODE_TOKEN`
- If interactive prompt was used: `"API token validated (from interactive prompt)"`

Implementation: Add a `tokenSource` string variable right after `let apiToken: string;` line 76. Set it in each branch:
- `options.token` branch (line 106): `tokenSource = "--token flag";`
- `process.env.HETZNER_TOKEN` branch: `tokenSource = "HETZNER_TOKEN env var";`
- `process.env.DIGITALOCEAN_TOKEN` branch: `tokenSource = "DIGITALOCEAN_TOKEN env var";`
- `process.env.VULTR_TOKEN` branch: `tokenSource = "VULTR_TOKEN env var";`
- `process.env.LINODE_TOKEN` branch: `tokenSource = "LINODE_TOKEN env var";`
- Interactive prompt branch (line 120-121): `tokenSource = "interactive prompt";`
Then change succeed message to: `tokenSpinner.succeed(\`API token validated (from ${tokenSource})\`);`

**UX #9 — Firewall status with rules:**
In `src/commands/firewall.ts`, replace the `firewallStatusCheck` function (lines 273-298). Instead of running bare `ufw status`, reuse `buildUfwStatusCommand()` + `parseUfwStatus()` (already imported from core):
```typescript
async function firewallStatusCheck(ip: string, name: string): Promise<void> {
  const spinner = createSpinner(`Checking firewall status on ${name}...`);
  spinner.start();

  try {
    const result = await sshExec(ip, buildUfwStatusCommand());
    if (result.code !== 0) {
      spinner.fail("Failed to check firewall status");
      if (result.stderr) logger.error(result.stderr);
      return;
    }

    const status = parseUfwStatus(result.stdout);
    if (status.active) {
      spinner.succeed(`UFW is active on ${name}`);
      if (status.rules.length > 0) {
        console.log();
        logger.info(`Open ports (${status.rules.length} rules):`);
        for (const rule of status.rules) {
          logger.step(`${rule.port}/${rule.protocol} → ${rule.action} from ${rule.from}`);
        }
      } else {
        logger.info("No rules configured.");
      }
    } else {
      spinner.warn(`UFW is inactive on ${name}`);
      logger.info("Run 'quicklify firewall setup' to enable.");
    }
  } catch (error: unknown) {
    spinner.fail("Failed to check firewall status");
    logger.error(getErrorMessage(error));
    const hint = mapSshError(error, ip);
    if (hint) logger.info(hint);
  }
}
```
Update tests in `tests/unit/firewall.test.ts`: find the existing "status" subcommand test and verify that `parseUfwStatus` output (rules) is now displayed. The test should mock `sshExec` to return a `ufw status numbered` output with rules and verify those rules appear in console output.

**UX #10 — domain info subcommand:**
In `src/commands/domain.ts`:
1. Add `"info"` to `validSubcommands` array: `["add", "remove", "check", "list", "info"]`
2. Add case in switch: `case "info": await domainInfo(server.ip, server.name); break;`
3. The `domainInfo` function is essentially the same as `domainList` (which fetches FQDN). BUT `info` is a more intuitive name for single-server use. Implement `domainInfo` as follows — it reuses `buildGetFqdnCommand` and `parseFqdn`:
```typescript
async function domainInfo(ip: string, name: string): Promise<void> {
  const spinner = createSpinner(`Fetching domain info for ${name}...`);
  spinner.start();

  try {
    const result = await sshExec(ip, buildGetFqdnCommand());
    if (result.code !== 0) {
      spinner.fail("Failed to fetch domain info");
      if (result.stderr) logger.error(result.stderr);
      return;
    }

    const fqdn = parseFqdn(result.stdout);
    spinner.succeed(`Domain info for ${name}`);
    console.log();
    logger.info(`Server: ${name} (${ip})`);
    if (fqdn) {
      logger.info(`FQDN: ${fqdn}`);
      const isHttps = fqdn.startsWith("https://");
      logger.info(`SSL: ${isHttps ? "enabled" : "disabled"}`);
      logger.info(`URL: ${fqdn}`);
    } else {
      logger.info(`FQDN: not set (using IP)`);
      logger.info(`URL: http://${ip}:8000`);
    }
  } catch (error: unknown) {
    spinner.fail("Failed to fetch domain info");
    logger.error(getErrorMessage(error));
    const hint = mapSshError(error, ip);
    if (hint) logger.info(hint);
  }
}
```
4. Note: the `requireCoolifyMode` guard before the switch already blocks bare servers from using domain commands. `info` is also a Coolify-only operation.

In `src/index.ts`: No change needed — the domain command already accepts `[subcommand]` as a positional arg. The subcommand validation is in `domainCommand`.

Add tests in `tests/unit/domain.test.ts` for the `info` subcommand: mock `sshExec` to return FQDN, verify output includes server name, FQDN, and SSL status.
  </action>
  <verify>
    <automated>cd C:/Users/Omrfc/Documents/quicklify && npx jest tests/unit/errorMapper.test.ts tests/unit/firewall.test.ts tests/unit/domain.test.ts --no-coverage 2>&1 | tail -20</automated>
  </verify>
  <done>
    - mapSshError returns dpkg lock message for dpkg-related errors
    - init token validation shows source (env var name, --token flag, or interactive prompt)
    - firewall status displays active rules list with port/protocol/action
    - domain info subcommand exists and shows FQDN, SSL status, and URL
  </done>
</task>

<task type="auto">
  <name>Task 2: UX #11 backup cleanup + UX #12 backup provider/IP display</name>
  <files>
    src/commands/backup.ts
    src/commands/restore.ts
    src/commands/destroy.ts
    src/commands/remove.ts
    src/core/backup.ts
    src/index.ts
    src/types/index.ts
    tests/unit/backup.test.ts
    tests/unit/restore.test.ts
    tests/unit/destroy.test.ts
  </files>
  <action>
**UX #11 — Backup cleanup command + destroy/remove prompt:**

1. In `src/core/backup.ts`, add a new pure function `listOrphanBackups`:
```typescript
export function listOrphanBackups(activeServerNames: string[]): string[] {
  if (!existsSync(BACKUPS_DIR)) return [];
  try {
    return readdirSync(BACKUPS_DIR)
      .filter((name) => {
        const fullPath = join(BACKUPS_DIR, name);
        // Only directories that are not in active server list
        return existsSync(join(fullPath)) && !activeServerNames.includes(name);
      })
      .sort();
  } catch {
    return [];
  }
}
```
Also add `cleanupServerBackups` that removes all backups for a given server name:
```typescript
import { rmSync } from "fs";  // add to existing fs import

export function cleanupServerBackups(serverName: string): { removed: boolean; path: string } {
  const dir = getBackupDir(serverName);
  if (!existsSync(dir)) return { removed: false, path: dir };
  try {
    rmSync(dir, { recursive: true, force: true });
    return { removed: true, path: dir };
  } catch {
    return { removed: false, path: dir };
  }
}
```

2. In `src/commands/backup.ts`, add a `backupCleanupCommand` function and wire it:
```typescript
async function backupCleanupCommand(): Promise<void> {
  const { getServers } = await import("../utils/config.js");
  const { listOrphanBackups, cleanupServerBackups } = await import("../core/backup.js");

  const servers = getServers();
  const activeNames = servers.map((s) => s.name);
  const orphans = listOrphanBackups(activeNames);

  if (orphans.length === 0) {
    logger.success("No orphan backups found. All backups belong to active servers.");
    return;
  }

  logger.title(`Found ${orphans.length} orphan backup(s):`);
  for (const name of orphans) {
    const backupCount = listBackups(name).length;
    logger.step(`${name} (${backupCount} backup${backupCount !== 1 ? "s" : ""})`);
  }
  console.log();

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Remove all ${orphans.length} orphan backup folder(s)?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info("Cleanup cancelled.");
    return;
  }

  let removed = 0;
  for (const name of orphans) {
    const result = cleanupServerBackups(name);
    if (result.removed) {
      logger.success(`Removed backups for "${name}"`);
      removed++;
    } else {
      logger.warning(`Failed to remove backups for "${name}"`);
    }
  }
  logger.success(`Cleaned up ${removed}/${orphans.length} orphan backup(s).`);
}
```
Add `inquirer` import at top of backup.ts (it is not imported there yet). Update `backupCommand` to handle `cleanup` subcommand. But wait — `backupCommand` signature is `(query?, options?)`. We need to detect if query is "cleanup":
```typescript
export async function backupCommand(
  query?: string,
  options?: { dryRun?: boolean; all?: boolean },
): Promise<void> {
  // Handle cleanup subcommand
  if (query === "cleanup") {
    return backupCleanupCommand();
  }
  // ... rest of existing code
}
```

3. In `src/commands/destroy.ts`, after successful destroy (both `result.success && result.cloudDeleted` and `result.success && result.hint` branches), add backup cleanup prompt:
```typescript
import { existsSync } from "fs";
import { listBackups, cleanupServerBackups } from "../core/backup.js";
// After the success message in each branch:
const backups = listBackups(server.name);
if (backups.length > 0) {
  const { cleanBackups } = await inquirer.prompt([
    {
      type: "confirm",
      name: "cleanBackups",
      message: `Found ${backups.length} backup(s) for "${server.name}". Remove them?`,
      default: false,
    },
  ]);
  if (cleanBackups) {
    const result = cleanupServerBackups(server.name);
    if (result.removed) {
      logger.success("Backups removed.");
    } else {
      logger.warning("Failed to remove backups.");
    }
  } else {
    logger.info("Backups kept. Run 'quicklify backup cleanup' later to remove orphans.");
  }
}
```
Extract this into a helper function `promptBackupCleanup(serverName: string)` to avoid duplication.

4. In `src/commands/remove.ts`, similarly add backup cleanup prompt after successful remove. Import `listBackups` and `cleanupServerBackups` from `../core/backup.js`. Add the same `promptBackupCleanup` pattern — since remove.ts is simpler, inline the logic or import a shared helper. For minimal code, just duplicate the 15-line block (two files is acceptable for this small logic).

**UX #12 — Backup provider/IP display + cross-provider/mode warnings:**

5. In `src/commands/backup.ts`, in the existing `backupCommand` at the final success message (line 340-342), add provider and IP:
After `logger.success(\`Backup saved to ${backupPath}\`);` add:
```typescript
logger.info(`Provider: ${server.provider} | IP: ${server.ip} | Mode: ${server.mode || "coolify"}`);
```
Do the same in `backupSingleServer` at line 145 — add provider/IP info after the success message.

6. In `src/commands/restore.ts`:
- When listing backups for selection (lines 73-81), enhance the choices to include provider/IP from manifest. Change:
```typescript
choices: backups.map((b) => ({ name: b, value: b })),
```
to:
```typescript
choices: backups.map((b) => {
  const m = loadManifest(join(getBackupDir(server.name), b));
  const info = m ? ` [${m.provider}${m.mode === "bare" ? "/bare" : ""}]` : "";
  return { name: `${b}${info}`, value: b };
}),
```
Import `loadManifest` from `../core/backup.js` (add to existing import).

- After loading manifest (line 85-89), add cross-provider warning and mode mismatch block:
```typescript
// Cross-provider warning
if (manifest.provider && manifest.provider !== server.provider) {
  logger.warning(
    `Backup was created on ${manifest.provider} but restoring to ${server.provider}. Proceed with caution.`,
  );
}

// Mode mismatch block
const serverMode = server.mode || "coolify";
const backupMode = manifest.mode || "coolify";
if (serverMode !== backupMode) {
  logger.error(
    `Mode mismatch: backup is "${backupMode}" but server "${server.name}" is "${serverMode}". Cannot restore across modes.`,
  );
  return;
}
```

Add `loadManifest` to the import from `../core/backup.js` in restore.ts (it is already imported — verify and add `getBackupDir` if not present). Also need to import `join` from `path` if not already there (it is imported via `{ join, basename }` at line 2).

7. Update tests:
- `tests/unit/backup.test.ts`: Add test for `query === "cleanup"` path.
- `tests/unit/restore.test.ts`: Add test for mode mismatch blocking restore, cross-provider warning.
- `tests/unit/destroy.test.ts`: Add test for backup cleanup prompt after destroy.
  </action>
  <verify>
    <automated>cd C:/Users/Omrfc/Documents/quicklify && npx jest tests/unit/backup.test.ts tests/unit/restore.test.ts tests/unit/destroy.test.ts tests/unit/core-backup.test.ts --no-coverage 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `quicklify backup cleanup` lists and removes orphan backups with confirmation prompt
    - `quicklify destroy` and `quicklify remove` prompt to clean up backups after success
    - `quicklify backup` output shows provider, IP, and mode
    - `quicklify restore` selection shows provider info from manifest
    - Cross-provider restore shows warning message
    - Mode mismatch (coolify vs bare) blocks restore with error
  </done>
</task>

<task type="auto">
  <name>Task 3: Full test suite + build verification</name>
  <files></files>
  <action>
Run the full test suite and build to verify no regressions from the 6 UX improvements. Fix any failing tests.

1. Run `npm run build` — must succeed with no TypeScript errors
2. Run `npm test` — all 1921+ tests must pass (may be more now with new tests)
3. Run `npx eslint src/` — no lint errors

If any test fails, fix the root cause (do NOT skip or disable tests). Common issues to watch for:
- Mock imports may need updating if new imports were added (e.g., `inquirer` in backup.ts, `rmSync` in core/backup.ts)
- New `listOrphanBackups` and `cleanupServerBackups` exports need to be mockable
- The `backupCommand` parameter change (treating query "cleanup" as subcommand) may affect existing tests that pass query strings
  </action>
  <verify>
    <automated>cd C:/Users/Omrfc/Documents/quicklify && npm run build && npm test 2>&1 | tail -30</automated>
  </verify>
  <done>
    - TypeScript build succeeds with zero errors
    - All tests pass (existing + new)
    - No lint errors
    - Coverage remains above 80%
  </done>
</task>

</tasks>

<verification>
1. `npm run build` succeeds
2. `npm test` — all tests pass, no regressions
3. `npx eslint src/` — clean
4. Manual spot check: grep for each UX item in source:
   - `grep "dpkg" src/utils/errorMapper.ts` — dpkg pattern exists
   - `grep "tokenSource\|from.*flag\|from.*env" src/commands/init.ts` — token source display
   - `grep "parseUfwStatus" src/commands/firewall.ts` — firewall status uses parsed rules
   - `grep '"info"' src/commands/domain.ts` — domain info subcommand registered
   - `grep "cleanup" src/commands/backup.ts` — backup cleanup command exists
   - `grep "provider.*mismatch\|mode.*mismatch\|Mode mismatch" src/commands/restore.ts` — mode guard exists
</verification>

<success_criteria>
- All 6 UX improvements implemented and tested
- Full test suite passes with no regressions
- Build succeeds
- No lint errors
</success_criteria>

<output>
After completion, create `.planning/quick/3-ux-improvements-3-dpkg-lock-message-4-to/3-SUMMARY.md`
</output>
