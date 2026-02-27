# External Integrations

**Analysis Date:** 2026-02-27

## APIs & External Services

**Cloud Providers:**
- **Hetzner Cloud** - Infrastructure provider
  - SDK/Client: Axios (custom wrapper at `src/providers/hetzner.ts`)
  - Auth: `HETZNER_TOKEN` env variable (API token)
  - Base URL: `https://api.hetzner.cloud/v1`
  - Endpoints: /servers, /ssh_keys, /locations, /datacenters, /images, /server_actions

- **DigitalOcean** - Infrastructure provider
  - SDK/Client: Axios (custom wrapper at `src/providers/digitalocean.ts`)
  - Auth: `DIGITALOCEAN_TOKEN` env variable (API token)
  - Base URL: `https://api.digitalocean.com/v2`
  - Endpoints: /droplets, /account, /account/keys, /regions, /sizes, /snapshots

- **Vultr** - Infrastructure provider
  - SDK/Client: Axios (custom wrapper at `src/providers/vultr.ts`)
  - Auth: `VULTR_TOKEN` env variable (API token)
  - Base URL: `https://api.vultr.com/v2`
  - Endpoints: /instances, /ssh-keys, /regions, /plans, /snapshots

- **Linode (Akamai)** - Infrastructure provider (beta status)
  - SDK/Client: Axios (custom wrapper at `src/providers/linode.ts`)
  - Auth: `LINODE_TOKEN` env variable (API token)
  - Base URL: `https://api.linode.com/v4`
  - Endpoints: /linode/instances, /profile/sshkeys, /regions, /linode/types, /images

**Coolify Platform:**
- **Coolify Installation** - Self-hosted PaaS platform
  - Installation script: `https://cdn.coollabs.io/coolify/install.sh`
  - Auto-install: Cloud-init script downloads and pipes to bash during server provisioning
  - Update command: `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`
  - Web UI: Accessed at `http://{server-ip}:8000` after provisioning
  - Requires: SSH access to server for management and updates

## Data Storage

**Databases:**
- **None** - Quicklify is a stateless CLI tool
- **Local Configuration:** JSON file-based (`~/.quicklify/servers.json`)
  - Format: JSON array of ServerRecord objects
  - Permissions: 0o600 (read/write owner only)
  - Storage: User's home directory
  - Client: Node.js fs module (built-in)

**File Storage:**
- **Local filesystem only**
  - Server records: `~/.quicklify/servers.json`
  - Backups directory: `~/.quicklify/backups/` (Coolify DB dumps + config)
  - Installation logs: `/var/log/quicklify-install.log` (on remote server)
  - Permissions: Restrictive (0o700 for directories, 0o600 for files)

**Caching:**
- None - Quicklify fetches fresh data from provider APIs on each command

## Authentication & Identity

**Cloud Provider Authentication:**
- **Type:** API token-based (Bearer token)
- **Implementation:**
  - Tokens passed as Authorization header: `Authorization: Bearer {token}`
  - Stored: Environment variables only (not persisted to config file)
  - Validation: `provider.validateToken(token)` calls provider API endpoint
  - Validation endpoints:
    - Hetzner: `GET /servers?per_page=1`
    - DigitalOcean: `GET /account`
    - Vultr: `GET /account`
    - Linode: `GET /profile`

**SSH Authentication (Server Access):**
- **Type:** Public key (SSH key pair)
- **Key Generation:**
  - Automatic: Generated during `init` (provision) if not provided
  - Manual: User can provide existing key via `--ssh-key-path`
  - Auto-generated keys stored: Cloud provider (uploaded by Quicklify)
- **Connection:**
  - SSH command: `ssh -o StrictHostKeyChecking=accept-new root@{ip}`
  - Strictness: Auto-accepts new host keys (suitable for newly provisioned servers)
  - Runs as root: All SSH commands execute as `root@{server-ip}`

**MCP Authentication:**
- **Type:** Environment variable-based (same cloud provider tokens)
- **Access:** MCP tools require provider API tokens in environment for status checks
- **Use case:** Claude can call Quicklify MCP tools with same credentials as CLI

## Monitoring & Observability

**Error Tracking:**
- None - Errors logged to stderr and displayed in terminal

**Logs:**
- **CLI Output:**
  - Colored terminal output via Chalk (info, success, error, warning)
  - Spinners via Ora for long-running operations
  - No persistent logging (output goes to stdout/stderr only)
- **Server Logs:**
  - Coolify container logs: fetched via SSH `docker logs coolify`
  - Docker service logs: fetched via SSH systemctl journal
  - System journal: fetched via SSH `journalctl`
- **Cloud-Init Logs:**
  - Location: `/var/log/quicklify-install.log` on newly provisioned servers
  - Captured during provisioning for debugging installation failures
- **Security Audit Output:**
  - Scores and findings printed to terminal (no storage)

## CI/CD & Deployment

**Hosting:**
- **Distribution:** npm package registry (npmjs.org)
- **Package name:** `quicklify`
- **Installation:** `npm install -g quicklify` or `npx quicklify`
- **Repository:** GitHub (omrfc/quicklify)

**CI Pipeline:**
- **Service:** GitHub Actions
- **Trigger:** Push to main, pull requests, manual workflow dispatch
- **Matrix:** 3 OS (ubuntu-latest, macos-latest, windows-latest) x 2 Node versions (20, 22)
- **Workflow steps:**
  - Checkout code
  - Setup Node.js
  - Install dependencies
  - Lint (`npm run lint`)
  - Build (`npm run build`)
  - Test (`npm run test`)
  - Coverage check (80% threshold)
  - Publish to npm (on version tags)
- **Release:** Tag push (`v*`) triggers automatic npm publish

## Environment Configuration

**Required env vars:**
- At least one of: `HETZNER_TOKEN`, `DIGITALOCEAN_TOKEN`, `VULTR_TOKEN`, or `LINODE_TOKEN`
- Optional: `QUICKLIFY_SAFE_MODE=true` (blocks destructive operations)

**Security env vars (sanitized from SSH context):**
- Tokens, secrets, passwords, credentials automatically removed from child process environment
- Implementation: `sanitizedEnv()` function filters process.env before SSH execution

**Secrets location:**
- Cloud provider tokens: Environment variables (not committed to git, `.gitignore` enforces)
- SSH keys: Stored on cloud provider during provisioning
- Server config: Local file `~/.quicklify/servers.json` (readable by owner only)

## Webhooks & Callbacks

**Incoming:**
- None - Quicklify is CLI-driven, no webhook receivers

**Outgoing:**
- None - No webhook notifications sent
- **Alternative:** Coolify itself may have webhook support for deployed applications (outside Quicklify scope)

## Rate Limiting

**Cloud Provider Rate Limits:**
- **Hetzner:** No strict rate limits documented, standard API rate limiting applies
- **DigitalOcean:** 5000 requests/hour per API token
- **Vultr:** 360 requests/minute per API key
- **Linode:** 4 requests/second per token
- **Mitigation:** MCP server tool descriptions warn against repeated calls in short intervals

## API Error Handling

**Error Mapping:** `src/utils/errorMapper.ts`
- HTTP status codes mapped to user-friendly messages
- Provider-specific errors (409 conflicts, 422 validation errors) handled with retry logic
- SSH errors caught and mapped (connection refused, timeout, permission denied)
- Axios error detection: `axios.isAxiosError()` type guards

**Validation:**
- IP address validation: `assertValidIp()` checks octet ranges before SSH
- Port validation: `validatePort()` ensures 1-65535 range
- Token validation: Provider API endpoint calls to confirm token validity
- Zod schema validation: Environment variables and user input validated against schemas

---

*Integration audit: 2026-02-27*
