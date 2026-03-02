# Coding Conventions

**Analysis Date:** 2026-03-02

## Naming Patterns

**Files:**
- Commands: `kebab-case.ts` matching CLI command name (e.g., `src/commands/init.ts`, `src/commands/backup.ts`)
- Core business logic: `camelCase.ts` (e.g., `src/core/status.ts`, `src/core/manage.ts`)
- Utilities: `camelCase.ts` (e.g., `src/utils/errorMapper.ts`, `src/utils/modeGuard.ts`)
- Providers: `providerName.ts` all lowercase (e.g., `src/providers/hetzner.ts`)
- MCP tools: `server<Feature>.ts` PascalCase feature (e.g., `src/mcp/tools/serverInfo.ts`)
- Tests: `<feature>.test.ts` or `<feature>-<variant>.test.ts` (e.g., `backup-bare.test.ts`)

**Functions:**
- Exported command entry points: `camelCase` verb+subject (e.g., `initCommand`, `backupCommand`, `firewallSetup`)
- Core functions: descriptive camelCase verbs (e.g., `checkCoolifyHealth`, `getCloudServerStatus`, `checkAllServersStatus`)
- MCP handlers: `handle<Feature>` prefix (e.g., `handleServerInfo`, `handleServerBackup`)
- Predicates: `is<Condition>` or `requires<Condition>` (e.g., `isBareServer`, `isHostKeyMismatch`)
- Guards: `assert<Invariant>` for throwing validators (e.g., `assertValidIp`)
- Factory: `create<Entity>` (e.g., `createProvider`, `createProviderWithToken`, `createSpinner`)

**Variables:**
- camelCase throughout
- Boolean flags: descriptive `isX`, `hasX` prefixes (e.g., `isNonInteractive`, `hasValidIp`, `isBare`, `sshReady`)
- Mutable accumulation: past tense (e.g., `failedTypes`, `failedLocations`)
- Prefix `_` for intentionally unused parameters (ESLint enforced via `argsIgnorePattern: "^_"`)

**Types/Interfaces:**
- Interfaces: PascalCase (e.g., `ServerRecord`, `CloudProvider`, `FirewallRule`)
- Type aliases: PascalCase (e.g., `ServerMode`, `FirewallProtocol`, `TemplateName`)
- Generic result type: `QuicklifyResult<T>` for core functions that return success/error without throwing
- Provider-internal types: prefixed with provider name (e.g., `HetznerLocation`, `HetznerServerType`)

**Constants:**
- SCREAMING_SNAKE_CASE for true module-level constants (e.g., `COOLIFY_UPDATE_CMD`, `BOOT_MAX_ATTEMPTS`)
- Record<string, ...> lookup tables: PascalCase (e.g., `IP_WAIT`, `COOLIFY_MIN_WAIT`)

## Code Style

**Formatting:**
- Tool: Prettier 3.x
- Configured via: `prettier --write "src/**/*.ts"` (no config file; uses defaults)
- Line endings: consistent — no trailing whitespace

**Linting:**
- Tool: ESLint 10 with `typescript-eslint` + `eslint-config-prettier`
- Config: `eslint.config.js` (flat config format)
- Key rules:
  - `@typescript-eslint/no-unused-vars: error` — unused vars are errors; `_` prefix exempts params
  - `@typescript-eslint/recommended` ruleset — full TypeScript best practices
  - `eslint-config-prettier` — disables formatting rules conflicting with Prettier
  - Tests are excluded from linting (`"ignores": ["tests/"]`)

## Import Organization

**ESM-native project** — all imports use `.js` extension even for TypeScript source files (resolved by tsconfig paths).

**Order (enforced by convention, not plugin):**
1. Node built-ins (`child_process`, `fs`, `path`, `os`, `url`)
2. Third-party packages (`axios`, `chalk`, `ora`, `inquirer`, `commander`, `zod`)
3. Internal absolute imports (providers, utils, core, types, constants)

**Import style:**
- Named imports preferred: `import { createProvider, createProviderWithToken } from "../utils/providerFactory.js"`
- `type` imports for interfaces/types: `import type { ServerRecord } from "../types/index.js"`
- Default imports only for libraries that export a default (e.g., `import axios from "axios"`)
- No barrel files / index.ts re-exports — each module imported directly by path

**Path aliases:**
- No aliases configured — all paths are relative (e.g., `"../utils/errorMapper.js"`)

## Error Handling

**Strategy — two-tier system:**

**Commands/providers throw errors.** All provider API calls wrap errors and rethrow with user-friendly context:
```typescript
// Provider pattern — always wrap with { cause: error }
throw new Error(
  `Failed to create server: ${error instanceof Error ? error.message : String(error)}`,
  { cause: error },
);
```

**Core functions return `QuicklifyResult<T>`.** No exceptions propagate to CLI layer:
```typescript
// Core pattern — catch and return error shape
try {
  const result = await doWork();
  return { success: true, data: result };
} catch (error: unknown) {
  return { success: false, error: getErrorMessage(error) };
}
```

**MCP tools use `mcpSuccess` / `mcpError`** from `src/mcp/utils.ts` — never throw, always return shaped response.

**Error extraction — always use `getErrorMessage()`** from `src/utils/errorMapper.ts`:
```typescript
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}
```

**Sensitive data stripping** — Axios error objects are sanitized before being used as `cause`:
```typescript
function stripSensitiveData(error: unknown): void {
  if (axios.isAxiosError(error)) {
    if (error.config) {
      error.config.headers = undefined;   // strip auth headers
      error.config.data = undefined;       // strip request body
    }
    (error as ...).request = undefined;    // strip request object
  }
}
```

**SSH error mapping** — `mapSshError()` in `src/utils/errorMapper.ts` maps stderr patterns to user-friendly messages (11 patterns). Returns `""` for unrecognized errors.

**Provider error mapping** — `mapProviderError()` maps HTTP status codes + message patterns to actionable hints. Returns `""` for unrecognized errors.

**catch (error: unknown)** — always type catch binding as `unknown`, never `any`.

## Security Patterns

**IP validation before all SSH operations:**
```typescript
// ALWAYS call assertValidIp before using IP in spawn/exec
assertValidIp(ip);
sshExecInner(ip, command, false);
```

**Sanitized environment for child processes:**
```typescript
// Strip TOKEN/SECRET/PASSWORD/CREDENTIAL env vars before spawning
sanitizedEnv()  // src/utils/ssh.ts — removes sensitive keys before any spawn()
```

**Process title masking when `--token` flag used:**
```typescript
// Prevent token from appearing in process list
process.title = "quicklify";
```

**SAFE_MODE guard for destructive MCP operations:**
```typescript
if (process.env.QUICKLIFY_SAFE_MODE === "true") {
  return mcpError("Destroy is disabled in SAFE_MODE", "Set QUICKLIFY_SAFE_MODE=false to allow...");
}
```

**Stderr sanitization before logging:**
```typescript
sanitizeStderr(stderr)  // src/utils/errorMapper.ts — redacts home paths, IPs, password=, token=, secret= patterns
```

**Config directory security:**
```typescript
mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });   // restricted permissions
writeFileSync(SERVERS_FILE, ..., { mode: 0o600 });          // only owner can read
```

**Host key mismatch auto-retry:**
- SSH commands auto-detect REMOTE HOST IDENTIFICATION HAS CHANGED in stderr
- Auto-removes stale key via `ssh-keygen -R <ip>` (IP validated before use)
- Retries once — single auto-heal, no infinite loop

**Token sourcing priority:**
1. Environment variable (preferred, warned if missing)
2. Interactive prompt (fallback for CLI)
3. `--token` flag (accepted but warned — visible in shell history)

## Logging

**Framework:** Custom `logger` object in `src/utils/logger.ts` wrapping `chalk` + `console.log`

**Logger API:**
```typescript
logger.info("...")     // blue ℹ  — informational
logger.success("...")  // green ✔ — success confirmation
logger.error("...")    // red ✖   — error message
logger.warning("...")  // yellow ⚠ — non-fatal warning
logger.title("...")    // bold cyan — section header (blank lines before/after)
logger.step("...")     // gray →   — instructional next-step hint
```

**Spinner pattern for async operations:**
```typescript
const spinner = createSpinner("Creating VPS server...");
spinner.start();
// ... async work ...
spinner.succeed("Server created (ID: 123)");
// or
spinner.fail("Server creation failed");
// or
spinner.warn("Cloud-init may not have finished");
```

**No raw `console.log` for user messages** — only `logger.*` or `spinner.*`. Raw `console.log()` used only for blank lines.

## Comments

**When to Comment:**
- Constants with non-obvious values (e.g., `// 30s (instant IP)` next to `attempts: 10, interval: 3000`)
- Security decisions (e.g., `// stdin must be "ignore" — not "inherit". MCP uses stdin for JSON-RPC transport`)
- Non-obvious behavior (e.g., `// Key already exists → find by matching public key`)
- `/* istanbul ignore next */` only for truly untestable branches (process.exit, OS platform guards)

**No JSDoc** — functions are self-documenting by name. JSDoc-style comments are used sparingly for exported utilities in MCP layer.

**Section dividers in complex files** using `// ─── Section Name ───` Unicode separator lines (visible in `src/mcp/utils.ts`, `src/core/manage.ts`).

## Function Design

**Size:** No strict limit enforced. Commands like `initCommand` (`src/commands/init.ts`, 619 lines) are large because they orchestrate multi-step user flows. Core utility functions are small (5–30 lines).

**Parameters:**
- Options objects for commands (e.g., `initCommand(options: InitOptions = {})`)
- Direct typed parameters for utilities (e.g., `assertValidIp(ip: string): void`)
- Private implementation details via `Xinner` pattern (e.g., `sshExecInner`, `sshStreamInner`) — public function validates, private does work

**Return Values:**
- `Promise<void>` for commands (side-effect only)
- `Promise<string>` for status checks returning simple values
- `Promise<QuicklifyResult<T>>` for core operations that can fail gracefully
- `McpResponse` for all MCP tool handlers (never throws)
- Predicates return `boolean`; guard functions return `void` (throw on violation)

## Module Design

**Exports:**
- Named exports only — no default exports from project source files
- Types exported alongside implementations (same file or `src/types/index.ts`)
- Exported for testing: `export { CONFIG_DIR, SERVERS_FILE, BACKUPS_DIR }` in `src/utils/config.ts`

**Barrel Files:**
- None. Consumers import directly from the module path.
- `src/types/index.ts` serves as the single type registry — all shared interfaces live here.

---

*Convention analysis: 2026-03-02*
