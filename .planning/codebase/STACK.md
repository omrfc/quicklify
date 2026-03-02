# Technology Stack

**Analysis Date:** 2026-03-02

## Languages

**Primary:**
- TypeScript 5.9.x - All source code in `src/`, compiled to `dist/`

**Secondary:**
- Bash - cloud-init scripts generated at runtime (`src/utils/cloudInit.ts`) and provisioned to servers via cloud provider user-data

## Runtime

**Environment:**
- Node.js >= 20.0.0 (tested on 20 and 22 via CI matrix)
- Current dev environment: Node.js v24.12.0

**Package Manager:**
- npm 11.6.2
- Lockfile: `package-lock.json` present (committed, required by CI `npm ci`)

## Module System

**Format:** ESM (`"type": "module"` in `package.json`)
- Entry point: `dist/index.js` (main), `dist/mcp/index.js` (MCP server)
- Bin wrappers in `bin/quicklify` and `bin/quicklify-mcp` use dynamic `import()` to load from `dist/`
- Test tsconfig switches to CommonJS to satisfy ts-jest (`tsconfig.test.json`)
- ESM note: `__dirname` not available — use `fileURLToPath(import.meta.url)` + `path.dirname()`

## Frameworks

**CLI:**
- Commander.js ^14.0.3 - command registration, option parsing, help generation
  - Entry: `src/index.ts` — 23 commands registered
  - Interactive menu: `src/commands/interactive.ts` — no-arg fallback with categorized menu

**Interactive Prompts:**
- Inquirer.js ^12.3.2 - all interactive prompts (provider selection, name, region, size)
  - Usage pattern: `src/utils/prompts.ts`, `src/utils/serverSelect.ts`

**MCP Protocol:**
- @modelcontextprotocol/sdk ^1.27.1 - Model Context Protocol server for AI integration
  - Server: `src/mcp/server.ts`, entry: `src/mcp/index.ts`
  - 7 registered tools: `server_info`, `server_logs`, `server_manage`, `server_maintain`, `server_secure`, `server_backup`, `server_provision`
  - Transport: stdio (JSON-RPC)

**HTTP Client:**
- Axios ^1.13.6 - all HTTP calls (cloud provider APIs, Coolify health checks, npm registry)
  - Pattern: direct `axios.get/post/delete` calls in each provider class
  - Security: `stripSensitiveData()` strips auth headers from error objects before logging

**Validation:**
- Zod ^4.3.6 - MCP tool input validation (`src/mcp/tools/*.ts`)
  - Pattern: `z.object({...})` schemas exported as `*Schema` constants alongside handlers

**Testing:**
- Jest ^30.2.0 - test runner
- ts-jest ^29.4.6 - TypeScript transform for Jest
- Config: `jest.config.cjs` (CommonJS because Jest config is pre-ESM evaluation)

**Build:**
- TypeScript compiler (`tsc`) - primary build tool
- tsx ^4.21.0 - dev mode execution (`npm run dev`)

**Linting / Formatting:**
- ESLint ^10.0.2 with `typescript-eslint` ^8.56.1
- eslint-config-prettier ^10.1.8 (disables ESLint formatting rules)
- Prettier ^3.8.1 - code formatting
- Config: `eslint.config.js` (flat config format)
- Key rule: `@typescript-eslint/no-unused-vars: error` with `argsIgnorePattern: "^_"`

## Key Dependencies

**Critical Runtime:**
- `axios` ^1.13.6 - HTTP to all 4 cloud provider REST APIs + npm registry for update checks
- `commander` ^14.0.3 - CLI framework, all command routing
- `inquirer` ^12.3.2 - interactive prompts for user input
- `@modelcontextprotocol/sdk` ^1.27.1 - MCP server protocol implementation
- `zod` ^4.3.6 - input validation for MCP tools

**UI / Output:**
- `chalk` ^5.6.2 - terminal color output (`src/utils/logger.ts`)
- `ora` ^9.3.0 - spinner/progress indicators (`src/utils/logger.ts`)
- `js-yaml` ^4.1.1 - parse `quicklify.yml` deployment config files

## TypeScript Configuration

**Production (`tsconfig.json`):**
- target: `ES2022`, module: `Node16`, moduleResolution: `Node16`
- strict mode enabled
- Source: `src/`, Output: `dist/`
- Generates `.d.ts` declarations and sourcemaps

**Test (`tsconfig.test.json`):**
- Extends base config, overrides to `module: CommonJS`, `moduleResolution: Node`
- Includes `tests/` directory
- Output: `dist-test/` (not published)

## Coverage Requirements

- All branches, functions, lines, statements: minimum **80%**
- Coverage directory: `coverage/`
- Excludes: `src/index.ts` (CLI entry point)
- Run: `npm run test:coverage`

## Configuration

**Environment Variables (auth tokens — no `.env` file, must be set by user):**
- `HETZNER_TOKEN` - Hetzner Cloud API token
- `DIGITALOCEAN_TOKEN` - DigitalOcean API token
- `VULTR_TOKEN` - Vultr API token
- `LINODE_TOKEN` - Linode (Akamai) API token
- `QUICKLIFY_SAFE_MODE=true` - blocks destructive operations (destroy, restore)

**User Config (persisted between sessions):**
- `~/.quicklify/servers.json` - server registry (mode 0600)
- `~/.quicklify/backups/` - local backup archives
- `~/.quicklify/.update-check` - cached npm registry version check (mode 0600)
- Config dir created at mode `0700`

**Deployment Config (optional, per-project):**
- `quicklify.yml` - YAML config file for `--config` flag
- Keys: `template`, `provider`, `region`, `size`, `name`, `fullSetup`, `domain`
- Tokens explicitly forbidden in YAML config (security check in `src/utils/yamlConfig.ts`)

**Build:**
- `npm run build` = `tsc && chmod +x dist/index.js`
- `npm run dev` = `tsx src/index.ts` (no compilation)

## Platform Requirements

**Development:**
- Node.js >= 20.0.0
- SSH client (`ssh`, `ssh-keygen`, `ssh-keyscan`) on PATH or at Windows system locations
- Optional: `dig` or `getent` for DNS checks (used on remote servers, not locally)

**Production / Installation:**
- Distributed as global npm package: `npm install -g quicklify`
- Cross-platform: macOS, Linux, Windows (SSH path resolution handles Windows paths)
- SSH binary discovery: checks `%SystemRoot%\System32\OpenSSH\ssh.exe`, `Program Files\OpenSSH`, Git for Windows

## CI

**GitHub Actions matrix:**
- OS: ubuntu-latest, macos-latest, windows-latest
- Node: 20, 22
- Steps: `npm ci` → `npm run build` → `npm run lint` → `npm run test:coverage`

---

*Stack analysis: 2026-03-02*
