# Codebase Concerns

**Analysis Date:** 2026-02-27

## Tech Debt

**Code Duplication in init.ts and provision.ts:**
- Issue: Constants `IP_WAIT`, `COOLIFY_MIN_WAIT`, and provisioning logic are duplicated between `src/commands/init.ts` and `src/core/provision.ts`
- Files: `src/commands/init.ts` (lines 29-42), `src/core/provision.ts` (lines 33-41)
- Impact: Changes to timeout configurations must be made in two places — easy to miss one. Risk of inconsistent behavior between CLI and MCP provisioning
- Fix approach: Extract `IP_WAIT`, `COOLIFY_MIN_WAIT`, `BOOT_MAX_ATTEMPTS` to shared constants file (`src/constants/provisioning.ts`) and import in both modules. This is tracked as v1.2.0 refactoring (TODO comment on line 32 of provision.ts)

**Command vs Core Module Separation:**
- Issue: Each command (e.g., `backup`, `domain`, `secure`) has both a command handler (`src/commands/`) and core logic (`src/core/`). Code is not fully isolated — logic may exist in both places with subtle differences
- Files: `src/commands/backup.ts`, `src/core/backup.ts` (and similarly for domain, maintain, manage)
- Impact: Bug fixes must be applied in two locations. Test coverage may be incomplete in both layers
- Fix approach: v1.2.0 refactoring will consolidate — commands import from core, core modules reuse logic via functions rather than duplicating

**Inconsistent SSH Key Handling Fallback:**
- Issue: SSH key generation returns `null` on failure, callers then proceed with password auth. Fallback is "best-effort" but not fully validated before returning success
- Files: `src/commands/init.ts` (lines 262-289), `src/core/provision.ts` (lines 53-74)
- Impact: Server created without SSH key can only use password auth. If cloud provider generates random password but ssh-keygen fails silently, user locked out of SSH until password reset via console
- Fix approach: Generate SSH key before server creation, fail provisioning if key generation fails in unattended mode (MCP). In interactive mode, warn user and require confirmation

## Known Bugs

**IP Assignment Race Condition:**
- Symptoms: Server shows IP "pending" after successful creation; users must wait or check status manually
- Files: `src/commands/init.ts` (lines 407-434), `src/core/provision.ts` (lines 180-208)
- Trigger: DigitalOcean and Vultr IP assignment timing varies (60-200s). Initial API response may return "0.0.0.0" or "pending"
- Impact: Coolify URL display delayed; browser open skipped; firewall setup can't start
- Current mitigation: Provider-specific polling intervals (`IP_WAIT` config). Min/max attempts scale per provider
- Recommendation: Add explicit IP validation before Coolify health check (`assertValidIp()` already in place). Consider caching validated IP in server record immediately

**Coolify Health Check Timeout Not Enforced:**
- Symptoms: Deployment completes even if Coolify is not ready; user sees "Coolify did not respond yet" warning
- Files: `src/commands/init.ts` (lines 436-440), `src/utils/healthCheck.ts`
- Trigger: Coolify cloud-init takes 3-5 minutes. Health check polling has implicit timeout (minWait + polling iterations) but no explicit deadline
- Impact: User waits indefinitely if Coolify install fails silently; firewall+secure setup skipped
- Mitigation: `ready` flag blocks full-setup auto-configuration. Manual user awareness required
- Recommendation: Add configurable health check timeout with clear max-wait message

**Server Creation Retry Logic Incomplete:**
- Symptoms: Certain providers may rate-limit during retry attempts; users prompted 3 times for input on failures
- Files: `src/commands/init.ts` (lines 311-377)
- Trigger: Server name already used, location disabled, or type unavailable — each triggers user re-prompt
- Impact: After 2 retries, non-retryable errors (API auth failure) still propagate as `process.exit(1)` without cleanup
- Mitigation: SSH keys uploaded before creation, so failed attempts don't leave orphaned keys
- Recommendation: Implement exponential backoff for transient failures; add rate-limit detection

## Security Considerations

**Hardcoded Known Hosts Bypass:**
- Risk: `StrictHostKeyChecking=accept-new` allows MITM attacks if attacker controls DNS or initial IP
- Files: `src/utils/ssh.ts` (lines 41, 53, 68)
- Current mitigation: Server IPs validated via `assertValidIp()` before SSH calls; IP obtained from trusted cloud provider API
- Recommendations:
  - On first connection, verify server IP against cloud provider state before auto-accepting host key
  - Warn user if IP changes between consecutive commands
  - Consider `ssh-keyscan` with cloud provider verification

**SSH Key Generation Without Passphrase:**
- Risk: Generated SSH keys stored in `~/.ssh/id_ed25519` with no passphrase. Local machine compromise exposes all managed servers
- Files: `src/utils/sshKey.ts` (line 37)
- Current mitigation: File permissions `0o700` on SSH directory, keys not transmitted
- Recommendations:
  - Consider prompting for passphrase interactively (breaks unattended provisioning)
  - Document that key is generated on-demand and not persisted across VPS creation in MCP mode
  - Use ssh-agent for passphrase-protected keys in future versions

**IP Validation Regex May Not Catch All Invalid Formats:**
- Risk: Regex `/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/` allows "999.999.999.999" before octet check
- Files: `src/utils/ssh.ts` (line 13), `src/core/manage.ts` (line 24)
- Current mitigation: Octet range check (0-255) follows regex
- Recommendation: Combine regex and range in single validation or use IP parsing library

**SAFE_MODE Default Not Enforced at Install Time:**
- Risk: MCP server disables `QUICKLIFY_SAFE_MODE` by default; users may forget this is production code running
- Files: `src/core/manage.ts` (lines 10-12)
- Current mitigation: Documentation warns users; default blocks destructive operations
- Recommendation: Warn users prominently when `SAFE_MODE=false` is set; log to stderr with timestamp

## Performance Bottlenecks

**Provider-Specific Wait Times Not Adaptive:**
- Problem: Hardcoded wait intervals (`IP_WAIT`, `COOLIFY_MIN_WAIT`) don't adapt to provider response times
- Files: `src/commands/init.ts` (lines 29-42), `src/core/provision.ts` (lines 33-41)
- Cause: Cloud provider API response times vary; fixed intervals waste time or timeout too early
- Impact: Users on slow providers (Vultr: 200s IP wait) experience long delays; fast providers (Hetzner: 30s) have excess polling
- Improvement path:
  - Implement exponential backoff: start with 1s, increase to max interval
  - Track provider response times across sessions and adjust defaults
  - Add `--max-wait` CLI flag to override defaults

**Server Status Polling No Exponential Backoff:**
- Problem: Status check loops use fixed intervals (1s boot poll, variable IP poll)
- Files: `src/commands/init.ts` (lines 393-397), `src/core/provision.ts` (lines 163-178)
- Impact: 30 API calls every 30s for boot wait; 40 calls every 5s for IP wait = 200+ unnecessary API calls per deployment
- Improvement path: Use exponential backoff starting at 1s, cap at provider interval; early exit if provider returns "running"

**SSH Operations Not Parallelized:**
- Problem: Firewall + security setup run sequentially after deployment (lines 463-471 in init.ts)
- Files: `src/commands/init.ts` (lines 461-475)
- Impact: `--full-setup` adds 10-20s to deployment time
- Improvement path: Run `firewallSetup()` and `secureSetup()` concurrently with `Promise.all()`; add error aggregation

## Fragile Areas

**Interactive Prompt Loop State Management:**
- Files: `src/commands/init.ts` (lines 166-216)
- Why fragile: State machine with 5 steps (provider, region, size, name, confirm) uses mutable `step` variable and case statement. BACK navigation complex. Hard to test, easy to break when adding new steps
- Safe modification: Extract to separate function with validated state transitions (enum for step IDs)
- Test coverage: 2 unit tests for back navigation; gaps on confirm → back path
- Recommendation: Consider using a state machine library (xstate) for complex flows

**Backup Manifest JSON Format Not Versioned:**
- Files: `src/core/backup.ts`, `src/commands/restore.ts`
- Why fragile: Backup manifest is plain JSON without schema versioning. Adding new fields breaks older restores silently (fields ignored)
- Impact: Backup from v1.1.0 restored to future v2.0.0 may lose data if manifest format changes
- Recommendation: Add `manifest_version: "1.0"` field to all exports; implement migration logic on restore

**Firewall + Security Setup Failures Don't Rollback:**
- Files: `src/commands/init.ts` (lines 461-475)
- Why fragile: Full setup applies firewall rules, then SSH hardening. If SSH hardening fails, user locked out of SSH access but firewall already active
- Impact: Server created but inaccessible without cloud provider console intervention
- Recommendation: Wrap in transaction-like pattern: apply both, or rollback both if either fails

**Error Message String Matching for Provider Retry Logic:**
- Files: `src/commands/init.ts` (lines 328-375)
- Why fragile: Retry logic depends on error message keywords: "already", "location disabled", "unavailable", "sold out"
- Impact: Provider API changes error wording → retry logic breaks, falls through to unhandled error
- Recommendation: Map provider error codes (not message text) to retry strategies

**Linode Provider Beta Status:**
- Files: `src/providers/linode.ts`
- Why fragile: Marked "Beta" in memory; fewer API operations tested than Hetzner/DO/Vultr
- Impact: Edge cases may not be covered (rate limiting, quota errors, region-specific limitations)
- Recommendation: Track Linode-specific issues separately; add provider-specific tests for quota/rate-limit scenarios

## Scaling Limits

**Config File Memory in RAM:**
- Current capacity: `servers.json` loaded entirely into memory on each command
- Limit: No pagination. If users manage 10,000+ servers, JSON parse + filter in-memory becomes slow
- Scaling path: Implement SQLite or JSON Lines format (streaming parse). Lazy-load server records on demand

**SSH Connection Pooling Not Implemented:**
- Current capacity: Each SSH command opens new connection, waits, closes
- Impact: Firewall + security setup creates 20+ SSH connections sequentially
- Scaling path: Connection reuse via persistent session manager (paramiko-like pattern in Node)

**MCP Server Concurrency:**
- Current capacity: Single-threaded Node event loop; all tool handlers share pool
- Limit: If multiple Claude users request provisioning simultaneously, queued behind each other
- Scaling path: Worker thread pool for blocking SSH operations (if supporting multiple concurrent MCP clients)

## Dependencies at Risk

**npm Audit: 2 DevDependency Vulnerabilities (Upstream):**
- Risk: `ajv@6` (ESLint peer) and `minimatch@3` (npm overrides) have known vulnerabilities
- Impact: Development-only; no production impact (bundled, not shipped to npm)
- Migration plan: Wait for upstream (ESLint, npm) fixes. Override temporarily while upstream updates. Lock file managed via CI
- Status: Tracked in memory; awaiting upstream resolution

**JavaScript YAML Parser:**
- Risk: `js-yaml` used for config parsing; YAML injection possible if untrusted configs parsed
- Files: `src/utils/yamlConfig.ts`
- Current mitigation: File-based only (trusted local config); 22+ security key patterns warned on load
- Recommendation: Restrict YAML to safe subset (ban `!!` type tags, JS execution)

**Axios HTTP Client Version:**
- Risk: `axios@1.13.5` — check for CVEs periodically
- Current mitigation: HTTPS enforced for all API calls; no raw request bodies logged
- Recommendation: Add `npm audit` to pre-commit hook; scheduled updates quarterly

## Missing Critical Features

**No Backup Encryption:**
- Problem: Backup manifests and export files stored locally without encryption
- Blocks: Sensitive data in backups (application configs, environment) not protected at rest
- Impact: If `~/.quicklify/` directory compromised, backup contents readable
- Recommendation: Implement optional AES-256 encryption for backups via OpenSSL CLI or Node crypto

**No Server Grouping/Labels:**
- Problem: Servers stored flat; no way to organize by project, environment, tier
- Blocks: Large deployments (50+ servers) hard to manage
- Impact: `quicklify list` shows flat list; filtering only by name/IP
- Recommendation: Add optional `tags: string[]` and `group: string` fields to server record; filter by tag

**No Audit Logging:**
- Problem: Commands executed with no persistent log of who did what when
- Blocks: Compliance; debugging; detecting unauthorized changes
- Impact: MCP tool calls untracked; if token leaked, no evidence of misuse
- Recommendation: Log all destructive operations (provision, destroy, restore) to `~/.quicklify/audit.log` with timestamp, command, user

**No Update Notifications:**
- Problem: Users on old versions won't know about security updates
- Blocks: Security fixes don't reach users unless they manually update
- Current approach: `updateCheck.ts` compares package.json version to npm registry
- Recommendation: Persist last-checked timestamp; warn user if running version >30 days old with unresolved CVEs

## Test Coverage Gaps

**SSH Connection Error Handling:**
- What's not tested: Network timeout, connection refused, host key verification failure scenarios
- Files: `src/utils/ssh.ts` (all export functions)
- Risk: Real SSH failures may not be handled gracefully
- Priority: High (SSH is critical path)
- Recommendation: Mock SSH with network delay/failure scenarios; test error propagation

**Provider API Rate Limiting:**
- What's not tested: Provider returns 429 (too many requests); retry logic, backoff
- Files: `src/providers/*.ts` (all provider classes)
- Risk: Rate limits not detected; commands fail silently or timeout
- Priority: High (production use)
- Recommendation: Add jest mock for 429 responses; verify retry logic + exponential backoff

**Backup Restore with Corrupted Manifest:**
- What's not tested: Backup manifest with invalid JSON, missing fields, wrong schema version
- Files: `src/commands/restore.ts`, `src/core/backup.ts`
- Risk: Silent failures (missing fields ignored) or crash (parse error)
- Priority: Medium (data recovery path)
- Recommendation: Add schema validation (Zod) for manifest format before restore

**IP Validation Edge Cases:**
- What's not tested: IPv6 (not supported), private IP ranges (10.0.0.0, 172.16.0.0, 192.168.0.0), broadcast (255.255.255.255)
- Files: `src/utils/ssh.ts` (line 12), `src/core/manage.ts` (line 22)
- Risk: Private IPs accepted (user mistake) or broadcast IPs cause SSH failure
- Priority: Low (unlikely in production)
- Recommendation: Add IPv4 private range check; reject if private IP detected

**Firewall Rules Idempotency:**
- What's not tested: Running firewall setup twice on same server; duplicate rules, config conflicts
- Files: `src/commands/firewall.ts`, `src/core/firewall.ts`
- Risk: Duplicate rules if user reruns setup; iptables may become inconsistent
- Priority: Medium (user may retry on failure)
- Recommendation: Add idempotency check (query existing rules before applying); test double-setup scenario

**YAML Config Template Defaults:**
- What's not tested: Template merging with partial YAML (some fields missing), template not found, invalid YAML syntax
- Files: `src/utils/yamlConfig.ts`, `src/utils/templates.ts`
- Risk: Silent fallback to defaults; user thinks they specified values but defaults applied
- Priority: Low (user-facing, tested in E2E)
- Recommendation: Warn user if fields auto-filled due to template defaults

## Known Workarounds

**SSH Key Already Exists on Provider:**
- Workaround: `uploadSshKeyBestEffort()` catches 400 (duplicate) and searches existing keys by public key match
- Files: `src/core/provision.ts` (lines 73-80), `src/providers/linode.ts` (lines 73-88)
- Status: Working but verbose; could be simplified with provider upsert methods

**Pending IP After Server Creation:**
- Workaround: User manually runs `quicklify status <server-id>` to refresh IP after a few minutes
- Files: `src/commands/status.ts`, `src/core/manage.ts`
- Status: Acceptable for manual CLI; problematic for MCP automation

---

*Concerns audit: 2026-02-27*
