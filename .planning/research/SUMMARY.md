# Project Research Summary

**Project:** Kastell v1.8 — Fleet + Notifications + Doctor --fix + Tech Debt
**Domain:** CLI security toolkit — multi-server fleet visibility, multi-channel notifications, doctor auto-remediation
**Researched:** 2026-03-14
**Confidence:** HIGH — all findings based on direct codebase analysis + live npm registry verification

## Executive Summary

Kastell v1.8 is an additive release built entirely on the v1.7 foundation. The four capabilities targeted — fleet multi-server visibility, multi-channel alert notifications, doctor interactive auto-fix, and structural tech debt cleanup — require only one new npm dependency (`p-limit` for SSH concurrency control). Every other building block is already present: `axios` covers Telegram/Discord/Slack webhooks, `nodemailer` was added in v1.7 scope for email, `Inquirer.js` handles doctor --fix prompts, and `Promise.allSettled` is the idiomatic pattern for parallel server operations. This is a low-dependency, high-integration milestone.

The recommended architecture is extension, not greenfield. `core/notify/` is a new module with a `NotificationChannel` interface and four thin channel implementations. `core/fleet.ts` aggregates existing per-server functions (`checkServerStatus`, `loadAuditHistory`) under a concurrency cap. `doctor --fix` adds `runAutoFix()` to the existing `core/doctor.ts` and a `--fix` flag to the thin command wrapper. Guard notification dispatch happens client-side: `kastell guard status` reads the remote breach log and calls `dispatchNotification()` from the user's machine — keeping credentials in `~/.kastell/notify.json` (0o600) rather than on the VPS.

The three non-negotiable safety rules that must be encoded before any feature code ships: (1) `Promise.allSettled` with `p-limit(5)` for all fleet SSH operations — never sequential `for...of`; (2) per-finding explicit confirmation gate before `sshExec` in doctor --fix — never auto-execute, particularly destructive commands like `docker system prune`; (3) per-breach-type cooldown state for notifications — without it the guard's 5-minute cron cadence creates alert storms. Tech debt cleanup (layer violation, adapter duplication) must land first to avoid building on a broken foundation.

---

## Key Findings

### Recommended Stack

The existing stack handles v1.8 completely with one addition. `p-limit ^7.3.0` is the sole new production dependency — it is pure ESM, has bundled TypeScript types, zero transitive dependencies, and prevents OS file descriptor exhaustion when running parallel SSH across a fleet. `nodemailer` and `@types/nodemailer` were already added in v1.7 research and are confirmed present. All three webhook-based notification channels (Telegram, Discord, Slack) use `axios` which is already a project dependency.

**Core technologies:**
- `p-limit ^7.3.0`: SSH concurrency cap for fleet — pure ESM, 170M weekly downloads, Node >=18 compatible
- `axios` (existing): Telegram Bot API, Discord webhooks, Slack incoming webhooks — plain HTTP POST, no bot frameworks needed
- `nodemailer ^8.0.2` (v1.7 scope): SMTP email notifications — CJS-in-ESM via Node 20 interop, same pattern as `@napi-rs/keyring`
- `Promise.allSettled` (native): multi-server fan-out — never `Promise.all`; one offline server must not block the rest
- `Inquirer.js` (existing): doctor --fix confirmation prompts — checkbox and confirm types already in stack

**What NOT to add:** `p-queue`, `cli-table3`, `@slack/webhook`, `telegraf`, `discord.js`, `winston` — each is overkill or wraps functionality already available in the stack.

### Expected Features

**Must have (table stakes):**
- `kastell fleet` with health + cached audit score per server — the only tool combining security posture with health in a CLI context
- Notification dispatch (Telegram + Discord minimum) wired to guard breach detection — guard runs silently without this
- `kastell notify test <channel>` validation command — users need to verify config before relying on alerts
- `kastell doctor --fix` interactive prompt — `DoctorFinding.command` already exists; this completes the detect-decide-act loop
- Tech debt: adapter duplication + layer violation fix — must be resolved before v1.9 audit expansion touches those layers

**Should have (competitive differentiators):**
- Fleet shows cached audit score with timestamp, not live SSH audit — response under 10 seconds for 10 servers
- Guard notification includes suggested fix command, not just alert text — competitors send "CPU HIGH" with nothing actionable
- Multi-channel fan-out: ALL configured channels receive each alert simultaneously via `Promise.allSettled`
- `kastell doctor suppress <finding-id>` — prevent auto-remediating intentional config deviations
- `postSetup` decomposition (bare/platform split) — tech debt item targeting v1.8 velocity improvement

**Defer to v1.8.x or v1.9:**
- Email SMTP notifications — Telegram + Discord covers 80%+ of users; SMTP adds config complexity
- Fleet `--sort`/`--filter` flags — basic table sufficient for v1.8.0
- Fleet `--watch` live refresh — ncurses complexity for marginal gain
- Doctor critical findings triggering automatic notification — defer until `--fix` is stable
- Server-side notification push (curl in guard script) — deferred to v1.9; client-side polling is safer for credential security

### Architecture Approach

v1.8 adds two new core modules (`core/fleet.ts`, `core/notify/`) and modifies five existing ones (`core/doctor.ts`, `core/guard.ts`, `commands/doctor.ts`, `adapters/coolify.ts`, `adapters/dokploy.ts`). The commands layer stays thin. Notification dispatch is client-side only in v1.8: `guardStatus()` detects breach lines in the remote log and calls `dispatchNotification()` from the user's machine, keeping webhook credentials in `~/.kastell/notify.json` (0o600) rather than embedded in the VPS guard script. Guard script injection of credentials is explicitly an anti-pattern — deploy as a separate sourced config file instead.

**Major components:**
1. `core/fleet.ts` — parallel fan-out across registered servers using `Promise.allSettled` + `p-limit(5)`; reads `checkServerStatus` and `loadAuditHistory` (both existing, no signature changes)
2. `core/notify/index.ts` + channel modules — `NotificationChannel` interface with four implementations; dispatch is `Promise.allSettled` across channels; failures log but never propagate
3. `core/doctor.ts` (extended) — new `runAutoFix()` function; iterates `DoctorFinding[]` with per-finding confirmation; adds `fixSafe: boolean` field to distinguish destructive commands
4. `adapters/shared.ts` (extended) — shared backup/restore template helpers extracted from coolify/dokploy (~80% duplication)
5. `core/deploy.ts` (fixed) — layer violation removed; imports moved from `commands/firewall.ts` to `core/firewall.ts`
6. `commands/completions.ts` (extended) — `fleet`, `notify`, `--fix` added to static completion strings

**New config file:** `~/.kastell/notify.json` (mode 0o600) for channel credentials.

### Critical Pitfalls

1. **Fleet sequential SSH** — `for...of` + `await sshExec` makes fleet unusable for 3+ servers (15s+). Use `Promise.allSettled` + `p-limit(5)` from the first commit; never sequential.

2. **Fleet partial failures silently swallowed** — filtering rejected results from `Promise.allSettled` hides unreachable servers. Every server must render a row with an UNREACHABLE state and error reason; total shown must equal total registered.

3. **Guard script shell injection** — injecting bot tokens into the bash heredoc in `buildDeployGuardScriptCommand()` causes shell injection if credentials contain `$`, backticks, or newlines. Deploy credentials as `/root/.kastell-notify.conf` (chmod 600) via a separate `sshExec` call; guard script sources the file at runtime.

4. **Doctor --fix executes destructive commands without confirmation** — `docker system prune -a` on production can delete containers needed to restart stopped services. Add `inquirer.prompt` gate before every `sshExec`; tag `DoctorFinding` with `fixSafe: boolean`; destructive commands require confirmation even with `--force`.

5. **Alert storms from repeat guard breaches** — guard runs every 5 minutes; same breach sends 72 Telegram messages in 6 hours. Implement per-breach-type cooldown in `/var/lib/kastell/notify-state.json`; default 1-hour window; single recovery notification when breach clears. Design cooldown before writing any channel HTTP code.

---

## Implications for Roadmap

Based on combined research, the build order is driven by two constraints: (a) tech debt must clear the foundation before new modules land on top, and (b) the notification module must exist before guard integration. Seven phases are suggested.

### Phase 1: Tech Debt — Layer Violation Fix
**Rationale:** `core/deploy.ts` currently imports from `commands/firewall.ts` and `commands/secure.ts` — an upward layer violation. Fleet and future core modules will import from `core/deploy.ts`. Adding fleet code on top of this violation embeds the mistake deeper. Fix this first, before any new code lands.
**Delivers:** Clean core layer; commands become thin wrappers for their own logic; no behavioral change.
**Addresses:** Tech debt item — layer violation (MEMORY.md, ARCHITECTURE.md build step 1).
**Avoids:** Pitfall 11 — run full test suite before, move one function at a time, update test mocks in the same commit.

### Phase 2: Tech Debt — Adapter Deduplication
**Rationale:** `adapters/coolify.ts` and `adapters/dokploy.ts` share ~80% backup/restore code. v1.9 audit expansion will add more adapter operations — fixing duplication now prevents it compounding into a larger refactor later.
**Delivers:** `adapters/shared.ts` with shared template helpers; no interface or behavior changes; all adapter tests pass.
**Addresses:** Tech debt item — adapter duplication.
**Avoids:** Pitfall 11 — each function moved individually; `npm test` after every move, not just at the end.

### Phase 3: Notification Module
**Rationale:** Guard integration depends on notifications. Building notifications as a standalone, independently testable module first allows `kastell notify test <channel>` to validate config before the guard wires it in. Cooldown design must happen here, not during guard integration.
**Delivers:** `core/notify/` with `NotificationChannel` interface + Telegram + Discord + Slack + Email implementations; `~/.kastell/notify.json` at 0o600; `kastell notify test <channel>` command; per-breach-type cooldown state design.
**Uses:** `axios` (existing), `nodemailer` (v1.7), `withRetry` from `utils/retry.ts` for rate-limit header parsing.
**Avoids:** Pitfall 3 (guard injection — client-side dispatch only), Pitfall 5 (alert storm — cooldown designed here), Pitfall 6 (token plaintext — 0o600 + keychain pattern from `core/tokens.ts`), Pitfall 7 (Discord/Slack rate limits — header-driven, not hardcoded).

### Phase 4: Doctor --fix
**Rationale:** Independent of notifications and fleet. Small surface area. Extends the existing `DoctorFinding.command` field which was designed for this purpose. Delivers high user value (completes the detect-decide-act loop) with low risk.
**Delivers:** `fixSafe: boolean` on `DoctorFinding`; `runAutoFix()` in `core/doctor.ts`; `--fix` and `--dry-run` flags on `kastell doctor`; per-finding `inquirer.prompt` confirmation gate.
**Uses:** `Inquirer.js` (existing), `sshExec` (existing), `assertValidIp` (existing).
**Avoids:** Pitfall 4 (destructive execution without confirmation), Pitfall 9 (auto-remediating intentional config — per-finding interactive prompts, no batch-apply).

### Phase 5: Fleet Visibility
**Rationale:** Depends on clean core layer (Phase 1) and stable existing functions `checkServerStatus`/`loadAuditHistory`. Does not depend on notifications. Independent, high-value feature that validates multi-server data reading patterns.
**Delivers:** `core/fleet.ts` + `commands/fleet.ts` + `mcp/tools/serverFleet.ts`; `kastell fleet` with health + cached audit score table; `--json` flag; UNREACHABLE state rendering; `p-limit(5)` concurrency cap.
**Uses:** `p-limit ^7.3.0` (new sole dependency), `Promise.allSettled` (native), `checkServerStatus` (existing), `loadAuditHistory` (existing), Chalk + `String.padEnd()` for table formatting.
**Avoids:** Pitfall 1 (sequential fleet SSH — `p-limit` from first commit), Pitfall 2 (partial failures silent — UNREACHABLE row required), Pitfall 8 (live SSH for fleet audit — cache-first, `--fresh` flag to override).

### Phase 6: Guard Notification Integration
**Rationale:** Depends on notification module (Phase 3). The most complex integration — guard script version embedding, client-side breach detection, `dispatchNotification()` wiring. Implemented last among feature phases to avoid wiring in an incomplete notification module.
**Delivers:** Guard script embeds `KASTELL_GUARD_VERSION="1.8.0"`; `guardStatus()` detects new breach lines and calls `dispatchNotification()`; version mismatch detection with redeploy prompt; notify-state.json preserved on guard script redeploy.
**Avoids:** Pitfall 10 (guard script version mismatch — `guardStatus()` reads and compares version), Pitfall 3 (credential injection — client-side dispatch only, no secrets in bash heredoc).

### Phase 7: Shell Completions + Polish
**Rationale:** All commands and flags are finalized only after Phases 1-6 complete. Purely additive, zero runtime impact. `postSetup` decomposition belongs here as a P2 item if capacity allows.
**Delivers:** `fleet`, `notify`, `--fix` in `commands/completions.ts`; completions verified on bash, zsh, fish; optional `postSetup` decomposition.

### Phase Ordering Rationale

- Tech debt first (Phases 1-2): the layer violation in `core/deploy.ts` must be resolved before fleet and future core modules add more imports; adapter deduplication prevents compounding before v1.9 lands on top
- Notifications before guard integration (Phase 3 before Phase 6): guard wiring is the final consumer of the notification module; a half-built notification module would produce a silently broken guard
- Fleet and doctor --fix (Phases 4-5) are independent of each other and of notifications — they could be reordered without consequence
- Shell completions last (Phase 7): all command signatures must be finalized first
- This order mirrors the build order recommended in ARCHITECTURE.md exactly

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Notifications):** Cooldown state location (server-side `/var/lib/kastell/` vs client-side `~/.kastell/`) and guard-side vs client-side dispatch tradeoffs have non-obvious implementation choices. Discord/Slack rate limit header parsing patterns are service-specific and warrant a research-phase pass.
- **Phase 6 (Guard Integration):** Guard script versioning strategy and client-side breach log polling frequency are design decisions with observable tradeoffs.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Layer Violation Fix):** The correct pattern is established: move logic to core, commands become thin wrappers. Direct execution, no unknowns.
- **Phase 2 (Adapter Dedup):** Template method / shared helpers is standard; risk is in test mock path updates, not design.
- **Phase 4 (Doctor --fix):** Pattern already exists in `commands/guard.ts` (lines 22-35); replicate that `inquirer.prompt + --force` structure exactly.
- **Phase 5 (Fleet):** All data sources are existing functions; `Promise.allSettled + p-limit` pattern is documented and verified.
- **Phase 7 (Completions):** Static string additions only.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | `p-limit` version verified live via `npm show`; existing stack confirmed in v1.7.0 release; nodemailer CJS interop is MEDIUM (not confirmed from official docs) |
| Features | HIGH | All features extend existing v1.7 code; no new problem domains; `DoctorFinding.command` already present and populated |
| Architecture | HIGH | Based on direct source analysis of v1.7 codebase; all integration points explicitly verified against actual files |
| Pitfalls | HIGH | Codebase-verified integration risks; external service rate limits from official Discord/Slack docs |

**Overall confidence:** HIGH

### Gaps to Address

- **nodemailer ESM interop:** MEDIUM confidence only. nodemailer 8.0.2 is CJS; Node 20 interop is expected (same as `@napi-rs/keyring`) but not confirmed from official nodemailer docs. Validate with a spike import test before committing to the email channel implementation in Phase 3.
- **Guard cooldown state location:** Research recommends `/var/lib/kastell/notify-state.json` (server-side, closer to guard script) vs `~/.kastell/guard-notify-state.json` (client-side, consistent with client-dispatch architecture). Resolve at the start of Phase 3 — the choice affects guard script changes in Phase 6.
- **Doctor suppress command scope:** Whether `kastell doctor suppress <finding-id>` belongs in Phase 4 (v1.8.0) or v1.8.x is not definitively resolved. Include as P2 within Phase 4; ship only if it does not delay fleet and notifications.
- **MCP tool parity:** `server_fleet` MCP tool is flagged as required. Verify the MCP tool registration pattern from v1.7 (`server_guard`, `server_doctor`, `server_lock`) and replicate exactly for fleet in Phase 5.

---

## Sources

### Primary (HIGH confidence)
- `npm show p-limit version type exports` — verified 7.3.0, pure ESM, bundled types
- `npm show nodemailer version` — verified 8.0.2
- Kastell codebase v1.7.0 direct analysis: `src/core/guard.ts` (guard script notify stub, heredoc construction), `src/core/doctor.ts` (`DoctorFinding.command` field, cache-first orchestrator), `src/utils/config.ts` (atomic writes, 0o600 pattern), `src/core/tokens.ts` (keychain token pattern to reuse), `src/commands/guard.ts` (inquirer.prompt + --force pattern)
- [Telegram Bot API](https://core.telegram.org/bots/api#sendmessage) — sendMessage via HTTP POST
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks) — POST `{text}` to webhook URL
- [Discord Rate Limits](https://docs.discord.com/developers/topics/rate-limits) — 5 req/2s per webhook; parse `X-RateLimit-*` headers; 404 = stop retrying
- [p-limit GitHub](https://github.com/sindresorhus/p-limit) — ESM, bundled types, 170M weekly downloads

### Secondary (MEDIUM confidence)
- [Discord Webhooks Guide 2025](https://inventivehq.com/blog/discord-webhooks-guide) — POST `{content}` to webhook URL
- [nodemailer ESM issue #1518](https://github.com/nodemailer/nodemailer/issues/1518) — CJS-only confirmed, Node 20 interop required
- [Auto-Remediation Safety Guide](https://medium.com/@anudeepballa7/kill-the-pager-a-practical-guide-to-auto-remediation-and-self-healing-systems-f1507343f9f2) — Detect→Decide→Do; fail-safe defaults; idempotent and reversible
- Coolify notification architecture (coolify.io/docs) — `NotificationProvider` interface design reference
- [Discord webhook rate limits guide](https://birdie0.github.io/discord-webhooks-guide/other/rate_limits.html) — failed requests count against quota

### Tertiary (MEDIUM confidence, needs validation)
- [Slack 2025 Rate Limit Changes](https://api.slack.com/changelog/2025-05-terms-rate-limit-update-and-faq) — new limits for non-Marketplace apps; parse `Retry-After` on all 429s
- [Webhook Security 2026](https://www.hooklistener.com/learn/webhook-security-fundamentals) — token storage and rotation patterns

---
*Research completed: 2026-03-14*
*Ready for roadmap: yes*
