# Architecture Patterns

**Domain:** Guard Core features for Kastell CLI (v1.7)
**Researched:** 2026-03-14
**Confidence:** HIGH — based on direct source code analysis + verified external patterns

---

## Context: Existing Architecture

The current Kastell architecture follows a strict layering convention:

```
src/commands/    (thin Commander.js wrappers — no logic here)
    |
    v
src/core/        (all business logic — SSH execution, parsing, result types)
    |
    +---> src/providers/   (cloud API: hetzner, digitalocean, vultr, linode)
    +---> src/adapters/    (platform: coolify, dokploy — PlatformAdapter interface)
    +---> src/utils/       (ssh, config, fileLock, retry, logger, modeGuard, etc.)
    +---> src/types/       (ServerRecord, ServerMode, KastellResult, etc.)
src/mcp/         (MCP server + tools — delegates to core/, never re-implements)
```

Key utilities already in place that v1.7 extends:
- `withFileLock` — mutex for any shared state file writes
- `withRetry` — exponential backoff with Retry-After header support
- `detectPlatform()` — SSH-based coolify/dokploy/bare detection
- `AuditHistoryEntry` + `saveAuditHistory()` — per-server score history with 50-entry cap
- `detectTrend()` — score delta (simple arithmetic, no ML)
- `AuditResult` with `categories[].score` — the data risk trend needs
- `applySecureSetup()` — SSH hardening + fail2ban (lock will reuse this)
- `sshExec()` — all server SSH calls go through this single utility
- `KastellResult<T>` — the return type convention for all core functions

---

## Recommended Architecture for v1.7

### High-Level: What Gets Added

```
src/core/
  guard/           (NEW — daemon lifecycle + health loop)
    daemon.ts
    healthChecks.ts
    types.ts
  lock/            (NEW — production hardening profiles)
    profiles.ts
    lock.ts
    types.ts
  fleet/           (NEW — multi-server aggregation)
    fleet.ts
    types.ts
  notify/          (NEW — multi-channel notification dispatch)
    channels/
      telegram.ts
      discord.ts
      slack.ts
      email.ts
    dispatch.ts
    types.ts
  schedule/        (NEW — backup schedule config persistence)
    schedule.ts
    types.ts
  trend/           (NEW — risk score trend with cause attribution)
    trend.ts        (extends existing history.ts)
    types.ts

src/commands/
  guard.ts         (NEW thin wrapper)
  lock.ts          (NEW thin wrapper — kastell lock --production)
  fleet.ts         (NEW thin wrapper)
  notify.ts        (NEW thin wrapper — kastell notify test/config)

src/utils/
  guardConfig.ts   (NEW — guard state file: ~/.kastell/guard.json)
  scheduleConfig.ts (NEW — schedule state file: ~/.kastell/schedule.json)
  notifyConfig.ts  (NEW — notify config: ~/.kastell/notify.json)

src/mcp/tools/
  serverFleet.ts   (NEW MCP tool)
  serverGuard.ts   (NEW MCP tool — status/start/stop)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `core/guard/daemon.ts` | Guard loop: run audit + health checks on interval, trigger notifications on threshold breach | `core/audit/`, `core/notify/dispatch.ts`, `utils/guardConfig.ts`, `utils/fileLock.ts` |
| `core/guard/healthChecks.ts` | SSH-based metric probes: disk %, RAM %, load, login failures | `utils/ssh.ts` — `sshExec()` only |
| `core/lock/lock.ts` | Apply hardening profile to server: SSH hardening + firewall + fail2ban + unattended-upgrades | `core/secure.ts` (reuse `applySecureSetup`), `utils/ssh.ts` |
| `core/lock/profiles.ts` | Pure config: what `--production` vs `--staging` means in terms of checks | No deps — pure data |
| `core/fleet/fleet.ts` | Collect latest audit score + health status for all registered servers in parallel | `core/audit/history.ts`, `utils/config.ts` `getServers()`, `core/guard/healthChecks.ts` |
| `core/notify/dispatch.ts` | Fan out a notification to all configured channels; swallow per-channel errors | `core/notify/channels/*`, `utils/notifyConfig.ts` |
| `core/notify/channels/*.ts` | One file per channel — send one message via HTTP POST (webhook/bot API) | `axios` (already a dep) or `nodemailer` for email |
| `core/schedule/schedule.ts` | Read/write schedule config; validate cron expression; compute nextRun | `core/backup.ts`, `utils/scheduleConfig.ts`, `utils/fileLock.ts` |
| `core/trend/trend.ts` | Load audit history, compute multi-point trend, attribute cause by comparing category score deltas | `core/audit/history.ts` (existing `loadAuditHistory`) |
| `utils/guardConfig.ts` | Read/write `~/.kastell/guard.json` (registered guard configs per server) | `utils/fileLock.ts` |
| `utils/notifyConfig.ts` | Read/write `~/.kastell/notify.json` (channel configs) | `utils/fileLock.ts` |
| `utils/scheduleConfig.ts` | Read/write `~/.kastell/schedule.json` (backup schedules per server) | `utils/fileLock.ts` |

---

## Data Flow

### Guard Daemon Flow

```
kastell guard start --server my-prod
  |
  v
commands/guard.ts (thin wrapper)
  |
  v
core/guard/daemon.ts
  ├── reads ~/.kastell/guard.json (server IP, interval, thresholds)
  ├── Loop every N minutes (setInterval):
  │   ├── core/guard/healthChecks.ts → sshExec(ip, diskCheck + ramCheck + loginCheck)
  │   ├── core/audit/ (runAudit) → AuditResult
  │   ├── core/audit/history.ts (saveAuditHistory) → persists to audit-history.json
  │   ├── core/trend/trend.ts (analyzeTrend) → TrendResult with cause list
  │   ├── core/schedule/schedule.ts → check nextRun, trigger createBackup if due
  │   └── if threshold breached → core/notify/dispatch.ts → channels
  └── writes ~/.kastell/guard.json (lastRun timestamp)
```

### Fleet Aggregation Flow

```
kastell fleet
  |
  v
commands/fleet.ts
  |
  v
core/fleet/fleet.ts
  ├── utils/config.ts getServers() → ServerRecord[]
  ├── Promise.allSettled(servers.map(aggregateOne))
  │   └── each: core/audit/history.ts loadAuditHistory(ip) → last score + timestamp
  │           + core/guard/healthChecks.ts (disk/RAM probe, optional --probe flag)
  └── returns FleetSummary[] sorted by score ascending (worst first)
```

### Lock Flow

```
kastell lock --production --server my-prod
  |
  v
commands/lock.ts
  |
  v
core/lock/lock.ts
  ├── core/lock/profiles.ts → LockProfile (what to enforce for --production)
  ├── core/secure.ts applySecureSetup() (SSH hardening + fail2ban) [REUSE]
  ├── sshExec: ufw rules per profile (allow/deny ports)
  ├── sshExec: enable unattended-upgrades
  ├── core/audit/ runAudit() → post-lock score (optional, --verify flag)
  └── returns LockResult { applied: string[], postLockScore?: number }
```

### Notification Dispatch Flow

```
core/notify/dispatch.ts
  ├── utils/notifyConfig.ts → NotifyConfig (channels with credentials)
  ├── Promise.allSettled(configuredChannels.map(ch => ch.send(message)))
  │   ├── telegram.ts: POST https://api.telegram.org/bot{token}/sendMessage  (axios)
  │   ├── discord.ts:  POST webhook URL { content: string }                  (axios)
  │   ├── slack.ts:    POST webhook URL { text: string }                     (axios)
  │   └── email.ts:    nodemailer SMTP sendMail
  └── returns { sent: string[], failed: string[] }  (never throws)
```

### Risk Trend with Cause Analysis Flow

```
core/trend/trend.ts
  ├── core/audit/history.ts loadAuditHistory(ip)
  ├── Sort by timestamp, slice last N entries (default: 10)
  ├── Compute overall score delta: score[n] - score[n-1]
  ├── Compute per-category deltas from categoryScores
  ├── Attribution: categories where delta < 0 → cause list
  └── returns TrendResult {
        direction: "improving" | "stable" | "degrading",
        scoreDelta: number,
        causes: Array<{ category: string, delta: number }>,
        history: AuditHistoryEntry[]
      }
```

### Backup Schedule Flow

```
kastell backup --schedule "0 2 * * *" --server my-prod
  |
  v
commands/backup.ts (existing, extended with --schedule flag)
  |
  v
core/schedule/schedule.ts
  ├── utils/scheduleConfig.ts read ~/.kastell/schedule.json
  ├── Validate cron expression (node-cron validate() or cron-parser)
  ├── Compute nextRun from cron string
  ├── withFileLock → write schedule entry
  └── returns ScheduleEntry { serverId, cron, nextRun: ISO string }

kastell guard (daemon loop) — checks schedule.json every iteration
  └── if nextRun <= now → core/backup.ts createBackup() → update nextRun
```

---

## Patterns to Follow

### Pattern 1: Core Function Returns KastellResult, Never Throws

All existing core functions use `KastellResult<T>` or domain-specific result types with `{ success, error?, hint? }`. New modules must follow the same convention.

```typescript
// core/fleet/types.ts
export interface FleetSummary {
  server: ServerRecord;
  lastScore: number | null;
  scoreAge: string | null;       // ISO timestamp of last audit
  diskUsedPct: number | null;
  ramUsedPct: number | null;
  platform: "coolify" | "dokploy" | "bare";
  error?: string;
}

// core/fleet/fleet.ts
export async function getFleetSummary(): Promise<FleetSummary[]> {
  const servers = getServers();
  const results = await Promise.allSettled(servers.map(aggregateOne));
  return results.map((r, i) =>
    r.status === "fulfilled" ? r.value : fallbackEntry(servers[i], r.reason)
  );
}
```

### Pattern 2: Config Files Use withFileLock + Atomic Write

All new config files (`guard.json`, `notify.json`, `schedule.json`) must use `withFileLock` for writes and the temp+rename atomic write pattern. This is already established in `config.ts` and `history.ts`.

```typescript
// utils/guardConfig.ts
export async function saveGuardConfig(config: GuardConfig): Promise<void> {
  await withFileLock(GUARD_FILE, () => {
    const tmp = GUARD_FILE + ".tmp";
    writeFileSync(tmp, JSON.stringify(config, null, 2), { mode: 0o600 });
    renameSync(tmp, GUARD_FILE);
  });
}
```

### Pattern 3: Notification Channel as Plain Function, Not Class

Following the existing "composition over inheritance" decision (v1.5, applied to adapters), each notification channel is a plain function module — not a class.

```typescript
// core/notify/channels/telegram.ts
export interface TelegramConfig { botToken: string; chatId: string; }

export async function sendTelegram(config: TelegramConfig, message: string): Promise<void> {
  await axios.post(
    `https://api.telegram.org/bot${config.botToken}/sendMessage`,
    { chat_id: config.chatId, text: message, parse_mode: "Markdown" },
    { timeout: 10_000 }
  );
}
```

### Pattern 4: Guard Daemon Uses setInterval, Not System Service

The guard daemon for v1.7 runs as a foreground Node.js process using `setInterval`. This avoids cross-platform service management complexity (systemd on Linux, launchd on macOS, SCM on Windows). The schedule config (`schedule.json`) records `nextRun`; the daemon polls it each loop tick.

For v1.7 scope: guard runs while `kastell guard start` is in the foreground. A system service wrapper (e.g., systemd unit file generation) is deferred to a later milestone.

### Pattern 5: Fleet Parallel Fan-Out with Promise.allSettled

Fleet must never block on a single unresponsive server. Use `Promise.allSettled` and record errors in the `FleetSummary.error` field rather than propagating them.

### Pattern 6: Lock Profiles as Pure Config Objects

Lock profiles are pure data — no network or SSH calls. This keeps them testable without mocking and allows future user-defined profiles stored in YAML.

```typescript
// core/lock/profiles.ts
export type LockProfileName = "production" | "staging";

export interface LockProfile {
  name: LockProfileName;
  requireSshKeyAuth: boolean;
  disableRootLogin: boolean;
  enableFail2ban: boolean;
  enableUnattendedUpgrades: boolean;
  firewallAllowPorts: number[];
  sshPort?: number;
}

export const LOCK_PROFILES: Record<LockProfileName, LockProfile> = {
  production: {
    name: "production",
    requireSshKeyAuth: true,
    disableRootLogin: true,
    enableFail2ban: true,
    enableUnattendedUpgrades: true,
    firewallAllowPorts: [22, 80, 443],
  },
  // ...
};
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Notification Logic in Command Files

The command file must stay thin. Channel config, dispatch logic, and message formatting all belong in `core/notify/`. Commands call `dispatch(message)` only.

### Anti-Pattern 2: Channel Credentials in servers.json

Notification credentials (bot tokens, webhook URLs) must live in a separate `~/.kastell/notify.json` (mode 0600), not appended to the existing `servers.json`. Mixing concerns and widening the credential surface is the risk.

### Anti-Pattern 3: Sequential SSH Probing in Fleet

Never call `sshExec` sequentially across all servers in fleet. One unreachable server would block the entire command. Use `Promise.allSettled` with a per-server timeout passed to `sshExec`.

### Anti-Pattern 4: Long-Running node-cron Process for Backup Scheduling

Do not use node-cron to schedule backups inside a persistent background process separate from the guard daemon. The reliable pattern for v1.7: write `nextRun` to `schedule.json`, have the guard daemon check it on each loop iteration. This requires no separate persistent process.

### Anti-Pattern 5: Trend Without Cause Attribution

Per PROJECT.md strategic principle: "Risk trend: always with 'why' — trend without cause is meaningless." The trend module must always return the category-level deltas alongside the directional indicator. A bare `score: 62 → 68` is not acceptable output.

### Anti-Pattern 6: Fat commands/doctor.ts

`src/commands/doctor.ts` currently contains business logic (token validation, check implementations). When expanding doctor intelligence, extract new checks into `src/core/doctor/` and keep the command file as a thin wrapper. This matches the established Commands -> Core pattern.

### Anti-Pattern 7: New npm Framework for Telegram/Discord/Slack

Avoid adding `telegraf`, `discord.js`, or `@slack/bolt` — these are full bot frameworks. Kastell only needs to POST a message to a webhook or bot API. Axios (already a dep) handles this with 3-5 lines per channel.

---

## Integration Points: New vs Modified

### New Modules (no existing code touched)

| New Module | Type | Notes |
|-----------|------|-------|
| `src/core/guard/daemon.ts` | New | Orchestrates health + audit loop |
| `src/core/guard/healthChecks.ts` | New | SSH metric probes (disk, RAM, auth failures) |
| `src/core/guard/types.ts` | New | GuardConfig, GuardState interfaces |
| `src/core/lock/lock.ts` | New | Applies LockProfile via SSH + reuses `applySecureSetup` |
| `src/core/lock/profiles.ts` | New | Pure config data for hardening levels |
| `src/core/lock/types.ts` | New | LockResult, LockProfile interfaces |
| `src/core/fleet/fleet.ts` | New | Parallel server aggregation |
| `src/core/fleet/types.ts` | New | FleetSummary interface |
| `src/core/notify/dispatch.ts` | New | Fan-out to all configured channels |
| `src/core/notify/channels/telegram.ts` | New | Telegram Bot API sendMessage (axios) |
| `src/core/notify/channels/discord.ts` | New | Discord Incoming Webhook (axios) |
| `src/core/notify/channels/slack.ts` | New | Slack Incoming Webhook (axios) |
| `src/core/notify/channels/email.ts` | New | nodemailer SMTP |
| `src/core/notify/types.ts` | New | NotifyConfig, ChannelConfig union types |
| `src/core/schedule/schedule.ts` | New | Schedule config CRUD + nextRun computation |
| `src/core/schedule/types.ts` | New | ScheduleEntry, ScheduleConfig interfaces |
| `src/core/trend/trend.ts` | New | Multi-point trend with category attribution |
| `src/core/trend/types.ts` | New | TrendResult, CauseEntry interfaces |
| `src/utils/guardConfig.ts` | New | guard.json read/write via withFileLock |
| `src/utils/notifyConfig.ts` | New | notify.json read/write via withFileLock |
| `src/utils/scheduleConfig.ts` | New | schedule.json read/write via withFileLock |
| `src/commands/guard.ts` | New | Thin CLI wrapper (start/stop/status) |
| `src/commands/lock.ts` | New | Thin CLI wrapper (--production/--staging) |
| `src/commands/fleet.ts` | New | Thin CLI wrapper |
| `src/commands/notify.ts` | New | Thin CLI wrapper (config/test subcommands) |
| `src/mcp/tools/serverFleet.ts` | New | MCP fleet summary tool |
| `src/mcp/tools/serverGuard.ts` | New | MCP guard status tool |

### Modified (Existing Code Extended)

| Existing File | What Changes |
|--------------|-------------|
| `src/commands/backup.ts` | Add `--schedule <cron>` option; delegates to `core/schedule/schedule.ts` |
| `src/commands/doctor.ts` | Extract current logic to `src/core/doctor/`; add new intelligence checks (cert expiry, backup freshness, audit score staleness) |
| `src/index.ts` | Register `guard`, `lock`, `fleet`, `notify` commands in Commander |
| `src/mcp/server.ts` | Register `server_fleet` and `server_guard` tools |
| `src/constants.ts` | Add `GUARD_CHECK_INTERVAL_MS`, `FLEET_PROBE_TIMEOUT_MS` constants |
| `src/types/index.ts` | No changes needed — new types live in feature module `types.ts` files |
| `src/core/audit/history.ts` | No changes — `loadAuditHistory` is already the right API for trend |

---

## Dependency: Notification Libraries

### Recommended: No New Dependencies for Telegram, Discord, Slack

These three channels use simple HTTP webhooks. Axios is already a project dependency.

- Telegram: `POST https://api.telegram.org/bot{token}/sendMessage`
- Discord: `POST {webhookUrl}` with `{ content: string }`
- Slack: `POST {webhookUrl}` with `{ text: string }`

Confidence: HIGH — all three services publish documented webhook APIs with simple JSON payloads.

### Email: nodemailer (One New Dependency)

Email requires SMTP handling. `nodemailer` is the established standard:
- 14M+ weekly npm downloads (MEDIUM confidence — figure from training data, verify at npm)
- Ships TypeScript types via `@types/nodemailer`
- ESM-compatible: `import nodemailer from "nodemailer"`
- Supports OAuth2 + STARTTLS

```bash
npm install nodemailer
npm install -D @types/nodemailer
```

### Scheduler: node-cron for Cron Expression Validation Only

For v1.7 the daemon loop uses `setInterval`. `node-cron` is used only for validating user-supplied cron expressions (`cron.validate(expr)`) and computing `nextRun` timestamps.

node-cron v3 supports ESM imports. The project is `"type": "module"` — verify the import works post-install. Fallback: `cron-parser` (pure ESM, simpler API, less commonly cited).

```bash
npm install node-cron
npm install -D @types/node-cron
```

Confidence: MEDIUM — node-cron ESM issue #700 on GitHub exists but v3 resolves it; risk is low because we only call `validate()` and `parseExpression()`, not the scheduling runtime.

---

## Suggested Build Order

Build order respects dependency graph: foundational modules first, composing features after.

| Step | Module(s) | Rationale |
|------|-----------|-----------|
| 1 | `core/notify/types.ts` + `utils/notifyConfig.ts` + `core/notify/channels/*` + `core/notify/dispatch.ts` + `commands/notify.ts` | Notifications are a leaf — no deps on other new modules. Needed by guard (step 3). Independently testable. |
| 2 | `core/lock/profiles.ts` + `core/lock/types.ts` + `core/lock/lock.ts` + `commands/lock.ts` | Pure config + reuses existing `core/secure.ts`. Self-contained, deliverable early. |
| 3 | `core/guard/types.ts` + `utils/guardConfig.ts` + `core/guard/healthChecks.ts` + `core/guard/daemon.ts` + `commands/guard.ts` | Depends on notify (step 1) and audit (existing). Health checks reuse `sshExec`. |
| 4 | `core/trend/types.ts` + `core/trend/trend.ts` | Depends on `core/audit/history.ts` (existing, no changes). Integrates into guard daemon and audit command output. |
| 5 | `core/schedule/types.ts` + `utils/scheduleConfig.ts` + `core/schedule/schedule.ts` + extend `commands/backup.ts` | Depends on `core/backup.ts` (existing). Integrate into guard daemon loop in step 3 after this is ready. |
| 6 | `core/fleet/types.ts` + `core/fleet/fleet.ts` + `commands/fleet.ts` | Depends on audit history (existing) and health checks (step 3). Parallel fan-out requires step 3 health probes. |
| 7 | `commands/doctor.ts` refactor → `src/core/doctor/` extraction + intelligence checks | Expands existing feature; cert expiry, backup freshness, score staleness all build on completed modules. |
| 8 | `src/index.ts` additions + `src/constants.ts` additions | Wire up new commands; add constants for intervals/timeouts. |
| 9 | MCP tools: `server_fleet`, `server_guard` | MCP tools always last — delegate to core, so core must be complete first. |

---

## Config File Layout (~/.kastell/)

```
~/.kastell/
  servers.json         (existing)
  audit-history.json   (existing, v1.5)
  snapshots/           (existing, v1.6)
  guard.json           (NEW v1.7) — guard daemon registrations per server
  notify.json          (NEW v1.7) — channel configs, mode 0600
  schedule.json        (NEW v1.7) — backup schedules per server
```

### guard.json schema

```json
{
  "version": 1,
  "guards": [
    {
      "serverId": "abc123",
      "serverIp": "1.2.3.4",
      "intervalMinutes": 5,
      "diskThresholdPct": 80,
      "ramThresholdPct": 90,
      "scoreThreshold": 60,
      "lastRun": "2026-03-14T12:00:00.000Z",
      "enabled": true
    }
  ]
}
```

### notify.json schema

```json
{
  "version": 1,
  "channels": {
    "telegram": { "botToken": "...", "chatId": "..." },
    "discord":  { "webhookUrl": "..." },
    "slack":    { "webhookUrl": "..." },
    "email":    {
      "host": "smtp.example.com",
      "port": 587,
      "user": "...",
      "pass": "...",
      "from": "alerts@example.com",
      "to":   "admin@example.com"
    }
  }
}
```

### schedule.json schema

```json
{
  "version": 1,
  "schedules": [
    {
      "serverId": "abc123",
      "serverIp": "1.2.3.4",
      "cron": "0 2 * * *",
      "nextRun": "2026-03-15T02:00:00.000Z",
      "enabled": true
    }
  ]
}
```

---

## Scalability Notes (v1.7 Scope vs Future)

| Concern | v1.7 (1-10 servers) | Future (50+ servers) |
|---------|--------------------|--------------------|
| Fleet SSH probing | Small `Promise.allSettled` batch | Needs concurrency limit (manual semaphore or `p-limit`) |
| Guard daemon per server | One `setInterval` loop per `kastell guard start` invocation | Needs daemon registry + single multiplex loop |
| Notification rate | Fire-and-forget per alert event | Need debounce to avoid flooding on repeated threshold breach |
| Audit history growth | 50-entry cap per server (existing) | Already capped — no change needed |
| schedule.json | Single file, per-server entries, file-locked | Scales fine for 50+ servers |

---

## Sources

- Kastell source code (direct analysis): `src/core/`, `src/utils/`, `src/adapters/`, `src/types/`, `src/constants.ts`
- [node-cron npm](https://www.npmjs.com/package/node-cron) — ESM support status
- [node-cron ESM Discussion #700](https://github.com/kelektiv/node-cron/issues/700) — ESM compatibility caveat
- [Better Stack: Comparing Node.js Schedulers](https://betterstack.com/community/guides/scaling-nodejs/best-nodejs-schedulers/) — library comparison
- [Telegram Bot API](https://core.telegram.org/bots/api#sendmessage) — sendMessage endpoint
- PROJECT.md strategic principles (Guard design goals, no AI/ML, deterministic thresholds, "trend always with why")

---

*Research completed: 2026-03-14*
*Replaces: v1.6 architecture research (2026-03-09)*
