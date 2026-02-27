# Architecture

**Analysis Date:** 2026-02-27

## Pattern Overview

**Overall:** Modular CLI + MCP Server with Plugin-style Provider Architecture

**Key Characteristics:**
- Multi-layered architecture: CLI commands → Core business logic → Providers (cloud infrastructure abstraction)
- Command-driven CLI using Commander.js with interactive prompts (Inquirer.js)
- Provider pattern: CloudProvider interface with 4 concrete implementations (Hetzner, DigitalOcean, Vultr, Linode)
- Dual-interface: CLI commands and MCP (Model Context Protocol) tools wrapping same business logic
- Error handling with provider-specific and SSH-specific error mappers
- Configuration persistence in ~/.quicklify/servers.json with backup isolation

## Layers

**Commands Layer:**
- Purpose: CLI entry points and user interaction (prompts, output formatting, argument parsing)
- Location: `src/commands/`
- Contains: 23 command handlers (init.ts, status.ts, backup.ts, firewall.ts, secure.ts, etc.)
- Depends on: Core layer, Utils, Types, Providers
- Used by: index.ts (main CLI), MCP tools

**Core Layer:**
- Purpose: Business logic and orchestration (not cloud-specific)
- Location: `src/core/`
- Contains: status.ts, provision.ts, backup.ts, manage.ts, secure.ts, firewall.ts, domain.ts, logs.ts, maintain.ts, snapshot.ts, tokens.ts
- Depends on: Providers, Utils, Types
- Used by: Commands and MCP tools

**Providers Layer:**
- Purpose: Abstract cloud provider APIs and convert to unified interface
- Location: `src/providers/`
- Contains: base.ts (interface), hetzner.ts, digitalocean.ts, vultr.ts, linode.ts (implementations)
- Depends on: axios, Types
- Used by: Core modules, Commands

**Utils Layer:**
- Purpose: Cross-cutting utilities (config, SSH, prompts, error mapping, validation)
- Location: `src/utils/`
- Contains: config.ts (server registry), ssh.ts (SSH operations), prompts.ts (interactive selection), errorMapper.ts (error translation), serverSelect.ts (server lookup), etc.
- Depends on: Types
- Used by: Commands, Core, Providers

**MCP Tools Layer:**
- Purpose: Model Context Protocol server implementation for AI/Claude integration
- Location: `src/mcp/tools/`
- Contains: 7 tools (serverInfo.ts, serverLogs.ts, serverManage.ts, serverMaintain.ts, serverSecure.ts, serverBackup.ts, serverProvision.ts)
- Depends on: Core, Utils, Providers, Types
- Used by: MCP server (`src/mcp/server.ts`)

**Types Layer:**
- Purpose: Shared TypeScript interfaces and type definitions
- Location: `src/types/index.ts`
- Contains: ServerRecord, CloudProvider, Region, ServerSize, FirewallRule, BackupManifest, etc.
- Depends on: Nothing
- Used by: All layers

## Data Flow

**Deployment (init command) Flow:**

1. User invokes `quicklify init` with optional flags/YAML config
2. `initCommand` loads config, validates template if provided
3. Interactive prompts (providerFactory → specific provider for regions/sizes) gather user input
4. `initCommand` calls `provider.uploadSshKey()` with auto-generated or user key
5. `initCommand` calls `provider.createServer()` with cloud-init script (Coolify installation)
6. Loop: Poll `provider.getServerStatus()` until IP assigned (provider-specific retry counts)
7. Wait for Coolify to boot (provider-specific wait times)
8. `healthCheck.waitForCoolify()` polls http://server-ip:8000 until responding
9. `saveServer()` writes ServerRecord to ~/.quicklify/servers.json
10. If --full-setup: runs `firewallSetup()` and `secureSetup()` via SSH
11. Opens browser to Coolify dashboard

**Status Check Flow:**

1. User invokes `quicklify status <query>`
2. `serverSelect.resolveServer()` searches ~/.quicklify/servers.json by IP or name
3. `getCloudServerStatus()` calls provider API (if not manual server) → "running" / "stopped" / "error"
4. `checkCoolifyHealth()` polls http://server-ip:8000 → "running" / "not reachable"
5. Prints status table
6. If `--autostart` and Coolify down but server running: `sshExec()` restart Coolify

**Backup Flow:**

1. User invokes `quicklify backup <query>`
2. SSH to server, execute Coolify backup script
3. Generate BackupManifest JSON (server name, provider, timestamp, Coolify version, file list)
4. Download backup tar.gz and manifest from server
5. Store in ~/.quicklify/backups/<server-name>-<timestamp>/
6. Report success with file size and path

**Security Setup Flow:**

1. User invokes `quicklify secure setup <query>` or `firewall setup <query>`
2. Parse domain/SSL/port options (with --dry-run support)
3. Generate shell commands for remote execution
4. SSH execute with `sshExec(ip, commands)` or `sshExecPty(ip, commands)` for interactive
5. Parse and display results (fail2ban status, SSH config changes, UFW rules)

**State Management:**

- **Server Registry**: `~/.quicklify/servers.json` (persisted array of ServerRecord)
  - Loaded at command start via `getServers()` from `src/utils/config.ts`
  - Mutation: `saveServer()`, `removeServer()`
  - Query: `findServer()`, `findServers()`

- **Backups**: `~/.quicklify/backups/<server>-<timestamp>/` (directory per backup)
  - BackupManifest.json holds metadata
  - Tar.gz contains Coolify data

- **Provider State**: Not persisted. Each operation requires API token (env vars or prompt)
  - Tokens collected per-command via `promptApiToken()` or `collectProviderTokens()`

- **Configuration**: No user config file (only YAML for one-time --config in init)
  - Defaults hardcoded in `src/utils/defaults.ts` (OpenAI API, Coolify endpoints)

## Key Abstractions

**CloudProvider Interface:**
- Purpose: Abstract cloud provider differences (different APIs, regions, sizing)
- Examples: `HetznerProvider`, `DigitalOceanProvider`, `VultrProvider`, `LinodeProvider`
- Pattern: Factory pattern via `providerFactory.createProvider(name)` or `createProviderWithToken(name, token)`
- Methods: validateToken, getRegions, getServerSizes, createServer, getServerStatus, destroyServer, rebootServer, createSnapshot, listSnapshots, deleteSnapshot

**ServerRecord (Domain Model):**
- Purpose: Unified representation of registered server across all providers
- Example: `{ id: "abc123", name: "prod", provider: "hetzner", ip: "1.2.3.4", region: "nbg1", size: "cax11", createdAt: "2026-02-27T..." }`
- Enables provider-agnostic operations (status, SSH, backup) by storing IP + provider reference

**Core Module Functions:**
- Purpose: Business logic that operates on servers (not CLI-specific)
- Examples: `checkCoolifyHealth(ip)`, `getCloudServerStatus(server, token)`, `runBackup(server)`, `secureAudit(ip)`
- Reusable by: Commands and MCP tools

**Error Mappers:**
- Purpose: Convert provider-specific / SSH-specific errors to user-friendly messages
- Examples: `mapProviderError(error, provider)` → friendly message + link to token page, `mapSshError(error, ip)` → specific SSH troubleshooting
- Pattern: Error code / pattern matching with contextual URLs

## Entry Points

**CLI Entry Point:**
- Location: `bin/quicklify` (executable wrapper)
- Actual Logic: `src/index.ts`
- Triggers: User runs `quicklify <command> [options]`
- Responsibilities: Parse commands/options, dispatch to command handlers, check for updates asynchronously

**MCP Server Entry Point:**
- Location: `bin/quicklify-mcp` (executable wrapper)
- Actual Logic: `src/mcp/server.ts` + `src/mcp/index.ts`
- Triggers: Claude Desktop / AI framework connects to MCP server
- Responsibilities: Register 7 tools, handle input validation, dispatch to tool handlers, return structured results

## Error Handling

**Strategy:** Layered error mapping with context-specific formatters

**Patterns:**

1. **Provider Errors** (Axios HTTP responses):
   - Caught in provider methods, re-thrown
   - Commands catch and pass to `mapProviderError(error, provider)` → 401→token issue, 402→billing, 429→rate limit, 500→service down
   - Output: User-friendly message + actionable link (token page, billing page)

2. **SSH Errors** (command execution failures):
   - Caught in `sshExec()`, stderr captured
   - Commands catch and pass to `mapSshError(error, ip)` → connection refused, permission denied, host key changed, etc.
   - stderr sanitized via `sanitizeStderr()` (removes paths, IP addresses, passwords, tokens)
   - Output: Specific troubleshooting hint

3. **Filesystem Errors** (ENOENT, EACCES, ENOSPC):
   - Caught in config/backup operations
   - Mapped via `mapFileSystemError()` → "File not found", "Permission denied", "Disk full"

4. **Validation Errors** (Zod schemas):
   - Input validation at command entry points
   - Returns 400-like user prompt with field errors
   - Example: Provider enum validation, IP address format, port range (1-65535)

5. **Graceful Degradation**:
   - Manual servers (id starts with "manual-") skip provider API calls
   - Commands handle missing env vars via fallback to prompts
   - Optional SSH features (e.g., autostart) fail silently if SSH unavailable

## Cross-Cutting Concerns

**Logging:**
- Framework: `src/utils/logger.ts` wrapping chalk for colors
- Patterns: logger.title(), logger.info(), logger.success(), logger.warning(), logger.error()
- Spinners: ora with .start(), .succeed(), .fail()
- No structured logging (JSON); human-readable CLI output only

**Validation:**
- Provider enum: Hardcoded switch in providerFactory validates provider name at creation time
- Server lookup: Name/IP uniqueness not enforced (multiple servers can share name)
- IP validation: `assertValidIp(ip)` checks format before SSH/HTTP operations
- Port validation: Range 1-65535, SSH port collision checks in `secureSetup()`
- Zod schemas for MCP tool inputs (strict validation before dispatch to handlers)

**Authentication:**
- Provider tokens: Environment variables (HETZNER_TOKEN, DIGITALOCEAN_TOKEN, VULTR_TOKEN, LINODE_TOKEN) or prompted
- SSH keys: Auto-generated on first deploy (via `generateSshKey()`) or user-provided
- No persistent auth storage; tokens ephemeral per command
- MCP tools inherit token from parent process env (no separate auth layer)

**Rate Limiting:**
- Provider-specific IP wait configs (retry counts + intervals vary by provider)
- Coolify health check retry loop with exponential backoff
- MCP tool descriptions warn against repeated calls to provider APIs

---

*Architecture analysis: 2026-02-27*
