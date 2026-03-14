# Architecture Research

**Domain:** CLI security toolkit — fleet visibility, multi-channel notifications, doctor auto-fix (v1.8)
**Researched:** 2026-03-14
**Confidence:** HIGH — based on direct source code analysis of v1.7 codebase

---

## Existing Architecture (v1.7 Baseline)

```
┌─────────────────────────────────────────────────────────────┐
│                    Entry Points                              │
│  ┌──────────────────┐      ┌────────────────────────────┐   │
│  │  CLI (index.ts)  │      │  MCP Server (mcp/server.ts)│   │
│  │  26 commands     │      │  12 tools                  │   │
│  └────────┬─────────┘      └──────────────┬─────────────┘   │
├───────────┼──────────────────────────────┼─────────────────┤
│                Commands Layer (thin)                         │
│  ┌────────┴──────────────────────────────┴──────────────┐   │
│  │  src/commands/ — arg parsing, display, spinner, route│   │
│  └───────────────────────────┬───────────────────────────┘  │
├───────────────────────────────┼─────────────────────────────┤
│                  Core Layer (fat — all business logic)       │
│  ┌───────────┐ ┌─────────┐ ┌─────────┐ ┌───────┐ ┌──────┐  │
│  │ audit/    │ │ guard   │ │ doctor  │ │ lock  │ │backup│  │
│  │ (checks,  │ │ (cron   │ │ (7 pure │ │       │ │sched-│  │
│  │  history, │ │  script │ │  checks,│ │       │ │ule)  │  │
│  │  diff,    │ │  deploy)│ │  cache) │ │       │ │      │  │
│  │  snapshot)│ └─────────┘ └─────────┘ └───────┘ └──────┘  │
│  └───────────┘ ┌─────────┐ ┌─────────┐ ┌───────┐ ┌──────┐  │
│                │ deploy  │ │ secure  │ │status │ │token │  │
│                └─────────┘ └─────────┘ └───────┘ └──────┘  │
├──────────────────────────────────────────────────────────────┤
│              Infrastructure Layer                            │
│  ┌───────────────────────────┐ ┌──────────────────────────┐  │
│  │  Providers (cloud APIs)   │ │  Adapters (platforms)    │  │
│  │  hetzner/do/vultr/linode  │ │  coolify/dokploy/bare    │  │
│  └───────────────────────────┘ └──────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│                   Utilities                                  │
│  ssh · config · fileLock · retry · modeGuard · serverSelect  │
├──────────────────────────────────────────────────────────────┤
│              Local State (~/.kastell/)                       │
│  servers.json · guard-state.json · audit-history-{ip}.json  │
│  doctor-metrics-{ip}.json · audit-snapshots/ · backups/     │
└──────────────────────────────────────────────────────────────┘
```

---

## v1.8 Changes: New vs Modified

### System Overview with v1.8 Additions

```
┌─────────────────────────────────────────────────────────────┐
│                    Entry Points                              │
│  ┌──────────────────┐      ┌────────────────────────────┐   │
│  │  CLI (index.ts)  │      │  MCP Server (mcp/server.ts)│   │
│  │  + fleet command │      │  + server_fleet tool        │   │
│  └────────┬─────────┘      └──────────────┬─────────────┘   │
├───────────┼──────────────────────────────┼─────────────────┤
│                Commands Layer                                │
│  ┌───────────────────┐   ┌──────────────────────────────┐   │
│  │ NEW commands/     │   │ MODIFIED commands/           │   │
│  │ fleet.ts          │   │ doctor.ts  (+ --fix flag)     │   │
│  └────────┬──────────┘   └──────────────┬───────────────┘   │
├───────────┼─────────────────────────────┼───────────────────┤
│                    Core Layer                                │
│  ┌──────────────────────┐ ┌──────────────────────────────┐  │
│  │ NEW core/            │ │ MODIFIED core/               │  │
│  │ fleet.ts             │ │ doctor.ts (+runAutoFix())     │  │
│  │ notify/              │ │ guard.ts  (+notify injection) │  │
│  │   index.ts           │ └──────────────────────────────┘  │
│  │   telegram.ts        │                                   │
│  │   discord.ts         │ TECH DEBT (refactor, no behavior  │
│  │   slack.ts           │ change):                         │
│  │   email.ts           │ adapters/coolify.ts              │
│  └──────────────────────┘ adapters/dokploy.ts              │
│                           core/deploy.ts (layer violation)  │
├──────────────────────────────────────────────────────────────┤
│              Infrastructure + Utils (unchanged)              │
└──────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

| Component | Responsibility | New vs Modified |
|-----------|----------------|-----------------|
| `commands/fleet.ts` | Arg parsing for fleet subcommands (status/audit/doctor); renders table | NEW |
| `core/fleet.ts` | Parallel multi-server data aggregation via `Promise.allSettled` | NEW |
| `core/notify/index.ts` | `NotificationChannel` interface + channel registry + `dispatchNotification()` | NEW |
| `core/notify/telegram.ts` | HTTP POST to Telegram Bot API (`axios`, no new dep) | NEW |
| `core/notify/discord.ts` | HTTP POST to Discord webhook (`axios`, no new dep) | NEW |
| `core/notify/slack.ts` | HTTP POST to Slack incoming webhook (`axios`, no new dep) | NEW |
| `core/notify/email.ts` | SMTP dispatch via `nodemailer` (one new dep) | NEW |
| `mcp/tools/serverFleet.ts` | MCP tool delegating to `core/fleet.ts` | NEW |
| `core/doctor.ts` | Add `runAutoFix()` which executes `DoctorFinding.command` over SSH | MODIFIED |
| `core/guard.ts` | Replace `notify()` stub in script template with `curl` webhook calls or structured breach log | MODIFIED |
| `commands/doctor.ts` | Add `--fix` flag, interactive confirm loop, display fix results | MODIFIED |
| `adapters/coolify.ts` | Extract backup/restore to shared template (tech debt, no behavior change) | MODIFIED |
| `adapters/dokploy.ts` | Use same shared template (tech debt, no behavior change) | MODIFIED |
| `adapters/shared.ts` | Add `sharedCreateBackup()` + `sharedRestoreBackup()` template functions | MODIFIED |
| `core/deploy.ts` | Remove import of `commands/firewall.ts` and `commands/secure.ts` — move needed logic to `core/` | MODIFIED (layer violation fix) |
| `commands/completions.ts` | Add `fleet`, `notify`, `--fix` to static completion strings | MODIFIED |

---

## Recommended Project Structure Changes

```
src/
├── commands/
│   ├── fleet.ts          # NEW — thin wrapper for fleet subcommands
│   └── doctor.ts         # MODIFIED — add --fix flag handling
├── core/
│   ├── fleet.ts          # NEW — multi-server aggregation
│   ├── notify/           # NEW — notification subsystem
│   │   ├── index.ts      #   NotificationChannel interface + dispatch router
│   │   ├── telegram.ts   #   Telegram Bot API (axios only)
│   │   ├── discord.ts    #   Discord webhook (axios only)
│   │   ├── slack.ts      #   Slack webhook (axios only)
│   │   └── email.ts      #   SMTP via nodemailer
│   ├── doctor.ts         # MODIFIED — add runAutoFix()
│   └── guard.ts          # MODIFIED — inject notify hook into script template
├── mcp/
│   └── tools/
│       └── serverFleet.ts  # NEW — MCP tool for fleet
├── adapters/
│   ├── shared.ts         # MODIFIED — add backup/restore template helpers
│   ├── coolify.ts        # MODIFIED — use shared template (no behavioral change)
│   └── dokploy.ts        # MODIFIED — use shared template (no behavioral change)
└── commands/
    └── completions.ts    # MODIFIED — add fleet, --fix, notify flags
```

---

## Architectural Patterns

### Pattern 1: Parallel Fan-Out for Fleet (`Promise.allSettled`)

**What:** `core/fleet.ts` calls existing per-server core functions in parallel. Returns `FleetResult[]` where each entry carries server identity plus either data or an error string. Uses `Promise.allSettled` not `Promise.all` so one unreachable server never blocks the rest.

**When to use:** Any operation spanning registered servers.

**Trade-offs:** No streaming output — full parallel execution then display. Acceptable for 2-20 servers (Kastell's target range). For 50+ servers a concurrency limit (manual semaphore) would be needed to avoid exhausting OS file descriptors from parallel SSH connections.

**Example:**
```typescript
// core/fleet.ts
export async function fleetStatus(
  servers: ServerRecord[],
  tokenMap: Map<string, string>,
): Promise<FleetStatusResult[]> {
  const results = await Promise.allSettled(
    servers.map((s) => checkServerStatus(s, tokenMap.get(s.provider) ?? ""))
  );
  return results.map((r, i) => ({
    server: servers[i],
    result: r.status === "fulfilled" ? r.value : null,
    error: r.status === "rejected" ? String(r.reason) : undefined,
  }));
}
```

### Pattern 2: NotificationChannel as Plain Function Module

**What:** Following the existing "composition over inheritance" decision (v1.5), each channel is a plain function module, not a class. `core/notify/index.ts` holds a `NotificationChannel` interface and reads config from `~/.kastell/notify.json`. Dispatch is `Promise.allSettled` across configured channels — channel errors are logged but never propagate.

**When to use:** Every alert path: guard status breach detection (client-side), future doctor --fix completion reporting.

**Note on guard script vs client-side dispatch:** The guard bash script runs on the remote server and cannot call Node.js. In v1.8, notification dispatch happens client-side: `kastell guard status` detects breach lines in the log and calls `dispatchNotification()` from the user's machine. This keeps webhook credentials in `~/.kastell/notify.json` (mode 0o600) on the user's machine, not on the VPS. Server-side push notifications (using `curl` in the guard script) can be added as an opt-in mode in v1.9.

**Example:**
```typescript
// core/notify/index.ts
export interface NotificationChannel {
  readonly name: string;
  send(level: "info" | "warn" | "critical", message: string): Promise<void>;
}

export async function dispatchNotification(
  level: "info" | "warn" | "critical",
  message: string,
): Promise<void> {
  const config = loadNotifyConfig(); // reads ~/.kastell/notify.json
  const channels = buildChannels(config);
  await Promise.allSettled(channels.map((c) => c.send(level, message)));
}
```

### Pattern 3: Doctor --fix as Prompt-and-Execute Loop

**What:** `DoctorFinding` already has a `command` field. `--fix` mode presents each finding's description and command, asks for confirmation (unless `--force`), then executes via `sshExec` with a 180s timeout. Returns `AutoFixResult[]` with per-finding success/skip/error.

**Critical constraint:** Some commands (`docker system prune -a`) are destructive. Tag findings with `fixSafe: boolean`. Destructive fixes require confirmation even with `--force`.

**Example:**
```typescript
// core/doctor.ts — new exported function
export async function runAutoFix(
  ip: string,
  findings: DoctorFinding[],
  options: { force?: boolean },
  confirm: (msg: string) => Promise<boolean>,
): Promise<AutoFixResult[]> {
  const results: AutoFixResult[] = [];
  for (const finding of findings) {
    const needsConfirm = !options.force || !finding.fixSafe;
    if (needsConfirm) {
      const ok = await confirm(`Apply fix for ${finding.id}?\n  ${finding.command}`);
      if (!ok) { results.push({ id: finding.id, skipped: true }); continue; }
    }
    const res = await sshExec(ip, finding.command, { timeoutMs: 180_000 });
    results.push({ id: finding.id, success: res.code === 0, output: res.stdout, error: res.stderr });
  }
  return results;
}
```

### Pattern 4: Guard Script Notify Stub (Existing Hook)

**What:** `core/guard.ts` line 93 already contains: `# KASTELL_NOTIFY_HOOK — notification stub. v1.8 will inject implementation here.` The script is regenerated at `kastell guard start`. In v1.8, `buildDeployGuardScriptCommand()` is extended: the stub remains (server-side notify deferred), but `guardStatus()` is extended to check for new breach lines since last poll and call `dispatchNotification()` client-side.

**Impact:** No change to cron entry or script path. Existing guard installs work unchanged until redeployed with `kastell guard start`.

---

## Data Flow

### Fleet Status Flow

```
kastell fleet status
    |
    v
commands/fleet.ts (resolve tokenMap from env/keychain, optional --filter)
    |
    v
core/fleet.ts fleetStatus(servers, tokenMap)
    |
    +--[Promise.allSettled, per-server 10s SSH timeout]--> core/status.ts checkServerStatus(s)
    |                                                           |-> providers/* getServerStatus()
    |                                                           |-> adapters/factory getAdapter().healthCheck()
    v
FleetStatusResult[] (all settled, per-server errors captured)
    |
    v
commands/fleet.ts renderFleetTable()  — sorted by status (errors last)
```

### Fleet Audit Flow

```
kastell fleet audit
    |
    v
core/fleet.ts fleetAudit(servers)
    |
    +--[Promise.allSettled]--> core/audit/history.ts loadAuditHistory(s.ip)
    |                          (reads cached scores only — no live SSH per server)
    v
FleetAuditResult[]  — last score + timestamp per server, sorted ascending (worst first)
```

### Notification Config + Dispatch Flow

```
kastell notify setup   [new subcommand]
    |
    v
commands/notify.ts (interactive prompts per channel, writes ~/.kastell/notify.json mode 0o600)

kastell guard status   [extended]
    |
    v
core/guard.ts guardStatus() — returns breaches[] (existing behavior)
    |
    v [if breaches.length > 0 and notify configured]
core/notify/index.ts dispatchNotification("warn", breachMessage)
    |
    +-> telegram.ts  POST api.telegram.org/bot{token}/sendMessage  (axios)
    +-> discord.ts   POST {webhookUrl} { content: string }          (axios)
    +-> slack.ts     POST {webhookUrl} { text: string }             (axios)
    +-> email.ts     nodemailer.sendMail(...)
```

### Doctor --fix Flow

```
kastell doctor <server> --fix
    |
    v
commands/doctor.ts — resolveServer(), runServerDoctor() (existing path)
    |
    v [if --fix flag]
For each DoctorFinding (severity order: critical first):
    |
    +-- display: finding.description + finding.command
    +-- if !fixSafe or !--force: prompt confirm
    +-- if confirmed: sshExec(ip, finding.command, {timeoutMs: 180_000})
    +-- collect AutoFixResult
    |
    v
commands/doctor.ts displayFixResults()  — per-finding pass/skip/fail
```

### Layer Violation Fix Flow (Tech Debt)

```
BEFORE (violation):
  core/deploy.ts  ─imports─>  commands/firewall.ts
                  ─imports─>  commands/secure.ts

AFTER (clean):
  core/deploy.ts  ─imports─>  core/firewall.ts   (logic moved here)
                  ─imports─>  core/secure.ts      (already exists)
  commands/firewall.ts  ─imports─>  core/firewall.ts  (thin wrapper)
  commands/secure.ts    ─imports─>  core/secure.ts    (thin wrapper)
```

---

## Integration Points

### New vs Existing — Explicit List

| v1.8 Feature | Existing Code Touched | Integration Point |
|---|---|---|
| `kastell fleet` | `core/status.ts`, `core/audit/history.ts` | Calls existing functions; no signature changes needed |
| Notifications | `core/guard.ts` (`guardStatus`) | Add post-breach `dispatchNotification()` call in guardStatus return path |
| `doctor --fix` | `core/doctor.ts` (`DoctorFinding` type) | Add `fixSafe` field to `DoctorFinding`; add `runAutoFix()` function; `commands/doctor.ts` adds `--fix` option |
| Adapter dedup | `adapters/coolify.ts`, `adapters/dokploy.ts`, `adapters/shared.ts` | Extract backup/restore to shared helpers; no PlatformAdapter interface changes |
| Layer violation | `core/deploy.ts`, `commands/firewall.ts`, `commands/secure.ts` | Move business logic to core; commands become thin wrappers |
| Shell completions | `commands/completions.ts` | Static string additions only — `fleet`, `notify`, `--fix` |
| MCP fleet tool | `mcp/server.ts` | Register `server_fleet` tool |

### External Services

| Service | Integration | Protocol | Auth |
|---------|-------------|----------|------|
| Telegram Bot API | `api.telegram.org/bot{token}/sendMessage` | HTTPS POST (axios) | Bot token in notify.json |
| Discord Webhook | `discord.com/api/webhooks/{id}/{token}` | HTTPS POST (axios) | Webhook URL in notify.json |
| Slack Webhook | `hooks.slack.com/services/{id}/{token}` | HTTPS POST (axios) | Webhook URL in notify.json |
| SMTP/Email | Configurable host:port | SMTP/STARTTLS (nodemailer) | User/pass in notify.json |

### Internal Boundaries

| Boundary | Communication | Constraint |
|---|---|---|
| `core/fleet.ts` -> `core/status.ts` | Direct import | Must not change `StatusResult` type |
| `core/fleet.ts` -> `core/audit/history.ts` | Direct import | `loadAuditHistory()` already returns correct type |
| `core/fleet.ts` -> `core/doctor.ts` | Direct import (fleet doctor subcommand) | `runServerDoctor()` signature unchanged |
| `core/notify/*` -> `utils/config.ts` | New helper reads `~/.kastell/notify.json` | Separate file from `servers.json` — no lock contention |
| `commands/doctor.ts` -> `core/doctor.ts` | New `runAutoFix()` export | `runServerDoctor()` signature unchanged |
| Guard breach -> notification | `guardStatus()` detects breaches, calls `dispatchNotification()` | Notification is fire-and-forget; never blocks status result |

---

## Config File Layout (~/.kastell/)

```
~/.kastell/
  servers.json                    (existing)
  guard-state.json                (existing v1.7) — per-server cron install state
  audit-history-{ip}.json         (existing v1.5/v1.6)
  doctor-metrics-{ip}.json        (existing v1.7) — MetricSnapshot cache
  audit-snapshots/                (existing v1.6)
  backups/                        (existing)
  notify.json                     (NEW v1.8) — channel configs, mode 0o600
```

### notify.json schema

```json
{
  "version": 1,
  "channels": {
    "telegram": { "botToken": "...", "chatId": "..." },
    "discord":  { "webhookUrl": "..." },
    "slack":    { "webhookUrl": "..." },
    "email": {
      "host": "smtp.example.com",
      "port": 587,
      "user": "...",
      "pass": "...",
      "from": "alerts@kastell.dev",
      "to":   "admin@example.com"
    }
  }
}
```

---

## Anti-Patterns

### Anti-Pattern 1: Storing Webhook Credentials on the Remote Server

**What people do:** Embed Telegram bot tokens or webhook URLs inside the bash guard script deployed to the VPS at `/root/kastell-guard.sh`.

**Why it is wrong:** The guard script is readable by root. Any process that achieves root access sees all notification credentials. Kastell's threat model assumes the server can be compromised — credential leakage from a guarded server would be a major trust failure.

**Do this instead:** Keep notification dispatch client-side. Guard script writes breach events to `/var/log/kastell-guard.log`. `kastell guard status` reads the log and dispatches from the user's machine using `~/.kastell/notify.json` (mode 0o600).

### Anti-Pattern 2: `Promise.all` for Fleet Operations

**What people do:** Use `Promise.all()` for multi-server SSH — one offline server with a 30s SSH timeout blocks the entire fleet output.

**Why it is wrong:** With 5 servers, one unreachable server delays output by 30s. Users think the command is hung.

**Do this instead:** Use `Promise.allSettled()` with per-server timeouts (10s for status checks, 30s for audit). Mark timed-out servers as `unreachable` in the output table.

### Anti-Pattern 3: `--fix --force` Without Destructive Safety Check

**What people do:** Route all fixes through `--force` unconditionally, assuming users know what they are running.

**Why it is wrong:** `docker system prune -a` runs without any prompt and permanently deletes unused images and containers. A user running `kastell doctor prod --fix --force` in a CI script may not realize a finding triggered `prune`.

**Do this instead:** Add `fixSafe: boolean` to `DoctorFinding`. Destructive fixes (`prune`, `rm`) always require an explicit confirmation, even with `--force`. Display a `[DESTRUCTIVE]` label before executing.

### Anti-Pattern 4: Adding Bot Framework Dependencies for Notifications

**What people do:** Add `telegraf`, `discord.js`, or `@slack/bolt` for notification dispatch.

**Why it is wrong:** These are full bot frameworks (50-100MB+). Kastell only needs to POST a message to a webhook endpoint. All three services support simple HTTP POST with a JSON body.

**Do this instead:** Use `axios` (already a project dependency) for Telegram/Discord/Slack. Add only `nodemailer` for email.

---

## Build Order Recommendation

Dependencies drive order. Tech debt first clears the foundation before new modules land on top.

| Step | What | Rationale |
|---|---|---|
| 1 | **Layer violation fix** — move logic from `commands/firewall.ts` + `commands/secure.ts` to `core/`; `core/deploy.ts` imports from `core/` only | Pure refactor, existing tests cover behavior. Must be done before fleet/deploy adds more imports. |
| 2 | **Adapter dedup** — extract backup/restore to `adapters/shared.ts` template helpers; update coolify + dokploy | Isolated refactor, no interface changes. Simplifies future adapter additions. |
| 3 | **`core/notify/`** — interface + all 4 channel modules + config helper | Standalone new module. No deps on fleet or doctor --fix. Independently testable with `kastell notify test`. |
| 4 | **`doctor --fix`** — add `fixSafe` to `DoctorFinding`, `runAutoFix()` in `core/doctor.ts`, `--fix` flag in `commands/doctor.ts` | Depends on existing `DoctorFinding.command` (already present). Small surface area. |
| 5 | **`kastell fleet`** — `core/fleet.ts` + `commands/fleet.ts` + MCP `serverFleet` tool | Depends on `core/status.ts` and `core/audit/history.ts` (existing, stable after step 1). |
| 6 | **Guard notify integration** — extend `guardStatus()` to call `dispatchNotification()` on new breaches | Depends on notify (step 3) and guard (existing). Implemented last to avoid incomplete notification dispatch. |
| 7 | **Shell completions** — add `fleet`, `notify`, `--fix` to static completion strings | Final step, all commands and flags finalized. |

---

## Dependency Notes

### No New Dependencies for Telegram, Discord, Slack

All three use simple HTTP webhooks. Axios is already a project dependency. No new packages needed.

### nodemailer (One New Runtime Dependency)

Email requires SMTP handling. `nodemailer` is the established Node.js standard for this. Ships TypeScript types via `@types/nodemailer`. ESM-compatible. Confidence: HIGH.

```bash
npm install nodemailer
npm install -D @types/nodemailer
```

---

## Sources

- Direct source analysis: `src/core/doctor.ts`, `src/core/guard.ts`, `src/core/status.ts`, `src/types/index.ts`, `src/adapters/interface.ts`, `src/adapters/shared.ts`, `src/utils/config.ts`
- Project context: `.planning/PROJECT.md` (v1.8 milestone goals, Key Decisions table, tech debt list from MEMORY.md)
- Guard script notify stub comment: `src/core/guard.ts` line 93 — `# KASTELL_NOTIFY_HOOK — notification stub. v1.8 will inject implementation here.`
- Tech debt list: `MEMORY.md` — layer violation (`core/deploy.ts -> commands/firewall.ts, secure.ts`), adapter backup/restore duplication, postSetup decomposition

---

*Architecture research for: Kastell v1.8 Fleet + Notifications + Doctor --fix + Tech Debt*
*Researched: 2026-03-14*
*Replaces: v1.7 architecture research*
