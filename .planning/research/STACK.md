# Stack Research

**Domain:** CLI tool — fleet multi-server visibility, multi-channel notifications, doctor auto-fix
**Researched:** 2026-03-14
**Confidence:** HIGH (versions verified live from npm registry)
**Scope:** NEW capabilities only for v1.8. Existing stack (TypeScript, Commander.js, Inquirer.js,
Axios 1.x, Zod 4.x, Chalk, Ora, js-yaml, @napi-rs/keyring, MCP SDK, figlet, croner, nodemailer,
Jest 30, ESLint 10, Prettier) is validated and NOT re-researched.

---

## Executive Decision

**One new production dependency: `p-limit`.** Everything else for v1.8 — fleet aggregation,
multi-channel notifications (Telegram/Discord/Slack/Email), and doctor --fix auto-remediation —
is built on the existing stack. `nodemailer` and `@types/nodemailer` were already added in v1.7
research. `croner` was also added in v1.7.

---

## Feature-by-Feature Stack Analysis

### 1. `kastell fleet` — `p-limit` for Concurrency Control

Fleet runs parallel SSH checks across all registered servers. With many servers, unbounded
`Promise.allSettled` will saturate the SSH connection pool and hit OS file descriptor limits.

**Recommended:** `p-limit` ^7.3.0

| Why p-limit | Why not alternatives |
|-------------|----------------------|
| Pure ESM (`"type":"module"`, exports `{ default: './index.js' }`) — confirmed via `npm show p-limit type exports` | `p-queue` adds priority queues, event emitters, rate limiting — overkill for bounded SSH fan-out |
| TypeScript types bundled (no `@types/` package needed) | Manual batching with `Promise.allSettled` in chunks is error-prone and re-implements what p-limit does |
| Zero transitive dependencies | `async` library (caolan) is CJS-only and brings 10+ utilities we don't need |
| 170M+ weekly downloads — battle-tested | |
| Node >=18, Kastell requires >=20 | |
| Current version 7.3.0, actively maintained | |

```bash
npm install p-limit
```

```typescript
import pLimit from "p-limit";

// Cap at 5 concurrent SSH connections regardless of fleet size
const limit = pLimit(5);
const results = await Promise.allSettled(
  servers.map((server) => limit(() => fetchServerStatus(server)))
);
```

**Concurrency cap rationale:** Most users have <20 servers. Cap of 5 prevents SSH connection
exhaustion without meaningfully slowing down fleet operations. The value should be a constant
in `constants.ts` so it can be tuned without touching business logic.

**Confidence:** HIGH — verified via `npm show p-limit version type exports`.

---

### 2. Multi-Channel Notifications — Existing Stack Only

All four notification channels are already covered by dependencies added in v1.7.

#### Telegram — Axios (already in stack)

```typescript
// src/core/notifications/telegram.ts
await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
  chat_id: chatId,
  text,
  parse_mode: "HTML",
});
```

**Confidence:** HIGH — official Telegram Bot API, plain HTTP POST.

#### Discord — Axios (already in stack)

```typescript
// src/core/notifications/discord.ts
await axios.post(webhookUrl, { content });
```

**Confidence:** HIGH — Discord webhook API, plain HTTP POST.

#### Slack — Axios (already in stack)

```typescript
// src/core/notifications/slack.ts
await axios.post(webhookUrl, { text });
```

**Confidence:** HIGH — official Slack Incoming Webhooks, plain HTTP POST.

#### Email — nodemailer (added in v1.7 scope)

nodemailer 8.0.2 and @types/nodemailer 7.0.11 are already in the dependency tree.
The v1.7 research confirmed the CJS interop pattern for ESM projects (same as `@napi-rs/keyring`).

```typescript
// src/core/notifications/email.ts
import nodemailer from "nodemailer";
const transporter = nodemailer.createTransport(smtpConfig);
await transporter.sendMail({ from, to, subject, text });
```

**Confidence:** MEDIUM — nodemailer 8.0.2 is CJS, interop works via Node 20 CJS-in-ESM support.
ESM-native status unconfirmed from official docs.

#### Notification Config — Zod (already in stack)

Notification channel config stored at `~/.kastell/notifications.json`, validated with Zod at
load time. Missing/disabled channels are silently skipped — no error if a channel is unconfigured.

```typescript
// src/types/index.ts addition
export interface NotificationConfig {
  telegram?: { botToken: string; chatId: string };
  discord?: { webhookUrl: string };
  slack?: { webhookUrl: string };
  email?: { host: string; port: number; user: string; pass: string; to: string; from: string };
}
```

---

### 3. `kastell doctor --fix` — Existing Stack Only

`DoctorFinding` already has a `command: string` field (the fix command to run). The `--fix` flag
adds an Inquirer.js prompt (already in stack) listing critical and warning findings, then calls
`sshExec(finding.command)` for each confirmed fix.

The pattern is:
1. Run doctor checks (already implemented)
2. Filter to findings with `severity !== "info"`
3. Inquirer checkbox prompt for user to select which fixes to apply
4. `for...of` loop calling `sshExec` for each selected finding's command
5. Re-run doctor to confirm resolution

No new library needed. Inquirer.js is already a dependency with checkbox support.

**Confidence:** HIGH — composes existing `sshExec`, `DoctorFinding`, and Inquirer.js.

---

### 4. Fleet Output — Existing Stack Only

Fleet table rendering uses Chalk (already in stack) for color. A simple columnar formatter
(~30 lines) in `core/fleet.ts` is sufficient. `cli-table3` or `table` npm packages add
unnecessary dependencies for a fixed-column status view.

Column layout: `[status] [name] [ip] [provider] [disk%] [ram%] [audit score]`

Chalk-only implementation handles column padding with `String.padEnd()`.

**Confidence:** HIGH — pattern mirrors existing doctor output rendering.

---

## Recommended Stack Additions for v1.8

### New Production Dependencies

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `p-limit` | ^7.3.0 | Parallel SSH concurrency cap for fleet operations | Pure ESM, bundled types, zero deps, prevents SSH connection exhaustion |

### Already Available (Added v1.7, Verify Present)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `nodemailer` | ^8.0.2 | SMTP email notifications | Added in v1.7 scope |
| `@types/nodemailer` | ^7.0.11 | TypeScript types for nodemailer | Added in v1.7 scope |
| `croner` | ^10.0.1 | Cron scheduler for guard/backup | Added in v1.7 scope |

### Installation

```bash
# Single new dependency for v1.8
npm install p-limit
```

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `p-queue` | Full priority queue with events — overkill for capped SSH fan-out | `p-limit` (lighter, sufficient) |
| `cli-table3` / `table` | NPM dependency for table formatting that's 30 lines of Chalk + padEnd | Chalk + `String.padEnd()` |
| `@slack/webhook` | Official SDK wraps a 3-line HTTP POST, adds `@slack/logger` transitive dep | `axios.post(webhookUrl, { text })` |
| `telegraf` / `node-telegram-bot-api` | Full interactive bot framework — Kastell only sends, never receives | Direct Axios POST to Bot API |
| `discord.js` | Full Discord bot library, >1MB, designed for interactive bots | Direct Axios POST to webhook URL |
| `winston` / `pino` | Structured logging — guard daemon log is append-only text, no levels needed yet | `fs.appendFileSync` (existing pattern) |
| `p-map` (sindresorhus) | Adds async mapping; `Promise.allSettled` + `p-limit` covers the same pattern explicitly | `p-limit` + `Promise.allSettled` |

---

## Version Compatibility

| Package | Version | Compatible With Kastell Stack | Notes |
|---------|---------|-------------------------------|-------|
| `p-limit` | ^7.3.0 | Node >=18, `"type":"module"`, TypeScript 5 | Pure ESM confirmed via `npm show` |
| `nodemailer` | ^8.0.2 | CJS — Node 20 ESM interop, same as `@napi-rs/keyring` | `import nodemailer from "nodemailer"` works |
| `@types/nodemailer` | ^7.0.11 | TypeScript 5.x | Dev dep only |

---

## Integration Points

| Feature | Module Path | Pattern | New Dep |
|---------|-------------|---------|---------|
| Fleet aggregation | `src/core/fleet.ts` | `pLimit(5)` + `Promise.allSettled` + `sshExec` | `p-limit` |
| Notification dispatcher | `src/core/notifications/index.ts` | Channel-agnostic dispatcher, Zod-validated config | None |
| Telegram channel | `src/core/notifications/telegram.ts` | `axios.post` to Bot API | None |
| Discord channel | `src/core/notifications/discord.ts` | `axios.post` to webhook URL | None |
| Slack channel | `src/core/notifications/slack.ts` | `axios.post` to webhook URL | None |
| Email channel | `src/core/notifications/email.ts` | `nodemailer.createTransport` | nodemailer (v1.7) |
| Doctor --fix | `src/commands/doctor.ts` extension | Inquirer checkbox → `sshExec(finding.command)` | None |
| Fleet fleet config | `src/constants.ts` addition | `FLEET_CONCURRENCY_LIMIT = 5` | None |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Fleet concurrency | `p-limit` ^7.3.0 | `p-queue` | Over-engineered for fixed fan-out |
| Fleet concurrency | `p-limit` ^7.3.0 | Manual `Promise.allSettled` batching | Error-prone re-implementation |
| Table rendering | Chalk + padEnd | `cli-table3` | Unnecessary dep for fixed-column output |
| Email | `nodemailer` (v1.7) | `emailjs` | Lower adoption, less maintained |
| Slack | Axios direct | `@slack/webhook` | Wraps 3-line POST, adds transitive dep |
| Telegram | Axios direct | `telegraf` | Full bot framework, far exceeds need |

---

## Sources

- `npm show p-limit version type exports` → `7.3.0`, `type=module`, confirmed pure ESM (HIGH confidence, verified live)
- `npm show nodemailer version` → `8.0.2` (HIGH confidence, verified live)
- `npm show @types/nodemailer version` → `7.0.11` (HIGH confidence, verified live)
- [Telegram Bot API](https://core.telegram.org/bots/api) — sendMessage via HTTP POST (HIGH)
- [Slack Incoming Webhooks](https://api.slack.com/incoming-webhooks) — POST `{text}` to URL (HIGH)
- [Discord Webhooks Guide 2025](https://inventivehq.com/blog/discord-webhooks-guide) — POST `{content}` to URL (MEDIUM)
- [p-limit GitHub](https://github.com/sindresorhus/p-limit) — ESM, types bundled, 170M weekly downloads (HIGH)
- [nodemailer ESM issue #1518](https://github.com/nodemailer/nodemailer/issues/1518) — CJS-only confirmed, Node 20 interop required (MEDIUM)

---

*Stack research for: Kastell v1.8 — Fleet + Notifications + Doctor --fix*
*Researched: 2026-03-14*
