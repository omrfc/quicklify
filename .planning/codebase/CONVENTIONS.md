# Coding Conventions

**Analysis Date:** 2026-02-27

## Naming Patterns

**Files:**
- Kebab-case for file names: `error-mapper.ts`, `cloud-init.ts`, `server-select.ts`
- Command files match command name: `init.ts`, `add.ts`, `remove.ts`, `status.ts`
- Utils organized by domain: `logger.ts`, `errorMapper.ts`, `config.ts`, `ssh.ts`, `serverSelect.ts`
- Suffixes denote purpose: `*.test.ts` for tests, `Factory.ts` for factory functions

**Functions:**
- camelCase for all function names: `initCommand`, `createProvider`, `validateToken`, `mapProviderError`
- Public exports prefix intent: `get*` for retrievers, `create*` for constructors, `map*` for mappers
- Async functions are clearly async: `async function validateToken()`, `async function deployServer()`
- Private/internal functions use helper naming: `uploadSshKeyToProvider`, `deployServer` (internal to init.ts)

**Variables:**
- camelCase for all variables: `providerChoice`, `apiToken`, `serverSize`, `isNonInteractive`
- Boolean flags start with `is`, `has`, `can`, `should`: `isValid`, `hasValidIp`, `shouldRetry`
- Constants in UPPER_SNAKE_CASE when module-level: `COOLIFY_RESTART_CMD`, `IP_WAIT`, `COOLIFY_MIN_WAIT`
- Collections end in plural: `failedTypes`, `failedLocations`, `servers`, `rules`

**Types:**
- PascalCase for interfaces: `CloudProvider`, `ServerRecord`, `InitOptions`, `DeploymentConfig`
- Suffix types with purpose: `*Options` for command options, `*Config` for configuration, `*Result` for results
- Union types use pipe syntax: `type TemplateName = "starter" | "production" | "dev"`
- Readonly protocol methods denoted with `interface`: `export interface CloudProvider { ... }`

## Code Style

**Formatting:**
- Prettier: `prettier@3.8.1`
- Print width: 100 characters
- Trailing commas: "all" (ES5-compatible)
- Tab width: 2 spaces
- Semicolons: required

**Linting:**
- ESLint 10 with TypeScript support: `@typescript-eslint`, `@eslint/js`
- Config: `eslint.config.js` (flat config format)
- Key rule: Unused variables trigger error unless prefixed with `_`
  ```typescript
  @typescript-eslint/no-unused-vars: ["error", { argsIgnorePattern: "^_" }]
  ```
- ESLint ignores: `dist/`, `coverage/`, `tests/`, `jest.config.cjs`

## Import Organization

**Order:**
1. Node.js built-ins: `import { readFileSync } from "fs"`
2. Third-party packages: `import axios from "axios"`, `import { Command } from "commander"`
3. Local relative imports: `import { initCommand } from "./commands/init.js"`
4. Type-only imports: `import type { ServerRecord } from "../types/index.js"`

**Path Aliases:**
- No path aliases configured. All imports use relative paths with `.js` extensions (ESM)
- Format: `import { func } from "../utils/module.js"`

**File extensions:**
- All import paths include `.js` extension (required for ESM in Node.js `"type": "module"`)
- Example: `import { saveServer } from "../utils/config.js"`

## Error Handling

**Patterns:**
- Centralized error mapping: `errorMapper.ts` provides domain-specific error handlers
- HTTP errors: `mapProviderError(error, provider)` maps API status codes to user messages
- SSH errors: `mapSshError(error, ip)` provides connection-specific guidance
- File system errors: `mapFileSystemError(error)` handles POSIX error codes
- Generic fallback: `getErrorMessage(error)` extracts string from any error type

**Strategy:**
- Errors caught with `try-catch` containing `error: unknown`
- Cast to Error type for message extraction: `error instanceof Error ? error.message : String(error)`
- Axios errors checked with `axios.isAxiosError(error)` before accessing `.response`
- Sensitive data sanitization: `sanitizeStderr()` redacts paths, IPs, passwords before logging

**Example (init.ts):**
```typescript
try {
  server = await providerWithToken.createServer({...});
  serverSpinner.succeed(`Server created (ID: ${server.id})`);
} catch (createError: unknown) {
  serverSpinner.fail("Server creation failed");
  const errorMsg = getErrorMessage(createError);

  if (errorMsg.includes("already")) {
    // Handle specific case
  } else {
    throw createError; // Re-throw if unhandled
  }
}
```

## Logging

**Framework:** Custom logger object in `src/utils/logger.ts`

**API:**
```typescript
logger.info(message)      // ℹ blue info
logger.success(message)   // ✔ green success
logger.error(message)     // ✖ red error
logger.warning(message)   // ⚠ yellow warning
logger.title(message)     // Bold cyan with blank lines around
logger.step(message)      // → gray step indicator
```

**Spinner:**
```typescript
const spinner = createSpinner("Loading...");
spinner.start();
spinner.succeed("Done!");     // or .fail(), .warn()
```

**Patterns:**
- One-liner status updates via spinners for operations
- Multi-step processes logged as `logger.title()` → steps → `logger.step()`
- Errors logged immediately when caught: `logger.error(getErrorMessage(error))`
- CLI commands end with summary: `logger.success()` or `logger.error()` + context

**Example (add.ts):**
```typescript
const verifySpinner = ora("Verifying Coolify installation...").start();
try {
  const result = await sshExec(serverIp, "curl -s ...");
  if (result.code === 0) {
    verifySpinner.succeed("Coolify is running");
  }
} catch {
  verifySpinner.warn("Could not verify Coolify. Server added anyway.");
}
```

## Comments

**When to Comment:**
- Complex algorithm logic (e.g., IP wait configuration with provider-specific timing)
- Non-obvious error handling branches (e.g., why certain API errors are retried)
- Provider-specific quirks (e.g., "DO/Vultr/Linode assign IP after boot")
- Magic numbers with reasoning (e.g., "30s timeout based on typical boot time")

**JSDoc/TSDoc:**
- Used for exported functions and types
- Include `@param`, `@returns`, `@throws` for clarity
- Not consistently enforced but present in core modules

**Example (init.ts line 28-34):**
```typescript
// Provider-specific IP wait configuration (IP assignment latency varies significantly)
const IP_WAIT: Record<string, { attempts: number; interval: number }> = {
  hetzner:      { attempts: 10, interval: 3000 },   // 30s (instant IP)
  digitalocean: { attempts: 20, interval: 3000 },   // 60s
  vultr:        { attempts: 40, interval: 5000 },   // 200s (slowest IP assignment)
  linode:       { attempts: 30, interval: 5000 },   // 150s
};
```

## Function Design

**Size:** Aim for single-responsibility functions under 150 lines. Complex flows broken into sub-functions.

**Parameters:**
- Named options objects preferred over positional: `options: InitOptions = {}`
- Destructured in function body when needed
- Type annotations required on all params

**Return Values:**
- Explicit return types on all functions: `async function deployServer(...): Promise<void>`
- Void used for side-effect functions (logging, saving files)
- Never return `null` — use `undefined` or throw error

**Example (init.ts line 44-68):**
```typescript
export async function initCommand(options: InitOptions = {}): Promise<void> {
  // Load YAML config if --config flag provided
  if (options.config) {
    const { config: yamlConfig, warnings } = loadYamlConfig(options.config);
    for (const w of warnings) {
      logger.warning(w);
    }
    const merged = mergeConfig(options, yamlConfig);
    // Apply merged values back to options
    if (merged.provider && !options.provider) options.provider = merged.provider;
    ...
  }
}
```

## Module Design

**Exports:**
- Named exports for functions: `export function initCommand() {}`
- Default exports avoided (single purpose per file)
- Types exported with `export interface`, `export type`

**Barrel Files:**
- No barrel files (index.ts) in src/commands/ or src/utils/
- Each module imported directly from its file path
- Main entry in `src/index.ts` imports 23 command functions explicitly

**Closures & Scoping:**
- Constants declared at module top: `const IP_WAIT`, `const COOLIFY_MIN_WAIT`
- Helper functions declared before public export
- No shared mutable state between invocations

**Example (errorMapper.ts structure):**
```typescript
// Module constants
const PROVIDER_URLS: Record<string, ProviderUrls> = { ... };
const SENSITIVE_PATTERNS = [ ... ];
const FS_ERROR_CODES: Record<string, string> = { ... };

// Exported utilities
export function getProviderDisplayName(provider: string): string { ... }
export function mapProviderError(error: unknown, provider: string): string { ... }
export function getErrorMessage(error: unknown): string { ... }
```

---

*Convention analysis: 2026-02-27*
