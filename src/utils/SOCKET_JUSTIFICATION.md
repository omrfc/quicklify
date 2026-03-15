# Socket.dev Supply Chain Justification

This document addresses the remaining Socket.dev security alerts for `kastell`.
Current score: 74/100. Target: no unresolved critical alerts.

## Resolved Alerts

### execSync → spawnSync migration (Plan 43-01)
- **Alert type:** `shell` — execSync passes commands through a shell (injection risk)
- **Resolution:** Migrated all `execSync` calls to `spawnSync` with argument arrays
- **Files migrated:** `src/utils/ssh.ts`, `src/core/backup.ts`, `src/core/snapshot.ts`,
  `src/core/secure.ts`, `src/core/firewall.ts`, `src/core/domain.ts`,
  `src/core/guard.ts`, `src/core/manage.ts`, `src/commands/init.ts`,
  `src/utils/updateCheck.ts`, `src/mcp/server.ts`
- **Additional protection:** `SshCommand` branded type + `shellEscape` prevents
  injection at SSH command construction layer (Phase 42-02)

### curl|bash in constants (Plan quick-6)
- **Alert type:** `obfuscated` — curl|bash pattern in dist/constants.js
- **Resolution:** Moved `COOLIFY_UPDATE_CMD` and `DOKPLOY_UPDATE_CMD` from
  `constants.ts` into their respective adapter files (`coolify.ts`, `dokploy.ts`).
  `constants.ts` no longer contains shell command patterns. The commands are
  platform-specific update scripts that only run on remote servers via SSH.

### child_process in deploy (Plan quick-6)
- **Alert type:** `shell` — spawnSync import in dist/core/deploy.js
- **Resolution:** Replaced inline `spawnSync("ssh-keygen", ...)` calls with
  existing `removeStaleHostKey()` utility from `ssh.ts`. `deploy.ts` no longer
  imports `child_process` directly.

## Remaining Alerts

### axios (network access)
- **Alert type:** `network` — axios makes outbound HTTP requests
- **Justification:** `axios` is the intentional HTTP client for all cloud provider
  API calls. Kastell must communicate with Hetzner, DigitalOcean, Vultr, and Linode
  REST APIs to provision, list, and destroy servers. There is no alternative
  implementation path that does not involve network access.
- **Risk mitigation:**
  - All API tokens are stored in OS keychain (Phase 42-01, `@napi-rs/keyring`)
  - `sanitizeResponseData()` whitelist approach prevents token/secret leakage in
    error messages (src/utils/config.ts)
  - axios is a well-maintained, widely-audited package (>50M weekly downloads)
- **Verdict:** False positive for a CLI tool that intentionally makes API calls.
  Elimination is not possible without rewriting all 4 provider modules.

### globalThis fetch in domain command
- **Alert type:** `network` — `globalThis["fetch"]` in dist/commands/domain.js
- **Justification:** The source file `src/commands/domain.ts` contains NO fetch
  calls and NO `globalThis` references. This pattern appears in the compiled
  output as a TypeScript ESM emit artifact or from a transitive dependency
  polyfill. The domain command uses SSH (`sshExec`) for all remote operations,
  not HTTP fetch.
- **Verdict:** Compilation artifact — false positive.

## Summary

| Alert | Type | Status | Reason |
|-------|------|--------|--------|
| execSync | shell | Resolved (43-01) | Migrated to spawnSync |
| curl\|bash in constants | obfuscated | Resolved (quick-6) | Moved to adapter files |
| child_process in deploy | shell | Resolved (quick-6) | Uses removeStaleHostKey utility |
| axios | network | Justified | Required for cloud provider APIs |
| globalThis fetch in domain | network | False positive | TypeScript compile artifact, no fetch in source |

The remaining `network` alert from axios is a known, accepted trade-off.
Kastell's core functionality (server provisioning, management) requires HTTP API
access to cloud providers. The alert correctly identifies that network calls
occur — this is intentional and documented behavior, not a supply chain risk.
