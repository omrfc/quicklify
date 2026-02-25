# Changelog

All notable changes to this project will be documented in this file.

## [1.0.3] - 2026-02-25

### Security
- Restore rollback: automatically restart Coolify if restore steps 3-5 fail after Coolify was stopped
- Fail2ban warning: show "partially complete" instead of misleading "complete" when fail2ban fails
- SSH key warnings: stronger guidance to run `quicklify secure setup` when key generation/upload fails

### Added
- `doctor --check-tokens` — Validate provider API tokens from environment variables against live APIs (Hetzner, DigitalOcean, Vultr, Linode)
- Update notification — Check npm registry for newer versions (24h cache, non-blocking)
- Auto-open browser — Automatically open Coolify dashboard after successful `init` deployment (platform-aware, `--no-open` to disable)
- Error mapper — Actionable error messages with provider-specific URLs for billing, token management, and troubleshooting

### Changed
- Init onboarding — Improved post-deployment "What's Next?" guide with numbered steps and copy-paste commands
- README slogan updated to "Self-hosting made simple" (platform-agnostic)
- CONTRIBUTING.md completely rewritten to reflect current project state (22 commands, 5 providers, 13 utils)

### Documentation
- `llms.txt` — AI-friendly project documentation with architecture, commands, and workflows

## [1.0.2] - 2026-02-24

### Security
- Sanitize error cause chains to prevent API token leakage in all provider errors
- Mask process title when `--token` flag is used
- Replace `execSync` with `spawnSync` for ssh-keygen (prevent shell injection)
- Add shell-safe assertions to domain FQDN and DNS check commands
- Case-insensitive + nested security key detection in YAML config
- Strip unknown fields from imported server data
- Add IP address format validation to all SSH functions
- Filter sensitive environment variables from child processes
- Add `StrictHostKeyChecking` to interactive SSH connections
- Set file permissions (`0o600`) on export files
- Set directory permissions (`0o700`) on backup directories
- Add Vultr and Linode to default provider validation
- Clear `error.config.data` on Linode API failures (rootPass protection)

## [1.0.1] - 2026-02-24

### Added
- `quicklify snapshot create/list/delete` — VPS snapshot management with cost estimates
- Maintain integration: automatic snapshot offer before maintenance (with cost estimate)
- `sshKey.test.ts` — dedicated tests for SSH key utilities (13 tests)
- Provider snapshot support for Hetzner, DigitalOcean, Vultr, and Linode

### Fixed
- **domain.ts**: SQL escape for FQDN values (defense-in-depth against SQL injection)
- **restore.ts**: Path traversal protection with `basename()` for `--backup` flag
- **yamlConfig.ts**: Expanded security key detection (6 → 21 patterns including password, credential, jwt, bearer, etc.)

## [1.0.0] - 2026-02-23

### Added
- **Vultr provider** (`src/providers/vultr.ts`) - Full Vultr API v2 integration
  - Base64-encoded user_data for cloud-init
  - SSH key upload with HTTP 409 conflict handling
  - OS: Ubuntu 24.04 (os_id: 2284)
  - Power status normalization (running/stopped)
- **Linode (Akamai) provider** (`src/providers/linode.ts`) - Full Linode API v4 integration
  - Auto-generated root_pass via `crypto.randomBytes()`
  - SSH key upload via `/profile/sshkeys`
  - Metadata user_data for cloud-init (base64)
  - Disk size conversion (MB → GB)
- **`quicklify add`** command - Register existing Coolify servers to Quicklify management
  - Interactive flow: provider → token → IP → verify Coolify → save
  - Non-interactive: `--provider`, `--ip`, `--name`, `--skip-verify` flags
  - Coolify verification via SSH (health check or `docker ps`)
  - Duplicate detection by IP address
- **`quicklify maintain [query]`** command - Full maintenance cycle
  - 6-step flow: snapshot warning → status check → Coolify update → health check → reboot → final check
  - `--skip-reboot` to skip the reboot step
  - `--all` to maintain all servers sequentially
  - `--dry-run` to preview maintenance steps
- **`quicklify remove [query]`** command - Remove a server from local config without destroying the cloud server
  - Accepts server name or IP address
  - Confirmation prompt before removal
- **`--all` flag** on `status`, `update`, `backup` commands
  - `status --all`: parallel status check with table output (Promise.all)
  - `update --all`: sequential update with single confirmation prompt
  - `backup --all`: sequential backup across all servers
- **`status --autostart`** flag - Restarts Coolify via SSH if server is running but Coolify is down
  - Uses `docker compose restart coolify` command
  - Waits 5 seconds and verifies Coolify came back up
- **`collectProviderTokens()`** utility - Deduplicates token prompts per unique provider across servers
- `VULTR_TOKEN` and `LINODE_TOKEN` environment variable support
- Vultr and Linode defaults in all 3 templates (starter, production, dev)
- `"vultr"` and `"linode"` in YAML config validation
- 195 new tests across 6 new test files + enhanced existing test files

### Changed
- Provider selection now shows 4 choices: Hetzner Cloud, DigitalOcean, Vultr, Linode (Akamai)
- Provider factory supports `"vultr"` and `"linode"` cases
- Total commands: 19 → 23 (add, maintain, remove + maintain --all)
- Test count: 742 → 937
- Test suites: 40 → 44
- Coverage: 98%+ statements, 91%+ branches, 98%+ functions
- Zero new npm dependencies added

## [0.9.0] - 2026-02-21

### Added
- **`--config <path>`** flag on `quicklify init` - Load deployment parameters from a YAML config file
  - Supports all init options: provider, region, size, name, fullSetup, template, domain
  - Validates config with detailed warnings for invalid values
  - Security: detects and warns about token fields in config files
  - Handles missing files and invalid YAML syntax gracefully
- **`--template <name>`** flag on `quicklify init` - Use predefined server templates
  - `starter` - Minimal setup (cheapest option, no hardening)
  - `production` - Production-ready (larger server, auto firewall + SSH hardening)
  - `dev` - Development/testing (cheap, no hardening)
  - Per-provider defaults: Hetzner and DigitalOcean have optimized region/size pairs
- **Config merge system** with priority: CLI flags > YAML config > template defaults > interactive prompts
- `QuicklifyYamlConfig`, `TemplateName`, `TemplateDefinition` TypeScript interfaces
- `src/utils/templates.ts` - Template definitions with per-provider defaults
- `src/utils/yamlConfig.ts` - YAML config loader with validation and security checks
- `src/utils/configMerge.ts` - Multi-source config merge logic
- 106 new tests across 4 new test files (templates, yamlConfig, configMerge, init-config E2E)

### Changed
- `InitOptions` interface extended with `config` and `template` fields
- `initCommand()` now processes YAML config and template before main flow
- Total commands: 19 (unchanged)
- Test count: 636 → 742
- Test suites: 36 → 40
- Coverage: 98%+ statements, 91%+ branches, 98%+ functions

### Dependencies
- Added `js-yaml` (runtime) + `@types/js-yaml` (dev) - YAML parsing

## [0.8.0] - 2026-02-21

### Added
- **`quicklify backup [query]`** command - Backup Coolify database and config files
  - `pg_dump` + gzip for PostgreSQL database backup
  - Config tarball (`.env`, `docker-compose.yml`, `docker-compose.prod.yml`)
  - SCP download to `~/.quicklify/backups/{server-name}/{timestamp}/`
  - `manifest.json` with server info, Coolify version, file list
  - `--dry-run` flag to preview backup steps
- **`quicklify restore [query]`** command - Restore Coolify from a backup
  - Interactive backup selection from available backups
  - `--backup <timestamp>` flag to skip selection prompt
  - Double confirmation safety (confirm + type server name)
  - Full restore flow: upload → stop Coolify → start DB → restore DB → restore config → start Coolify
  - `--dry-run` flag to preview restore steps
- **`quicklify export [path]`** command - Export server list to JSON file
  - Default path: `./quicklify-export.json`
  - Custom path: `quicklify export /path/to/file.json`
- **`quicklify import <path>`** command - Import servers from JSON file
  - Format validation with field-level checking
  - Duplicate detection by server ID (skips existing)
- **`--full-setup` flag** on `quicklify init` - Auto-configure firewall + SSH hardening after deploy
  - Runs `firewallSetup()` + `secureSetup(force=true)` after Coolify health check
  - Skips interactive confirmations in automated mode
- `BackupManifest` TypeScript interface
- `BACKUPS_DIR` config constant (`~/.quicklify/backups/`)
- `validateServerRecords()` pure function for import validation
- `scpDownload()` and `scpUpload()` SCP helpers using `spawn`
- `loadManifest()` and `listBackups()` backup utility functions
- Pure command builder functions for all backup/restore SSH operations
- 137 new tests across 4 new test files + 6 enhanced test files
- Provider test coverage: uploadSshKey, rebootServer, createServer with sshKeyIds
- Doctor, monitor, restart, status, healthCheck, ssh edge case coverage

### Changed
- `firewallSetup()` now exported from `firewall.ts` (was private)
- `secureSetup()` now exported from `secure.ts` with `force` parameter to skip prompts
- Total commands: 15 → 19 (backup, restore, export, import)
- Test count: 499 → 636
- Test suites: 32 → 36
- Coverage: 98%+ statements, 90%+ branches, 98%+ functions
- Zero new npm dependencies added

## [0.7.2] - 2026-02-21

### Added
- **Auto SSH key upload** during `quicklify init` — detects local SSH key (`~/.ssh/id_ed25519.pub`, `id_rsa.pub`, `id_ecdsa.pub`) and uploads to provider (DigitalOcean/Hetzner) automatically. Eliminates password requirement on first SSH login
- **Auto SSH key generation** — if no SSH key exists, generates ed25519 key pair automatically
- **Local config cleanup on destroy failure** — when `quicklify destroy` fails (server already deleted), prompts to remove from local config

### Fixed
- **Fail2ban heredoc bug** — heredoc delimiter was not recognized when joined with `&&` chain, causing invalid config file and fail2ban crash. Replaced with `printf`
- **Fail2ban systemd backend** — added `python3-systemd` package (required for `backend = systemd` on Ubuntu)

## [0.7.1] - 2026-02-20

### Fixed
- **Domain command rewritten for Coolify v4** - Uses PostgreSQL `instance_settings` table instead of `.env` APP_URL
- Domain add now uses `docker compose -f docker-compose.yml -f docker-compose.prod.yml restart` (fixes compose error)
- Coolify existence check uses `docker ps` container check instead of `.env` file check
- DNS check fallback to `getent ahosts` (works on servers without `dig`/`dnsutils`)
- SSH restart compatibility: fallback `systemctl restart ssh` for Ubuntu/Debian (was `sshd` only)

## [0.7.0] - 2026-02-20

### Added
- **`quicklify firewall [subcommand]`** command - Manage server firewall (UFW)
  - `setup` - Install UFW + configure Coolify ports (80, 443, 8000, 6001, 6002) + SSH (22)
  - `add` - Open a port (`--port`, `--protocol tcp|udp`)
  - `remove` - Close a port (port 22 protected, Coolify ports warn before removal)
  - `list` - Show current firewall rules
  - `status` - Check UFW active/inactive state
- **`quicklify domain [subcommand]`** command - Manage server domain and SSL
  - `add` - Bind domain to Coolify (`--domain`, `--no-ssl` to disable HTTPS)
  - `remove` - Remove domain, revert to IP:8000
  - `check` - Verify DNS A record matches server IP
  - `list` - Show current APP_URL configuration
- **`quicklify secure [subcommand]`** command - SSH hardening and fail2ban
  - `setup` - Disable password auth, set root login to key-only, install fail2ban (requires SSH key check + double confirmation)
  - `status` - Show current SSH security settings
  - `audit` - Detailed security report with score (0-4)
- `--dry-run` flag on all three commands - Preview commands without executing
- Protected port system: port 22 cannot be removed via `firewall remove`
- Coolify port warnings: removing ports 80/443/8000/6001/6002 requires confirmation
- SSH key safety check: `secure setup` refuses to run if no authorized_keys found
- Pure functions for all commands (unit-testable): `isValidPort`, `isProtectedPort`, `buildUfwRuleCommand`, `parseUfwStatus`, `isValidDomain`, `sanitizeDomain`, `buildSetFqdnCommand`, `parseDnsResult`, `parseFqdn`, `parseSshdConfig`, `parseAuditResult`, `buildHardeningCommand`, `buildFail2banCommand`
- `FirewallRule`, `FirewallStatus`, `SshdSetting`, `SecureAuditResult` TypeScript interfaces
- 140 new tests across 3 test files (firewall, domain, secure)

### Changed
- Total commands: 12 → 15
- Test count: 354 → 494
- Test suites: 29 → 32
- Coverage maintained: 97%+ statements, 85%+ branches, 96%+ functions
- Zero new npm dependencies added

## [0.6.0] - 2026-02-20

### Added
- **`quicklify logs [query]`** command - View Coolify, Docker, or system logs via SSH
  - `--lines N` (default 50), `--follow` (real-time streaming), `--service coolify|docker|system`
- **`quicklify monitor [query]`** command - Show CPU, RAM, Disk usage via SSH
  - `--containers` flag to display Docker container list
- **`quicklify health`** command - Bulk health check of all registered servers
  - Parallel HTTP checks with response time measurement and table output
- **`quicklify doctor`** command - Local environment diagnostics
  - Checks Node.js version, npm, SSH client, config directory, registered servers
  - `--check-tokens` flag for future provider token validation
- `sshStream()` SSH helper - Spawns SSH with `stdio: "inherit"` for real-time log streaming
- `parseMetrics()` pure function for parsing `top`/`free`/`df` output
- `buildLogCommand()` pure function for service-to-command mapping
- `checkServerHealth()` function for individual server HTTP health checks
- 43 new tests across 5 test files (doctor, health-command, logs, monitor, ssh-utils)

### Changed
- Test count: 311 → 354
- Test suites: 25 → 29
- Coverage maintained: 97%+ statements, 87%+ branches, 96%+ functions
- Zero new npm dependencies added

## [0.5.0] - 2026-02-20

### Added
- **`quicklify config`** command - Manage default configuration (`set`, `get`, `list`, `reset`)
- **`quicklify ssh [query]`** command - SSH into a registered server (interactive or `--command` mode)
- **`quicklify update [query]`** command - Update Coolify on a registered server via SSH
- **`quicklify restart [query]`** command - Restart a server via provider API (Hetzner + DigitalOcean)
- `rebootServer()` method on `CloudProvider` interface (Hetzner + DigitalOcean implementations)
- Shared `resolveServer()` and `promptApiToken()` utilities (`src/utils/serverSelect.ts`)
- Default config management via `~/.quicklify/config.json` (`src/utils/defaults.ts`)
- SSH helper utilities: `checkSshAvailable()`, `sshConnect()`, `sshExec()` (`src/utils/ssh.ts`)
- `QuicklifyConfig` TypeScript interface
- 65 new tests across 7 new test files
- SSH availability detection for Windows/Linux/macOS

### Changed
- Extracted duplicate `selectServer()` into shared utility (DRY refactor)
- Refactored `status` and `destroy` commands to use shared `resolveServer` + `promptApiToken`
- Test count: 246 → 311
- Coverage maintained: 97%+ statements, 88%+ branches

## [0.4.1] - 2026-02-20

### Security
- **Environment variable token support** - Use `HETZNER_TOKEN` / `DIGITALOCEAN_TOKEN` env vars instead of `--token` flag to avoid shell history and `ps aux` exposure
- Config directory (`~/.quicklify/`) created with `0o700` permissions (owner only)
- Cloud-init install log restricted to `chmod 600` (root read/write only)
- Server name validation strengthened: 3-63 chars, must start with letter, end with letter/number
- SSL/HTTPS setup warnings added to `init` and `status` command output
- Updated `SECURITY.md` with current security measures and DigitalOcean API v2

### Changed
- ESLint upgraded from v9 to v10 (new `preserve-caught-error` rule compliance)
- Updated dependencies: axios 1.13, chalk 5.6, commander 14, ora 9, tsx 4.21, typescript 5.9
- Minimum Node.js version: 20 (ESLint 10 + ora 9 + commander 14 requirement)
- CI matrix: 3 OS x 2 Node versions (dropped Node 18)
- Non-interactive mode now detected by `--provider` flag alone (token can come from env var)
- `--token` option description updated to mention env var alternatives

## [0.4.0] - 2026-02-20

### Added
- **`quicklify list`** command - List all registered servers (no token required)
- **`quicklify status [query]`** command - Check server and Coolify status by IP or name
- **`quicklify destroy [query]`** command - Destroy a server with double confirmation safety
- **Non-interactive mode** for `quicklify init` with `--provider`, `--token`, `--region`, `--size`, `--name` flags
- **Coolify health check polling** - Replaces blind wait with intelligent `http://IP:8000` polling
- **Server record persistence** - Successful deploys saved to `~/.quicklify/servers.json`
- `ServerRecord` and `InitOptions` TypeScript interfaces
- `src/utils/config.ts` - Config module for server record CRUD (`getServers`, `saveServer`, `removeServer`, `findServer`)
- `src/utils/providerFactory.ts` - Provider factory extracted from init.ts for better testability
- `src/utils/healthCheck.ts` - `waitForCoolify()` with configurable polling (min wait + 5s interval + max attempts)
- `destroyServer()` method on `CloudProvider` interface (Hetzner + DigitalOcean implementations)
- 86 new tests: config, list, status, destroy, healthCheck, providerFactory, edge cases, E2E flows
- Edge case test coverage: config corruption, health check retries, non-interactive validation

### Changed
- `initCommand` now accepts `InitOptions` parameter for non-interactive mode
- Init flow uses `waitForCoolify()` instead of fixed `setTimeout` (faster with early exit on success)
- Init flow saves server record to local config after successful deploy
- Success message now includes `quicklify status` and `quicklify list` hints
- Provider creation extracted to `providerFactory.ts` (no behavior change)
- Test count: 145 → 233
- Coverage maintained: 97%+ statements, 89%+ branches, 96%+ functions

### Fixed
- Non-interactive mode properly exits with code 1 on invalid provider or token
- Health check accepts any HTTP response (200, 302, 401, 500) as "Coolify is running"
- `destroy` now removes local config record when server already deleted from provider ("not found")

## [0.3.1] - 2026-02-19

### Fixed
- Hetzner pricing now shows net prices (excl. VAT) matching website display
- Hetzner server types filtered by `/datacenters` API for real availability
- Replaced deprecated Hetzner server types (cpx→cx23/cx33, per Jan 2026 deprecation)
- "Server name already used" error now prompts for a new name instead of crashing
- Location disabled retry now re-prompts for both region and server type
- Back navigation in error retry flows (server type → region)
- Updated static fallback prices to match current Hetzner net pricing

### Changed
- `getLocationConfig` now accepts `exclude` parameter to filter disabled locations

## [0.3.0] - 2026-02-19

### Added
- DigitalOcean provider implementation (full API integration)
- Provider selection UI prompt (Hetzner Cloud / DigitalOcean)
- `getProviderConfig()` prompt function
- DigitalOcean-specific interfaces (`DORegion`, `DOSize`, `DOErrorResponse`)
- Step-based back navigation with `← Back` option in all prompts
- `getServerDetails()` + IP refresh for DigitalOcean delayed IP assignment
- Minimum 2GB RAM + 2 vCPU filter for Coolify requirements
- Network connectivity wait loop in cloud-init (DigitalOcean cloud-init timing fix)
- Installation logging to `/var/log/quicklify-install.log` for troubleshooting
- Troubleshooting info in deployment success message
- Location retry on "server location disabled" error (offers region change)
- 50+ new tests (DigitalOcean integration, provider selection, E2E flows)

### Changed
- `init` command now prompts for provider selection instead of defaulting to Hetzner
- DigitalOcean image changed from Ubuntu 24.04 to 22.04 (stable cloud-init support)
- Hetzner server type filtering now uses `/datacenters` API for real availability
- Replaced deprecated Hetzner server types (cpx→cx23/cx33, per Jan 2026 deprecation)
- Provider-specific deployment timing (Hetzner ~5 min, DigitalOcean ~7 min)
- Cloud-init script now uses `set +e` for resilient execution
- UFW firewall support for DigitalOcean (alongside iptables for Hetzner)
- Updated `typescript-eslint` from 8.55 to 8.56
- Test count: 95 → 143+

### Fixed
- Hetzner deprecated server types (cpx11, cx22 etc.) shown but failing on creation
- DigitalOcean cloud-init failing due to network not ready at script execution time
- Hetzner pricing now shows net prices (excl. VAT) matching website display
- Coverage gaps in Hetzner provider (price null fallback, error.data.error undefined)

## [0.2.8] - 2026-02-16

### Added
- ESLint 9 + typescript-eslint 8 + Prettier setup with npm scripts
- `.prettierrc` and `eslint.config.js` configuration files
- `CHANGELOG.md` with full version history
- `CONTRIBUTING.md` with development guide and PR process
- Proper TypeScript interfaces for Hetzner API responses (`HetznerLocation`, `HetznerServerType`, `HetznerPrice`, `HetznerErrorResponse`)
- `isAxiosError` mock in test helpers

### Changed
- Replaced all `catch (error: any)` with `catch (error: unknown)` + proper type guards
- Replaced `any` type annotations with proper interfaces in Hetzner provider
- Applied Prettier formatting across all source files

## [0.2.7] - 2026-02-16

### Changed
- Updated README with accurate feature descriptions and missing version history
- Fixed inaccurate SECURITY.md claims (token handling, SDK references)
- Added npm keywords for better discoverability (vps, cloud, automation, self-hosted, paas, devops, server)

### Security
- Added server name sanitization in cloud-init script (defense-in-depth)

## [0.2.6] - 2026-02-16

### Changed
- CI: Upgraded Codecov action to v5

## [0.2.5] - 2026-02-16

### Added
- CI: Codecov integration for automatic coverage badge

## [0.2.4] - 2026-02-15

### Changed
- Refactor: Removed recommended label from server type selection
- Excluded failed server types from retry list

## [0.2.3] - 2026-02-15

### Fixed
- Unsupported server type error now triggers retry
- Dynamic deployment summary based on actual server config
- Dynamic recommended server type selection

## [0.2.2] - 2026-02-15

### Added
- Deprecated server type filtering
- Retry mechanism for unavailable server types

## [0.2.1] - 2026-02-14

### Fixed
- URL protocol changed from https to http for initial Coolify setup

## [0.2.0] - 2026-02-14

### Added
- Dynamic server type filtering based on selected location
- Auto firewall configuration (ports 8000, 22, 80, 443)

### Changed
- Improved price formatting

### Removed
- Debug logs

## [0.1.11] - 2026-02-14

### Changed
- Removed tracked Claude Code local settings

### Added
- Firewall rules to cloud-init
- Security notes to README

## [0.1.10] - 2026-02-14

### Fixed
- Updated deploy time estimate from 60 seconds to 4 minutes

## [0.1.9] - 2026-02-14

### Fixed
- Read version from package.json dynamically

## [0.1.8] - 2026-02-14

### Fixed
- Added build step to publish workflow

## [0.1.7] - 2026-02-14

### Fixed
- Added .npmignore to include dist/ in npm package

## [0.1.6] - 2026-02-14

### Fixed
- Added bin wrapper for Windows npx compatibility

## [0.1.5] - 2026-02-14

### Fixed
- Added files field to include dist/ in npm package

## [0.1.4] - 2026-02-14

### Added
- SECURITY.md with security policy
- Socket.dev security badge
- Package.json metadata (repository, bugs, homepage, author)

## [0.1.3] - 2026-02-14

### Added
- Auto npm publish workflow via GitHub Actions
- GitHub stars badge to README

## [0.1.2] - 2026-02-14

### Changed
- Updated deploy time references from 60s to 4 minutes

## [0.1.1] - 2026-02-14

### Fixed
- Corrected bin field in package.json
- Added status badges to README

## [0.1.0] - 2026-02-14

### Added
- Initial release
- Hetzner Cloud integration
- Interactive CLI with Commander.js + Inquirer.js
- Automated Coolify installation via cloud-init
- ARM64 support
- Full test suite (unit, integration, e2e)
