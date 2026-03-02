# External Integrations

**Analysis Date:** 2026-03-02

## Cloud Provider APIs

All four providers share the same `CloudProvider` interface (`src/providers/base.ts`). Each is a class that wraps Axios calls to the provider's REST API. Auth is via Bearer token passed at construction time from env vars.

**Hetzner Cloud:**
- Base URL: `https://api.hetzner.cloud/v1`
- Client: `src/providers/hetzner.ts` — `HetznerProvider` class
- Auth env var: `HETZNER_TOKEN`
- Operations: list/create/destroy/reboot servers, upload SSH keys, create/list/delete snapshots, list locations and server types
- Token validation: `GET /servers` (200 = valid)
- Server creation: Ubuntu 24.04 image, user-data (cloud-init)
- Snapshot pricing: `€0.006/GB/mo` (computed client-side)
- IP wait: up to 30s (10 attempts × 3s)

**DigitalOcean:**
- Base URL: `https://api.digitalocean.com/v2`
- Client: `src/providers/digitalocean.ts` — `DigitalOceanProvider` class
- Auth env var: `DIGITALOCEAN_TOKEN`
- Operations: same interface as Hetzner — droplet CRUD, SSH keys, snapshots, regions, sizes
- Token validation: `GET /account`
- IP wait: up to 60s (20 attempts × 3s)

**Vultr:**
- Base URL: `https://api.vultr.com/v2`
- Client: `src/providers/vultr.ts` — `VultrProvider` class
- Auth env var: `VULTR_TOKEN`
- Operations: same interface — instance CRUD, SSH keys, snapshots, regions, plans
- Token validation: `GET /account`
- IP wait: up to 200s (40 attempts × 5s) — slowest IP assignment of all providers

**Linode (Akamai):**
- Base URL: `https://api.linode.com/v4`
- Client: `src/providers/linode.ts` — `LinodeProvider` class
- Auth env var: `LINODE_TOKEN`
- Operations: same interface — linode CRUD, SSH keys, snapshots, regions, types
- Token validation: `GET /profile`
- Note: uses `crypto` module for SSH key generation on Linode-specific flow
- IP wait: up to 150s (30 attempts × 5s)

**Provider Factory:**
- `src/utils/providerFactory.ts` — `createProviderWithToken(name, token)` returns the correct provider instance
- Provider name strings: `"hetzner"`, `"digitalocean"`, `"vultr"`, `"linode"`
- Token resolution: `src/core/tokens.ts` — reads env vars `HETZNER_TOKEN`, `DIGITALOCEAN_TOKEN`, `VULTR_TOKEN`, `LINODE_TOKEN`

**Security — sensitive data stripping:**
- Every provider has a local `stripSensitiveData(error)` function that removes `config.headers` and `config.data` from Axios errors before they propagate, preventing token leakage in error messages or logs

## SSH (Remote Server Management)

All server management operations after provisioning use native SSH via Node.js `child_process`. There is no SSH library dependency.

**Client:** `src/utils/ssh.ts`
- `sshExec(ip, command)` — captures stdout/stderr, returns `{code, stdout, stderr}`
- `sshStream(ip, command)` — streams output to terminal (used for logs, interactive commands)
- `sshConnect(ip)` — opens interactive SSH session
- `assertValidIp(ip)` — regex + octet range validation before any SSH call (injection prevention)
- `sanitizedEnv()` — strips `TOKEN`, `SECRET`, `PASSWORD`, `CREDENTIAL` env vars before spawning SSH subprocess
- Host key handling: detects `Host key verification failed` error, calls `ssh-keygen -R <ip>` to remove stale entry, then retries once
- Timeouts: connect = 10s, exec = 30s, stream = 120s
- Buffer cap: 1MB max on stdout/stderr capture

**SSH Key Management:** `src/utils/sshKey.ts`
- `findLocalSshKey()` — searches `~/.ssh/id_ed25519.pub`, `id_rsa.pub`, `id_ecdsa.pub`
- `generateSshKey()` — runs `ssh-keygen -t ed25519` with `sanitizedEnv()`, saves to `~/.ssh/id_ed25519`
- `getSshKeyName()` — returns `quicklify-{timestamp}`
- Keys uploaded to provider during `quicklify init` via `provider.uploadSshKey()`

**SSH operations used by core modules:**
- `src/core/backup.ts` — `sshExec` to run `pg_dump`, `tar`, `scp`-style transfer
- `src/core/secure.ts` — `sshExec` to read `/etc/ssh/sshd_config`, check fail2ban status
- `src/core/domain.ts` — `sshExec` to run psql in Coolify DB container, restart Docker Compose
- `src/core/logs.ts` — `sshStream` to tail journald or Docker logs
- `src/core/maintain.ts` — `sshStream` to run Coolify update installer
- `src/core/firewall.ts` — `sshExec` to manage UFW rules

## MCP (Model Context Protocol)

Quicklify exposes a secondary binary `quicklify-mcp` that runs as an MCP server for AI assistant integration (Claude Desktop, etc.).

**SDK:** `@modelcontextprotocol/sdk` ^1.27.1
- Server class: `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
- Transport: stdio (JSON-RPC over stdin/stdout)
- Server entry: `src/mcp/index.ts`, factory: `src/mcp/server.ts`

**Registered Tools (7):**
| Tool | File | Actions |
|------|------|---------|
| `server_info` | `src/mcp/tools/serverInfo.ts` | list, status, health, sizes |
| `server_logs` | `src/mcp/tools/serverLogs.ts` | logs, monitor |
| `server_manage` | `src/mcp/tools/serverManage.ts` | add, remove, destroy |
| `server_maintain` | `src/mcp/tools/serverMaintain.ts` | update, restart, maintain |
| `server_secure` | `src/mcp/tools/serverSecure.ts` | secure-setup, secure-audit, firewall-*, domain-* |
| `server_backup` | `src/mcp/tools/serverBackup.ts` | backup-create/list/restore, snapshot-* |
| `server_provision` | `src/mcp/tools/serverProvision.ts` | provision new server |

**MCP Auth pattern:**
- Provider API tokens passed as env vars when launching `quicklify-mcp` (e.g. `HETZNER_TOKEN=xxx quicklify-mcp`)
- `src/mcp/utils.ts` — `requireProviderToken(provider)` reads from env, returns `McpError` if missing
- `QUICKLIFY_SAFE_MODE=true` env var blocks destructive MCP operations (destroy, restore, provision)

**MCP stdin isolation:**
- SSH `spawn()` calls use `stdio: ["ignore", ...]` to prevent MCP's JSON-RPC stdin from leaking into SSH processes

## npm Registry

**Purpose:** Update check — compares installed version against latest published version.

- Endpoint: `GET https://registry.npmjs.org/quicklify/latest`
- Client: Axios with 3-second timeout
- Caching: result stored in `~/.quicklify/.update-check` (JSON with `lastCheck` timestamp)
- Check interval: 24 hours (only fetches once per day)
- Never blocks startup — all errors silently caught
- Implementation: `src/utils/updateCheck.ts`

## Coolify (Self-Hosted Platform)

Quicklify provisions and manages Coolify instances. Coolify itself is an external dependency installed on managed servers.

**Installation:**
- cloud-init script (`src/utils/cloudInit.ts` → `getCoolifyCloudInit()`) runs on first boot:
  - Fetches and executes `https://cdn.coollabs.io/coolify/install.sh` via curl
  - Constant: `COOLIFY_UPDATE_CMD = "curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash"` (`src/constants.ts`)

**Health check:**
- `src/utils/healthCheck.ts` — polls `http://{ip}:8000` with Axios (5s timeout per attempt)
- Min wait before first check: Hetzner 60s, DigitalOcean/Linode 120s, Vultr 180s (from `src/constants.ts`)

**Coolify internals accessed via SSH:**
- Docker container: `coolify` (for restart), `coolify-db` (PostgreSQL)
- DB: PostgreSQL in `coolify-db` container, user `coolify`, database `coolify`
- Source dir: `/data/coolify/source` (Docker Compose files live here)
- Restart cmd: `docker compose -f docker-compose.yml -f docker-compose.prod.yml restart coolify`
- Domain config: `UPDATE instance_settings SET fqdn='...' WHERE id=0` (direct psql in container)
- Backup: `docker exec coolify-db pg_dump` + `tar` of `/data/coolify/source` config files

**Browser open (post-deploy):**
- `src/utils/openBrowser.ts` — opens `http://{ip}:8000` after successful provisioning
- Skipped in headless/CI environments (checks `CI`, `GITHUB_ACTIONS`, `SSH_CONNECTION`, `DISPLAY` env vars)
- URL validated with regex before exec (`SAFE_URL_PATTERN = /^https?:\/\/[\d.]+(?::\d+)?\/?$/`)

## Data Storage

**Databases:** None — no database dependency in the CLI itself.

**File Storage:**
- Local filesystem only
- `~/.quicklify/servers.json` — server registry (JSON array of `ServerRecord`)
- `~/.quicklify/backups/{serverName}/` — local backup archives (`.sql.gz`, `.tar.gz`)
- `~/.quicklify/.update-check` — cached version check result

**Caching:** File-based (update check only, 24h TTL)

## Authentication & Identity

**Auth Provider:** None — no user authentication in Quicklify itself.

**Provider tokens:** Passed via env vars or `--token` CLI flag. Validated against provider APIs at command time. Never stored to disk by Quicklify (tokens intentionally rejected from YAML config files with a security warning).

**Safe Mode:** `QUICKLIFY_SAFE_MODE=true` env var — blocks `destroy`, `restore`, and `provision` (MCP) operations. Checked in `src/core/manage.ts` (`isSafeMode()`) and MCP tools.

## Monitoring & Observability

**Error Tracking:** None (no Sentry, Datadog, etc.)

**Logging:**
- `src/utils/logger.ts` — `chalk`-colored console output (`info`, `success`, `error`, `warning`, `title`, `step`)
- `ora` spinners for long-running async operations (provisioning, waiting for Coolify)
- No file logging in the CLI itself
- On provisioned servers: `/var/log/quicklify-install.log` captures cloud-init output

## CI/CD & Deployment

**Package Registry:** npm (`https://registry.npmjs.org/`)
- Package name: `quicklify`
- Published: v1.2.0
- Publish trigger: `v*` git tag push → GitHub Actions publish workflow

**Hosting:** GitHub repository (`https://github.com/omrfc/quicklify`)

**CI Pipeline:** GitHub Actions
- Matrix: 3 OS (ubuntu, macos, windows) × 2 Node versions (20, 22) = 6 jobs
- Steps: `npm ci` → `npm run build` → `npm run lint` → `npm run test:coverage`
- Publish workflow: triggered on `v*` tag, runs `npm publish`

**Website:** `https://quicklify.omrfc.dev` (external, not part of this codebase)

## Webhooks & Callbacks

**Incoming:** None

**Outgoing:** None (Quicklify initiates all API calls; no webhooks sent or received)

## Environment Configuration Summary

**Required for operation (set by user):**
```
HETZNER_TOKEN          # Hetzner Cloud API token
DIGITALOCEAN_TOKEN     # DigitalOcean API token
VULTR_TOKEN            # Vultr API token
LINODE_TOKEN           # Linode API token
```

**Behavior modifiers:**
```
QUICKLIFY_SAFE_MODE=true   # Blocks destructive operations
CI / GITHUB_ACTIONS        # Detected to suppress browser open
SSH_CONNECTION / SSH_TTY   # Detected to suppress browser open
DISPLAY / WAYLAND_DISPLAY  # Detected for Linux headless check
```

**No `.env` file** — tokens must be provided via shell environment or `--token` CLI flag.

---

*Integration audit: 2026-03-02*
