# Feature Research: Kastell v1.8 Fleet + Notifications

**Domain:** Multi-server fleet visibility, multi-channel notifications, doctor auto-remediation, and tech debt cleanup for self-hosted server CLI
**Researched:** 2026-03-14
**Confidence:** HIGH — all features directly extend existing shipped code; no new problem domains

---

## Context: What Already Exists

Before cataloguing what's new, the v1.7 foundation that v1.8 builds on:

- `kastell guard` — cron-based remote daemon, writes `MetricSnapshot` to `/var/lib/kastell/metrics.json` every 5 min. Guard script has a `notify()` stub explicitly commented "v1.8 will inject implementation here."
- `kastell doctor` — 7 checks (disk trend, swap, stale packages, fail2ban, audit regression, backup age, Docker disk). Has `DoctorFinding.command` field per finding. No `--fix` flag exists yet.
- `kastell audit` — 46 checks, 9 categories, snapshot persistence, diff engine. No fleet aggregation.
- `servers.json` — all registered servers. Already used by `kastell list`.
- `audit-history.json` — per-server audit score history. Already used by `kastell audit --trend`.
- `doctor-metrics-<ip>.json` — per-server metric history cache. Written locally by doctor --fresh runs.
- No `fleet` command, no `notifications/` module, no `kastell notify` command exist yet.

The guard script in `src/core/guard.ts` has a literal `# KASTELL_NOTIFY_HOOK` comment and a no-op `notify()` shell function. V1.8 wires the real implementation.

---

## Table Stakes (Users Expect These)

Features the target audience will expect given the stated v1.8 goal: "operationally complete for multi-server environments."

| Feature | Why Expected | Complexity | Dependencies on Existing |
|---------|--------------|------------|--------------------------|
| `kastell fleet` — one-command multi-server status table | Any tool that manages multiple servers must show them all at a glance. Without this, users run `kastell status` 5 times manually. | MEDIUM | `servers.json`, existing `kastell status` SSH check, `audit-history.json` for cached scores |
| Fleet shows audit score per server, not just uptime | Guard was marketed as the security layer. A fleet view without security posture is just a ping table — no differentiation. | MEDIUM | `loadAuditHistory()` (v1.5), existing `AuditHistoryEntry` type |
| Fleet handles unreachable servers gracefully (partial failure) | In real multi-server environments, one server being down must not block the others from displaying. | LOW | `Promise.allSettled()` pattern, existing `sshExec` timeout |
| At least one notification channel (Telegram) wired to guard | Guard daemon runs silently right now — guard alerts never reach the user. The `notify()` stub in the guard shell script is a placeholder waiting for v1.8. | HIGH | `buildDeployGuardScriptCommand()` in `core/guard.ts`, new notifications module |
| `kastell doctor --fix` interactive prompt per finding | Every `DoctorFinding` already has a `.command` field. The "Run: <command>" display is already there. `--fix` is the logical next step: prompt confirmation, then execute via SSH. | MEDIUM | `runServerDoctor()`, `DoctorFinding.command`, `sshExec()`, Inquirer.js (already in stack) |
| `kastell notify test <channel>` validation command | Before guard relies on a notification channel, users need to verify config works. Without a test command, debugging is done by waiting for a real alert. | LOW | New notifications module, Inquirer.js, config schema |
| Notification config in `~/.kastell/config.yaml` | Kastell already has a YAML config system with Zod validation. Users expect notifications to be configured the same way as everything else. | LOW | Existing `config.ts`, Zod validation, `config validate` subcommand |

---

## Differentiators (Competitive Advantage)

Features that separate Kastell from Lynis (audit only), Netdata (metrics, no action), and generic server tools.

| Feature | Value Proposition | Complexity | Dependencies on Existing |
|---------|-------------------|------------|--------------------------|
| Fleet shows security score alongside health — not just CPU/RAM | No other fleet tool shows security posture. Netdata shows metrics. Kastell shows: is this server actually secure? | MEDIUM | `loadAuditHistory()`, color-coded score formatter |
| Fleet reads cached audit score (fast) vs running live audit (slow) | Fleet is an at-a-glance dashboard. Live auditing 10 servers would take 2+ minutes. Cached score from last audit run is the right tradeoff. Response time < 10 seconds for 10 servers. | MEDIUM | `audit-history.json`, `doctor-metrics-<ip>.json` |
| Guard notification contains fix command, not just alert text | `DoctorFinding.command` already carries the suggested fix. When guard sends a Telegram alert, include the command to run — "kastell doctor myserver --fix" or the specific remediation. Competitors send "CPU HIGH" and nothing else. | MEDIUM | Guard shell script `notify()` hook, `DoctorFinding` type |
| `kastell doctor --fix` executes via SSH with explicit confirmation | The `command` field was designed for this. Interactive: show finding, show command, prompt "Execute? [y/N]", run via `sshExec()`, show output. No other tool does interactive remediation tied to its own diagnostic output. | MEDIUM | `runServerDoctor()`, `sshExec()`, Inquirer.js `confirm` prompt |
| Multi-channel fan-out (one config, all channels receive) | Guard alerts go to ALL configured channels simultaneously, not just one. If Slack is configured and Telegram is configured, both receive the alert. | LOW | `NotificationProvider` interface, `Promise.allSettled()` |
| Tech debt cleanup enables faster future feature velocity | Adapter duplication (coolify.ts/dokploy.ts ~80% same), layer violation (core importing commands), shell completion gaps — fixing these now prevents them from compounding in v1.9. | HIGH | Existing adapters, shell completions, `postSetup.ts` |

---

## Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Live audit on `kastell fleet` | Users want "current" security scores | Auditing 10 servers takes 10+ minutes, defeats the purpose of a fleet overview | Show cached score from `audit-history.json` with timestamp; user can run `kastell audit <server>` for freshness |
| Auto-fix without confirmation in `doctor --fix` | "Fully automated" sounds convenient | Running SSH commands on production without confirmation is dangerous. Trust barrier. Kastell's principle: detect → decide → act | `--fix` prompts confirmation per finding. `--force` flag skips prompts for CI use only |
| Notification retry queue / persistence database | Reliability concern | SQLite/file-based queue is infrastructure complexity for indie-hacker-scale alerting. Adds maintenance surface. | Fire-and-forget with one inline retry (try → wait 3s → retry → log failure). Sufficient for non-critical alerts. |
| Slack/Discord bot that receives commands | Interactive bot sounds useful | Bot infrastructure (webhook listener, command parsing, auth) is v2.0+ territory. Significantly more complex than one-way push. | One-way push alerts only. User runs remediation from CLI. |
| Fleet web dashboard | Visual appeal | v3.0 territory. Web UI requires auth, hosting, reverse proxy. Premature. | CLI table output with chalk color coding |
| Apprise or other notification aggregator gateway | Avoids per-channel integration code | Adds a hosted/self-hosted dependency. Kastell sends directly; no intermediary services. | Thin provider pattern: one module per channel, same `NotificationProvider` interface |
| Notification deduplication (complex state) | Prevent alert storms | Full dedup requires persistent state keyed on (server, finding type, time window). Simple threshold: "not more than 1 alert per finding type per 30 minutes per server," stored in a small JSON file. | Simple rate-limit JSON state file in `~/.kastell/guard-notify-state.json` |
| `fleet --watch` live refresh (ncurses-style) | Dashboard feel | Terminal raw mode, resize handling, cleanup on crash — significant complexity for marginal gain. | Static one-shot query. Pipe to watch(1) if needed. |
| Doctor `--fix --all` execute all fixes without review | Convenience | Running every remediation command without per-item review is dangerous in production. | `--fix` prompts each finding individually. No `--all` auto-execute. |

---

## Feature Details

### 1. `kastell fleet` — Multi-Server Visibility

**What it does:** Shows all registered servers with health status and security score in a single table. Reads from existing data; does not run fresh audits.

**Expected output:**
```
  Server        Provider   IP              Status   Score   Last Audit      Platform
  -----------   ---------  --------------  -------  ------  --------------  --------
  web-prod      hetzner    1.2.3.4         ONLINE   82/100  2h ago          coolify
  api-server    do         5.6.7.8         ONLINE   61/100  1d ago          bare
  staging       vultr      9.10.11.12      OFFLINE  --      3d ago          dokploy
```

**Data sources:**
- Server list: `getServers()` (existing)
- Health: SSH ping (`sshExec` with 5s timeout) + cloud provider status API (reuse `kastell status` core)
- Score: `loadAuditHistory(ip)` → most recent entry (NOT a live audit)
- Platform: from `ServerRecord.mode` (existing)

**Commands:**
- `kastell fleet` → table output
- `kastell fleet --json` → JSON array for scripting
- `kastell fleet --sort score` → ascending audit score (weakest servers first)

**Execution:** `Promise.allSettled()` over all servers concurrently. Per-server timeout: 8 seconds. One slow/offline server never blocks others.

**Graceful failure:** Offline servers show "OFFLINE" in status, "--" for score. No crash.

**New files needed:** `src/core/fleet.ts`, `src/commands/fleet.ts`
**Complexity:** MEDIUM — reads existing data structures, new formatter.

---

### 2. Multi-Channel Notifications

**What it does:** Delivers guard breach alerts and doctor critical findings via user-configured channels.

**Supported channels (v1.8, priority order):**
1. **Telegram** — Bot API: `POST https://api.telegram.org/bot{token}/sendMessage`. Free, no infrastructure, preferred by indie hackers. [P1]
2. **Discord** — Webhook: `POST https://discord.com/api/webhooks/{id}/{token}`. Free, developer community standard. [P1]
3. **Slack** — Incoming webhook: `POST https://hooks.slack.com/services/...`. Common in micro-DevOps teams. [P2]
4. **Email** — SMTP via Nodemailer. Fallback for teams without chat channels. [P2]

**Architecture — `NotificationProvider` interface:**
```typescript
interface NotificationProvider {
  name: string;
  send(message: NotificationMessage): Promise<void>;
}

interface NotificationMessage {
  serverName: string;
  level: 'critical' | 'warning' | 'info';
  subject: string;
  body: string;
  command?: string; // suggested fix command if applicable
}
```

**Config schema extension (config.yaml):**
```yaml
notifications:
  telegram:
    botToken: "..."
    chatId: "..."
  discord:
    webhookUrl: "..."
  slack:
    webhookUrl: "..."
  email:
    smtpHost: "smtp.example.com"
    smtpPort: 587
    from: "kastell@example.com"
    to: "admin@example.com"
    username: "..."
    password: "..."
```

**Rate limiting:** Simple JSON state file `~/.kastell/guard-notify-state.json`. Tracks last-sent timestamp per `{serverName}:{findingId}`. Skip if < 30 minutes since last send. File is written atomically (temp+rename pattern, consistent with audit snapshots).

**Fan-out behavior:** Send to ALL configured channels. Use `Promise.allSettled()`. If one channel fails, log the error and continue to others. No crash on channel failure.

**Guard integration:** Replace the no-op `notify()` shell function in `buildDeployGuardScriptCommand()` with a webhook call. Since the guard runs as a shell script on the remote VPS, the notification must be triggered from the CLI side, not from bash. The guard script writes breach events to the log; `kastell guard status` reads them. A new `kastell guard alerts` subcommand (or the existing `guard status` polling pattern) can trigger notifications after reading the log. Alternatively, the guard script can use `curl` to call a webhook directly from the VPS if the URL is injected into the script during `kastell guard start`.

**Recommended approach for guard alerts:** Inject webhook URLs into the guard shell script at deploy time (via `kastell guard start`). Guard script uses `curl` to hit Telegram/Discord webhooks directly from the VPS. Simple, reliable, no polling required. SMTP not supported from guard script (too complex in bash); Email alerts come from CLI-side doctor/notify commands only.

**New files:** `src/core/notifications/index.ts`, `src/core/notifications/telegram.ts`, `src/core/notifications/discord.ts`, `src/core/notifications/slack.ts`, `src/core/notifications/email.ts`
**New dependency:** `nodemailer` (for email only; Telegram/Discord/Slack use axios which is already in stack)
**New command:** `kastell notify test <channel>`
**Complexity:** MEDIUM — HTTP calls to well-documented APIs, config schema extension, no new problem domains.

---

### 3. `kastell doctor --fix` — Auto-Remediation Prompts

**What it does:** For each `DoctorFinding`, prompt the user with the finding description and its `.command`, then execute via SSH if confirmed.

**Expected UX:**
```
  CRITICAL: Disk projected to reach 95% full in ~3 days
  Suggested fix: df -h / && kastell audit myserver

  Execute this command on myserver? [y/N]: y
  Running...
  Filesystem      Size  Used Avail Use% Mounted on
  /dev/sda1        40G   36G  1.6G  96% /
  Done.

  WARNING: Swap usage is at 73% — high swap can indicate memory pressure
  Suggested fix: free -h

  Execute this command on myserver? [y/N]: n
  Skipped.
```

**Implementation notes:**
- Extend `doctorCommand()` in `src/commands/doctor.ts` to handle `--fix` flag
- After `displayFindings()`, iterate findings and call `confirm()` from Inquirer.js
- If confirmed: `sshExec(ip, finding.command)`, display stdout/stderr
- If declined: log "Skipped." and continue to next finding
- `--fix` only valid in server mode (when `server` argument provided); local mode has no SSH target
- `--fix --force` skips confirmation prompts (for CI/scripting)
- If `sshExec` returns non-zero exit code: show error output, log failure, continue to next finding (don't abort)

**No new files needed:** Extends existing `src/commands/doctor.ts` and `src/core/doctor.ts`
**Complexity:** LOW-MEDIUM — Inquirer.js `confirm` is already in the stack. The SSH execution path (`sshExec`) is already called by doctor for `--fresh` mode.

---

### 4. Tech Debt Cleanup

Four debt items identified in MEMORY.md, all targeted for v1.8:

**4a. Adapter duplication** — `coolify.ts`/`dokploy.ts` ~80% same backup/restore code
- Pattern: extract shared logic to `src/adapters/shared.ts` using template method or plain functions
- Complexity: MEDIUM — requires reading both adapters in full, identifying shared surface, writing shared utilities without breaking existing tests
- Risk: adapter conformance tests (40 tests from v1.6) must all pass after refactor

**4b. Layer violation** — `core/deploy.ts` imports from `commands/firewall.ts` and `commands/secure.ts`
- Pattern: extract the needed logic from commands into core (or a shared util), remove the upward import
- Complexity: MEDIUM — traced import paths, extract without duplicating
- Risk: existing tests for commands/firewall.ts and commands/secure.ts must still pass

**4c. Shell completions gaps** — `audit`, `evidence` commands + `--schedule`, `--trend`, `--days` flags missing
- Pattern: extend `src/core/completions.ts` with missing entries
- Complexity: LOW — static completions file, straightforward additions
- Risk: near zero (completions don't affect runtime behavior)

**4d. `postSetup` decomposition** — 195-line function needs bare/platform split
- Pattern: split into `postSetupBare()` and `postSetupManaged()` with shared orchestrator
- Complexity: MEDIUM — careful reading of the 195-line function to identify branch points
- Risk: provisioning tests must pass; this is a critical path

---

## Feature Dependencies

```
Notification module (src/core/notifications/)
    |
    +--requires--> config schema extension (Zod)
    +--required-by--> guard (inject webhook URLs into shell script at deploy time)
    +--required-by--> kastell notify test <channel> command
    +--optional-for--> doctor (can send critical findings via notification)

kastell fleet
    |
    +--reads--> servers.json (existing)
    +--reads--> audit-history.json (existing, loadAuditHistory)
    +--calls--> sshExec health ping (existing)
    (fully independent of notifications)

kastell doctor --fix
    |
    +--extends--> DoctorFinding.command (existing, already populated)
    +--calls--> sshExec (existing)
    +--uses--> Inquirer.js confirm (existing dependency)
    (independent of fleet and notifications)

tech debt cleanup
    (independent — no runtime feature dependencies)
    (should land before or alongside feature phases to avoid merging on broken foundations)
```

### Dependency Ordering

1. **Tech debt cleanup** — fix layer violation and adapter duplication before writing new code that depends on those layers
2. **Notification module** — blocks guard integration; start early
3. **`kastell fleet`** — independent, quick win, validates multi-server data reading patterns
4. **`kastell doctor --fix`** — independent, low risk, delivers immediate user value
5. **Guard notification integration** — requires notification module; inject webhook URLs into guard script
6. **Shell completions** — last, lowest risk, purely additive

---

## MVP Definition for v1.8

### Launch With (v1.8.0)

These ship together as the v1.8 release. All are required for the milestone goal of "operationally complete for multi-server environments."

- [ ] `kastell fleet` with health + cached audit score — validates multi-server visibility
- [ ] Notification module (Telegram + Discord minimum) + `kastell notify test` — validates alert delivery
- [ ] Guard notification integration (inject webhook into guard script at `kastell guard start`) — wires the guard daemon to notifications
- [ ] `kastell doctor --fix` interactive prompt — completes the detect-decide-act loop
- [ ] Tech debt cleanup (adapter duplication + layer violation) — required before v1.9 audit expansion touches those layers

### Defer to v1.8.x or v1.9

- [ ] Fleet `--sort` and `--filter` flags — basic table sufficient for v1.8.0
- [ ] Email SMTP notifications — Telegram + Discord covers 80%+ of users; email adds nodemailer dependency and SMTP configuration complexity
- [ ] Doctor critical findings → automatic notification — defer after `--fix` is proven stable
- [ ] `fleet --watch` live refresh — premature complexity

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `kastell fleet` | HIGH | MEDIUM | P1 |
| Notifications (Telegram + Discord) | HIGH | MEDIUM | P1 |
| Guard notification integration | HIGH | MEDIUM | P1 |
| `kastell doctor --fix` | HIGH | LOW | P1 |
| Tech debt: adapter duplication | MEDIUM (velocity) | MEDIUM | P1 |
| Tech debt: layer violation | MEDIUM (correctness) | MEDIUM | P1 |
| Shell completions gaps | LOW | LOW | P2 |
| Slack notifications | MEDIUM | LOW | P2 |
| Email notifications | MEDIUM | MEDIUM | P2 |
| `postSetup` decomposition | MEDIUM (velocity) | MEDIUM | P2 |
| Fleet `--sort`/`--filter` | LOW | LOW | P3 |
| Fleet `--watch` | LOW | HIGH | P3 |

**Priority key:**
- P1: Required for v1.8.0 milestone
- P2: Add in v1.8.x point release if time permits
- P3: Defer to v1.9+

---

## Competitor Feature Analysis

| Feature | Netdata | Lynis | CrowdSec | Kastell v1.8 |
|---------|---------|-------|----------|--------------|
| Fleet multi-server view | Yes (web dashboard) | No | No | Yes (CLI table, audit score included) |
| Security score per server | No (metrics only) | Yes (per-server, manual) | Partial (threat score) | Yes (audit score from history) |
| Alert notifications | Yes (email, Slack) | No | Yes (multi-channel) | Yes (Telegram, Discord, Slack, Email) |
| Auto-remediation prompts | No | No (shows commands, no execute) | No | Yes (`doctor --fix` via SSH) |
| Multi-cloud provider support | No | No | No | Yes (Hetzner, DO, Vultr, Linode) |
| CLI-native (no web server required) | No | Yes | Partial | Yes |

Kastell's fleet view is the only one that combines security score with health status in a CLI context without requiring a web server.

---

## Sources

- Kastell codebase v1.7.0: `src/core/guard.ts` (guard shell script with `# KASTELL_NOTIFY_HOOK` comment, `notify()` stub), `src/core/doctor.ts` (`DoctorFinding.command` field), `src/commands/doctor.ts` (existing `displayFindings()` pattern)
- Kastell `PROJECT.md` v1.8 section: confirmed target features (fleet, notifications, doctor --fix, tech debt)
- Kastell `MEMORY.md`: confirmed tech debt items (adapter duplication, layer violation, shell completions, postSetup)
- [Telegram Bot API sendMessage](https://core.telegram.org/bots/api#sendmessage) — simple POST, token + chatId required
- [Discord Webhook docs](https://discord.com/developers/docs/resources/webhook) — POST to webhook URL with JSON body
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks) — same POST pattern as Discord
- [Nodemailer SMTP](https://nodemailer.com/smtp/) — SMTP transport, existing npm package
- Coolify notification architecture (coolify.io/docs/knowledge-base/notifications) — reference for `NotificationProvider` interface design and channel fan-out behavior

---

*Feature research for: Kastell v1.8 Fleet + Notifications*
*Researched: 2026-03-14*
