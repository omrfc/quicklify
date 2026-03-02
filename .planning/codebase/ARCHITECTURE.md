# Architecture

**Analysis Date:** 2026-03-02

## Pattern Overview

**Overall:** Three-Layer CLI + MCP Server

**Key Characteristics:**
- Commands are thin wrappers: parse CLI args, call `resolveServer`, delegate to core functions, render output
- Core holds all business logic: pure functions return `QuicklifyResult<T>` (no throws), async side-effectful functions communicate via SSH
- Providers are cloud API plugins: all implement the `CloudProvider` interface from `src/providers/base.ts`
- MCP server exposes the same core functions as 7 registered tools over stdio JSON-RPC
- No database: server state persisted in `~/.quicklify/servers.json` (JSON flat file), backups in `~/.quicklify/backups/`

## Layers

**Commands Layer:**
- Purpose: CLI argument parsing, interactive prompts, output rendering (spinners, chalk), error display
- Location: `src/commands/`
- Contains: 23 command handlers (one file per command) + `interactive.ts` (category menu)
- Depends on: `src/core/`, `src/utils/`, `src/types/index.ts`
- Used by: `src/index.ts` (Commander.js `.action()` callbacks)

**Core Layer:**
- Purpose: Business logic, SSH orchestration, provider interactions, data persistence
- Location: `src/core/`
- Contains: `provision.ts`, `status.ts`, `backup.ts`, `manage.ts`, `tokens.ts`, `secure.ts`, `firewall.ts`, `domain.ts`, `logs.ts`, `maintain.ts`, `snapshot.ts`
- Depends on: `src/utils/`, `src/providers/`, `src/types/index.ts`, `src/constants.ts`
- Used by: `src/commands/` and `src/mcp/tools/`

**Providers Layer:**
- Purpose: Cloud provider API abstraction (HTTP calls via axios)
- Location: `src/providers/`
- Contains: `base.ts` (interface), `hetzner.ts`, `digitalocean.ts`, `vultr.ts`, `linode.ts`
- Depends on: `axios`, `src/types/index.ts`
- Used by: `src/core/` via `src/utils/providerFactory.ts`

**MCP Server:**
- Purpose: Expose core operations as MCP tools for AI agent consumption via stdio JSON-RPC
- Location: `src/mcp/`
- Contains: `index.ts` (entry point), `server.ts` (tool registration), `utils.ts` (shared helpers), `tools/` (7 tool handlers)
- Depends on: `src/core/`, `src/utils/config.ts`, `@modelcontextprotocol/sdk`
- Used by: `bin/quicklify-mcp` binary

**Utilities Layer:**
- Purpose: Shared infrastructure: SSH execution, config I/O, provider factory, logging, error mapping, server selection
- Location: `src/utils/`
- Contains: `ssh.ts`, `config.ts`, `providerFactory.ts`, `logger.ts`, `errorMapper.ts`, `serverSelect.ts`, `modeGuard.ts`, `cloudInit.ts`, `sshKey.ts`, `healthCheck.ts`, `templates.ts`, `yamlConfig.ts`, `configMerge.ts`, `defaults.ts`, `prompts.ts`, `openBrowser.ts`, `updateCheck.ts`
- Depends on: `src/types/index.ts`, `src/constants.ts`
- Used by: all layers

## Data Flow

**CLI Command (e.g., `quicklify backup myserver`):**

1. `src/index.ts` parses args via Commander.js, calls `backupCommand(query, options)`
2. `src/commands/backup.ts` calls `resolveServer(query)` from `src/utils/serverSelect.ts`
3. `resolveServer` calls `findServers(query)` from `src/utils/config.ts` — reads `~/.quicklify/servers.json`
4. Command checks mode via `isBareServer(server)` from `src/utils/modeGuard.ts`
5. Command calls core helper: `createBareBackup(ip, name, provider)` or inline SSH steps via `sshExec(ip, cmd)`
6. `sshExec` in `src/utils/ssh.ts` spawns `ssh root@<ip>` subprocess with `sanitizedEnv()`
7. Result is written to `~/.quicklify/backups/<serverName>/<timestamp>/` with `manifest.json`
8. `logger` (chalk + ora) renders final status

**MCP Tool Call (e.g., `server_backup { action: "backup-create" }`):**

1. `bin/quicklify-mcp` starts `McpServer` with stdio transport
2. `server.ts` dispatches to `handleServerBackup(params)` in `src/mcp/tools/serverBackup.ts`
3. Tool handler calls `resolveServerForMcp(params, servers)` from `src/mcp/utils.ts`
4. Handler calls the same core functions: `createBareBackup()` or `createBackup()`
5. Returns `mcpSuccess({ ... })` or `mcpError("...", hint)` — both are JSON in MCP response envelope

**Server Provisioning Flow:**

1. `initCommand` (interactive) or `handleServerProvision` (MCP) gathers `provider`, `region`, `size`, `name`, `mode`
2. `getProviderToken(provider)` reads env var (e.g., `HETZNER_TOKEN`)
3. `createProviderWithToken(provider, token)` in `src/utils/providerFactory.ts` returns `CloudProvider` instance
4. `provider.validateToken(token)` → `provider.uploadSshKey(name, publicKey)` → `provider.createServer(config)`
5. `cloudInit` script (from `src/utils/cloudInit.ts`) embeds Coolify auto-installer or bare setup into user-data
6. Poll `provider.getServerStatus(id)` and `provider.getServerDetails(id)` until `running` and IP assigned
7. `saveServer(record)` writes to `~/.quicklify/servers.json`

**State Management:**
- No in-memory state. Every operation reads `~/.quicklify/servers.json` fresh via `getServers()` from `src/utils/config.ts`
- `getServers()` normalizes legacy records: sets `mode = "coolify"` if missing (backward compat)
- Tokens are never stored; always read from env vars at call time via `getProviderToken(provider)` in `src/core/tokens.ts`

## Key Abstractions

**`CloudProvider` Interface:**
- Purpose: Uniform contract for all cloud providers
- Definition: `src/providers/base.ts`
- Implementations: `src/providers/hetzner.ts`, `src/providers/digitalocean.ts`, `src/providers/vultr.ts`, `src/providers/linode.ts`
- Pattern: Factory `createProviderWithToken(name, token)` in `src/utils/providerFactory.ts` — switch-case dispatcher

**`QuicklifyResult<T>`:**
- Purpose: Core functions return structured results, never throw (callers handle errors)
- Definition: `src/types/index.ts`
- Fields: `{ success: boolean; data?: T; error?: string; hint?: string }`
- Used by: `src/core/provision.ts`, `src/core/manage.ts`, `src/core/backup.ts`

**`ServerRecord`:**
- Purpose: Canonical server representation persisted to disk and passed between layers
- Definition: `src/types/index.ts`
- Fields: `id`, `name`, `provider`, `ip`, `region`, `size`, `createdAt`, `mode?: ServerMode`
- `mode` distinguishes Coolify-installed servers (`"coolify"`) from generic bare VPS (`"bare"`)

**`ServerMode` ("coolify" | "bare"):**
- Purpose: Gate Coolify-specific operations on bare servers
- Enforced by: `requireCoolifyMode(server, commandName)` in `src/utils/modeGuard.ts`
- Examples of guarded ops: `backup` (Coolify DB), `update` (Coolify update), `maintain`, `restore`
- Bare-compatible ops: SSH access, firewall, secure, domain, system backup, restart (cloud API)

**MCP Response Helpers:**
- Purpose: Uniform JSON envelope for all MCP tool responses
- Location: `src/mcp/utils.ts`
- `mcpSuccess(data)` → `{ content: [{ type: "text", text: JSON.stringify(data) }] }`
- `mcpError(error, hint?, suggestedActions?)` → same shape with `isError: true`
- `resolveServerForMcp(params, servers)` — auto-selects single server if no `server` param provided
- `requireProviderToken(provider)` — discriminated union return for token resolution

**SAFE_MODE:**
- Purpose: Block destructive operations in automated/untrusted contexts
- Trigger: `QUICKLIFY_SAFE_MODE=true` env var
- Enforced by: `isSafeMode()` in `src/core/manage.ts`
- Blocks: `destroy`, `provision`, `restore` in MCP tools

## Entry Points

**CLI Binary:**
- Location: `bin/quicklify` — one-liner: `import('../dist/index.js')`
- Compiled source: `src/index.ts` — Commander.js program setup + no-arg interactive menu trigger
- Interactive mode: if `process.argv.slice(2).length === 0`, calls `interactiveMenu()` from `src/commands/interactive.ts`, then feeds result back into `program.parseAsync()`

**MCP Binary:**
- Location: `bin/quicklify-mcp` (compiled from `src/mcp/index.ts`)
- Starts `McpServer` with `StdioServerTransport` — communicates over stdin/stdout JSON-RPC
- All logging must go to `process.stderr` (stdout reserved for MCP protocol)

## Error Handling

**Strategy:** Errors at the provider/SSH level are caught and mapped to user-friendly messages. Core functions return `QuicklifyResult` (no throws). Commands handle results and call `logger.error()`.

**Patterns:**
- `getErrorMessage(error)` in `src/utils/errorMapper.ts` — safe extraction from unknown errors
- `mapProviderError(error, provider)` — maps axios HTTP status codes (401, 402, 404, 429, 5xx) and network errors to hints
- `mapSshError(error, ip)` — maps SSH stderr patterns (connection refused, permission denied, host key mismatch, dpkg lock) to user-friendly messages
- `sanitizeStderr(stderr)` — redacts IPs, home paths, tokens from stderr before surfacing
- `stripSensitiveData(error)` in each provider — removes axios config headers/data from error objects before re-throw
- SSH host key mismatch: auto-detected via `isHostKeyMismatch(stderr)`, automatically retried after `removeStaleHostKey(ip)`

## Cross-Cutting Concerns

**Logging:** `logger` object in `src/utils/logger.ts` — chalk-colored console output (`info`, `success`, `error`, `warning`, `title`, `step`). `createSpinner(text)` returns ora spinner. MCP tools write to `process.stderr` only.

**Validation:**
- IP validation: `assertValidIp(ip)` in `src/utils/ssh.ts` — validates before every SSH call and cloud API call
- Server name validation: `validateServerName(name)` in `src/core/manage.ts` — RFC-hostname pattern
- Provider validation: `isValidProvider(provider)` in `src/core/manage.ts`
- Remote path safety: `assertSafePath(path)` in `src/core/backup.ts` — rejects shell metacharacters in SCP paths

**Authentication:** No stored credentials. API tokens read from env vars via `getProviderToken(provider)` in `src/core/tokens.ts`. SSH uses key-based auth (key found via `findLocalSshKey()` in `src/utils/sshKey.ts` or generated if missing).

**SSH Execution:** All remote commands go through `sshExec(ip, cmd)` or `sshStream(ip, cmd)` in `src/utils/ssh.ts`. Both use `sanitizedEnv()` to strip token/secret env vars before spawning subprocess. SSH binary resolved cross-platform via `resolveSshPath()`.

---

*Architecture analysis: 2026-03-02*
