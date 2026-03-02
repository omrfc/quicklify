# Codebase Concerns

**Analysis Date:** 2026-03-02

---

## Tech Debt

**Provider list hardcoded in 5+ locations:**
- Issue: The provider list `["hetzner", "digitalocean", "vultr", "linode"]` and env key maps `{ hetzner: "HETZNER_TOKEN", ... }` are duplicated across multiple files with no shared source of truth. Adding Dokploy (v1.3.0) requires updating every location manually.
- Files: `src/commands/add.ts:37`, `src/commands/init.ts:81`, `src/core/manage.ts:16`, `src/core/tokens.ts:3-8`, `src/utils/serverSelect.ts:71-75`, `src/mcp/tools/serverInfo.ts:20-21`
- Impact: Adding a new platform requires changes in 6+ files. Missing one causes silent failures (token not resolved, provider not validated).
- Fix approach: Centralize in `src/constants.ts` as `SUPPORTED_PROVIDERS` and `PROVIDER_ENV_KEYS`. Import everywhere.

**`stripSensitiveData` duplicated in all 4 providers:**
- Issue: Identical function body (strips axios error headers + request) is copy-pasted in all four provider files.
- Files: `src/providers/hetzner.ts:5-13`, `src/providers/digitalocean.ts:5-13`, `src/providers/vultr.ts:5-13`, `src/providers/linode.ts:5-13`
- Impact: Any security fix to the stripping logic must be applied to 4 files. One missed file = token leak in error output.
- Fix approach: Move to `src/providers/base.ts` as an exported utility function, import in all providers.

**Backward-compatibility re-exports in command files:**
- Issue: `src/commands/backup.ts` and `src/commands/restore.ts` contain `// Re-export pure functions from core/backup.ts for backward compatibility` blocks. These import then immediately re-export from `src/core/backup.ts`. This is a post-refactoring artifact.
- Files: `src/commands/backup.ts:25-37`, `src/commands/restore.ts:24-35`
- Impact: Confused import chains — tests importing from `commands/backup.ts` get core functions. Obfuscates architecture boundary.
- Fix approach: Audit all test files that import from `commands/backup.ts` or `commands/restore.ts` for core functions, update them to import directly from `core/backup.ts`, then remove the re-exports.

**`ServerRecord.mode` is optional everywhere:**
- Issue: `mode?: ServerMode` is optional in `src/types/index.ts` line 49, which means every code path must defensively `?? "coolify"`. Legacy records from before v1.1.0 have no `mode` field. The `getServers()` normalizer in `src/utils/config.ts:26` only runs on read; data in memory between reads can still be `mode: undefined`.
- Files: `src/types/index.ts:49`, `src/utils/config.ts:26`, `src/utils/modeGuard.ts:4`
- Impact: Any new code that forgets `?? "coolify"` will misclassify legacy servers as bare servers when `undefined` is checked against `"bare"`. However `isBareServer()` checks for `=== "bare"` so legacy `undefined` will never accidentally trigger bare mode — the risk is reversed: Coolify ops might be blocked if a new check is `!== "coolify"` instead.
- Fix approach: For v1.3.0, consider making `mode` required in `ServerRecord` and ensuring `getServers()` always normalizes. The YAML export/import path (`src/commands/transfer.ts`) should also normalize on import.

**`src/commands/init.ts` is too large (619 lines):**
- Issue: `initCommand()` handles YAML config loading, template resolution, interactive wizard (6-step loop), non-interactive path, SSH key upload, server creation with retry, IP polling, cloud-init wait, full-setup orchestration, and success output — all in one file.
- Files: `src/commands/init.ts`
- Impact: Difficult to test individual paths. The inline `deployServer()` function is 320+ lines. Adding Dokploy mode will make this file even larger.
- Fix approach: Extract `deployServer()` to `src/core/deploy.ts` (parallel to `src/core/provision.ts`). The `init.ts` command should be a thin wizard wrapper only.

**Duplicate `pg_dump` path hardcoded in backup commands:**
- Issue: The Coolify database backup command `docker exec coolify-db pg_dump -U coolify -d coolify | gzip > /tmp/coolify-backup.sql.gz` uses literals `coolify-db`, `coolify` (user), `coolify` (db) that are also available as constants in `src/constants.ts` (`COOLIFY_DB_CONTAINER`, `COOLIFY_DB_USER`, `COOLIFY_DB_NAME`). The `buildPgDumpCommand()` in `src/core/backup.ts:20-22` does not use those constants.
- Files: `src/core/backup.ts:20-22`, `src/constants.ts:26-28`
- Impact: If Coolify changes its container/db naming, two places need updating.
- Fix approach: Update `buildPgDumpCommand()` to import and use the existing constants.

---

## Known Bugs

**BUG-5 and BUG-1 comments in init.ts indicate known incomplete flows:**
- Symptoms: Two inline comments `// Wait for SSH + cloud-init to finish (BUG-5)` and `// Full setup: firewall + secure (BUG-1)` label known edge cases in the bare-mode init flow.
- Files: `src/commands/init.ts:457`, `src/commands/init.ts:493`
- Trigger: Bare server provisioning with `--full-setup` flag on slow-booting instances.
- Workaround: The code has retry loops (60 attempts, 5s apart), but the BUG comments suggest the root timing issue may not be fully resolved.

**SCP operations have no timeout:**
- Symptoms: `scpDownload()` and `scpUpload()` in `src/core/backup.ts:124-165` spawn `scp` processes with no `setTimeout` timer. A stalled network or large backup can hang the CLI indefinitely.
- Files: `src/core/backup.ts:124-165`
- Trigger: Large Coolify PostgreSQL backup on slow network, or broken SSH connection after SCP starts (SCP does not use `BatchMode=yes`).
- Workaround: None currently. `sshExec` has a 30s timeout but `scpDownload`/`scpUpload` do not.

**SCP stdin is `"inherit"` — MCP stdin leak risk:**
- Symptoms: `scpDownload` and `scpUpload` use `stdio: ["inherit", "pipe", "pipe"]`. In MCP mode, stdin carries JSON-RPC data. SCP inheriting stdin means it can consume MCP protocol messages when waiting for host key confirmation.
- Files: `src/core/backup.ts:135`, `src/core/backup.ts:157`
- Trigger: First backup/restore via MCP tool when server host key is not cached and SCP prompts for confirmation.
- Workaround: The `sshExec` function correctly uses `stdio: ["ignore", ...]`. SCP should match this behavior by passing `-o StrictHostKeyChecking=accept-new` (like SSH already does) and setting stdin to `"ignore"`.

**Coolify domain FQDN `removeDomain()` uses server IP as domain:**
- Symptoms: `removeDomain()` in `src/core/domain.ts:143` calls `buildSetFqdnCommand(`${ip}:8000`, false)`. This passes an IP address with port through `buildSetFqdnCommand()`, which checks for non-alphanumeric characters including `:`. The `:` character is allowed by the regex at `src/core/domain.ts:30`.
- Files: `src/core/domain.ts:30`, `src/core/domain.ts:143`
- Trigger: Any `domain remove` or `domain-remove` MCP action.
- Workaround: The function works for `IP:port` patterns but the regex `[^a-zA-Z0-9.:_-]` allows `.` and `:` which is intentional here, so this is functional but the comment at line 30 doesn't explain the `:` allowance.

---

## Security Considerations

**API tokens read directly from `process.env` without validation:**
- Risk: `src/core/tokens.ts:11` returns raw env var values with no format validation. An accidentally set empty string `HETZNER_TOKEN=""` returns `""` (falsy) which is filtered out, but a whitespace-only string `" "` is returned as a valid token and will pass the `if (!token)` guard, leading to confusing API 401 errors instead of a clear "token not configured" message.
- Files: `src/core/tokens.ts:10-12`, `src/utils/serverSelect.ts:78-79`
- Current mitigation: Providers call `validateToken()` which will fail on empty/whitespace tokens.
- Recommendations: Add `.trim()` check in `getProviderToken()`. Return `undefined` for whitespace-only values.

**`--token` flag exposes API token in shell history:**
- Risk: `src/commands/init.ts:108-112` warns about this and sets `process.title = "quicklify"` to hide the token from `ps aux`, but shell history (`~/.bash_history`, `~/.zsh_history`) still captures the full command.
- Files: `src/commands/init.ts:108-112`
- Current mitigation: Warning is printed, process title is updated.
- Recommendations: Consider prompting interactively when `--token` flag is used without a value (like `--token` with no argument triggers prompt), to avoid history leakage entirely. Document in README that `--token` should only be used in non-interactive CI scripts where history is cleared.

**YAML config accepts `domain` field but does not validate it:**
- Risk: `src/utils/yamlConfig.ts:141-147` accepts `domain` as any string without format validation (just checks `typeof === "string"`). The domain field isn't used during provisioning currently, but it's in the config schema.
- Files: `src/utils/yamlConfig.ts:141-147`
- Current mitigation: Domain is only used if passed through to `domain set` commands which do their own validation.
- Recommendations: Apply same regex check used in `src/core/domain.ts:isValidDomain()` to the YAML validation.

**`scpDownload`/`scpUpload` do not pass `-o BatchMode=yes`:**
- Risk: Without `BatchMode=yes`, SCP can prompt for host key confirmation to stdin. In MCP mode (stdin = JSON-RPC pipe), this would silently consume protocol data.
- Files: `src/core/backup.ts:133-136`, `src/core/backup.ts:155-158`
- Current mitigation: `StrictHostKeyChecking=accept-new` prevents prompts on first connection, but not on host key mismatch.
- Recommendations: Add `-o BatchMode=yes -o StrictHostKeyChecking=accept-new` to SCP args. Add host-key-mismatch detection similar to `sshStreamInner` in `src/utils/ssh.ts`.

---

## Performance Bottlenecks

**All provider API calls lack HTTP timeout configuration:**
- Problem: Every `axios.get/post/delete` call in all four provider files (`src/providers/hetzner.ts`, `src/providers/digitalocean.ts`, `src/providers/vultr.ts`, `src/providers/linode.ts`) omits the `timeout` option. Default axios timeout is unlimited.
- Files: All `src/providers/*.ts` files, ~40 axios calls total
- Cause: Timeout was never added during initial implementation.
- Improvement path: Add `timeout: 30000` (30s) to all provider axios calls. Consider creating an axios instance per provider with default timeout set at construction.

**Backup polling uses sequential SSH calls for each server in `--all` mode:**
- Problem: When `backup --all` is invoked, `src/commands/backup.ts` processes servers sequentially via `for...of` loop. Each backup involves: version check SSH call + pg_dump SSH call + config tar SSH call + 2x SCP downloads — 5 remote operations per server, all blocking.
- Files: `src/commands/backup.ts:155-185`
- Cause: Sequential design; no parallelization.
- Improvement path: `Promise.all()` with a concurrency limit (e.g. 3 parallel backups). For v1.3.0, low priority since most users have 1-3 servers.

**`buildMonitorCommand()` runs multiple `top`, `free`, `df` commands in one SSH session:**
- Problem: `src/core/logs.ts:51-57` constructs a compound command with `&&` and parses separator-delimited output. The `top -bn1` call is slow (~1s sampling delay) and runs even for metric requests that only need disk/RAM.
- Files: `src/core/logs.ts:51-57`, `src/core/logs.ts:60-103`
- Cause: All metrics combined into one SSH command for efficiency, but `top` has unavoidable latency.
- Improvement path: Replace `top -bn1 | head -5` with `cat /proc/loadavg` or `vmstat 1 1` for faster CPU metrics.

---

## Fragile Areas

**`parseMetrics()` in `src/core/logs.ts` is brittle:**
- Files: `src/core/logs.ts:60-103`
- Why fragile: Output parsing relies on specific text patterns from `top`, `free -h`, and `df -h`. `top` output format varies across Linux distros (Debian vs Ubuntu vs Alpine). `free` column ordering differs between versions. The `df -h --total` output is matched by `startsWith("total")` which can break if locale differs.
- Safe modification: Always test against actual Ubuntu 24.04 (the installed distro) output. Add locale normalization (`LANG=C LANGUAGE=C`) to the SSH command prefix.
- Test coverage: `src/core/logs.ts:parseMetrics` has unit tests in `tests/unit/logs.test.ts` but they test against hardcoded string fixtures, not live server output.

**`parseSshdConfig()` in `src/core/secure.ts` uses raw regex on config file:**
- Files: `src/core/secure.ts:7-37`
- Why fragile: Uses `new RegExp(`^\\s*${check.key}\\s+(.+)`, "m")` against the full `sshd_config` content. An `Include` directive in modern Ubuntu 24.04 sshd_config can pull in `/etc/ssh/sshd_config.d/*.conf` where hardening settings may actually live. The current parser only sees the main file, so settings applied via includes are invisible.
- Safe modification: The `buildAuditCommand()` should use `sshd -T` (dump effective config) instead of `cat /etc/ssh/sshd_config` to get the resolved configuration.
- Test coverage: Unit tested in `tests/unit/secure.test.ts` but tests use synthetic config strings without Include directives.

**`parseUfwStatus()` in `src/core/firewall.ts` uses regex against numbered output:**
- Files: `src/core/firewall.ts:57-75`
- Why fragile: Matches against `ufw status numbered` output format `[ 1] 22/tcp ALLOW IN Anywhere`. UFW output format can differ if IPv6 rules are present (extra `(v6)` suffix) or if the rule source includes an IP range.
- Safe modification: Test against a server with IPv6 rules enabled. Extend regex to handle `(v6)` suffix.
- Test coverage: Unit tested in `tests/unit/firewall.test.ts`.

**`scpDownload`/`scpUpload` use plain `scp` without path resolution:**
- Files: `src/core/backup.ts:133`, `src/core/backup.ts:155`
- Why fragile: The `ssh` binary is resolved via `resolveSshPath()` in `src/utils/ssh.ts` to handle Windows locations. The `scp` binary is hardcoded as `"scp"`. On Windows systems where OpenSSH is not in PATH (e.g., Git bash only), `scp` may not be found or may be a different implementation.
- Safe modification: Apply the same Windows-aware resolution for `scp` as for `ssh`. Alternatively, use `rsync` or implement file transfer via the resolved `ssh` binary with `-p` flag.
- Test coverage: Mocked in unit tests; no cross-platform integration test.

**Interactive wizard in `src/commands/init.ts` uses a while-loop state machine:**
- Files: `src/commands/init.ts:152-226`
- Why fragile: The back-navigation uses `step` integer variables and a `while (step >= 4 && step <= 7)` loop with manual step increments. Adding a new wizard step (e.g., platform selection for Dokploy) requires careful step number management and updating all `step = N` assignments.
- Safe modification: Extract into an array of step configs or use a state machine library. For Dokploy v1.3.0, adding a platform step before provider would require shifting all step numbers.
- Test coverage: Tested via E2E tests in `tests/e2e/init.test.ts` but the step-back navigation path is hard to exercise in tests.

---

## Scaling Limits

**`servers.json` flat file storage:**
- Current capacity: Read/write on every `getServers()` + `saveServer()` call. Fine for <50 servers.
- Limit: Concurrent CLI invocations can race on `writeFileSync` — last write wins. Affects `backup --all` combined with another command running simultaneously.
- Scaling path: File-based locking (`lockfile-fs` or advisory lock) before any write to `servers.json`. Low priority until multi-server orchestration use cases increase.

**No API rate limit handling or backoff in provider calls:**
- Current capacity: Each provider enforces rate limits (Hetzner: 3600 req/hr, DigitalOcean: 250 req/min).
- Limit: `backup --all` with many servers triggers provider API calls per server for status polling. `maintain --all` also makes multiple API calls per server.
- Scaling path: Implement exponential backoff on 429 responses. The error mapping in `src/utils/errorMapper.ts:66-68` already detects 429 but only shows a message; no retry occurs.

---

## Dependencies at Risk

**`inquirer` v12 (major version, breaking API vs v8/v9):**
- Risk: Inquirer v12 changed the API significantly from v9. The codebase uses `inquirer.Separator`, `inquirer.prompt()` directly — these are the new API but tests mock the old v9-style `inquirer/lib` internals in `tests/__mocks__`.
- Impact: If a test mock is missed, tests silently pass against mock but fail at runtime.
- Migration plan: Verify `tests/__mocks__/inquirer.ts` aligns with v12 actual module shape. Check `@types/inquirer` version is v9 (`"@types/inquirer": "^9.0.7"`) while runtime is v12 — type mismatch exists.

**`zod` v4 (recently released, potential ecosystem misalignment):**
- Risk: `"zod": "^4.3.6"` in production. Zod v4 has breaking changes from v3 (different error format, `.parse()` behavior). The MCP SDK and other consumers may expect Zod v3.
- Files: All `src/mcp/tools/*.ts` files use Zod schemas
- Impact: If `@modelcontextprotocol/sdk` internally uses Zod v3, the schema objects passed from Zod v4 may not be compatible.
- Migration plan: Verify `@modelcontextprotocol/sdk` Zod dependency. Run `npm ls zod` to check for multiple versions.

**`@types/inquirer` is v9 but runtime inquirer is v12:**
- Risk: Type definitions are 3 major versions behind the installed runtime. TypeScript may not catch API incompatibilities.
- Files: All `src/utils/prompts.ts`, `src/commands/interactive.ts`, etc.
- Impact: Low if the subset of Inquirer API used hasn't changed between v9 and v12 types, but risky for editor autocomplete and catching new breaking changes.
- Migration plan: Use `inquirer`'s own bundled types (available in v12) instead of `@types/inquirer`.

---

## Missing Critical Features

**No SCP binary resolution for Windows:**
- Problem: `src/core/backup.ts` calls `spawn("scp", ...)` with hardcoded binary name. `src/utils/ssh.ts:resolveSshPath()` handles Windows SSH lookup but there is no equivalent `resolveScpPath()`.
- Blocks: Backup/restore on Windows if `scp` is not in PATH.

**No timeout on SCP file transfers:**
- Problem: Large Coolify PostgreSQL dumps (`coolify-backup.sql.gz`) can be gigabytes on active instances. With no SCP timeout, CLI hangs indefinitely on network interruption mid-transfer.
- Blocks: Reliable CLI behavior in unstable network conditions.

**No onboarding message after `quicklify add` for manually-added servers:**
- Problem: `quicklify add` saves a server record with `region: "unknown"` and `size: "unknown"`. No post-add guidance is shown for next steps (firewall, secure, backup). The `src/core/manage.ts:160-161` sets these literal "unknown" strings.
- Blocks: User experience after adding an existing server.

**Coolify install URL is hardcoded, no pinning:**
- Problem: `src/constants.ts:19` and `src/utils/cloudInit.ts:97` both use `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`. This always installs the latest Coolify version with no version pinning.
- Blocks: Reproducible deployments. If Coolify releases a breaking version, all new `quicklify init` deployments break with no rollback option.

---

## Test Coverage Gaps

**SCP functions (`scpDownload`, `scpUpload`) tested only with mocks:**
- What's not tested: Actual SCP process spawning, timeout behavior, host-key-mismatch handling, Windows `scp` binary resolution.
- Files: `src/core/backup.ts:124-165`
- Risk: The stdin=inherit MCP leak and missing timeout bugs exist precisely because the subprocess behavior is not exercised.
- Priority: High — affects backup/restore reliability.

**`buildHardeningCommand()` with port injection:**
- What's not tested: Invalid port values (e.g. `port = NaN`, `port = -1`, `port = 99999`) passed to the SSH hardening sed command. The guard at `src/core/secure.ts:83-87` silently skips invalid ports with a comment "no injection risk."
- Files: `src/core/secure.ts:80-88`
- Risk: If the validation logic has a gap, the port value could still reach the shell.
- Priority: Medium.

**Interactive back-navigation in `initCommand`:**
- What's not tested: The back-navigation loop at `src/commands/init.ts:152-226`. When user presses "← Back" at step 5 (server type), the loop returns to step 4 (region). The current E2E tests in `tests/e2e/init.test.ts` mock prompts but don't exercise the BACK_SIGNAL flow through the full wizard.
- Files: `src/commands/init.ts:152-226`
- Risk: Wizard can get stuck or jump to wrong step if step numbering logic has a bug.
- Priority: Medium.

**`scpDownload` / `scpUpload` MCP stdin inheritance:**
- What's not tested: Running backup/restore while MCP server is active with real stdin data.
- Files: `src/core/backup.ts:133-165`
- Risk: Silent data corruption of MCP JSON-RPC stream.
- Priority: High.

**Provider-specific Hetzner region list (hardcoded getRegions):**
- What's not tested: The static `getRegions()` fallback at `src/providers/hetzner.ts:224-231` returns a hardcoded list that may be outdated (e.g. Hetzner added Singapore region `sin1` in 2024).
- Files: `src/providers/hetzner.ts:224-231`
- Risk: If API `getAvailableLocations()` fails and fallback is used, users see old/incomplete region lists without error.
- Priority: Low.

---

*Concerns audit: 2026-03-02*
