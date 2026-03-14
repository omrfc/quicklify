# Domain Pitfalls: Kastell v1.7 Guard Core

**Domain:** Adding guard daemon, lock hardening, fleet visibility, doctor intelligence, multi-channel notifications, backup scheduling, and risk trend analysis to existing TypeScript CLI + MCP server management tool
**Researched:** 2026-03-14
**Confidence:** HIGH (codebase inspection + web research + established patterns from v1.6)

---

## Critical Pitfalls

### P1: Crontab Deployment Is Not Idempotent by Default

**What goes wrong:** `kastell guard install <ip>` installs the guard cron entry by SSHing in and running `crontab -e` or appending to the crontab. Every subsequent `guard install` call (for re-install, update, or retry) APPENDS a new cron entry instead of replacing the existing one. The server ends up with 3-10 duplicate `kastell-guard` cron entries all running simultaneously, causing multiple parallel alert floods.

**Why it happens:** The standard `crontab -l | crontab -` append pattern does not check for duplicates. The existing `sshExec()` pattern (single command, return stdout) is naturally append-friendly. Nothing in the current codebase has guard/cron logic yet, so there is no existing pattern to follow.

**Consequences:**
- Guard runs N times per interval (N = number of installs). One cron entry fires every 5 min; 5 duplicate entries fire every minute.
- Notification flood: users get 5 identical Telegram alerts per event.
- Cannot remove guard cleanly — `kastell guard uninstall` must know how many copies exist.

**Prevention:**
1. Use the sentinel-comment pattern: every guard cron entry is preceded by `# kastell-guard-v1.7`. Install logic: `crontab -l 2>/dev/null | grep -v "kastell-guard" | { cat; echo "# kastell-guard-v1.7"; echo "*/5 * * * * /path/to/guard.sh >> /var/log/kastell-guard.log 2>&1"; } | crontab -`
2. This command is idempotent: removes all existing kastell-guard entries, then adds exactly one.
3. Test for idempotency: run `guard install` 3 times in sequence and confirm only one cron entry exists each time.
4. `guard status` should show entry count — if count > 1, warn and self-heal.

**Detection:** Run `kastell guard install <ip>` twice. SSH in and run `crontab -l | grep kastell`. If two entries appear, idempotency is broken.

**Phase:** Guard daemon (earliest phase).

---

### P2: Lock Command Leaves Server in a Broken Intermediate State

**What goes wrong:** `kastell lock --production` applies multiple hardening steps sequentially over SSH: disable password auth → configure fail2ban → restrict sudo → set kernel parameters → configure UFW. If the SSH connection drops mid-sequence (network blip, server overload, sshd restart from the hardening itself), the server is partially hardened in an undefined state. Some settings are applied, others are not. Running `lock` again may fail because some prerequisites are already changed.

**Why it happens:** The existing `sshExec()` fires one SSH command at a time. Each hardening step is a separate SSH call. There is no transaction concept — no rollback if step 4 of 10 fails. The existing `secure.ts` has the same sequential pattern (it's a known limitation that was acceptable for setup, not for production hardening).

**Consequences:**
- PasswordAuthentication is disabled but fail2ban is not running: locked-out risk if an attacker brute-forces the remaining time window.
- If sshd restarts mid-sequence, Kastell loses its SSH connection and cannot finish.
- `kastell audit` will show partial hardening as regressions.

**Prevention:**
1. Bundle ALL lock operations into a SINGLE SSH command (heredoc script): `ssh root@ip 'bash -s' < lock-script.sh`. The lock script runs entirely server-side — one SSH connection, no mid-sequence drops.
2. Write the lock script to stdout and pipe it: no file written to server except the lock record.
3. Include `set -e` in the lock script — any step failure aborts the rest. Add a `trap cleanup EXIT` that restores the last known state on failure.
4. Write a lock state file on the server (`/etc/kastell-lock.json`) after successful completion. `kastell lock` checks this before running: if partial state detected, show which steps succeeded and offer `--resume` or `--force-reset`.
5. Run `sshd -t` (config test) before restarting sshd — catch config errors before applying.

**Detection:** Interrupt the SSH connection mid-way through a `lock` command (kill the SSH process). Check server state. If SSH access still works but the server is partially hardened, rollback is missing.

**Phase:** Lock command.

---

### P3: Fleet Parallel SSH Opens Too Many Connections — Node.js Process Hangs

**What goes wrong:** `kastell fleet status` must check N servers. The naive implementation `Promise.all(servers.map(s => checkServer(s)))` fires all SSH connections simultaneously. With 20 servers, this opens 20 parallel SSH processes. The existing `sshExec()` uses `child_process.execFile` (spawns a new process per call). At 20+ parallel processes, the OS hits file descriptor limits, some SSH processes fail to connect, and the Node.js event loop stalls waiting for orphaned child processes.

**Why it happens:** The current codebase makes one SSH call at a time — commands, audit, evidence all operate on a single server. The existing `withRetry` and `withProviderErrorHandling` are designed for sequential API calls, not parallel SSH spawning. Fleet is the first feature that requires concurrent SSH connections.

**Consequences:**
- Node.js process hangs indefinitely with no output.
- Some fleet checks succeed while others silently timeout, producing an incomplete report with no indication of which servers were skipped.
- OS-level SSH multiplexing may fail because too many ControlMaster sockets compete.

**Prevention:**
1. Implement a concurrency limiter: `p-limit` (or a 15-line rolling window) capping simultaneous SSH connections at 5. This is NOT `Promise.all` — it is a queue.
2. Each fleet SSH call must have an explicit timeout (use the existing `SSH_EXEC_TIMEOUT_MS` pattern: 30s for status, 60s for detailed metrics).
3. Catch per-server failures independently: one server's SSH failure must not reject the entire fleet promise. Use `Promise.allSettled` not `Promise.all`.
4. Report partial results: "15/20 servers checked. 3 unreachable (timeout), 2 connection refused."
5. Add a `--concurrency <n>` flag for power users managing 50+ server fleets.

**Detection:** Add 10 servers to Kastell config. Run `kastell fleet status`. If the process hangs or exits with an error referencing the first failed server, concurrency control is missing.

**Phase:** Fleet command.

---

### P4: Notification Delivery Failure Silently Drops Alerts

**What goes wrong:** `kastell guard` sends alerts via Telegram/Discord/Slack when a threshold is crossed (disk > 80%, new fail2ban ban, audit regression). If the notification delivery fails (network timeout, expired token, rate limit), the failure is silently swallowed. The guard cron job exits successfully, the user sees no error, and the critical disk alert is never delivered.

**Why it happens:** Notification is a "fire and forget" operation. The guard script will naturally use a pattern like `sendTelegram(...).catch(() => {})` to prevent notification failure from crashing the guard process. This is correct for process stability but wrong for alert reliability.

**Consequences:**
- User's server runs out of disk. Guard detected it. Guard tried to notify. Telegram token expired. Alert never delivered. User finds out when the server crashes.
- Notification channel failures are invisible — no way to know if notifications are working without testing.

**Prevention:**
1. Log all notification attempts and outcomes to a local log on the server (`/var/log/kastell-guard.log`): timestamp, channel, event, result (success/failed/rate-limited).
2. Multi-channel with fallback ordering: if primary channel (Telegram) fails, try secondary (Discord), then Email. Not all channels simultaneously — sequential fallback.
3. Implement `kastell guard test-notify <ip>` command: sends a test notification through all configured channels and reports which succeeded/failed.
4. Rate limit awareness: Discord webhooks allow 5 requests/2s per webhook. Telegram allows ~30/s. Slack webhooks allow ~1/s. Guard fires at most once per event type per interval — do NOT batch alert types into one rapid burst.
5. Never retry a failed notification inside the cron job script — the next cron run will re-evaluate. Retry adds complexity and can flood channels.

**Detection:** Set an invalid Telegram bot token. Run guard manually. Trigger a threshold event. Check if any error is visible to the user or logged anywhere. If the guard exits with code 0 and no log entry exists, silent failure is confirmed.

**Phase:** Multi-channel notifications.

---

### P5: Cron Runs Guard in Minimal Environment — Guard Script Fails Silently

**What goes wrong:** The guard cron script calls `kastell audit`, `kastell status`, or provider APIs. These require environment variables (`KASTELL_HETZNER_TOKEN`, `KASTELL_DO_TOKEN`) and a resolved `PATH` (to find `kastell`, `node`, `docker`). Cron runs with a minimal `PATH=/usr/bin:/bin` and NO shell environment. The guard script exits with `command not found` — silently, because cron errors go to mail (which nobody reads on a VPS).

**Why it happens:** This is the #1 cron pitfall (confirmed by multiple sources: 52% of "cron job not working" issues are PATH/environment failures). The existing Kastell CLI assumes it is run from an interactive shell or MCP context where the user's environment is loaded. Guard runs headless inside cron.

**Consequences:**
- Guard daemon is "installed" and appears active (`crontab -l` shows the entry) but never actually does anything.
- User thinks guard is protecting their server. It isn't.

**Prevention:**
1. The guard cron entry MUST source the environment explicitly: `*/5 * * * * . /root/.kastell/guard-env.sh && /root/.kastell/guard.sh >> /var/log/kastell-guard.log 2>&1`
2. `guard-env.sh` is generated by `kastell guard install` and contains: `export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`, `export KASTELL_HETZNER_TOKEN=...`, and any other required vars.
3. The generated guard-env.sh must have permissions `0600` (it contains API tokens).
4. `guard-env.sh` must use absolute paths for the node binary: `export NODE=/usr/bin/node` not relying on PATH for the runtime.
5. Add a heartbeat check to `kastell guard status <ip>`: reads the last N lines of `/var/log/kastell-guard.log` and shows when guard last ran successfully. If last run > 2x the interval, warn "guard may not be running."

**Detection:** Install guard on a server. Wait for 2 cron intervals. SSH in and run `cat /var/log/kastell-guard.log`. If the file is empty or shows "command not found" errors, environment setup is broken.

**Phase:** Guard daemon.

---

## Moderate Pitfalls

### P6: Backup Schedule Creates Overlapping Runs

**What goes wrong:** `backup --schedule "every 6 hours"` installs a cron job that runs the backup. If a backup takes longer than 6 hours (large database, slow network, server under load), the next scheduled backup starts while the previous one is still running. Two backup processes write to the same `/tmp/coolify-backup.sql.gz` simultaneously, corrupting the archive.

**Why it happens:** Cron does not prevent overlapping executions. The existing `backup.ts` does not use any locking mechanism (only the config layer uses `withFileLock`). The backup process involves SCP download which can take minutes on large volumes.

**Prevention:**
1. Use a lock file at the top of the backup script: `flock -n /tmp/kastell-backup.lock -c "actual_backup_command"`. If the lock is held, exit with code 0 (not an error — just skip this run).
2. Log skipped runs: "Skipping backup: previous run still in progress."
3. Use unique temp file names per run: `/tmp/kastell-backup-$(date +%s).sql.gz` instead of a fixed name. This prevents write collision even if locking fails.
4. Set a max backup duration timeout: `timeout 3600 /path/to/backup.sh` — kills the backup after 1 hour and logs the timeout.
5. The `backup --schedule` option should warn if the schedule interval is shorter than the typical backup duration (estimate based on server disk usage reported by `kastell status`).

**Detection:** Create a backup script that sleeps for 10 minutes. Schedule it every 1 minute. Check if multiple processes run simultaneously by counting PIDs.

**Phase:** Backup scheduling.

---

### P7: Risk Trend Score Changes Without Cause Context — Meaningless Trend

**What goes wrong:** `kastell doctor` shows "Risk score: 62 → 68 ↑ (worse)" without explaining WHY. The score increased because 3 new critical checks were added to the audit engine in v1.7, not because the server's security regressed. The user panics, manually audits the server, finds nothing wrong, and loses trust in the trend feature.

**Why it happens:** Risk trend uses the existing audit snapshot diff engine, which compares check results but does not distinguish "check was added to the engine" from "server regressed on existing check." The v1.6 audit has 46 checks. v1.7 may add new checks for guard/lock state. Those new checks will show as failures in trend diff without context.

**Consequences:** Alert fatigue. Users stop trusting the trend line and disable notifications. The core value proposition of Guard Core is undermined.

**Prevention:**
1. Risk trend must separate "engine change" from "server change." When a new check appears in current audit that did not exist in the snapshot, do NOT count it as a regression — count it as "N new checks added, X already pass."
2. Each cause in the trend report must reference a specific check ID: "Risk +6: SSH-07 (MaxSessions not set) ↑ critical, FW-03 (UFW inactive) ↑ critical."
3. Trend display format: `Risk: 62 → 68 ↑ (+6)` then cause list. "Risk changed by X, reasons below" is the pattern from PROJECT.md. Never show a trend number without reasons.
4. Annotate snapshots with `kastellVersion` and `checkCount`. If `checkCount` differs between snapshots, show "Note: audit engine updated from 46 to 52 checks between these snapshots."
5. Implement a `--baseline` flag that pins a snapshot as the accepted state. Trends are measured against the baseline, not the previous snapshot. This avoids drift caused by intermediate intentional changes.

**Detection:** Add a new audit check to the engine. Take a snapshot before and after (without changing server state). Run trend analysis. If the score changes and no "engine update" note is shown, the trend is misleading.

**Phase:** Risk trend, doctor command.

---

### P8: Fleet Status Uses Cloud API for Every Server — Rate Limit Hit on Large Fleets

**What goes wrong:** `kastell fleet status` fetches status for each server. For each server, the current `status.ts` calls both SSH health AND the provider API (to get cloud-level status: running, stopped, datacenter, etc.). With 20 servers across Hetzner (10) and DigitalOcean (10), this fires 20 simultaneous provider API calls. Both providers have rate limits. The existing `withRetry` adds backoff, but the thundering herd from v1.6 P7 applies here and can cause the entire fleet status to take 30+ seconds.

**Why it happens:** The current status check is designed for a single server. Fleet is the first multi-server operation that makes N provider API calls in parallel.

**Prevention:**
1. Separate fleet status into two tiers: SSH-only tier (fast, no API calls) and full tier (SSH + cloud API). Default to SSH-only for fleet — most users want "is the server up and healthy," not "what is its cloud datacenter."
2. Group provider API calls by provider: make one batch check to Hetzner for all 10 Hetzner servers before moving to DigitalOcean. This keeps rate limit state coherent per provider.
3. Re-use the jitter + per-provider rate limit state from the existing `withRetry` (v1.6 infrastructure).
4. Add `--full` flag to `fleet status` that enables cloud API enrichment.

**Phase:** Fleet command.

---

### P9: Doctor Command Recommends Actions That Contradict User's Intentional Config

**What goes wrong:** `kastell doctor` sees that password authentication is enabled and recommends "Run `kastell lock` to disable password auth." But the user intentionally left password auth enabled because their SSH key workflow on this server is managed externally (they manage keys via their cloud provider's dashboard). Doctor's recommendation is correct in general but wrong for this specific server.

**Why it happens:** Doctor applies generic best-practice rules without knowing the user's intentional deviations. The existing audit system has the same limitation (it flags everything against a universal standard). Doctor takes the next step of making active recommendations, amplifying the signal/noise problem.

**Prevention:**
1. Doctor recommendations must reference the specific check and its current value: "PasswordAuthentication is 'yes' (check SSH-02). Recommended: 'no'. Run `kastell audit --fix SSH-02 <ip>`."
2. Allow check suppression via config: `~/.kastell/suppress.yaml` with entries like `suppress: [SSH-02]`. Doctor skips suppressed checks.
3. Doctor should show "last changed" context if available from audit history: "This check has been failing for 14 days."
4. Distinguish between "critical recommendation" (act now) and "improvement opportunity" (act when convenient). Color and priority matter.
5. Never auto-apply doctor recommendations. Doctor = report + commands to run. Lock = apply. Keep the boundary sharp.

**Phase:** Doctor command.

---

### P10: Guard Script on Server Must Be Versioned — Stale Script After Kastell Update

**What goes wrong:** Guard installs a script to the server (`/root/.kastell/guard.sh`). When Kastell is updated from v1.7 to v1.8 (which adds new check logic), the guard script on the server is still v1.7. The local Kastell CLI sends alerts in v1.8 format, but the guard script generates v1.7 format. Data parsed client-side is misaligned.

**Why it happens:** Guard is a "fire and install" operation in v1.7. There is no concept of guard script versioning or update propagation. The existing auto-migration pattern (`~/.quicklify` → `~/.kastell`) handles local config, not remote scripts.

**Prevention:**
1. Guard script must embed its version: `KASTELL_GUARD_VERSION="1.7.0"`. The `guard status` command checks this version and warns if it differs from the local Kastell version.
2. `kastell guard update <ip>` command: re-installs the latest guard script using the same idempotent install pattern (P1).
3. Auto-suggest update: if `guard status` detects version mismatch, print "Guard script is v1.7.0. Kastell is v1.8.0. Run `kastell guard update <ip>` to update."
4. Script format changes between minor versions should be backward-compatible (additive). Breaking format changes require a major version bump and migration notice.

**Phase:** Guard daemon, ongoing maintenance concern.

---

### P11: Lock Command Locks Out SSH on Misconfigured Servers

**What goes wrong:** `kastell lock --production` disables password authentication (`PasswordAuthentication no` in sshd_config). If the user's SSH key is not already in `~/.ssh/authorized_keys` on the server (perhaps they've been using password auth to connect), they are permanently locked out after `lock` runs. No SSH access = no way to undo the damage without cloud console rescue mode.

**Why it happens:** The existing `secure.ts` does the same operations (it's the v1.0 setup path). But `secure` is run at provision time when the user is expected to have SSH key auth working. `lock --production` is designed to be run on an EXISTING server that may have been set up without Kastell. The user population is different: existing servers may not have Kastell-managed SSH keys.

**Consequences:** Server is permanently inaccessible via SSH. Recovery requires cloud provider console (Hetzner VNC, DO recovery mode) or a support ticket.

**Prevention:**
1. Before applying any lock operation that affects SSH auth, verify SSH key authentication works: run a test SSH command using key auth only (`-o PasswordAuthentication=no -o BatchMode=yes`). If this test fails, abort with clear error: "Your SSH key auth is not working. Running lock would lock you out. Set up key auth first."
2. Require explicit confirmation for SSH-affecting operations: `--confirm-key-auth-works` flag.
3. Dry run by default for first use: `kastell lock --production` without `--apply` shows what would change, does not apply. This is consistent with the existing `--dry-run` convention on destructive commands.
4. Document the lock sequence clearly: verify key auth → show plan → user confirms → apply → verify SSH still works.

**Detection:** Set up a test server with only password auth. Run `kastell lock --production`. If SSH access is lost without a prior warning, the safety check is missing.

**Phase:** Lock command (most critical phase to get right).

---

### P12: Notification Credential Storage Is Insecure

**What goes wrong:** Multi-channel notifications require credentials: Telegram bot token, Discord webhook URL, Slack webhook URL, SMTP password. These are stored in `~/.kastell/notifications.json` or similar. If stored with default permissions (644), any user on the machine can read them. If stored inside `servers.json` (the natural first-instinct shortcut), every server record carries all notification secrets.

**Why it happens:** The existing `servers.json` pattern uses `0o600` permissions at the file level. Adding notification credentials to the same file or a new file with default permissions is an easy mistake. The OS keychain (`@napi-rs/keyring`) is already used for provider API tokens but notification credentials are a new category.

**Prevention:**
1. Notification credentials are per-user (global), not per-server. Store in a dedicated `~/.kastell/notifications.json` with `0o600` permissions, written using the same `atomicWrite` pattern with explicit `mode` option.
2. Consider using the existing OS keychain for Telegram token and SMTP password (the highest-sensitivity credentials). Less critical: Discord/Slack webhook URLs (they are scoped to a channel, not an account).
3. Never store notification credentials inside server records in `servers.json`.
4. `kastell guard configure-notifications` command that collects credentials and writes them with correct permissions. Never accept credentials as CLI flags (they appear in shell history and process list).

**Phase:** Multi-channel notifications.

---

## Minor Pitfalls

### P13: Fleet Output Is Unreadable for Large Server Counts

**What goes wrong:** `kastell fleet status` with 30 servers prints 30 blocks of server info one after another. The output exceeds one terminal screen height. By the time the command finishes, the user is looking at servers 28-30 and must scroll to find a problem in server 3.

**Prevention:**
1. Fleet output uses a compact table format by default: one row per server (name, IP, status, disk, score, last-audit-age). Full details via `--verbose` flag.
2. Sort output: unhealthy/unreachable servers first. Healthy servers last.
3. MCP tool (`server_fleet`) must return JSON, never terminal-formatted output.

**Phase:** Fleet command.

---

### P14: Doctor Command Makes Remote SSH Calls on Every Invocation — Too Slow

**What goes wrong:** `kastell doctor <ip>` runs a full SSH audit + metrics fetch every time it is invoked. For a 10-server fleet, `kastell doctor` becomes a 60-second command. Users stop running it.

**Prevention:**
1. Doctor uses the most recent audit snapshot (already cached in `~/.kastell/audit-snapshots/`) as input. It does NOT run a new audit unless `--fresh` flag is passed.
2. If the latest snapshot is older than 24 hours, warn: "Snapshot is 3 days old. Run `kastell audit --save-snapshot <ip>` for current data."
3. Doctor = analysis of existing data. Fresh collection = audit/evidence commands. Keep the boundary explicit.

**Phase:** Doctor command.

---

### P15: Backup Schedule Confirmation Not Persisted — Lost After Machine Restart

**What goes wrong:** `backup --schedule "every 6 hours"` installs the cron entry on the server and returns success. But the schedule configuration is not written to `~/.kastell/servers.json` (the local record). After the user's machine is wiped or Kastell is reinstalled, `kastell server list` shows no schedule information, and `kastell guard status` cannot report whether scheduled backups are configured.

**Prevention:**
1. Add `backupSchedule: string | null` field to `ServerRecord` type. Persist the schedule expression when installing.
2. `kastell guard status <ip>` should report: backup schedule, last backup time (read from server log), next scheduled run.
3. Schedule expression in `ServerRecord` is the source of truth for re-installation — `guard reinstall` can restore the cron entry from the stored config.

**Phase:** Backup scheduling.

---

### P16: Risk Trend With Only One Snapshot — Division by Zero / Misleading Delta

**What goes wrong:** User runs `kastell doctor` after the very first audit snapshot. There is only one data point. The trend shows "Risk: 68 (baseline)" which is fine. But if the code naively computes `delta = current - previous`, and there is no previous, it crashes or shows "Risk: 68 → undefined (↑ NaN%)".

**Prevention:**
1. Require at least 2 snapshots for trend display. If fewer exist, show "Insufficient history for trend. Run `kastell audit --save-snapshot <ip>` again after 24 hours."
2. All trend math must handle the single-snapshot case explicitly — not via null-coalescing to 0 (which implies the score was 0 before).
3. Guard the trend computation with a type-safe helper: `computeTrend(snapshots: AuditSnapshot[]): TrendResult | null` — returns null when insufficient data.

**Phase:** Risk trend, doctor command.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Guard daemon install | P1 (duplicate cron entries), P5 (cron minimal environment) | Sentinel-comment idempotent install, generate guard-env.sh with explicit PATH + tokens |
| Guard daemon operation | P4 (silent notification failure), P10 (stale script after update) | Log all notify outcomes, embed guard script version, `guard status` checks version |
| Lock command | P2 (partial hardening on SSH drop), P11 (lockout on no key auth) | Single-SSH heredoc script, test key auth before applying, dry run by default |
| Fleet management | P3 (parallel SSH exhaustion), P8 (thundering herd on provider API) | p-limit concurrency cap at 5, Promise.allSettled for partial results, SSH-only default tier |
| Multi-channel notifications | P4 (silent failure), P12 (credential storage permissions) | Sequential fallback chain, log all delivery attempts, 0o600 for notifications.json |
| Backup scheduling | P6 (overlapping runs), P15 (schedule not persisted) | flock on backup script, unique temp filenames, persist schedule to ServerRecord |
| Risk trend analysis | P7 (engine change vs server regression), P16 (single snapshot crash) | Distinguish new checks from regressions, require 2+ snapshots, annotate with check count |
| Doctor command | P9 (contradicts intentional config), P14 (too slow without cache) | Allow check suppression config, use cached snapshots by default |

---

## Sources

- Kastell codebase: `utils/ssh.ts` (sshExec pattern, SSH_EXEC_TIMEOUT_MS=30s, MAX_BUFFER_SIZE=1MB), `core/secure.ts` (SSH command sequential pattern), `core/backup.ts` (SCP/temp file pattern), `core/audit/history.ts` (MAX_ENTRIES_PER_SERVER cap), `utils/fileLock.ts` (withFileLock pattern), `utils/retry.ts` (withRetry pattern)
- PROJECT.md: Guard autonomous architecture (cron-based, no AI, multi-channel, risk trend with cause)
- LESSONS.md: SSH timeout considerations, Inquirer non-interactive requirement for --force, core functions need context (platform/mode)
- [Cron environment pitfalls — cronitor.io](https://cronitor.io/guides/cron-troubleshooting-guide): 52% of cron failures are PATH/environment issues
- [Crontab idempotency — Ansible issue #37355](https://github.com/ansible/ansible/issues/37355): cron module not idempotent without name; overwrite vs append pattern
- [Slack rate limits](https://docs.slack.dev/apis/web-api/rate-limits/): ~1 message/s per webhook URL
- [Discord webhook rate limits](https://birdie0.github.io/discord-webhooks-guide/other/rate_limits.html): 5 requests/2s, shared across community webhooks
- [Telegram rate limits — Poracle](https://muckelba.github.io/poracleWiki/operation/ratelimits.html): ~30 messages/s bulk limit
- [Fleet: SSH certificate trust vulnerability](https://github.com/rancher/fleet/security/advisories/GHSA-xgpc-q899-67p8): fleet management tools that auto-trust SSH certs — directly analogous to TOFU concern
- [Google SRE distributed cron](https://sre.google/sre-book/distributed-periodic-scheduling/): idempotency as the most valuable safety feature for scheduled jobs
- [Linux server hardening idempotency — linux.com](https://www.linux.com/topic/linux/linux-server-hardening-using-idempotency-ansible-part-2/): idempotent hardening prevents intermediate states
- [SSH hardening lockout risk — zsec.uk](https://blog.zsec.uk/locking-down-ssh-the-right-way/): verify key auth before disabling password auth
- v1.6 PITFALLS.md: P7 (thundering herd), P15 (rate limit state not persisted) — both apply to fleet operations in v1.7

---
*Research completed: 2026-03-14*
