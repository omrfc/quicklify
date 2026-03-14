# Feature Landscape: Kastell v1.7 Guard Core

**Domain:** Autonomous security monitoring, one-command hardening, multi-server visibility, and proactive operations intelligence for self-hosted server CLI
**Researched:** 2026-03-14
**Scope:** v1.7 features only — `kastell guard`, `kastell lock`, `kastell fleet`, `kastell doctor`, multi-channel notifications, `backup --schedule`, risk trend with cause analysis.

---

## Table Stakes

Features the target audience (indie hackers, micro-DevOps teams) will expect based on the v1.5/v1.6 audit foundation and Kastell's stated product position ("autonomous server security").

| Feature | Why Expected | Complexity | Dependencies on Existing |
|---------|--------------|------------|--------------------------|
| `kastell guard start` — daemon that persists on the remote server | Audit is one-shot; autonomous = it keeps running. The product claim "Guard = heart" makes this the core deliverable. | High | SSH utilities, `runAudit()` core, existing health-check patterns from `kastell status` |
| Threshold alerts: disk, RAM, CPU | Users who deploy guard expect basic resource alerts. Missing = it feels like a glorified cron wrapper. | Medium | Existing metrics collection (LANG=C prefix pattern from v1.4) |
| Re-audit on schedule (e.g., every 6h) and send alert on regression | Audit drift detection over time. The diff engine (v1.6) is already built — guard should use it. | Medium | `runAudit()`, audit diff engine, `AuditSnapshot` from v1.6 |
| At least one notification channel on first release (Telegram recommended) | Without a notification path, guard is silent — defeats the purpose. Telegram is the most common free channel for indie hackers. | Medium | None (new integration) |
| `kastell guard stop` / `kastell guard status` | Lifecycle management of the daemon is mandatory — you need to know if it's running and how to stop it. | Low | SSH utilities, process management patterns |
| `kastell lock --production` — idempotent hardening bundle | SSH key-only auth, fail2ban, UFW, sysctl kernel tuning, unattended-upgrades. Existing `secure setup` is close but not all-in-one + idempotent. | Medium | Existing `secure setup` core, UFW, fail2ban commands |
| `kastell fleet` — list all servers with health + score at a glance | Users managing 3+ servers have no quick overview today. `kastell status <server>` is per-server only. | Medium | `servers.json` registry, `runAudit()` parallelized, `kastell status` |
| `backup --schedule "0 3 * * *"` — write cron entry on the server | Scheduled backup is the #1 feature users want after they see `kastell backup` works. | Medium | Existing `backup` core, SSH exec, cron on remote |
| Risk trend visible in `kastell audit --trend` | v1.6 already stores audit history. Showing score over time without "why" is already done via audit history. The "why" = cause list. | Medium | Existing `AuditHistoryEntry`, diff engine from v1.6 |

---

## Differentiators

Features that distinguish Kastell from Lynis, CrowdSec, Netdata — none of which combine these concerns.

| Feature | Value Proposition | Complexity | Dependencies on Existing |
|---------|-------------------|------------|--------------------------|
| Guard daemon installs as **cron on the remote server** (not a local process) | No PM2/systemd on user's machine. Kastell writes a crontab entry on the VPS via SSH, then the VPS runs the guard script. Clean, universal, zero local state. | Medium | SSH exec, crontab manipulation, remote script install |
| Risk trend with **cause list** — "Score 62→68 ↑ because: fail2ban not running, PermitRootLogin not disabled" | Trend without cause is useless. Kastell already has check-level diff (v1.6). Wiring the failed checks into the trend line is the differentiator. | Medium | `AuditSnapshot` diff, `AuditHistoryEntry`, v1.6 diff engine |
| `kastell fleet` shows **security score per server**, not just uptime | No fleet tool shows security posture. Others show ping/CPU/memory. Kastell adds audit score. | High | Parallel `runAudit()` across all servers, fleet formatter |
| `kastell doctor` — proactive recommendations before things break | Not just "here is what is wrong now" but "here is what is about to go wrong": disk trending toward full, swap usage creeping, unpatched packages accumulating. | High | Metric collection, threshold-based trend logic, no ML |
| `kastell lock` is **idempotent and platform-aware** | Running it twice doesn't break anything. Knows Coolify/Dokploy/Bare differences (don't change ports Coolify needs). | Medium | Existing `requireManagedMode`, platform adapter pattern |
| Backup schedule writes **verified crontab** with overlap protection | `concurrencyPolicy=Forbid` equivalent for cron: checks if previous backup is still running before starting new one. | Medium | Backup core, remote cron, lock file on server |
| Multi-channel notification with **channel test command** | `kastell notify test telegram` confirms config works before guard relies on it. Coolify does this, Kastell should too. | Low | New notification module |

---

## Anti-Features

Features to explicitly NOT build in v1.7. Either premature, wrong scope, or contradicts strategic principles.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| AI/ML anomaly detection in guard | PROJECT.md: "No AI/ML — deterministic thresholds only." ML models need training data, introduce false positives, and are opaque. | Static thresholds: disk > 80%, CPU > 90% for 5min, etc. |
| Guard daemon as a **local** long-running Node.js process | Kastell is a CLI tool, not a background service on the user's machine. A local daemon requires install/uninstall lifecycle, conflicts with project's "no infrastructure" principle. | Remote cron on the VPS — it runs on the server, not on the user's laptop |
| PM2-managed guard process | Introduces PM2 dependency and its own maintenance surface. Out of scope. | Remote cron entry managed by Kastell via SSH |
| systemd service unit file generation | Only works on systemd Linux, not universally supported, complex rollback. | crontab — supported on every Linux/Unix VPS |
| Fleet web dashboard | v3.0 territory. Building a web UI now is premature and violates "open source + local first." | CLI table output for `kastell fleet` |
| Apprise/third-party notification gateway | Adds a hosted dependency. Kastell sends directly to Telegram/Discord/Slack/SMTP. | Thin provider pattern: one module per channel |
| Notification queue / retry persistence | For a security monitoring tool at indie-hacker scale, fire-and-forget with a single retry is sufficient. A durable queue is infrastructure complexity. | Inline retry: try once, wait 5s, try again, log failure |
| Auto-remediation in guard (auto-fix on detection) | Running automated `kastell audit --fix` without user confirmation is dangerous on production. Trust barrier. | Alert + fix command suggestion. User runs the fix. |
| Backup scheduling via local cron on user's machine | Kastell doesn't own the user's cron. | Remote cron on the VPS — consistent with guard's cron-on-server approach |
| Slack/Discord bot with commands | Bot infrastructure is v2.0+ territory. | One-way notification only (push alerts from guard) |
| Fleet centralized metrics aggregation server | Requires a Kastell-hosted backend or self-hosted collector. Premature. | Pull-based: `kastell fleet` SSHs to each server at query time |

---

## Feature Details

### 1. `kastell guard` — Autonomous Security Monitoring Daemon

**What it does:** Installs a shell script on the remote server and registers it as a crontab entry. The script runs on the VPS periodically, checks health, runs audit, sends alerts if thresholds exceeded or regressions detected.

**Architecture decision — remote cron, not local daemon:**
- Guard logic lives on the server as a shell script (or compiled Node.js bundle via `kastell guard install`)
- `kastell guard start <server>` deploys the script and writes the crontab entry via SSH
- `kastell guard stop <server>` removes the crontab entry
- `kastell guard status <server>` checks if crontab entry exists and shows last run result
- No process stays alive on the user's machine

**Expected behavior:**
- `kastell guard start myserver` → uploads guard script + cron entry `*/5 * * * * /opt/kastell/guard.sh`
- Guard script checks: disk usage, RAM usage, CPU (5-min load average), last audit score delta
- On threshold breach: sends notification via configured channel(s)
- On audit regression (vs last snapshot): sends notification with regressed check names
- Guard script logs to `/var/log/kastell-guard.log` (rotated weekly, max 7 days)
- Idempotent: running `guard start` twice just overwrites the crontab entry — no duplicates

**Complexity:** High. New `core/guard/` module. Remote script deployment via SCP + SSH. Crontab manipulation via `crontab -l | ... | crontab -`. Notification integration. Lock file on server to prevent overlapping runs.

**Alternative considered:** Local Node.js daemon with setInterval. Rejected — Kastell should not run as a background service on the user's machine. Remote cron is the correct separation.

---

### 2. `kastell lock --production` — One-Command Server Hardening

**What it does:** Applies an ordered, idempotent hardening bundle to a server in a single command. Stronger than existing `kastell secure setup` (which is provisioning-time only).

**Expected behavior:**
- `kastell lock myserver --production` applies all checks below, skipping any already satisfied
- Each step is idempotent: running twice is safe
- Dry-run: `kastell lock myserver --production --dry-run` shows what would change
- After completion: shows audit score before/after

**Hardening steps (ordered):**
1. SSH key-only auth (`PasswordAuthentication no`, `PubkeyAuthentication yes`)
2. Disable root login (`PermitRootLogin no`) — only if non-root sudo user exists
3. SSH port unchanged unless `--ssh-port <port>` explicitly passed (don't break existing access)
4. fail2ban: install if absent, verify `sshd` jail active
5. UFW: enable if inactive, ensure Kastell ports are allowed (platform-aware: Coolify 8000, Dokploy 3000)
6. Unattended-upgrades: install + enable security-only updates
7. Sysctl kernel hardening: `net.ipv4.conf.all.rp_filter=1`, `net.ipv4.icmp_echo_ignore_broadcasts=1`, etc.
8. Disable unused services (optional, `--strict` flag): cups, avahi, rpcbind

**Platform-awareness:**
- `--mode coolify`: ensure port 8000 stays open in UFW
- `--mode dokploy`: ensure port 3000 stays open in UFW
- `--mode bare`: no platform port exceptions

**Complexity:** Medium. Existing `secure setup` does SSH hardening and fail2ban. `lock` extends it with kernel sysctl, unattended-upgrades, and structured before/after scoring. Idempotency is the critical new concern — each step must check-before-apply.

**What NOT to include:** Automatic port changes (lockout risk), service removal without explicit `--strict` flag, anything that would break a running Coolify/Dokploy instance.

---

### 3. `kastell fleet` — Multi-Server Visibility

**What it does:** Shows all registered servers with health status and security score in a single table.

**Expected behavior:**
- `kastell fleet` → table: server name | provider | IP | status | audit score | last audit | platform
- `kastell fleet --json` → JSON array for scripting
- `kastell fleet --sort score` → sorted by audit score ascending (weakest first)
- Status column: online (green), offline (red), unknown (yellow)
- Score column: color-coded (≥80 green, 60-79 yellow, <60 red)
- Parallel execution: all servers queried concurrently via `Promise.all()` with per-server timeout
- Graceful partial failure: if one server is unreachable, show "OFFLINE" for that row, continue

**Data sources:**
- Server list: `servers.json` (all registered servers)
- Health: quick SSH check + cloud provider status API (reuse existing `kastell status` core)
- Audit score: last stored `AuditHistoryEntry` from `~/.kastell/audit-history.json` (NOT a live audit — that would be too slow for fleet view)

**What fleet does NOT do:** Run a fresh audit on each server (too slow for fleet overview). Use `kastell audit --compare` for two-server deep comparison.

**Complexity:** Medium. New `core/fleet.ts` module. Parallel SSH + provider API calls with timeout. New table formatter. Reads existing `AuditHistoryEntry` for cached scores.

---

### 4. `kastell doctor` — Proactive Operations Intelligence

**What it does:** Analyzes server trends and warns about things that are about to break — before they do.

**Expected behavior:**
- `kastell doctor myserver` → list of findings ordered by severity
- Finding types (deterministic thresholds, no ML):
  - **Disk trending full**: current disk > 70% AND grew > 5% in 7 days → "Disk will fill in ~14 days at current rate"
  - **Swap usage high**: swap > 50% → "RAM pressure detected, consider upgrading plan or tuning swap"
  - **Packages stale**: last `apt upgrade` > 30 days → "Security updates pending, run kastell update"
  - **Fail2ban ban rate high**: > 100 bans in last 24h → "High brute-force activity on this IP"
  - **Audit regression streak**: 3+ consecutive audit score drops → "Audit score has declined for 3 consecutive runs"
  - **Backup age**: last backup > 7 days → "No recent backup detected"
  - **Docker disk usage**: `docker system df` shows > 5GB reclaimable → "Docker can be cleaned with: docker system prune"
- Output format: each finding has severity (critical/warning/info), description, and recommended command
- `kastell doctor myserver --fix` prompts for each finding with a suggested command to run

**Complexity:** High. Requires collecting multiple metric types in a single SSH session (disk history requires reading from logs or comparing sequential polls, or using stored metric snapshots). The "trending" logic needs historical data — store a lightweight metric snapshot alongside audit history.

**Key design constraint:** No ML. All recommendations from static rules + thresholds. "Disk will fill in ~14 days" is a linear extrapolation from two data points (last stored metric + current), not a learned model.

**Historical data needed:** Doctor needs at least two data points separated by time. Store a `MetricSnapshot` (disk %, swap %, package age) in `~/.kastell/metrics-history.json` per server, similar to `audit-history.json`. Guard daemon updates this on each run.

---

### 5. Multi-Channel Notifications

**What it does:** Delivers guard alerts and doctor findings via configured channels.

**Supported channels (v1.7):**
1. **Telegram** — via Bot API (HTTP POST to `api.telegram.org/bot{token}/sendMessage`). Most common for indie hackers, free, no infra. [HIGH priority]
2. **Discord** — via webhook URL (HTTP POST with JSON payload). Free, widely used by developer communities. [HIGH priority]
3. **Slack** — via incoming webhook URL. Common in micro-DevOps teams. [MEDIUM priority]
4. **Email** — via SMTP (Nodemailer). Fallback for teams without chat channels. [MEDIUM priority]

**Configuration:**
```yaml
# ~/.kastell/config.yaml
notifications:
  telegram:
    botToken: "..."
    chatId: "..."
  discord:
    webhookUrl: "..."
  slack:
    webhookUrl: "..."
  email:
    smtp: "smtp.example.com:587"
    from: "kastell@example.com"
    to: "admin@example.com"
```

**Commands:**
- `kastell notify test telegram` — sends a test message to verify config
- `kastell notify test discord` — same for Discord
- Notification config managed via `kastell config` commands (extends existing config system)

**Expected behavior:**
- Guard sends via all configured channels
- If a channel fails: log error, try next channel, don't crash guard
- Message format: plain text with server name, finding severity, description, and suggested fix command
- Rate limiting: max 1 alert per finding type per 30 minutes per server (prevent flood)

**Architecture:** Thin provider pattern — one module per channel implementing a `NotificationProvider` interface:
```typescript
interface NotificationProvider {
  name: string;
  send(message: NotificationMessage): Promise<void>;
}
```

**Complexity:** Medium. HTTP calls (Telegram/Discord/Slack use webhooks/Bot API, all are simple POST requests). Nodemailer for SMTP. Config schema extension. The rate-limiting state can be stored in a simple JSON file in `~/.kastell/`.

**What NOT to build:** Notification queue, persistence, retry database, bot command handling (listen for messages from Slack/Discord bots). One-way push only.

---

### 6. `backup --schedule` — Scheduled Backup via Remote Cron

**What it does:** Writes a cron entry on the remote server that triggers `kastell backup` on a schedule, or alternatively deploys a backup shell script that runs independently of Kastell being installed on the user's machine.

**Expected behavior:**
- `kastell backup myserver --schedule "0 3 * * *"` → installs backup cron on VPS
- `kastell backup myserver --schedule list` → shows current scheduled backup cron entry
- `kastell backup myserver --schedule remove` → removes the cron entry
- Idempotent: calling `--schedule` twice replaces the entry, doesn't duplicate
- Overlap protection: cron script checks for a lock file before running; if previous backup still running, skips and logs

**Two backup strategies (platform-aware):**
- Coolify/Dokploy: uses platform adapter's `backup()` method (already implemented)
- Bare: uses `rsync` or tar to `/mnt/backup/` (new)

**Cron format validation:**
- Parse and validate the user's cron expression before writing
- Display human-readable description: `"0 3 * * *" → runs daily at 03:00 UTC`

**Complexity:** Medium. Cron entry manipulation via SSH (same pattern as guard). Lock file on server to prevent overlapping backups. Cron expression validation (use a small utility or validate via `crontab` itself).

---

### 7. Risk Trend with Cause Analysis

**What it does:** Shows audit score over time with the specific checks that drove each score change — not just "score went from 62 to 68" but "score rose because: fail2ban enabled (+6), PermitRootLogin disabled (+4)".

**Expected behavior:**
- `kastell audit myserver --trend` → shows last 10 audit runs with scores and cause delta
- `kastell audit myserver --trend --days 30` → time-bounded trend
- Each data point shows: timestamp, score, score delta vs previous, list of checks that changed (using v1.6 diff engine)
- Color-coded: score improvements green, regressions red
- `--trend --json` for machine-readable output

**Data sources:**
- `audit-history.json` stores scores (already exists from v1.5)
- Snapshots (from v1.6) store full check state — diff between consecutive snapshots gives the cause list
- If no snapshots exist for an interval, show score without cause ("cause data unavailable for this period")

**Implementation note:** The diff engine from v1.6 already compares two `AuditResult` objects check-by-check. Trend cause analysis is just applying that diff across the full snapshot history in chronological order.

**Complexity:** Medium. Reads from existing data structures. Trend formatter is new. Correlation between `audit-history.json` (scores) and `snapshots/` (full results) needs careful timestamp matching.

---

## Feature Dependencies

```
Notification module (core/notifications/)
    |
    +---> guard needs notifications
    +---> doctor needs notifications (alert on critical findings)

backup --schedule
    (independent — uses existing backup core + SSH cron manipulation)

kastell lock --production
    (independent — extends existing secure setup)

kastell guard start
    |
    +---> requires notification module (to send alerts)
    +---> writes MetricSnapshot on each run (feeds doctor)
    +---> reads AuditSnapshot diff (uses v1.6 snapshot+diff engine)

kastell fleet
    |
    +---> reads servers.json (existing)
    +---> reads audit-history.json (existing) for cached scores
    +---> quick SSH health check (reuse kastell status core)

kastell doctor
    |
    +---> requires MetricSnapshot history (written by guard, or on-demand by doctor itself)
    +---> reads audit-history.json (existing)
    +---> optionally triggers notifications for critical findings

risk trend (kastell audit --trend)
    |
    +---> requires audit-history.json (v1.5, existing)
    +---> requires snapshots (v1.6, existing) for cause analysis
    +---> independent of guard and doctor
```

### Dependency Ordering (recommended build order):

1. **Notification module** — blocks guard and doctor
2. **`backup --schedule`** — independent, low-risk, quick win
3. **`kastell lock --production`** — independent, high user value
4. **Risk trend (`--trend`)** — independent, builds on v1.6 data
5. **`kastell guard`** — requires notifications; writes metrics for doctor
6. **`kastell fleet`** — independent of guard but more useful after guard is collecting data
7. **`kastell doctor`** — requires at least 2 metric snapshots from guard; should land last

---

## MVP Recommendation

**Phase 1 (Notifications + Lock + Schedule):** Notification module + `kastell lock` + `backup --schedule`
- Notification is the foundation that blocks guard. Build it first with `test` command to validate before wiring guard.
- `lock` and `backup --schedule` are independent and deliver immediate standalone value.
- Fast wins that can ship while guard is being built.

**Phase 2 (Guard + Trend):** `kastell guard` + risk trend (`--trend`)
- Guard is the core feature. Trend builds on v1.6 data already available.
- Both rely on the notification module from Phase 1.

**Phase 3 (Fleet + Doctor):** `kastell fleet` + `kastell doctor`
- Fleet is presentational (reads existing data) — relatively fast.
- Doctor needs metric history, which guard provides — doctor should launch after guard has been running.

**Defer to v1.8:**
- Email SMTP notifications (Telegram + Discord covers 80% of users in v1.7)
- `kastell doctor --fix` auto-remediation prompts (get the doctor output right first)
- Fleet `--sort` and `--filter` flags (basic table is sufficient for v1.7)

---

## Complexity Budget (Estimates)

| Feature | Estimated LOC | New Files | New Dependencies | Risk |
|---------|--------------|-----------|------------------|------|
| Notification module | ~200 | 3–4 (core/notifications/ + channel providers) | nodemailer (email only) | Medium |
| `kastell lock --production` | ~180 | 2 (core/lock.ts, commands/lock.ts) | None | Medium |
| `backup --schedule` | ~120 | 0 (extend existing backup core + command) | None | Low |
| Risk trend (`--trend`) | ~150 | 1 (core/audit/trend.ts) | None | Low |
| `kastell guard` | ~350 | 3–4 (core/guard/, commands/guard.ts, remote script) | None | High |
| `kastell fleet` | ~200 | 2 (core/fleet.ts, commands/fleet.ts) | None | Medium |
| `kastell doctor` | ~300 | 2 (core/doctor.ts, commands/doctor.ts) | None | High |
| Shell completions update | ~50 | 0 (extend existing completions) | None | Low |
| **Total** | **~1,550** | **~17** | **1 (nodemailer, optional)** | |

---

## Sources

- [Healthchecks.io — cron job monitoring patterns](https://healthchecks.io) — cron-on-server approach for daemon without local process
- [Running Node.js with systemd (NodeSource)](https://nodesource.com/blog/running-your-node-js-app-with-systemd-part-1) — why remote cron beats local Node.js daemon for Kastell's use case
- [Apprise Docker multi-platform notifications](https://oneuptime.com/blog/post/2026-02-08-how-to-run-apprise-in-docker-for-multi-platform-notifications/view) — evaluated and rejected (adds hosted dependency); direct channel integration preferred
- [Coolify notification docs](https://coolify.io/docs/knowledge-base/notifications) — reference for notification channel design (Email, Telegram, Discord, Slack, Mattermost, Pushover, Webhooks)
- [Integrating AlertManager with Slack/Discord](https://dohost.us/index.php/2025/09/28/integrating-alertmanager-with-slack-or-discord-for-team-notifications/) — webhook-based notification patterns
- [Linux server hardening checklist — Pluralsight](https://www.pluralsight.com/resources/blog/tech-operations/linux-hardening-secure-server-checklist) — hardening step ordering and idempotency patterns
- [SSH hardening: 12 steps — CloudIngenium](https://kx.cloudingenium.com/ssh-hardening-secure-linux-server/) — lock step ordering reference
- [Safe scheduling patterns — Medium/Javarevisited](https://medium.com/javarevisited/safe-scheduling-patterns-in-spring-fix-overlaps-cron-issues-and-idempotent-job-failures-ed41e765e07c) — idempotent cron job design, overlap protection
- [Cyber risk scoring methods — Centraleyes](https://www.centraleyes.com/7-methods-for-calculating-cybersecurity-risk-scores/) — cause-based risk trend scoring rationale
- [Proactive monitoring — Fortra/Intermapper](https://www.fortra.com/blog/what-is-proactive-monitoring) — doctor intelligence pattern: predict before it breaks
- [Best server monitoring tools 2025 — MOSS](https://moss.sh/server-management/best-server-monitoring-tools-2025/) — competitive landscape confirming no tool covers Kastell's full position
- Kastell codebase (v1.6): `src/core/audit/`, `src/utils/ssh.ts`, `src/core/evidence.ts` — verified integration points

---

*Research completed: 2026-03-14*
*Scope: Kastell v1.7 Guard Core feature landscape*
