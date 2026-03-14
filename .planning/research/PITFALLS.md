# Pitfalls Research

**Domain:** Kastell v1.8 — adding fleet visibility, multi-channel notifications, doctor auto-fix, tech debt cleanup to existing TypeScript ESM CLI + SSH + guard daemon
**Researched:** 2026-03-14
**Confidence:** HIGH (codebase-verified integration risks + web research on external services)

---

## Critical Pitfalls

### Pitfall 1: Fleet Sequential SSH Makes the Feature Unusable

**What goes wrong:**
`kastell fleet status` iterates servers with a sequential `for...of` loop and `await sshExec()` inside it. With 5 servers at 3s SSH latency each, the command takes 15+ seconds. Users cancel and conclude the feature is broken or too slow to use.

**Why it happens:**
Every existing Kastell core function operates on a single server: `resolveServer()` → `sshExec()` → display. Applying the same pattern to N servers in a loop is the path of least resistance. Fleet is the first feature that requires concurrent SSH.

**How to avoid:**
Use `Promise.allSettled()` for concurrent SSH per server. Add a concurrency cap at 3-5 simultaneous SSH connections to avoid exhausting the OS file descriptor limit (`child_process.execFile` spawns one process per call). Show a spinner with live progress (`N/M checked`). Use `Promise.allSettled` not `Promise.all` — one unreachable server must never abort the entire fleet.

```typescript
// Pattern to use
import pLimit from 'p-limit';
const limit = pLimit(5);
const results = await Promise.allSettled(
  servers.map(s => limit(() => checkServerStatus(s)))
);
// Render fulfilled and rejected separately
```

**Warning signs:**
`for...of` loop with `await sshExec()` inside. `Promise.all()` (throws on first rejection). Fleet output count does not match `kastell config list` count.

**Phase to address:**
Fleet visibility — establish concurrency before any other fleet work.

---

### Pitfall 2: Fleet Partial Failures Silently Swallowed

**What goes wrong:**
`Promise.allSettled()` is used but `rejected` results are filtered out before rendering. Fleet shows 4 servers healthy, silently omits the 1 that timed out. User believes the fleet is fine.

**Why it happens:**
Rendering errors alongside successes requires a distinct visual state that is easy to skip in a first pass. The existing `KastellResult<T>` pattern returns `success: false` for failures — but fleet aggregation must surface those per-server, not drop them.

**How to avoid:**
Fleet output must have a distinct visual state per server: OK, WARN, FAIL, UNREACHABLE. A failed server row must appear with its error reason (e.g., "SSH timeout after 30s"), not disappear. Total shown must equal total registered. Final summary: `15 healthy, 2 unreachable, 1 critical`.

**Warning signs:**
Output row count is less than `kastell config list` count when a server is unreachable. Any use of `.filter(r => r.status === 'fulfilled')` without rendering the rejected entries.

**Phase to address:**
Fleet visibility — design the result renderer before writing SSH logic.

---

### Pitfall 3: Guard Script Notification Injection Creates Shell Injection Vector

**What goes wrong:**
In v1.8, Telegram bot token and chat ID will be injected into the guard bash script. The `buildDeployGuardScriptCommand()` function in `core/guard.ts` (line 80) constructs the script as an array of strings joined by `\n` and deployed via heredoc. If a credential value contains `$`, backticks, `"`, or newlines, the heredoc injection corrupts the script or executes arbitrary commands on the server.

**Why it happens:**
The v1.7 guard script already has a `notify() { : }` stub at line 97 as the explicit injection point for v1.8. The temptation is to replace the stub body with interpolated credential values. This is directly adjacent to a string interpolation shell injection.

**How to avoid:**
Never inject secrets into the heredoc body. Instead:
1. Deploy credentials as a separate config file (`/root/.kastell-notify.conf`) via a distinct `sshExec` call
2. Write the conf file with `chmod 600` immediately after creation
3. Have the guard script `source /root/.kastell-notify.conf` at runtime (keeps `buildDeployGuardScriptCommand()` static and testable)
4. Escape any values written to the conf file using shell-safe quoting: `printf '%s' "$token"` not `echo $token`

**Warning signs:**
Any code doing `${botToken}` or `${chatId}` inside the `lines[]` array in `buildDeployGuardScriptCommand()`. Credential values interpolated into the heredoc string.

**Phase to address:**
Notifications phase, guard script integration step — first thing before writing any channel code.

---

### Pitfall 4: Doctor --fix Executes Destructive Commands Without Confirmation

**What goes wrong:**
`kastell doctor --fix` auto-executes `DoctorFinding.command` values via `sshExec`. On a production server, `docker system prune -a` (the DOCKER_DISK finding) removes all unused images — including ones needed to restart currently-stopped containers. This causes unrecoverable data loss on production.

**Why it happens:**
`DoctorFinding.command` already contains the exact fix command. Running it via `sshExec(ip, finding.command)` is a one-line addition. The temptation to "just run it" is high. The existing doctor command intentionally only reports; `--fix` is the natural next step and carries all the risk.

**How to avoid:**
`kastell doctor --fix` must prompt per-finding before execution. For each finding: display severity, description, and the exact command that will run, then `[y/N]` prompt (default N). Add `--force` flag to skip prompts for CI. Implement `--dry-run` that shows what would run without executing. Follow the exact `inquirer.prompt` + `--force` guard pattern already in `commands/guard.ts` (lines 22-35). Never auto-execute findings of severity `critical` without explicit `--force`.

**Warning signs:**
`sshExec` called with `finding.command` without an intervening `inquirer.prompt`. No `--dry-run` option on the `doctor` Commander definition. No `--force` flag.

**Phase to address:**
Doctor --fix phase — establish safety gates first, implement execution second.

---

### Pitfall 5: Notification Alert Storms from Repeat Guard Breaches

**What goes wrong:**
Guard runs every 5 minutes. Disk is at 82% for 6 hours. Guard sends 72 Telegram messages. The user mutes the notification channel. Kastell gets labelled as spam. The notification feature becomes counter-productive.

**Why it happens:**
The simplest implementation: breach detected → `notify()` called → HTTP POST to webhook. No state between runs. Each of 72 cron executions detects the same breach and posts.

**How to avoid:**
Implement per-breach-type cooldown state in a file on the server (`/var/lib/kastell/notify-state.json`). Structure: `{ "DISK": { "lastAlertAt": "2026-03-14T10:00:00Z" } }`. The guard script reads this file before sending, skips if last alert was within cooldown window (default 1 hour). Sends a single recovery notification when breach clears. Guard script redeploy must preserve existing notify-state.json rather than overwrite it.

**Warning signs:**
`notify()` function called unconditionally on breach detection. No state file read before sending. No cooldown logic in the guard script. Guard script redeploy overwrites `/var/lib/kastell/` directory.

**Phase to address:**
Notifications phase — design cooldown before writing any channel-specific HTTP code.

---

### Pitfall 6: Notification Tokens Stored Plaintext in Config File

**What goes wrong:**
Telegram bot tokens, Discord webhook URLs, SMTP credentials stored in `~/.kastell/notifications.json` with default file permissions (0o644). On shared or multi-user machines, any local user can read all notification credentials.

**Why it happens:**
A new `notifications.json` file can easily miss the `mode: 0o600` parameter that `config.ts` uses for `servers.json`. Notification credentials look like "just config values" but have secret semantics.

**How to avoid:**
Use the existing OS keychain pattern (`@napi-rs/keyring`, already used for provider tokens in `core/tokens.ts` and `core/tokenBuffer.ts`). Store bot tokens and SMTP passwords in keychain under `kastell-notify-<channel>`. For webhook URLs (lower sensitivity but still secret), use file storage at `0o600`. Reuse the exact `saveToken`/`getToken` pattern from `core/tokens.ts`. Never accept notification credentials as CLI flag arguments (they appear in shell history and `ps aux`).

**Warning signs:**
`writeFileSync('notifications.json', ...)` without explicit `{ mode: 0o600 }`. Any notification credential appearing in CLI option parsing (`--token`).

**Phase to address:**
Notifications phase, config storage step — before implementing any channel.

---

## Moderate Pitfalls

### Pitfall 7: Discord and Slack Rate Limits Cause Notification Delivery Failures

**What goes wrong:**
Fleet sends alerts for multiple servers simultaneously. Discord webhooks allow 5 requests per 2 seconds. Slack webhooks allow approximately 1 per second. When 3 servers breach threshold at the same time (fleet event), notifications 4+ are rejected with 429. Failed requests still count against Discord's rate limit quota — retrying immediately makes it worse.

**Why it happens:**
Multi-server fleet is the first scenario where multiple alerts can fire simultaneously. Single-server guard had no concurrent notification problem.

**How to avoid:**
Queue notifications and send sequentially with per-channel rate limiting. For Discord: parse `X-RateLimit-Remaining` and `Retry-After` response headers — never hardcode 5 req/2s (Discord can change limits). For Slack: parse `Retry-After` on 429. For Telegram: limit to 30/s total. Use the existing `withRetry` pattern from `utils/retry.ts` which already parses `Retry-After` headers. For Discord 404 (deleted webhook): do not retry at all — surface "webhook deleted" error and disable that channel.

**Warning signs:**
Hardcoded `sleep(400)` between Discord calls instead of header-driven rate limiting. `Promise.all` on concurrent notification sends to multiple channels.

**Phase to address:**
Notifications phase, channel implementation step.

---

### Pitfall 8: Fleet Audit Runs Live SSH for All Servers — Unusably Slow

**What goes wrong:**
`kastell fleet audit` triggers a fresh SSH audit for each server. 10 servers × 2 SSH batches × audit check duration = several minutes of runtime. Users expect fleet audit to be fast.

**Why it happens:**
`kastell audit` for a single server does 2 SSH batch calls. Fleet naively maps the same function over all servers.

**How to avoid:**
Fleet audit by default reads from cached audit snapshots (already stored in `~/.kastell/audit-snapshots/`). Only run live SSH if `--fresh` flag is passed or if the cached snapshot is older than a configurable threshold (default 24 hours). Display snapshot age per server: `web-01: score 82 (cached 3h ago)`. This is consistent with the existing doctor cache-first pattern in `core/doctor.ts` (lines 327-411).

**Warning signs:**
`fleet audit` makes SSH connections without first checking for cached snapshots. No `--fresh` flag on fleet audit.

**Phase to address:**
Fleet visibility phase, fleet audit subcommand.

---

### Pitfall 9: Doctor --fix Auto-Remediates Intentional Config Deviations

**What goes wrong:**
`kastell doctor --fix` sees `HIGH_BAN_RATE` (fail2ban 200 total bans) and suggests `sudo fail2ban-client status`. Fine. But it also sees password auth enabled and auto-applies `kastell audit --fix SSH-02`. The user intentionally left password auth enabled because their deployment pipeline requires it. Auto-fix reverses an intentional decision.

**Why it happens:**
Doctor findings are generated from generic rules without knowledge of the user's intentional config. `--fix` that executes `DoctorFinding.command` treats all findings equally.

**How to avoid:**
Doctor --fix must be per-finding interactive. Do not batch-apply all findings. The prompt for each finding must show: finding ID, current state, proposed change, command. User can skip individual findings. Add a `kastell doctor suppress <finding-id> <server>` command to permanently skip specific findings for specific servers (stored in `~/.kastell/suppress.json`). Suppressed findings are shown dimmed with `[suppressed]` label, not hidden entirely.

**Warning signs:**
`--fix` mode applies all findings in a loop without per-finding confirmation. No suppression config mechanism.

**Phase to address:**
Doctor --fix phase.

---

### Pitfall 10: Guard Script Version Mismatch After v1.8 Update

**What goes wrong:**
Guard v1.7 script is already deployed to servers. v1.8 adds notification hooks and cooldown state logic. After `npm update -g kastell`, the local CLI is v1.8 but the on-server guard script is still v1.7. Notifications never fire because the notify hook does not exist in the v1.7 script. No error — guard still runs, logs OK, but never notifies.

**Why it happens:**
The guard script is a remote artifact deployed via SSH. It does not auto-update when the local CLI updates. There is no version check in the current `guardStatus()` function.

**How to avoid:**
Embed guard script version in the script itself: `KASTELL_GUARD_VERSION="1.8.0"`. The `guardStatus()` function (already reads log output via SSH) should additionally read this version and compare to local CLI version. If mismatch detected, surface: "Guard script is v1.7.0. Kastell is v1.8.0. Run `kastell guard start <server> --force` to redeploy." The existing `startGuard()` is already idempotent (uses sentinel-comment cron pattern) — calling it again safely redeploys the new script.

**Warning signs:**
`guardStatus()` does not read or compare `KASTELL_GUARD_VERSION`. No warning shown when guard script version differs from CLI version.

**Phase to address:**
Notifications phase (guard script extension) — add version embed before extending the script.

---

### Pitfall 11: Tech Debt Cleanup Breaks Existing Tests

**What goes wrong:**
The tech debt cleanup phase refactors adapter duplication (`coolify.ts`/`dokploy.ts` shared ~80% code), fixes the layer violation (`core/deploy.ts` → `commands/firewall.ts`), and decomposes `postSetup`. Each refactor risks breaking the 3038 existing tests, particularly adapter mock patterns that depend on the current module structure.

**Why it happens:**
Adapters are currently mocked at the module level in tests. Extracting shared methods into a new base class or template changes import paths and mock targets. The lesson from LESSONS.md: "Re-export kaldırırken TÜM test import+mock path'lerini birlikte güncelle."

**How to avoid:**
For each refactor: (1) run the full test suite before touching anything to establish a green baseline, (2) move one function at a time with re-exports at old paths for backward compat, (3) update all test mocks in the same commit as the source move, (4) run `npm test` after every individual move. Do not batch multiple adapter refactors into one commit. Layer violation fix (`core/deploy.ts` importing from `commands/`) must use dependency injection or move the shared logic to `core/` — do not import command modules from core.

**Warning signs:**
Any commit that moves adapter code without simultaneously updating test mock paths. `import` from `commands/` inside any file in `core/`.

**Phase to address:**
Tech debt cleanup phase — treat as highest-risk phase, plan each refactor individually.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Sequential `for...of` fleet SSH | Simple to write | Unusable for 3+ servers (15s+) | Never — use `Promise.allSettled` + concurrency limit |
| Notification token in plain JSON config | No extra dep | World-readable credential on multi-user machines | Never — reuse existing `@napi-rs/keyring` pattern |
| Doctor --fix auto-execute without prompt | Faster UX | Destructive command on wrong server, no rollback | Never — always prompt or require `--force` |
| Hardcode Discord rate limit (5 req/2s) | Simple | Breaks silently when Discord changes limits | Never — parse `X-RateLimit-*` headers |
| Inject bot token directly into guard bash heredoc | One less file to manage | Shell injection if token contains `$`, backtick, newline | Never — use separate sourced config file |
| Fleet audit runs live SSH for all servers | Always fresh data | Minutes of runtime for 10+ servers, users stop using it | Only with explicit `--fresh` flag |
| Suppress fleet partial failures | Clean output | User thinks all servers are fine when one is unreachable | Never — always show UNREACHABLE state |

---

## Integration Gotchas

Common mistakes when connecting to external notification services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Telegram | Sending MarkdownV2 text with unescaped `<`, `>`, `&`, `.` | Use `parse_mode: 'HTML'` consistently or escape all special chars per Telegram docs |
| Telegram | Bot token valid but user never sent `/start` to the bot (403 Forbidden) | Detect 403, surface: "Send /start to your Telegram bot before using notifications" |
| Telegram | Using `sendMessage` directly from bash guard script | HTTP calls from bash are fragile; prefer CLI-side notification dispatch polling guard log |
| Discord | Hardcoding 5 req/2s rate limit | Parse `X-RateLimit-Remaining` and `Retry-After` response headers dynamically |
| Discord | Retrying on 404 (webhook deleted) | 404 = permanent failure; disable channel and surface "webhook deleted" error |
| Slack | Treating incoming webhook URL as permanent | Webhook URLs can be revoked; detect 403/404 and surface re-setup prompt |
| Slack | Not handling 2025 rate limit changes for non-Marketplace apps | Parse `Retry-After` on all 429 responses; do not assume previous limits still apply |
| Email via SMTP | Blocking SMTP send from within guard bash cron | SMTP from bash is fragile and blocking; use HTTP-based transactional API (Resend, Mailgun) or dispatch from CLI side |
| All channels | Sending alert immediately on detection, no cooldown | Implement per-breach-type cooldown (1h default) with state file on server |
| All channels | Silent failure when delivery fails | Log all delivery attempts and outcomes to `/var/log/kastell-guard.log` |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Sequential fleet SSH | `fleet status` takes N × 3s | `Promise.allSettled` + `p-limit(5)` | At 3+ servers |
| `Promise.all` for fleet | One unreachable server aborts all | Use `Promise.allSettled` always | At first unreachable server |
| Live SSH for fleet audit | `fleet audit` takes minutes | Cache-first: use stored snapshots, `--fresh` to override | At 5+ servers |
| Concurrent notification sends | Discord/Slack 429 errors | Sequential send with header-driven rate limiting | When 2+ servers breach simultaneously |
| Guard script redeploy overwrites notify state | Alert storm after `guard start --force` | Merge existing notify-state.json, do not overwrite | On first guard update after v1.8 |
| `guard-state.json` write without file lock | Concurrent guard commands corrupt state | Extend `withFileLock` from `utils/fileLock.ts` to guard state writes | When multiple guard commands run in parallel |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Notification tokens in 0o644 file | Any local user reads Telegram/SMTP credentials | Reuse `@napi-rs/keyring` from `core/tokens.ts`; file storage at `0o600` minimum |
| Bot token interpolated into guard bash heredoc | Shell injection if token contains `$`, backtick, newline | Deploy as separate `/root/.kastell-notify.conf` with `chmod 600`, sourced at runtime |
| Doctor --fix without IP validation | Wrong server targeted if `assertValidIp` bypassed | Always call `assertValidIp(ip)` at entry of fix orchestrator, same as all other SSH functions |
| Fleet JSON output includes full server IPs | Terminal history exposes entire fleet topology | Respect existing `KASTELL_SAFE_MODE` pattern; truncate in verbose log output |
| Notification webhook URL logged on error | Webhook URL in error logs = leaked credential | Pass notification URLs through existing `sanitizeResponseData()` before logging |
| `kastell notify setup` accepting token as CLI flag | Token appears in shell history and `ps aux` | Use `inquirer.password()` prompt only; reject `--token` flag pattern for secrets |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Fleet all-or-nothing output | One unreachable server hides all results | Per-server row with UNREACHABLE state; never abort entire fleet |
| Doctor --fix executes without showing command | No chance to review what will run on production | Show command, prompt `[y/N]` (default N), then execute |
| No notification test command | Users configure wrong token, never find out | `kastell notify test <channel>` sends test message immediately after setup |
| Alert storm from repeat breaches | Users mute channel, lose trust in guard | Per-type cooldown (1h default) with recovery notification when breach clears |
| Fleet audit output overwhelming for 10+ servers | Wall of text, nothing actionable | Compact table: one row per server. Unhealthy servers first. `--verbose` for details |
| Doctor cold-start shows "no data" without explanation | Users think doctor is broken | Explicit message: "No cached data. Run with `--fresh` to collect current metrics." |
| Shell completions miss new `fleet` and `notify` commands | `kastell <TAB>` does not show new commands | Update `commands/completions.ts` in same PR as new command |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Fleet status:** Shows server list but uses `Promise.all` — verify `Promise.allSettled` and UNREACHABLE state rendering
- [ ] **Fleet status:** Concurrency capped — verify `p-limit` or equivalent; test with 10 servers simultaneously
- [ ] **Fleet audit:** Shows scores but runs live SSH — verify cache-first behavior, `--fresh` flag works
- [ ] **Notifications:** Channel sends first message but has no cooldown — verify notify-state.json written and read per-breach-type
- [ ] **Notifications:** Tokens configured but file permissions not verified — `ls -la ~/.kastell/` should show `0o600`
- [ ] **Notifications:** Setup complete but no test send — verify `kastell notify test <channel>` sends message
- [ ] **Doctor --fix:** Displays fix commands but check for `inquirer.prompt` gate before `sshExec` call
- [ ] **Doctor --fix:** `--dry-run` flag defined and implemented — verify it shows commands without executing
- [ ] **Guard + notifications:** Guard script redeployed via `guard start --force` — verify notify-state.json preserved
- [ ] **Guard script version:** v1.8 script has `KASTELL_GUARD_VERSION="1.8.0"` embedded — verify `guardStatus()` reads and compares it
- [ ] **Shell completions:** `fleet` and `notify` commands in `completions.ts` — verify `kastell <TAB>` shows them
- [ ] **MCP parity:** `fleet` and `notify` functions accessible via MCP tools — verify against v1.5/v1.7 tool pattern
- [ ] **Tech debt refactor:** All adapter test mock paths updated after adapter consolidation — `npm test` passes clean after each move

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Notification token stored plaintext | LOW | Delete `notifications.json`, re-run `kastell notify setup`, tokens migrate to keychain |
| Alert storm already sent | LOW | Deploy cooldown logic via `kastell guard start --force`, send "alerts now rate-limited" message to channel |
| Doctor --fix ran `docker system prune -a` without confirm | HIGH | No automatic recovery — containers may be irrecoverable; audit what was lost; add confirmation gate as breaking change; document clearly |
| Guard heredoc injection broke script | MEDIUM | `kastell guard stop <server> && kastell guard start <server>` redeploys fixed script |
| Fleet partial failures silent | LOW | Add UNREACHABLE state to renderer; no data loss, purely display bug |
| Tech debt refactor broke tests | MEDIUM | `git revert` the refactor commit, redo it function-by-function with test updates in same commit |
| Shell completions missing new commands | LOW | Add entries to `completions.ts` and publish patch release |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Fleet sequential SSH | Fleet visibility (first commit) | `kastell fleet status` on 3 servers completes in under 10 seconds |
| Fleet partial failure silent | Fleet visibility (renderer design) | Kill one server's SSH port; verify fleet still shows all other servers |
| Guard script injection | Notifications (before any channel code) | Credential with `$`, backtick in value — guard script deploys without corruption |
| Doctor --fix no confirmation | Doctor --fix (first — gates before execution) | `kastell doctor --fix` without `--force` — must show prompt before running any command |
| Alert storm | Notifications (cooldown design) | Trigger same breach 12 times; verify only 1 alert sent within 1-hour window |
| Notification token plaintext | Notifications (config storage) | `ls -la ~/.kastell/` — all notification credential files show `600` permissions |
| Guard script version mismatch | Notifications (script extension) | `guardStatus()` output includes version; mismatch shows migration prompt |
| Tech debt refactor breaks tests | Tech debt cleanup (each move individually) | `npm test` green after every individual function move, not only at end |
| Shell completions gap | Tech debt cleanup phase | `kastell <TAB>` shows `fleet` and `notify` on bash, zsh, fish |

---

## Sources

- Kastell codebase: `src/core/guard.ts` (heredoc construction lines 80-148, notify stub line 97, guard state pattern)
- Kastell codebase: `src/core/doctor.ts` (DoctorFinding.command pattern, cache-first orchestrator lines 327-412)
- Kastell codebase: `src/utils/config.ts` (atomic writes, `0o600` file permissions pattern)
- Kastell codebase: `src/core/tokens.ts`, `src/core/tokenBuffer.ts` (keychain token reuse pattern)
- Kastell codebase: `src/commands/guard.ts` (inquirer.prompt + --force guard pattern to replicate in doctor --fix)
- Kastell codebase: `src/utils/retry.ts` (withRetry + Retry-After header parsing, reuse for notification rate limits)
- Kastell LESSONS.md: "Re-export kaldırırken TÜM test import+mock path'lerini birlikte güncelle"
- [Discord Rate Limits](https://docs.discord.com/developers/topics/rate-limits) — 5 req/2s per webhook, parse headers; 404 = stop retrying
- [Discord Webhook Rate Limits Guide](https://birdie0.github.io/discord-webhooks-guide/other/rate_limits.html) — failed requests count against quota
- [Slack Rate Limits](https://api.slack.com/docs/rate-limits) — HTTP 429 + Retry-After header
- [Slack 2025 Rate Limit Changes](https://api.slack.com/changelog/2025-05-terms-rate-limit-update-and-faq) — new limits for non-Marketplace apps
- [Auto-Remediation Safety Guide](https://medium.com/@anudeepballa7/kill-the-pager-a-practical-guide-to-auto-remediation-and-self-healing-systems-f1507343f9f2) — Detect→Decide→Do; fail-safe defaults; start with low-risk fixes; idempotent and reversible
- [Webhook Security 2026](https://www.hooklistener.com/learn/webhook-security-fundamentals) — token storage and rotation patterns

---
*Pitfalls research for: Kastell v1.8 Fleet + Notifications + Doctor --fix*
*Researched: 2026-03-14*
