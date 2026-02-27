# Technology Stack

**Analysis Date:** 2026-02-27

## Languages

**Primary:**
- TypeScript 5.9.3 - CLI application, MCP server, provider clients, utilities
- JavaScript - Configuration files (jest.config.cjs, eslint.config.js), shell scripts in cloud-init

**Secondary:**
- Bash - Cloud-init scripts for server provisioning and firewall configuration

## Runtime

**Environment:**
- Node.js 20.0.0 or higher (specified in `package.json` engines field)
- Current development: Node v24.12.0

**Package Manager:**
- npm 11.6.2 (or compatible)
- Lockfile: `package-lock.json` (lockfileVersion 3)

## Frameworks

**Core CLI:**
- Commander.js 14.0.3 - CLI command parsing and routing
- Inquirer.js 12.3.2 - Interactive prompts and selections

**MCP (Model Context Protocol):**
- @modelcontextprotocol/sdk 1.27.1 - MCP server implementation for Claude integration

**Infrastructure & Utilities:**
- Axios 1.13.5 - HTTP client for cloud provider APIs
- js-yaml 4.1.1 - YAML parsing and serialization
- Chalk 5.6.2 - Terminal text coloring for CLI output
- Ora 9.3.0 - Terminal spinner for loading states
- Zod 4.3.6 - Schema validation for environment variables and user input

**Testing:**
- Jest 30.2.0 - Test runner and framework
- ts-jest 29.4.6 - TypeScript to JavaScript compiler for Jest
- @types/jest 30.0.0 - TypeScript definitions for Jest

**Build & Development:**
- TypeScript 5.9.3 - Language compiler
- tsx 4.21.0 - TypeScript execution for development (`npm run dev`)
- Prettier 3.8.1 - Code formatter
- ESLint 10.0.0 - Linter with TypeScript support
- typescript-eslint 8.56.0 - TypeScript-specific ESLint rules
- @eslint/js 10.0.1 - ESLint JavaScript rules
- eslint-config-prettier 10.1.8 - Prettier integration with ESLint

## Key Dependencies

**Critical:**
- Axios 1.13.5 - Communicates with Hetzner, DigitalOcean, Vultr, and Linode cloud APIs
- @modelcontextprotocol/sdk 1.27.1 - Enables Claude integration via MCP protocol for server management tools

**Infrastructure:**
- Commander.js 14.0.3 - Routes 23 CLI commands (init, provision, destroy, secure, domain, firewall, backup, maintain, etc.)
- Inquirer.js 12.3.2 - Interactive selection for provider, region, size, and configuration choices
- js-yaml 4.1.1 - Loads server configuration from YAML files
- Zod 4.3.6 - Validates API tokens and configuration inputs before cloud provider calls
- Chalk 5.6.2 - Colored output for status messages (success, error, warning)
- Ora 9.3.0 - Spinners for long-running operations (API calls, SSH commands)

**SSH & Local Config:**
- Child process (Node.js built-in) - Spawns SSH commands to servers at `root@{ip}`
- File system (Node.js built-in) - Stores server records in `~/.quicklify/servers.json`, backups in `~/.quicklify/backups/`

## Configuration

**Environment:**
- Cloud provider API tokens configured as environment variables:
  - `HETZNER_TOKEN` - Hetzner Cloud API token
  - `DIGITALOCEAN_TOKEN` - DigitalOcean API token
  - `VULTR_TOKEN` - Vultr API token
  - `LINODE_TOKEN` - Linode (Akamai) API token
- CLI accepts `--token` flag as fallback (not recommended, visible in shell history)
- Safety mode: `QUICKLIFY_SAFE_MODE=true` blocks destructive operations (destroy, restore)

**Build:**
- `tsconfig.json` - TypeScript compiler options (ES2022 target, Node16 module resolution, strict mode)
- `tsconfig.test.json` - Separate TypeScript config for tests (less strict for testing patterns)
- `jest.config.cjs` - Jest configuration with ts-jest transformer, 80% coverage threshold
- `.prettierrc` - Prettier formatting (100 char width, 2-space indent, trailing commas)
- `eslint.config.js` - ESLint configuration with TypeScript rules and Prettier integration
- `.npmignore` / `package.json` files array - Publishes `bin/`, `dist/`, `README.md`, `LICENSE`, `SECURITY.md`

## Platform Requirements

**Development:**
- Operating System: Linux, macOS, Windows (with Git Bash or WSL2)
- SSH client available (`ssh` command)
- Git for version control
- Node.js 20+ installed

**Production (npm package):**
- Node.js 20+ runtime
- SSH client installed on system
- Network access to cloud provider APIs (Hetzner, DigitalOcean, Vultr, Linode)
- Valid API tokens for at least one cloud provider

**Server Target (Coolify deployment):**
- Ubuntu/Debian-based Linux OS (cloud-init scripts use apt-get)
- Minimum 2GB RAM, 1 CPU (typical for Coolify)
- Open ports: 22 (SSH), 80 (HTTP), 443 (HTTPS), 8000 (Coolify UI), 6001-6002 (Coolify services)

## Build Output

**Entry Points:**
- `bin/quicklify` - Main CLI binary (shebang: `#!/usr/bin/env node`)
- `bin/quicklify-mcp` - MCP server binary for Claude integration
- `dist/index.js` - Compiled main CLI (post-build)
- `dist/mcp/server.js` - Compiled MCP server (post-build)

**Build Process:**
```bash
npm run build  # tsc && chmod +x dist/index.js
```

---

*Stack analysis: 2026-02-27*
