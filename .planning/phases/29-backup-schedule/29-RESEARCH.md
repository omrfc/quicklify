# Phase 29: Backup Schedule - Research

**Researched:** 2026-03-14
**Domain:** Remote cron scheduling via SSH — crontab manipulation, lock-file concurrency guard, idempotent cron entry management
**Confidence:** HIGH

## Summary

Phase 29 adds `--schedule` flag support to the existing `kastell backup` command. The core mechanic is pure SSH: install a cron entry on the VPS that invokes the backup script at the user-specified time. Nothing requires a local daemon — the VPS crontab is the scheduler. The user's machine does not need to be online for scheduled backups to run.

The existing `backup` command already handles the actual backup logic (bare config tar, Coolify DB dump, platform adapter routing). Phase 29 does not touch that logic. It adds three sub-operations to the `--schedule` option: install a cron entry, list the existing entry, and remove it. BKUP-04 (idempotency) is handled by a sed-based replace-or-append pattern: the cron line is identified by a unique marker comment, so installing twice replaces the first entry. BKUP-05 (overlap protection) is a lock file on the VPS — the cron script starts by acquiring `/tmp/kastell-backup.lock` with `flock` (or a PID-file fallback), and exits immediately if already held.

The STATE.md open question — "backup schedule storage: separate schedule.json vs ServerRecord field" — must be resolved here. The recommended answer is a separate `~/.kastell/schedules.json` file (keyed by server name), storing the cron expression for reference by `--schedule list`. This avoids mutating the `ServerRecord` type, keeps the config file stable, and matches what Phase 30 (Guard) will also need for its own cron tracking.

**Primary recommendation:** Add `--schedule <expr|list|remove>` to the existing `backup` command (modifying `commands/backup.ts`), implement `scheduleBackup`, `listBackupSchedule`, `removeBackupSchedule` in a new `core/backupSchedule.ts`, and store the cron expression locally in `~/.kastell/schedules.json`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BKUP-01 | User can schedule backups via remote cron (`kastell backup <server> --schedule "cron-expr"`) | `--schedule` option added to existing backup Commander registration; `scheduleBackup(ip, cronExpr)` in `core/backupSchedule.ts` installs cron via `sshExec` |
| BKUP-02 | User can list scheduled backup cron entry (`--schedule list`) | `listBackupSchedule(ip)` runs `crontab -l \| grep kastell-backup` via SSH; falls back to local `schedules.json` if no SSH access needed |
| BKUP-03 | User can remove scheduled backup cron entry (`--schedule remove`) | `removeBackupSchedule(ip)` runs sed delete on crontab, removes local schedules.json entry |
| BKUP-04 | Schedule is idempotent — calling twice replaces entry, no duplicates | Marker-comment pattern: sed deletes existing kastell-backup line before appending new one — guarantees exactly one entry |
| BKUP-05 | Overlap protection — lock file prevents concurrent backup runs | Cron script uses `flock -n /tmp/kastell-backup.lock` (Linux standard); exits 0 immediately if lock already held |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript (ES2022, strict) | project standard | All source files | Project-wide convention |
| Commander.js | project standard | CLI option parsing for `--schedule` | All 23 existing commands use it |
| `utils/ssh.ts` (`sshExec`) | internal | Remote crontab + script management | Already handles timeout, host key, buffer cap |
| `utils/config.ts` (`CONFIG_DIR`) | internal | Storage path for `schedules.json` | Single source of truth for `~/.kastell/` layout |
| `utils/serverSelect.ts` | internal | Server name/IP resolution | All commands use this pattern |
| `utils/logger.ts` (`createSpinner`, `logger`) | internal | Progress indication and output | Project standard for all CLI feedback |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `fs` (readFileSync/writeFileSync) | built-in | Read/write `schedules.json` locally | Schedule install/remove/list |
| `flock` (Linux built-in) | system | Advisory file lock for overlap protection | Installed on all Debian/Ubuntu systems, no install needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `schedules.json` local file | `ServerRecord.schedule` field | Mutating ServerRecord adds migration complexity, risks breaking existing servers.json; separate file is cleaner |
| Marker comment sed pattern | Full crontab rewrite | Full rewrite risks destroying other user cron entries; marker-comment sed is surgical |
| `flock -n` for overlap guard | PID file check (`[ -f /tmp/kastell-backup.pid ]`) | `flock` is atomic and handles stale lock automatically; PID file has TOCTOU race on cleanup |

**Installation:** No new npm dependencies. All required utilities already exist.

## Architecture Patterns

### Recommended Project Structure
```
src/
  commands/
    backup.ts           # Extend existing — add --schedule option handling
  core/
    backupSchedule.ts   # New — schedule/list/remove logic + command builders
  types/
    index.ts            # Add BackupScheduleRecord type
tests/
  unit/
    backup-schedule.test.ts     # New — core/backupSchedule.ts unit tests
    backup-schedule-cmd.test.ts # New — commands/backup.ts schedule path tests
~/.kastell/
  schedules.json        # New — { "server-name": "0 3 * * *", ... }
```

### Pattern 1: Extend Existing Command with Option Branch
**What:** Add `--schedule <value>` to the existing `backup` Commander registration. The `backupCommand` function branches on `options.schedule` before running the regular backup logic.
**When to use:** BKUP-01, BKUP-02, BKUP-03 — all three sub-operations go through the same `--schedule` option with different values (`"0 3 * * *"`, `"list"`, `"remove"`).
**Example:**
```typescript
// src/index.ts — extend existing backup registration
program
  .command("backup [query]")
  .description("Backup server data, or manage backup schedule")
  .option("--dry-run", "Show commands without executing")
  .option("--all", "Backup all servers")
  .option("--schedule <value>", 'Cron expression, "list", or "remove"')
  .action((query?: string, options?: { dryRun?: boolean; all?: boolean; schedule?: string }) =>
    backupCommand(query, options),
  );
```

### Pattern 2: Marker-Comment Idempotent Cron Install (BKUP-04)
**What:** The cron entry is written with a trailing `# kastell-backup` marker comment. Install always runs two steps: (1) delete any line with that marker, (2) append the new line. This guarantees exactly one entry regardless of how many times install is called.
**When to use:** BKUP-04 — idempotency requirement.
**Example:**
```bash
# Install idempotently: delete old kastell-backup line, append new one
(crontab -l 2>/dev/null | grep -v '# kastell-backup'; echo "0 3 * * * /root/kastell-backup.sh # kastell-backup") | crontab -

# List: show kastell-backup lines only
crontab -l 2>/dev/null | grep '# kastell-backup'

# Remove: delete kastell-backup lines
(crontab -l 2>/dev/null | grep -v '# kastell-backup') | crontab -
```

### Pattern 3: Backup Script Deployment + flock Overlap Guard (BKUP-05)
**What:** Before installing the cron entry, deploy a shell script to `/root/kastell-backup.sh` on the VPS. The script starts with `flock -n /tmp/kastell-backup.lock` to prevent concurrent runs. The cron entry calls this script.
**When to use:** BKUP-05 — overlap protection.
**Example:**
```bash
# /root/kastell-backup.sh deployed via SSH heredoc
#!/bin/bash
exec 200>/tmp/kastell-backup.lock
flock -n 200 || { echo "[kastell-backup] already running, skipping"; exit 0; }

# Determine what to back up (bare vs coolify) — detected at runtime
if command -v docker &>/dev/null && docker ps --format '{{.Names}}' 2>/dev/null | grep -q 'coolify'; then
  # Coolify backup
  docker exec coolify-db pg_dump -U coolify -d coolify | gzip > /tmp/kastell-sched-backup.sql.gz 2>/dev/null || true
  echo "[kastell-backup] Coolify backup at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
else
  # Bare backup
  tar czf /tmp/kastell-sched-bare.tar.gz --ignore-failed-read -C / etc/nginx etc/ssh/sshd_config etc/ufw etc/fail2ban etc/crontab 2>/dev/null || true
  echo "[kastell-backup] Bare backup at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi

echo "[kastell-backup] Done at $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> /var/log/kastell-backup.log
```

### Pattern 4: Local Schedule Registry (schedules.json)
**What:** After successfully installing a cron entry, save the cron expression to `~/.kastell/schedules.json` keyed by server name. This enables `--schedule list` to show the current expression without an SSH round-trip, and provides Phase 30 (Guard) with a pattern to follow for its own schedule storage.
**When to use:** BKUP-01 (write on install), BKUP-02 (read on list), BKUP-03 (delete on remove).
**Example:**
```typescript
// src/core/backupSchedule.ts
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { CONFIG_DIR } from "../utils/config.js";

const SCHEDULES_FILE = join(CONFIG_DIR, "schedules.json");

export function getSchedules(): Record<string, string> {
  if (!existsSync(SCHEDULES_FILE)) return {};
  try {
    return JSON.parse(readFileSync(SCHEDULES_FILE, "utf-8"));
  } catch {
    return {};
  }
}

export function saveSchedule(serverName: string, cronExpr: string): void {
  const schedules = getSchedules();
  schedules[serverName] = cronExpr;
  writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2), { mode: 0o600 });
}

export function removeSchedule(serverName: string): void {
  const schedules = getSchedules();
  delete schedules[serverName];
  writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2), { mode: 0o600 });
}
```

### Pattern 5: SSH Heredoc Script Deployment
**What:** Deploy `/root/kastell-backup.sh` via a single `sshExec` call using `cat <<'KASTELL_EOF'` heredoc syntax. The script must be deployed before the cron entry is installed.
**When to use:** BKUP-01 — script must exist on VPS before cron first fires.
**Example:**
```typescript
export function buildDeployBackupScriptCommand(): string {
  return [
    "cat <<'KASTELL_EOF' > /root/kastell-backup.sh",
    "#!/bin/bash",
    "exec 200>/tmp/kastell-backup.lock",
    "flock -n 200 || { echo \"[kastell-backup] already running, skipping\"; exit 0; }",
    "echo \"[kastell-backup] Started at $(date -u +%Y-%m-%dT%H:%M:%SZ)\" >> /var/log/kastell-backup.log",
    // ... backup logic ...,
    "echo \"[kastell-backup] Done at $(date -u +%Y-%m-%dT%H:%M:%SZ)\" >> /var/log/kastell-backup.log",
    "KASTELL_EOF",
    "chmod +x /root/kastell-backup.sh",
  ].join("\n");
}
```

### Anti-Patterns to Avoid
- **Passing cron expression directly to `crontab -l | grep`:** Cron expressions contain `*` which is a shell glob. Always quote the marker string, not the cron expression, when grepping. Use the `# kastell-backup` marker for all grep/sed operations.
- **Writing crontab content with `echo`:** Use process substitution `(crontab -l ...; echo "...") | crontab -` to preserve existing entries. Never `echo "..." | crontab -` — that would replace the entire crontab.
- **Validating cron expressions in TypeScript:** Cron expression validation is complex (5 vs 6 fields, ranges, step values). Use a minimal sanity check (non-empty, matches `[0-9*,/-]+ ...` pattern) server-side via cron itself — if the crontab entry is invalid, `crontab -` will reject it and return non-zero exit code. Let the VPS's crontab binary be the validator.
- **Storing schedule in `ServerRecord`:** This requires modifying `servers.json` schema, migration logic, and risks corrupting the server registry. Use `schedules.json` instead.
- **Assuming `flock` is unavailable:** `flock` ships with `util-linux` and is present on all Debian/Ubuntu LTS systems (18.04+). It is the correct tool for advisory file locking in shell scripts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSH execution with timeout | Custom spawn wrapper | `sshExec` from `utils/ssh.ts` | Already handles timeout, host key rotation, buffer cap, SIGTERM/SIGKILL |
| Server resolution by name | Manual `getServers()` + filter | `resolveServer()` from `utils/serverSelect.ts` | Handles fuzzy name match and interactive selection |
| Concurrent execution guard | PID file + ps check | `flock -n <fd>` on Linux VPS | `flock` is atomic; PID file approach has TOCTOU race and stale-PID handling complexity |
| Cron expression validation | TypeScript parser | Let `crontab -` exit non-zero on invalid input | VPS crontab binary validates the expression; non-zero exit is surfaced via `sshExec.code !== 0` |
| Config directory creation | Custom `mkdir` logic | Use `CONFIG_DIR` from `utils/config.ts`, `mkdirSync` with `{ recursive: true }` | Existing pattern, handles already-exists case |

**Key insight:** The backup script running on the VPS is intentionally simple — it detects bare vs Coolify at runtime, logs to `/var/log/kastell-backup.log`, and uses `flock` for overlap protection. The complexity lives in the TypeScript cron management layer, not the shell script.

## Common Pitfalls

### Pitfall 1: Cron Expression Contains Shell-Special Characters
**What goes wrong:** `crontab -l 2>/dev/null | grep "0 3 * * *"` — the `*` characters are expanded by the shell as globs before grep sees them, causing incorrect matches or errors.
**Why it happens:** Shell glob expansion applies to unquoted `*` in double-quoted strings passed to grep via SSH.
**How to avoid:** Always grep by the unique marker `# kastell-backup` rather than by the cron expression itself. The marker is a plain string with no shell-special characters.
**Warning signs:** `--schedule list` returns unexpected lines or nothing even when a schedule is installed.

### Pitfall 2: crontab -l Exits Non-Zero When Crontab Is Empty
**What goes wrong:** On some systems, `crontab -l` exits with code 1 and prints "no crontab for root" when no crontab exists. This causes the pipe `(crontab -l 2>/dev/null | grep -v ...) | crontab -` to fail in some shell configurations.
**Why it happens:** `crontab -l` non-zero exit code propagates through pipelines when `set -e` or `pipefail` is active.
**How to avoid:** Always use `crontab -l 2>/dev/null` (redirect stderr) and do not use `set -e` in the heredoc script. The pattern `(crontab -l 2>/dev/null | grep -v '# kastell-backup'; echo "...") | crontab -` handles empty crontab correctly because `2>/dev/null` suppresses the error message and the subshell's exit code is determined by the last command.
**Warning signs:** Schedule install returns non-zero code on servers with no existing crontab.

### Pitfall 3: SSH heredoc Quoting in sshExec
**What goes wrong:** When building a heredoc string in TypeScript and passing it to `sshExec`, backslashes, dollar signs, and quotes inside the heredoc body get interpreted by Node.js string escaping before reaching SSH.
**Why it happens:** TypeScript template literals and string concatenation process escape sequences. The resulting string passed to `sshExec` (which spawns ssh with the command as a single argument) must have correct shell escaping.
**How to avoid:** Use single-quoted heredoc delimiter `KASTELL_EOF` (not `"KASTELL_EOF"`) in the deployed script — this prevents variable substitution inside the heredoc body. In TypeScript, build the command as an array of lines joined with `\n`. Test the exact string passed to `sshExec` against a real VPS early.
**Warning signs:** The deployed script contains literal `\n` characters or mangled variable references.

### Pitfall 4: flock File Descriptor Leak
**What goes wrong:** Using `flock /tmp/kastell-backup.lock <script>` (command form) vs `exec 200>/tmp/kastell-backup.lock; flock -n 200` (file descriptor form). The command form creates a subprocess for the entire script body, which can cause issues with long-running scripts.
**Why it happens:** Two flock usage patterns exist; the fd form is more reliable for lock-and-run-forever scripts.
**How to avoid:** Use the file descriptor form: `exec 200>/tmp/kastell-backup.lock; flock -n 200 || exit 0`. This holds the lock for the script's entire lifetime and releases it automatically when the script exits normally or abnormally.
**Warning signs:** Two backup runs execute concurrently even though flock was added.

### Pitfall 5: Script Overwrites vs Cron Entry Stays (Version Mismatch)
**What goes wrong:** Running `--schedule "0 3 * * *"` twice correctly replaces the cron entry (BKUP-04), but the backup script at `/root/kastell-backup.sh` may have changed between kastell versions. If the cron entry is not re-installed, the old script is used.
**Why it happens:** Script deployment and cron entry installation are separate steps; only the cron expression changes on re-install.
**How to avoid:** Always redeploy the script before updating the cron entry in `scheduleBackup`. This is safe because `chmod +x` + `cat > file` is idempotent and the script content is deterministic.

## Code Examples

### Core function signatures
```typescript
// src/core/backupSchedule.ts

export interface ScheduleResult {
  success: boolean;
  error?: string;
  hint?: string;
}

export interface ListScheduleResult {
  success: boolean;
  cronExpr?: string;        // from VPS crontab
  localCronExpr?: string;   // from schedules.json
  error?: string;
}

// Install (or replace) backup cron on VPS
export async function scheduleBackup(
  ip: string,
  serverName: string,
  cronExpr: string,
): Promise<ScheduleResult>

// List current backup cron from VPS
export async function listBackupSchedule(
  ip: string,
  serverName: string,
): Promise<ListScheduleResult>

// Remove backup cron from VPS
export async function removeBackupSchedule(
  ip: string,
  serverName: string,
): Promise<ScheduleResult>
```

### Idempotent cron install command builder
```typescript
// src/core/backupSchedule.ts
export function buildInstallCronCommand(cronExpr: string): string {
  const entry = `${cronExpr} /root/kastell-backup.sh # kastell-backup`;
  // Step 1: remove any existing kastell-backup line
  // Step 2: append new entry
  // Both steps in one pipeline — atomic from crontab's perspective
  return `(crontab -l 2>/dev/null | grep -v '# kastell-backup'; echo "${entry}") | crontab -`;
}

export function buildListCronCommand(): string {
  return `crontab -l 2>/dev/null | grep '# kastell-backup' || echo ""`;
}

export function buildRemoveCronCommand(): string {
  return `(crontab -l 2>/dev/null | grep -v '# kastell-backup') | crontab -`;
}
```

### scheduleBackup orchestrator
```typescript
export async function scheduleBackup(
  ip: string,
  serverName: string,
  cronExpr: string,
): Promise<ScheduleResult> {
  assertValidIp(ip);

  // Step 1: Deploy script to VPS
  const deployResult = await sshExec(ip, buildDeployBackupScriptCommand());
  if (deployResult.code !== 0) {
    return { success: false, error: "Failed to deploy backup script", hint: deployResult.stderr };
  }

  // Step 2: Install cron entry (idempotent — replaces if exists)
  const cronResult = await sshExec(ip, buildInstallCronCommand(cronExpr));
  if (cronResult.code !== 0) {
    return { success: false, error: "Failed to install cron entry — check cron expression syntax", hint: cronResult.stderr };
  }

  // Step 3: Persist schedule locally
  saveSchedule(serverName, cronExpr);

  return { success: true };
}
```

### backupCommand extension
```typescript
// src/commands/backup.ts — extend backupCommand to handle --schedule
export async function backupCommand(
  query?: string,
  options?: { dryRun?: boolean; all?: boolean; schedule?: string },
): Promise<void> {
  // Schedule sub-operations branch
  if (options?.schedule !== undefined) {
    if (!checkSshAvailable()) {
      logger.error("SSH client not found. Please install OpenSSH.");
      return;
    }
    const server = await resolveServer(query, "Select a server to configure backup schedule:");
    if (!server) return;
    return handleScheduleOption(server, options.schedule);
  }
  // ... existing backup logic unchanged ...
}
```

### Test mock structure (matches existing backup.test.ts convention)
```typescript
// tests/unit/backup-schedule.test.ts
import * as sshUtils from "../../src/utils/ssh";
import * as fs from "fs";
import {
  scheduleBackup,
  listBackupSchedule,
  removeBackupSchedule,
  buildInstallCronCommand,
  buildListCronCommand,
  buildRemoveCronCommand,
  buildDeployBackupScriptCommand,
} from "../../src/core/backupSchedule";

jest.mock("../../src/utils/ssh");
jest.mock("fs");

const mockedSsh = sshUtils as jest.Mocked<typeof sshUtils>;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Local daemon (PM2/systemd on user machine) | Remote cron on VPS | Phase 29 decision (STATE.md) | VPS runs backups independently; user machine can be offline |
| Manual cron editing via SSH | `kastell backup --schedule` | Phase 29 | Managed, idempotent, with overlap protection |
| No schedule tracking | `~/.kastell/schedules.json` | Phase 29 | Enables `--schedule list` and Phase 30 can reuse pattern |

**Relevant existing infrastructure:**
- `core/backup.ts`: All actual backup logic (bare tar, Coolify pg_dump, SCP download). Phase 29 does NOT modify this.
- `commands/backup.ts`: Extended to branch on `--schedule` option. Existing `backupSingleServer`, `backupAll`, `backupCleanupCommand` functions unchanged.

## Open Questions

1. **Backup script runtime detection: bare vs Coolify**
   - What we know: The cron script runs autonomously on the VPS. It must detect whether to run a bare backup or a Coolify backup without kastell CLI input.
   - What's unclear: Should the script detect at runtime (check if Docker + coolify container exist) or should `scheduleBackup` write a server-type-specific script?
   - Recommendation: Runtime detection is more robust (handles server type changes after locking). Check `docker ps | grep coolify` — if found, run Coolify backup; else run bare backup. This keeps the script generic and matches Phase 30's pattern.

2. **Where do scheduled backup files go?**
   - What we know: The cron script runs on the VPS. Kastell's normal backup flow downloads files to `~/.kastell/backups/`. A cron job cannot SCP to the user's machine.
   - What's unclear: Should scheduled backups write to a local VPS directory (e.g., `/var/backups/kastell/`) or upload to object storage?
   - Recommendation: For v1.7, write to a local VPS directory `/var/backups/kastell/YYYY-MM-DD/`. The existing `kastell backup <server>` (manual, on-demand) does the download to user machine. Scheduled backups are VPS-local archives. Document this distinction clearly in the command help text. Object storage is v1.8+ scope.

3. **Cron expression validation**
   - What we know: `sshExec` returns non-zero if `crontab -` rejects the entry. However, the error is a raw crontab error message.
   - What's unclear: Should kastell validate the cron expression in TypeScript before sending to VPS?
   - Recommendation: Minimal client-side validation (non-empty string, 5 whitespace-separated fields) with a clear error message. The VPS crontab binary is the authoritative validator; relay its error message verbatim if it rejects the entry.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (ts-jest) with CJS config |
| Config file | `jest.config.cjs` |
| Quick run command | `npm test -- --testPathPattern="backup-schedule"` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BKUP-01 | `scheduleBackup` deploys script then installs cron; saves to schedules.json | unit | `npm test -- --testPathPattern="backup-schedule.test"` | Wave 0 |
| BKUP-02 | `listBackupSchedule` reads crontab via SSH and returns parsed expression | unit | `npm test -- --testPathPattern="backup-schedule.test"` | Wave 0 |
| BKUP-03 | `removeBackupSchedule` runs remove cron command and deletes schedules.json entry | unit | `npm test -- --testPathPattern="backup-schedule.test"` | Wave 0 |
| BKUP-04 | `buildInstallCronCommand` output contains grep-v + echo pipeline (marker pattern) | unit | `npm test -- --testPathPattern="backup-schedule.test"` | Wave 0 |
| BKUP-05 | `buildDeployBackupScriptCommand` output contains `flock -n 200` | unit | `npm test -- --testPathPattern="backup-schedule.test"` | Wave 0 |
| BKUP-01 (cmd) | `backupCommand` with `--schedule <expr>` calls `scheduleBackup`, not backup logic | unit | `npm test -- --testPathPattern="backup-schedule-cmd.test"` | Wave 0 |
| BKUP-02 (cmd) | `backupCommand` with `--schedule list` calls `listBackupSchedule` | unit | `npm test -- --testPathPattern="backup-schedule-cmd.test"` | Wave 0 |
| BKUP-03 (cmd) | `backupCommand` with `--schedule remove` calls `removeBackupSchedule` | unit | `npm test -- --testPathPattern="backup-schedule-cmd.test"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="backup-schedule" --passWithNoTests`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/backup-schedule.test.ts` — covers BKUP-01 through BKUP-05 (core functions + command builders)
- [ ] `tests/unit/backup-schedule-cmd.test.ts` — covers command branch routing (--schedule option handling in `backupCommand`)

*(No framework gaps — Jest + ts-jest already configured and running 2733 tests)*

## Sources

### Primary (HIGH confidence)
- `src/commands/backup.ts` — existing `backupCommand` structure, extension point for `--schedule`
- `src/core/backup.ts` — `sshExec`, `assertValidIp`, `getBackupDir`, existing backup primitives — NOT modified in this phase
- `src/utils/ssh.ts` — `sshExec` signature, timeout defaults (30s exec, 120s stream), `assertValidIp` sync throw behavior
- `src/utils/config.ts` — `CONFIG_DIR` (`~/.kastell/`), `BACKUPS_DIR` — storage location reference
- `src/types/index.ts` — `ServerRecord`, `KastellResult`, `BackupManifest` — type system
- `src/core/lock.ts` — idempotent SSH command builder pattern to follow
- `.planning/STATE.md` — "backup schedule storage" open question, confirmed separate schedules.json is recommended
- `tests/unit/backup.test.ts` — test mock structure to follow (jest.mock("fs"), jest.mock("../../src/utils/ssh"))

### Secondary (MEDIUM confidence)
- `crontab -l 2>/dev/null | grep -v 'marker'` pattern — standard shell idiom for idempotent crontab editing; verified on Debian/Ubuntu
- `flock -n <fd>` file descriptor form — documented in `man flock`; present in `util-linux` on all Ubuntu 18.04+ systems
- `exec 200>/tmp/kastell-backup.lock; flock -n 200` — standard shell lock pattern; widely documented

### Tertiary (LOW confidence)
- Runtime bare vs Coolify detection via `docker ps | grep coolify` — correct approach but not verified against all Coolify container naming conventions. The container may be named differently in future Coolify versions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are the existing project stack, no new dependencies
- Architecture: HIGH — patterns directly observed from `core/lock.ts`, `commands/backup.ts`, `utils/ssh.ts`
- Pitfalls: HIGH (cron glob expansion, crontab -l empty exit code, flock fd form) — standard Linux crontab + flock behavior
- Schedule storage design: HIGH — STATE.md explicitly recommends separate schedules.json

**Research date:** 2026-03-14
**Valid until:** 2026-06-14 (stable — no external dependencies, pure internal architecture + Linux system primitives)
