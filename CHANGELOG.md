# Changelog

All notable changes to this project will be documented in this file.

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
