# Project Research Summary

**Project:** Kastell v1.7 Guard Core
**Domain:** Autonomous server security monitoring, one-command hardening, multi-server visibility, proactive operations intelligence
**Researched:** 2026-03-14
**Confidence:** HIGH

## Executive Summary

Kastell v1.7 Guard Core is an autonomous security monitoring milestone built on top of v1.6's audit foundation. The research confirms a lean, dependency-minimal approach: only `croner` (cron scheduling inside the guard daemon) and conditionally `nodemailer` (SMTP email) are new production dependencies. All other capabilities — Telegram, Discord, Slack notifications; fleet aggregation; doctor intelligence; lock hardening; risk trend analysis — are implemented via Node.js built-ins and Axios (already in the stack). The guard daemon runs as a scheduled cron entry on the remote VPS (not as a local background process), which is the architecturally correct separation for a CLI tool and avoids the complexity of systemd, launchd, or PM2.

The recommended build order is: notifications first (guard depends on it), then lock and backup schedule (independent, fast wins), then guard daemon and risk trend, then fleet and doctor last (doctor requires metric history that guard collects). This dependency-aware ordering is consistent across all three research dimensions — FEATURES.md, ARCHITECTURE.md, and PITFALLS.md all converge on the same 3-phase grouping. Approximately 1,550 new lines of TypeScript across 17 new files, zero new dependencies for the core happy path (Telegram + Discord + Slack), and a single optional dependency for email.

The top risks are operational rather than architectural: crontab idempotency failure (duplicate guard entries), SSH lockout from `kastell lock` (password auth disabled before key auth is verified), partial hardening state if SSH drops mid-sequence, and silent notification delivery failure. All four have clear, tested mitigations documented in PITFALLS.md. The existing codebase patterns (`withFileLock`, `withRetry`, `KastellResult<T>`, `Promise.allSettled`) apply directly to every new module — this milestone is greenfield within a mature, consistent codebase.

---

## Key Findings

### Recommended Stack

The existing stack requires only one unconditional new dependency. `croner` (^10.0.1) is the scheduler for the guard daemon's internal cron loop — pure ESM, zero transitive dependencies, bundled TypeScript types, actively maintained. All notification channels (Telegram, Discord, Slack) are plain HTTP POST requests handled by Axios. `nodemailer` (^8.0.2, CJS, same interop pattern as `@napi-rs/keyring`) is conditionally added for SMTP email. Every other v1.7 feature — daemon lifecycle, fleet aggregation, doctor checks, lock hardening, risk trend — uses Node.js built-ins or existing codebase utilities.

**Core technologies:**
- `croner` ^10.0.1: cron scheduling inside guard daemon — only ESM-native, zero-dep, bundled-types scheduler available; `node-cron` v4 is CJS-only
- `nodemailer` ^8.0.2 + `@types/nodemailer` ^7.0.11: SMTP email channel — conditional, same CJS interop pattern already established in codebase
- `child_process.spawn({detached: true})` + PID file: daemon lifecycle management — cross-platform, no PM2 needed
- `Promise.allSettled` (built-in): fleet parallel SSH fan-out with failure isolation — already used in codebase
- `axios` (existing): all three webhook notification channels — Telegram Bot API, Discord webhook, Slack webhook each require only a JSON POST

**What NOT to add:** PM2, `node-cron` (CJS-only v4), `node-schedule` (3 transitive deps), `telegraf`/`discord.js`/`@slack/bolt` (full bot frameworks), `better-sqlite3` (JSON files sufficient), `winston`/`pino` (append-only log file sufficient for v1.7).

### Expected Features

All seven v1.7 features are confirmed as user-expected or differentiating. The target audience (indie hackers, micro-DevOps teams) has no existing tool that combines autonomous security monitoring, audit-score-aware fleet visibility, and proactive operations intelligence in a single CLI.

**Must have (table stakes):**
- `kastell guard start/stop/status` — daemon lifecycle is mandatory; a silent guard defeats the purpose
- Threshold alerts (disk, RAM, CPU) — expected behavior for any monitoring tool
- At least one notification channel at launch (Telegram recommended as most common for indie hackers)
- `kastell lock --production` — idempotent one-command hardening bundle
- `kastell fleet` — multi-server overview; per-server-only commands are insufficient for 3+ server users
- `backup --schedule` — top requested feature after users see backup works
- Risk trend in `kastell audit --trend` — audit history exists from v1.5; surfacing it is expected

**Should have (differentiators):**
- Risk trend with cause list ("score 62→68 because: fail2ban not running, PermitRootLogin not disabled") — trend without cause is called out in PROJECT.md as a first-class principle; trend number alone is unacceptable output
- `kastell fleet` showing security audit score per server, not just uptime — no competitor does this
- `kastell doctor` proactive recommendations — predict before it breaks, not just report what is broken now
- `kastell lock` idempotency + platform-awareness (Coolify/Dokploy port safety)
- Backup schedule overlap protection (flock-based lock file on server)
- `kastell notify test <channel>` — verify notification config works before guard relies on it

**Defer to v1.8+:**
- Email SMTP notifications (Telegram + Discord covers 80% of users in v1.7)
- `kastell doctor --fix` auto-remediation prompts (get the report right first)
- Fleet `--sort` and `--filter` flags beyond basic score sort
- Slack/Discord bot commands (one-way push only in v1.7)
- Fleet web dashboard (v3.0 territory)
- Auto-remediation in guard (alert + suggestion, not auto-apply)

### Architecture Approach

v1.7 is a greenfield addition to a mature, layered codebase. The Commands (thin) -> Core (logic) -> Utils/Providers/Adapters structure is strictly maintained. Every new module follows established conventions: `KastellResult<T>` return types (never throw), `withFileLock` + atomic temp+rename for any config writes, plain function modules (not classes, per the composition-over-inheritance decision from v1.5 adapters), and `Promise.allSettled` for parallel fan-out with failure isolation. Three new config files in `~/.kastell/` (guard.json, notify.json, schedule.json), all at mode 0o600.

**Major components:**
1. `core/notify/` — channel-agnostic notification dispatcher with per-channel plain function modules; foundational dependency for guard and doctor
2. `core/guard/` — daemon lifecycle (healthChecks, daemon orchestration); writes MetricSnapshot that doctor consumes
3. `core/lock/` — pure config profiles + SSH hardening via single heredoc script; reuses existing `applySecureSetup`
4. `core/fleet/` — parallel server aggregation via `Promise.allSettled`; reads cached audit history (no live audit per server)
5. `core/doctor/` — analysis of cached snapshots and metric history; does NOT SSH on every invocation
6. `core/trend/` — multi-point cause attribution on existing `audit-history.json`; extends v1.6 diff engine
7. `core/schedule/` — cron expression validation + nextRun persistence; integrated into guard daemon loop
8. 2 new MCP tools: `server_fleet`, `server_guard` (always built last, delegate to core)

### Critical Pitfalls

1. **Crontab not idempotent by default (P1)** — Use sentinel-comment pattern: `crontab -l | grep -v "kastell-guard" | { cat; echo "# kastell-guard-v1.7"; echo "*/5 * * * * ..."; } | crontab -`. Running `guard install` twice must result in exactly one entry. Test explicitly for idempotency.

2. **SSH lockout from lock command (P11)** — Before applying any SSH auth hardening, verify key auth works with `ssh -o PasswordAuthentication=no -o BatchMode=yes`. Abort with a clear error if key auth fails. Dry-run by default on first `lock` use.

3. **Partial hardening state on SSH drop (P2)** — Bundle ALL lock operations into a single SSH heredoc script (`ssh root@ip 'bash -s' < lock-script.sh`). Include `set -e` and `trap cleanup EXIT`. One connection, atomic apply, no partial state.

4. **Cron minimal environment kills guard silently (P5)** — Guard cron entry must source a generated `guard-env.sh` with explicit PATH and all API tokens. Cron runs headless; the user's shell environment is completely absent.

5. **Silent notification delivery failure (P4)** — Log every notify attempt and outcome to `/var/log/kastell-guard.log`. Sequential fallback chain (Telegram -> Discord -> Email). `kastell guard test-notify <ip>` validates all channels before guard depends on them.

---

## Implications for Roadmap

Based on research, the dependency graph and pitfall profile converge on a 3-phase structure. All three research files independently recommend the same grouping.

### Phase 1: Notifications + Lock + Backup Schedule

**Rationale:** Notifications are a leaf dependency (no deps on other new modules) but block guard and doctor. Lock and backup schedule are fully independent of each other and of notifications — they can be built in parallel and deliver standalone value immediately. This phase has the lowest risk profile and produces three shippable features.

**Delivers:** `kastell notify config/test`, `kastell lock --production`, `backup --schedule`

**Addresses:** Table stakes for lock (idempotent hardening bundle) and backup (top user request after v1.5); notification foundation required for Phase 2 guard.

**Avoids:** P4 (notification silent failure — test command validates channels before guard uses them), P11 (SSH lockout — lock safety checks land here), P2 (partial hardening — single SSH heredoc script), P12 (credential storage permissions — notify.json at 0o600).

**Research flag:** Standard patterns — skip `/gsd:research-phase`. Lock hardening step ordering and notification webhook patterns are fully documented.

### Phase 2: Guard Daemon + Risk Trend

**Rationale:** Guard is the core feature of this milestone ("Guard = heart" per PROJECT.md). It depends on the notification module from Phase 1. Risk trend is independent but belongs here because it enriches guard output (score regression alerts include cause list). Both features use existing v1.6 audit data structures with no new schema changes needed.

**Delivers:** `kastell guard start/stop/status`, scheduled health + audit + notification loop, `kastell audit --trend` with cause attribution

**Uses:** `croner` (daemon internal scheduling), `Promise.allSettled` (notification fan-out), existing `audit-history.json` and v1.6 diff engine

**Implements:** `core/guard/daemon.ts`, `core/guard/healthChecks.ts`, `core/trend/trend.ts`, `utils/guardConfig.ts`, `core/schedule/schedule.ts` (wired into daemon loop)

**Avoids:** P1 (duplicate cron entries — idempotent sentinel-comment install), P5 (cron environment — guard-env.sh sourcing), P10 (stale guard script — embed version, `guard update` command), P7 (trend without cause — category-delta attribution required, not optional), P16 (single snapshot crash — require 2+ snapshots, return null otherwise).

**Research flag:** Guard daemon (remote cron script versioning strategy, cross-platform cron path resolution, guard-env.sh secure generation) may benefit from a `/gsd:research-phase` pass before implementation.

### Phase 3: Fleet + Doctor

**Rationale:** Fleet reads from existing audit history and guard's health check utilities — it is more useful after guard has been collecting data. Doctor requires MetricSnapshot history that the guard daemon writes; launching doctor before guard means doctor has no historical data to analyze. Both features are presentational layers on top of data Phases 1 and 2 produce.

**Delivers:** `kastell fleet` (multi-server table with security score), `kastell doctor` (proactive findings from cached snapshots + metric history), 2 new MCP tools (`server_fleet`, `server_guard`)

**Avoids:** P3 (fleet parallel SSH exhaustion — concurrency cap at 5, per-server timeout, `Promise.allSettled`), P8 (provider API thundering herd — SSH-only default tier, `--full` flag for cloud enrichment), P9 (doctor contradicts intentional config — check suppression via `~/.kastell/suppress.yaml`), P14 (doctor too slow — use cached snapshots by default, `--fresh` flag for live fetch), P13 (fleet unreadable at scale — compact one-row-per-server table, sort unhealthy first).

**Research flag:** Standard patterns for fleet (parallel SSH with concurrency limit) and doctor (threshold rules, snapshot analysis). Skip `/gsd:research-phase`.

### Phase Ordering Rationale

- Notifications before guard: guard cannot alert without a tested notification path. Building and validating notifications independently prevents a silent-failure guard daemon from shipping.
- Lock and backup schedule in Phase 1: both are independent of notifications, have immediate standalone user value, and have the simplest pitfall profile. Fast wins that keep the milestone moving while guard is under development.
- Risk trend in Phase 2 with guard: trend uses the same audit history guard updates; wiring them together avoids a separate integration step later.
- Doctor after guard: doctor's "trending full" and "backup age" recommendations require at least two MetricSnapshot entries separated by time. Shipping doctor before guard has collected data produces empty or misleading output.
- Fleet after guard health checks: fleet reuses `core/guard/healthChecks.ts` for live disk/RAM probing. Building fleet after health checks are in place avoids duplicating SSH probe logic.

### Research Flags

**Needs `/gsd:research-phase` during planning:**
- Phase 2 — Guard daemon: remote cron script versioning strategy (how to propagate version tag to installed script), cross-platform cron path resolution (Ubuntu `/usr/local/bin/node` vs Alpine `/usr/bin/node`), and guard-env.sh secure generation with API token injection need careful specification before implementation.

**Standard patterns (skip `/gsd:research-phase`):**
- Phase 1 — Notifications: HTTP webhook POST patterns are fully documented; lock hardening step ordering is well-established.
- Phase 1 — Lock + Backup Schedule: both extend existing SSH command patterns; no new architectural unknowns.
- Phase 3 — Fleet + Doctor: parallel SSH with concurrency limit and snapshot analysis are established patterns; no unknowns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | `croner` ESM/types/zero-dep verified; Telegram/Discord/Slack direct HTTP confirmed via official docs; nodemailer CJS interop matches existing `@napi-rs/keyring` pattern |
| Features | HIGH | Feature scope confirmed against Kastell codebase, competitor landscape, and PROJECT.md strategic principles; dependency ordering verified from multiple research angles |
| Architecture | HIGH | Based on direct source code analysis of existing codebase; all new modules follow patterns already proven in production |
| Pitfalls | HIGH | Crontab idempotency, SSH lockout, cron environment, and silent notification failure all confirmed by external sources and codebase inspection |

**Overall confidence:** HIGH

### Gaps to Address

- **nodemailer ESM native support in v8:** v8.0.2 was published 2026-03-10 but official docs have not confirmed native ESM. The CJS interop via `import nodemailer from "nodemailer"` works (same pattern as `@napi-rs/keyring`). Verify before committing if email is in v1.7 scope. Low risk — the fallback pattern is proven.
- **Guard script version propagation:** The mechanism for detecting and updating stale guard scripts on remote servers (P10) is specified at the concept level (version embed + `guard update` command) but the exact update strategy (full re-deploy vs patch) needs specification during Phase 2 planning.
- **croner expression validation API:** ARCHITECTURE.md mentions `node-cron` for expression validation while STACK.md recommends `croner` for everything. Croner's own expression validation should be confirmed sufficient before adding any additional library. Standardize on croner only.
- **Backup schedule storage location:** PITFALLS.md (P15) recommends adding `backupSchedule` to `ServerRecord` while ARCHITECTURE.md specifies a separate `schedule.json`. Resolve during Phase 1 planning. The cleaner pattern is separate `schedule.json` with a reference field in `ServerRecord` for display in `server list`.

---

## Sources

### Primary (HIGH confidence)
- Kastell source code (direct analysis): `src/core/`, `src/utils/`, `src/adapters/`, `src/types/`, `src/constants.ts` — all integration points verified against actual files
- [croner npm](https://www.npmjs.com/package/croner) — v10.0.1, ESM, zero-dep, bundled types confirmed
- [Telegram Bot API](https://core.telegram.org/bots/api#sendmessage) — sendMessage endpoint, direct HTTP POST
- [Slack Incoming Webhooks](https://api.slack.com/incoming-webhooks) — POST `{text}` to webhook URL
- [Discord Webhooks Guide](https://inventivehq.com/blog/discord-webhooks-guide) — POST `{content}` to webhook URL
- [Node.js child_process](https://nodejs.org/api/child_process.html) — `spawn({detached: true})` + `unref()` daemon pattern
- [cronitor.io cron troubleshooting](https://cronitor.io/guides/cron-troubleshooting-guide) — 52% of cron failures are PATH/environment issues (P5)
- [SSH hardening lockout risk](https://blog.zsec.uk/locking-down-ssh-the-right-way/) — verify key auth before disabling password auth (P11)
- PROJECT.md: strategic principles (no AI/ML, deterministic thresholds, "trend always with why")
- LESSONS.md: SSH timeout considerations, core functions need context (platform/mode)

### Secondary (MEDIUM confidence)
- [nodemailer npm](https://www.npmjs.com/package/nodemailer) — v8.0.2, CJS; ESM native status not confirmed by official docs at research date
- [node-cron ESM Discussion #700](https://github.com/kelektiv/node-cron/issues/700) — CJS-only confirmed; reason `croner` was chosen
- [Google SRE distributed cron](https://sre.google/sre-book/distributed-periodic-scheduling/) — idempotency as most valuable safety feature for scheduled jobs
- [Linux server hardening idempotency](https://www.linux.com/topic/linux/linux-server-hardening-using-idempotency-ansible-part-2/) — idempotent hardening prevents intermediate states
- [Slack rate limits](https://docs.slack.dev/apis/web-api/rate-limits/) — ~1 msg/s per webhook
- [Discord webhook rate limits](https://birdie0.github.io/discord-webhooks-guide/other/rate_limits.html) — 5 req/2s

### Tertiary (LOW confidence)
- [Better Stack: Comparing Node.js Schedulers](https://betterstack.com/community/guides/scaling-nodejs/best-nodejs-schedulers/) — library comparison, validates croner selection
- [Crontab idempotency (Ansible issue #37355)](https://github.com/ansible/ansible/issues/37355) — overwrite vs append pattern; confirms sentinel-comment approach

---

*Research completed: 2026-03-14*
*Ready for roadmap: yes*
