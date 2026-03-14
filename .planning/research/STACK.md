# Technology Stack: Kastell v1.7 Guard Core

**Project:** Kastell CLI — Guard Core milestone
**Researched:** 2026-03-14
**Confidence:** HIGH (croner, notification approach) / MEDIUM (nodemailer ESM status)
**Scope:** NEW capabilities only for v1.7. Existing stack (TypeScript, Commander.js, Inquirer.js, Axios, Zod, Chalk, Ora, js-yaml, MCP SDK, @napi-rs/keyring, figlet, Jest, ESLint, Prettier) is validated and NOT re-researched.

---

## Executive Decision

**One new production dependency: `croner`.** Everything else — daemon pattern, fleet aggregation, doctor intelligence, risk trend analysis, notifications for Telegram/Discord/Slack — can be implemented via Node.js built-ins (child_process, fetch, fs) and straight HTTP calls using Axios (already in the stack). Email via `nodemailer` is conditionally added (see rationale below).

---

## Feature-by-Feature Stack Analysis

### 1. Backup Scheduling (`backup --schedule`) — croner

The daemon needs a cron-style scheduler to execute backup jobs on a user-defined schedule (e.g., `0 2 * * *`). This is the one capability with no clean built-in solution.

**Recommended:** `croner` ^10.0.1

| Why croner | Why not others |
|------------|----------------|
| Zero dependencies | `node-cron` v4.2.1 is CJS-only; requires `@types/node-cron` separately; not pure ESM |
| Native ESM: `import { Cron } from "croner"` | `node-schedule` has 3 dependencies, heavier footprint |
| Built-in TypeScript types (no `@types/` needed) | `cron` (kelektiv) is CJS, less maintained |
| Supports seconds field, timezone, pause/resume, async jobs | All alternatives require either CJS interop hacks or separate type packages |
| Node.js >=18 (Kastell requires >=20) | |
| Version 10 released 2026-02, actively maintained | |

```bash
npm install croner
```

```typescript
import { Cron } from "croner";

// Inside guard/daemon core:
const job = new Cron("0 2 * * *", { timezone: "UTC" }, async () => {
  await runBackup(server);
});
// job.stop() for graceful shutdown
```

**Confidence:** HIGH — verified ESM support, TypeScript bundled, zero-dependency.

---

### 2. `kastell guard` Daemon — Node.js Built-ins Only

The guard daemon runs as a detached background process on the **user's machine**, polling the remote server via SSH on schedule (health checks every 5 min, security scan on schedule). It is NOT a daemon installed on the target server.

**Architecture decision:** `spawn` + `detach` + PID file. No dependency needed.

```typescript
// src/core/guard/daemon.ts (spawn path)
import { spawn } from "child_process";
import { writeFileSync, readFileSync, existsSync, unlinkSync } from "fs";

const PID_FILE = path.join(kastellDir, "guard.pid");

export function startDaemon(args: string[]): void {
  const child = spawn(process.execPath, [daemonEntrypoint, ...args], {
    detached: true,
    stdio: ["ignore", fs.openSync(logFile, "a"), fs.openSync(logFile, "a")],
  });
  child.unref();
  writeFileSync(PID_FILE, String(child.pid));
}

export function stopDaemon(): void {
  if (!existsSync(PID_FILE)) throw new Error("Guard is not running");
  const pid = parseInt(readFileSync(PID_FILE, "utf8"), 10);
  process.kill(pid, "SIGTERM");
  unlinkSync(PID_FILE);
}
```

**The daemon process itself** uses `croner` for its internal scheduling loop and `process.on("SIGTERM")` for graceful shutdown (stop cron jobs, close SSH connections).

**Why not PM2 / systemd unit files:**
- PM2 is a runtime dependency — Kastell is a CLI tool, not a server. Installing PM2 just for guard adds ~10MB and a daemon of its own.
- systemd unit file generation is Linux-only; Kastell CI runs on Windows, macOS, Linux. The `spawn({detached: true})` pattern works cross-platform.
- For v1.7, the guard daemon serves indie hackers who want a simple `kastell guard start`. PM2 is complexity they don't need.

**Confidence:** HIGH — standard Node.js `child_process` pattern, well-documented.

---

### 3. Multi-Channel Notifications — Mixed Approach

#### Telegram — Direct HTTP via Axios (No New Dependency)

Telegram Bot API is a pure HTTP REST API. Axios is already in the stack.

```typescript
// src/core/notifications/telegram.ts
import axios from "axios";

export async function sendTelegram(
  token: string,
  chatId: string,
  text: string,
): Promise<void> {
  await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  });
}
```

No library. No dependency. The Bot API is stable and has not changed its `sendMessage` interface in years.

**Confidence:** HIGH — official Telegram Bot API, plain HTTP POST.

#### Discord — Direct HTTP via Axios (No New Dependency)

Discord webhooks require a single POST to a webhook URL with a JSON body. No auth, no bot setup.

```typescript
// src/core/notifications/discord.ts
export async function sendDiscord(webhookUrl: string, content: string): Promise<void> {
  await axios.post(webhookUrl, { content });
}
```

No library needed. Discord's webhook API is stable.

**Confidence:** HIGH — direct HTTP, officially documented pattern.

#### Slack — Direct HTTP via Axios (No New Dependency)

Slack Incoming Webhooks accept a POST with `{ text: "..." }`. Same pattern.

```typescript
// src/core/notifications/slack.ts
export async function sendSlack(webhookUrl: string, text: string): Promise<void> {
  await axios.post(webhookUrl, { text });
}
```

The `@slack/webhook` package (v7.0.6, requires Node >=18) is the official SDK, but it wraps exactly this HTTP call. Adding it would bring in `@slack/logger` as a transitive dependency for a 3-line implementation. Not worth it.

**Confidence:** HIGH — Slack webhook API is stable, pattern verified from official docs.

#### Email — `nodemailer` (Conditionally Add)

SMTP email requires a proper mail transport library. The Node.js `net` module can do raw SMTP but that is ~500 lines of error-prone code. `nodemailer` v8.0.2 (published 2026-03-10) is the undisputed standard.

**ESM status:** Nodemailer is CJS. However, Kastell already imports `@napi-rs/keyring` (also CJS) using dynamic `import()` and the project's `"type": "module"` setup handles CJS interop transparently for CommonJS packages in Node.js 20+. The existing pattern applies.

**Recommended:** `nodemailer` ^8.0.2 + `@types/nodemailer` ^7.0.11

```bash
npm install nodemailer
npm install -D @types/nodemailer
```

```typescript
import nodemailer from "nodemailer";

export async function sendEmail(
  smtpConfig: SmtpConfig,
  to: string,
  subject: string,
  text: string,
): Promise<void> {
  const transporter = nodemailer.createTransport(smtpConfig);
  await transporter.sendMail({ from: smtpConfig.from, to, subject, text });
}
```

**Why nodemailer over alternatives:**
- Raw SMTP via `net` — ~500 lines, handles TLS, AUTH, STARTTLS, retries. Not realistic.
- `emailjs` — niche, less maintained, fewer downloads.
- `sendgrid/mail` — SaaS-only, not SMTP-agnostic. Many Kastell users run their own SMTP servers.

**Deferral option:** If the product decision is made that email is v1.8+ (not v1.7), skip nodemailer for now. The notification abstraction should be designed so email is a plug-in channel. The first three channels (Telegram, Discord, Slack) have zero new dependencies.

**Confidence:** MEDIUM (nodemailer ESM interop via dynamic import confirmed by pattern already in codebase; ESM-native support in v8 not confirmed by official docs at time of research).

---

### 4. `kastell fleet` — No New Dependency

Fleet is multi-server status aggregation: run parallel SSH checks across all registered servers, collate results into a unified view. Kastell already has `sshConnect`, `sshExec`, and `servers.json` (all server records). The fleet command reads server records, fans out SSH calls in parallel with `Promise.allSettled`, and renders a table.

Table rendering: Kastell already uses Chalk for color. A simple columnar formatter (~30 lines) is sufficient. There is no need for `cli-table3` or similar.

**Confidence:** HIGH — entirely using existing utilities.

---

### 5. `kastell doctor` Intelligence — No New Dependency

Doctor performs proactive operations checks: disk usage threshold, RAM pressure, failed systemd services, Docker daemon health, last backup age, audit score regression. All implemented as SSH commands parsed client-side. No ML, no AI (per PROJECT.md: "No AI/ML — simple statistics + threshold + cron. Deterministic").

Pattern: doctor checks are structured similarly to audit checks — each check has an ID, severity, observed value, threshold, and a fix suggestion. The existing audit types can be reused or extended.

**Confidence:** HIGH — pattern mirrors existing audit engine.

---

### 6. Risk Trend with Cause Analysis — No New Dependency

Risk trend is a time-series of audit scores stored in the existing `~/.kastell/audit-history.json` (already populated by v1.5+). Trend = current score minus rolling average of last N entries. Cause analysis = which checks changed status between snapshots.

This is arithmetic on JSON data already on disk. No time-series database, no charting library.

**Confidence:** HIGH — uses existing audit history infrastructure.

---

### 7. `kastell lock --production` — No New Dependency

Lock is a curated sequence of existing hardening commands: firewall setup, SSH hardening, fail2ban install, unattended-upgrades enable, kernel parameter tuning. All implemented via existing `sshExec` calls. The `--production` flag drives a stricter check sequence.

**Confidence:** HIGH — composes existing SSH hardening functions.

---

## Recommended Stack Additions

### Production Dependencies

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `croner` | ^10.0.1 | Cron-style job scheduler for backup scheduling inside guard daemon | Zero-dep, native ESM, bundled TS types, actively maintained, Node >=18 |
| `nodemailer` | ^8.0.2 | SMTP email notifications | Only option for SMTP-agnostic email; standard library for Node.js email |

### Development Dependencies

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@types/nodemailer` | ^7.0.11 | TypeScript types for nodemailer | nodemailer ships no bundled types |

### Installation

```bash
# Core new dependency
npm install croner

# Email channel (conditional — add if email is in v1.7 scope)
npm install nodemailer
npm install -D @types/nodemailer
```

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `PM2` | Runtime daemon manager adds 10MB+, platform-specific behavior, wrong abstraction for CLI tool | `child_process.spawn({ detached: true })` + PID file (Node built-in) |
| `node-cron` | CJS-only in v4.2.1, needs separate `@types/node-cron`, not actively maintained for ESM | `croner` (pure ESM, bundled types, zero-dep) |
| `node-schedule` | 3 transitive dependencies, overkill for simple interval scheduling | `croner` |
| `@slack/webhook` | Official SDK wraps a 3-line HTTP POST, adds `@slack/logger` transitive dep | `axios.post(webhookUrl, { text })` directly |
| `telegraf` | Full bot framework (conversations, menus, webhook server) — Kastell only sends messages, never receives | `axios.post` to Telegram Bot API directly |
| `node-telegram-bot-api` | Same issue — interactive bot framework, polling loop, not needed for one-way notifications | Direct HTTP via Axios |
| `discord.js` | Full Discord bot library, enormous footprint, designed for interactive bots | Direct webhook HTTP POST via Axios |
| `better-sqlite3` | Risk trend and fleet history are simple JSON append patterns; audit-history.json already exists | `fs` + JSON (existing pattern) |
| `node:sqlite` (built-in) | Still experimental in Node 20/22; Kastell ships to production, not for experimental APIs | JSON files (existing pattern) |
| `p-queue` | Fleet parallel SSH calls are bounded by server count (typically <50); Promise.allSettled is sufficient | `Promise.allSettled` |
| `winston` / `pino` | Guard daemon logs are append-only text to a single file; no log levels, rotation, or structured logging needed yet | `fs.appendFileSync` to `~/.kastell/guard.log` |

---

## Node.js Built-ins Used (No Install Required)

| Module | Purpose | Feature |
|--------|---------|---------|
| `child_process.spawn` | Guard daemon process management | Detached process + PID tracking |
| `fs.writeFileSync` / `readFileSync` | PID file read/write | Daemon lifecycle |
| `process.kill` / `process.on("SIGTERM")` | Daemon start/stop/graceful shutdown | Signal handling |
| `fs.appendFileSync` | Guard daemon log file | Simple append logging |
| `Promise.allSettled` | Fleet parallel server checks | Fan-out with failure isolation |

---

## Integration Points Summary

| Feature | Where | How | New Files |
|---------|-------|-----|-----------|
| Backup scheduling | `core/guard/scheduler.ts` | `croner` Cron instance, configured schedule | `core/guard/scheduler.ts` |
| Guard daemon lifecycle | `core/guard/daemon.ts` | `child_process.spawn({detached})` + PID file | `core/guard/daemon.ts` |
| Guard poll loop | `core/guard/monitor.ts` | `croner` 5-min interval + SSH checks | `core/guard/monitor.ts` |
| Notifications (Telegram) | `core/notifications/telegram.ts` | `axios.post` to Bot API | `core/notifications/telegram.ts` |
| Notifications (Discord) | `core/notifications/discord.ts` | `axios.post` to webhook URL | `core/notifications/discord.ts` |
| Notifications (Slack) | `core/notifications/slack.ts` | `axios.post` to webhook URL | `core/notifications/slack.ts` |
| Notifications (Email) | `core/notifications/email.ts` | `nodemailer.createTransport` | `core/notifications/email.ts` |
| Notification dispatcher | `core/notifications/index.ts` | Channel-agnostic dispatcher, reads config | `core/notifications/index.ts` |
| Fleet aggregation | `core/fleet.ts` | `Promise.allSettled` + `sshExec` | `core/fleet.ts` |
| Doctor checks | `core/doctor.ts` | SSH checks mirroring audit check pattern | `core/doctor.ts` |
| Lock hardening | `core/lock.ts` | Ordered `sshExec` hardening sequence | `core/lock.ts` |
| Risk trend | `core/audit/trend.ts` | Arithmetic on existing `audit-history.json` | `core/audit/trend.ts` |

---

## Version Compatibility

| Package | Version | Compatible With Kastell Stack | Notes |
|---------|---------|-------------------------------|-------|
| `croner` | ^10.0.1 | Node >=18, ESM, TypeScript 5 | Zero dep, no interop issues |
| `nodemailer` | ^8.0.2 | CJS — same as `@napi-rs/keyring` interop pattern | `import nodemailer from "nodemailer"` works in Node 20 ESM |
| `@types/nodemailer` | ^7.0.11 | TypeScript 5.x | Updated 2026-03 |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Cron scheduling | `croner` ^10 | `node-cron` v4 | CJS-only, @types separate, less maintained |
| Cron scheduling | `croner` ^10 | `node-schedule` | 3 deps, complex API for simple intervals |
| Daemon management | `spawn({detached})` | PM2 | 10MB runtime dep, wrong abstraction for CLI |
| Telegram notify | Axios direct | `telegraf` | Full bot framework, 100x more than needed |
| Slack notify | Axios direct | `@slack/webhook` | Wraps 3-line HTTP POST, adds transitive dep |
| Email | `nodemailer` | `emailjs` | Lower adoption, less maintained |
| Email | `nodemailer` | Raw SMTP via `net` | ~500 lines, error-prone TLS/AUTH handling |
| Fleet data | JSON files | `better-sqlite3` | JSON append is sufficient, no querying needed |

---

## Sources

- [croner npm](https://www.npmjs.com/package/croner) — v10.0.1, zero-dep, ESM confirmed
- [croner GitHub](https://github.com/Hexagon/croner) — TypeScript typings bundled, Node >=18
- [croner ESM import](https://croner.56k.guru/) — `import { Cron } from "croner"` verified
- [node-cron ESM discussion](https://github.com/kelektiv/node-cron/issues/700) — CJS-only confirmed
- [nodemailer npm](https://www.npmjs.com/package/nodemailer) — v8.0.2, published 2026-03-10
- [nodemailer ESM issue](https://github.com/nodemailer/nodemailer/issues/1518) — no native ESM as of research date, CJS interop required
- [@types/nodemailer npm](https://www.npmjs.com/package/@types/nodemailer) — v7.0.11, updated 2026-03
- [Telegram Bot API](https://core.telegram.org/bots/api) — `sendMessage` via direct HTTP POST
- [Slack Incoming Webhooks](https://api.slack.com/incoming-webhooks) — POST `{text}` to webhook URL
- [Discord Webhooks Guide](https://inventivehq.com/blog/discord-webhooks-guide) — POST `{content}` to webhook URL
- [@slack/webhook npm](https://www.npmjs.com/package/@slack/webhook) — v7.0.6, wraps same HTTP POST
- [Node.js child_process](https://nodejs.org/api/child_process.html) — `spawn({detached: true})` + `unref()` daemon pattern
- [PM2 GitHub](https://github.com/Unitech/pm2) — production process manager, evaluated and rejected

---

*Stack research for: Kastell v1.7 Guard Core*
*Researched: 2026-03-14*
