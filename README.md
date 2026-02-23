# quicklify

> English | [Türkçe](README.tr.md)

![Tests](https://github.com/omrfc/quicklify/actions/workflows/ci.yml/badge.svg)
[![Coverage](https://codecov.io/gh/omrfc/quicklify/branch/main/graph/badge.svg)](https://codecov.io/gh/omrfc/quicklify)
![npm](https://img.shields.io/npm/v/quicklify)
![Downloads](https://img.shields.io/npm/dw/quicklify)
![License](https://img.shields.io/badge/license-MIT-blue)
![GitHub stars](https://img.shields.io/github/stars/omrfc/quicklify?style=flat-square)
[![Socket Badge](https://socket.dev/api/badge/npm/package/quicklify)](https://socket.dev/npm/package/quicklify)

> Deploy Coolify to a cloud VPS with one command

## 🚀 What is Quicklify?

Quicklify is a CLI tool that automates [Coolify](https://coolify.io/) deployment on cloud VPS providers. Coolify is an open-source, self-hosted alternative to Vercel/Netlify/Heroku — and Quicklify gets it running on your VPS with one command.

**Before Quicklify:**

```
Create VPS manually (5 min)
SSH into server (2 min)
Install Docker (10 min)
Configure firewall (5 min)
Install Coolify (10 min)
Total: ~30 minutes + manual work
```

**With Quicklify:**

```bash
npx quicklify init
# Hetzner: ~4 min | DigitalOcean: ~6 min | Vultr: ~5 min | Linode: ~6 min
# Zero manual work ✨
```

## ✨ Features

- 🎯 **One Command Deploy** - VPS + Coolify with a single command
- 💰 **Cost Savings** - $50-200/mo (Vercel/Netlify) → €3.79/mo
- 🔒 **Secure by Default** - Automated security setup
- 🌍 **Multi-Cloud** - Hetzner Cloud, DigitalOcean, Vultr, Linode
- 💻 **Beautiful CLI** - Interactive prompts with validation
- 🎨 **ARM64 Ready** - Support for cost-effective ARM servers
- ⚡ **Fast Setup** - Hetzner ~4 min, DigitalOcean ~6 min, Vultr ~5 min, Linode ~6 min
- ✨ **Dynamic Server Types** - Only shows compatible types for selected location
- 🔥 **Auto Firewall** - Ports 8000, 22, 80, 443 configured automatically
- 🚀 **Zero SSH Required** - Opens directly in browser after deployment
- 📋 **Server Management** - List, status check, destroy, restart, backup, restore commands
- 🔧 **Default Config** - Set defaults to skip repetitive prompts
- 🔑 **SSH Access** - Connect to servers or run remote commands
- 🔄 **Coolify Update** - Update Coolify with one command
- 🏥 **Health Check Polling** - Detects when Coolify is ready (no more blind waiting)
- 📊 **Server Monitoring** - CPU/RAM/Disk usage and Docker container status
- 📜 **Log Viewer** - View Coolify, Docker, or system logs with follow mode
- 🩺 **Environment Doctor** - Diagnose local setup issues
- 🫀 **Bulk Health Check** - Check all servers at once
- 🔥 **Firewall Management** - UFW setup, add/remove ports, protected port safety
- 🌐 **Domain Management** - Bind domains, DNS check, auto SSL via Coolify
- 🛡️ **SSH Hardening** - Disable password auth, fail2ban, security audit with score
- 🧪 **Dry-Run Mode** - Preview commands on firewall/domain/secure/backup/restore before executing
- 💾 **Backup & Restore** - Database + config backup with SCP download, restore with double confirmation
- 📦 **Export/Import** - Transfer server list between machines as JSON
- ⚡ **Full Setup** - `--full-setup` flag auto-configures firewall + SSH hardening after deploy
- 📄 **YAML Config** - `quicklify init --config quicklify.yml` for one-command deploy
- 📋 **Templates** - `--template starter|production|dev` with per-provider defaults
- 🤖 **Non-Interactive Mode** - CI/CD friendly with `--provider --token --region --size --name` flags
- ➕ **Add Existing Servers** - `quicklify add` to register existing Coolify servers
- 🔄 **Bulk Operations** - `--all` flag for status, update, backup across all servers
- 🔁 **Auto-Restart** - `status --autostart` restarts Coolify if server is running but Coolify is down
- 🔧 **Full Maintenance** - `quicklify maintain` runs status, update, health check, reboot in sequence

## 🎯 What Can You Do with Quicklify?

### Deploy a Coolify Server in Minutes

```bash
npx quicklify init                              # Interactive setup
npx quicklify init --provider hetzner --full-setup  # With auto firewall + SSH hardening
npx quicklify init --template production         # Production-ready defaults
npx quicklify init --config quicklify.yml        # From YAML config file
```

### Manage Your Servers

```bash
quicklify list                    # List all registered servers
quicklify status my-server        # Check server + Coolify status
quicklify status --all            # Check all servers at once
quicklify ssh my-server           # SSH into a server
quicklify ssh my-server -c "uptime"  # Run a remote command
```

### Keep Everything Updated & Healthy

```bash
quicklify update my-server        # Update Coolify to latest version
quicklify restart my-server       # Reboot the server
quicklify maintain my-server      # Full maintenance: status → update → health → reboot
quicklify maintain --all          # Maintain all servers sequentially
quicklify health                  # Quick health check for all servers
```

### Backup & Restore

```bash
quicklify backup my-server        # Backup database + config files
quicklify backup --all            # Backup all servers
quicklify restore my-server       # Restore from a backup
quicklify export servers.json     # Export server list
quicklify import servers.json     # Import on another machine
```

### Security & Networking

```bash
quicklify firewall setup my-server    # Configure UFW with Coolify ports
quicklify domain add my-server --domain coolify.example.com  # Bind domain + SSL
quicklify secure setup my-server      # SSH hardening + fail2ban
quicklify secure audit my-server      # Security audit with score (0-4)
```

### Monitoring & Diagnostics

```bash
quicklify monitor my-server       # Live CPU/RAM/Disk usage
quicklify logs my-server -f       # Follow Coolify logs in real-time
quicklify doctor                  # Check local environment
quicklify status my-server --autostart  # Auto-restart Coolify if down
```

## 📦 Installation

### Using npx (Recommended)

```bash
npx quicklify init
```

### Global Installation

```bash
npm install -g quicklify
quicklify init
```

## 🎬 Quick Start

### Step 1: Get API Token

**Hetzner Cloud:**

1. Visit [Hetzner Console](https://console.hetzner.cloud/)
2. Select your project
3. Navigate to Security → API Tokens
4. Click "Generate API Token"
5. Set permissions to **Read & Write**
6. Copy the token (shown only once!)

**DigitalOcean:**

1. Visit [DigitalOcean API](https://cloud.digitalocean.com/account/api/tokens)
2. Generate New Token with **Read & Write** scope
3. Copy the token

**Vultr:**

1. Visit [Vultr API](https://my.vultr.com/settings/#settingsapi)
2. Enable API and copy the API Key
3. Whitelist your IP address

**Linode (Akamai):** ⚠️ *Beta — not yet tested with real deployments*

1. Visit [Linode API Tokens](https://cloud.linode.com/profile/tokens)
2. Create a Personal Access Token with **Read/Write** scope
3. Copy the token

### Step 2: Deploy Coolify

```bash
npx quicklify init
```

You'll be prompted for:

- ✅ **API Token** - Paste your cloud provider token
- ✅ **Region** - Select datacenter location
- ✅ **Server Size** - Choose VPS specs (CAX11 recommended)
- ✅ **Server Name** - Name your instance

### Step 3: Access Coolify

After deployment (Hetzner ~4 min, DigitalOcean ~6 min, Vultr ~5 min, Linode ~6 min):

```
✅ Deployment Successful!
Server IP: 123.45.67.89
Access Coolify: http://123.45.67.89:8000
```

Visit the URL, create your admin account, and start deploying!

## 🔒 Security Notes

**Important:** Port 8000 is publicly accessible after deployment.

**Recommended next steps:**
1. **One-command setup:** `quicklify init --full-setup` (auto-configures firewall + SSH hardening)
2. **Or manually:** `quicklify firewall setup my-server`
3. **Add a domain:** `quicklify domain add my-server --domain example.com`
4. **Harden SSH:** `quicklify secure setup my-server`
5. **Run security audit:** `quicklify secure audit my-server`
6. **Create a backup:** `quicklify backup my-server`
7. Set a **strong password** on first login
8. Consider **Cloudflare** for DDoS protection

## 🌐 Supported Providers

| Provider | Status | Starting Price | Architecture |
|----------|--------|----------------|--------------|
| **Hetzner Cloud** | ✅ Available | €3.79/mo | ARM64 + x86 |
| **DigitalOcean** | ✅ Available | $12/mo | x86 |
| **Vultr** | ✅ Available | $6/mo | x86 |
| **Linode (Akamai)** | ⚠️ Beta | $12/mo | x86 |

> **Note:** Linode support is in **beta** — it has not been tested with real deployments yet. Please [report any issues](https://github.com/omrfrkcpr/quicklify/issues).

## 💡 Use Cases

**Perfect for:**

- 🚀 Side projects and MVPs
- 💼 Client deployments (freelancers/agencies)
- 🎓 Learning DevOps and self-hosting
- 💸 Cutting cloud hosting costs
- 🏢 Small team internal tools

**When to use alternatives:**

- Large enterprise? → Coolify Cloud or enterprise PaaS
- Extreme scale? → Kubernetes + managed services

## 📊 Cost Comparison

| Solution | Monthly Cost | Setup Time | Management |
|----------|--------------|------------|------------|
| Vercel (Hobby) | $20+ | 5 min | Easy |
| Vercel (Pro) | $50+ | 5 min | Easy |
| Netlify (Pro) | $19+ | 5 min | Easy |
| **Quicklify + Hetzner** | **€3.79** | **~4 min** | **Easy** |
| **Quicklify + DigitalOcean** | **$12** | **~6 min** | **Easy** |
| **Quicklify + Vultr** | **$6** | **~5 min** | **Easy** |
| **Quicklify + Linode** | **$12** | **~6 min** | **Easy** |
| Manual VPS + Coolify | €3.79 | 30+ min | Hard |

**Savings: ~$180-240/year per project!** 💰

## 📋 Recent Updates

### v1.0.0 (2026-02-23)
- **New providers:** Vultr and Linode (Akamai) — 4 cloud providers now supported
- **New command:** `quicklify add` — register existing Coolify servers to Quicklify management
- **New command:** `quicklify maintain` — full maintenance cycle (status, update, health, reboot)
- **Bulk operations:** `--all` flag on `status`, `update`, `backup` — operate on all servers at once
- **Auto-restart:** `status --autostart` — restarts Coolify if server is running but Coolify is down
- **`collectProviderTokens()`** — asks for each provider's token only once across all servers
- 947 tests across 45 suites with 98%+ statement coverage, zero new dependencies

### v0.9.0 (2026-02-21)
- **YAML Config:** `quicklify init --config quicklify.yml` - deploy from a config file
- **Templates:** `--template starter|production|dev` - predefined server configurations per provider
- **Config merge:** Priority order: CLI flags > YAML config > template defaults > interactive prompts
- **Security:** Token fields in YAML are detected and warned (never store tokens in config files)
- 1 new dependency (js-yaml), 742 tests with 98%+ statement coverage

### v0.8.0 (2026-02-21)
- **New commands:** `quicklify backup`, `quicklify restore`, `quicklify export`, `quicklify import`
- **Backup:** pg_dump + config tarball, SCP download to `~/.quicklify/backups/`, manifest.json metadata
- **Restore:** Upload backup to server, stop/start Coolify, restore DB + config, double confirmation safety
- **Export/Import:** Transfer `servers.json` between machines, duplicate detection, format validation
- **`--full-setup` flag:** `quicklify init --full-setup` auto-configures firewall + SSH hardening after deploy
- Zero new dependencies, 636 tests with 98%+ statement coverage

### v0.7.0 (2026-02-20)
- **New commands:** `quicklify firewall`, `quicklify domain`, `quicklify secure`
- **Firewall management:** UFW setup, add/remove ports, protected port 22 safety, Coolify port warnings
- **Domain management:** Bind domains to Coolify, DNS A record check, auto SSL
- **SSH hardening:** Disable password auth, key-only root login, fail2ban, security audit with 0-4 score
- **Dry-run mode:** `--dry-run` flag previews all commands without executing
- Zero new dependencies, 494 tests with 97%+ statement coverage

### v0.6.0 (2026-02-20)
- **New commands:** `quicklify logs`, `quicklify monitor`, `quicklify health`, `quicklify doctor`
- **Log viewer:** View Coolify/Docker/system logs with `--follow` real-time streaming
- **Server monitoring:** CPU/RAM/Disk usage and Docker container list
- **Bulk health check:** Check all registered servers at once with response times
- **Environment doctor:** Diagnose Node.js, SSH, config issues locally
- Zero new dependencies, 354 tests with 97%+ statement coverage

### v0.5.0 (2026-02-20)
- **New commands:** `quicklify config`, `quicklify ssh`, `quicklify update`, `quicklify restart`
- **Default config:** Set defaults for provider, region, size with `quicklify config set`
- **SSH access:** Connect to servers with `quicklify ssh` or run commands with `--command`
- **Coolify updates:** Update Coolify via SSH with `quicklify update`
- **Server restart:** Reboot via provider API with `quicklify restart`
- 311 tests with 97%+ statement coverage

### v0.4.0 (2026-02-20)
- **New commands:** `quicklify list`, `quicklify status [query]`, `quicklify destroy [query]`
- **Non-interactive mode:** `quicklify init --provider --token --region --size --name` for CI/CD
- **Health check polling:** Detects when Coolify is ready instead of blind waiting
- 246 tests with 97%+ statement coverage

### v0.3.1 (2026-02-19)
- Hetzner pricing now shows net prices (excl. VAT), matching website display
- Hetzner server types use `/datacenters` API for real availability per location
- Replaced deprecated Hetzner server types (cpx→cx23/cx33)
- "Server name already used" error now prompts for a new name
- Location disabled retry now re-prompts for server type

### v0.3.0 (2026-02-19)
- DigitalOcean provider support (full API integration)
- Interactive provider selection (Hetzner / DigitalOcean)
- Step-based back navigation in all prompts
- Network wait loop + install logging for DigitalOcean cloud-init reliability

## 🗺️ Roadmap

### v0.1.0 (Completed)

- [x] Hetzner Cloud integration
- [x] Interactive CLI
- [x] Automated Coolify installation
- [x] ARM64 support

### v0.2.0 (Completed)

- [x] Dynamic server type filtering
- [x] Auto firewall configuration
- [x] Price formatting fix

### v0.2.x (Completed)

- [x] Deprecated server type filtering
- [x] Retry on unavailable server types
- [x] Dynamic deployment summary
- [x] Dynamic recommended selection
- [x] Codecov integration with coverage badge
- [x] ESLint + Prettier code quality tooling
- [x] Zero `any` types - full type safety

### v0.3.0 (Completed)

- [x] DigitalOcean support
- [x] Interactive provider selection UI
- [x] Step-based back navigation
- [x] Cloud-init reliability improvements (network wait, logging)

### v0.4.0 (Completed)

- [x] Server management commands (list, status, destroy)
- [x] Non-interactive mode for CI/CD
- [x] Coolify health check polling (replaces blind wait)
- [x] Server record persistence (`~/.quicklify/servers.json`)
- [x] `destroyServer()` on provider interface
- [x] Double confirmation safety for destroy

### v0.5.0 (Completed)

- [x] Default configuration management (`quicklify config`)
- [x] SSH access to servers (`quicklify ssh`)
- [x] Coolify update via SSH (`quicklify update`)
- [x] Server restart via provider API (`quicklify restart`)
- [x] Shared server selection and token utilities (DRY refactor)

### v0.6.0 (Completed)

- [x] Server monitoring - CPU/RAM/Disk usage (`quicklify monitor`)
- [x] Log viewer - Coolify/Docker/system logs (`quicklify logs`)
- [x] Bulk health check for all servers (`quicklify health`)
- [x] Environment diagnostics (`quicklify doctor`)
- [x] SSH streaming for real-time log following

### v0.7.0 (Completed)

- [x] Firewall management - UFW setup, add/remove ports (`quicklify firewall`)
- [x] Domain management - Bind domains, DNS check, SSL (`quicklify domain`)
- [x] SSH hardening - Password disable, fail2ban, security audit (`quicklify secure`)
- [x] Dry-run mode for all security commands

### v0.8.0 (Completed)

- [x] Backup Coolify database + config (`quicklify backup`)
- [x] Restore from backup with double confirmation (`quicklify restore`)
- [x] Export/Import server list (`quicklify export`, `quicklify import`)
- [x] `--full-setup` flag for auto firewall + SSH hardening on init

### v0.9.0 (Completed)

- [x] YAML config file (`quicklify.yml`) for one-command deploy
- [x] Template system (`--template starter|production|dev`)
- [x] Config merge with priority: CLI > YAML > template > interactive

### v1.0.0 (Completed)

- [x] Vultr provider support
- [x] Linode (Akamai) provider support
- [x] `quicklify add` — register existing Coolify servers
- [x] `quicklify maintain` — full maintenance cycle
- [x] `--all` flag for status, update, backup
- [x] `status --autostart` — auto-restart Coolify when down

### Future
- [ ] `quicklify snapshot` — automated VPS snapshots before maintenance
- [ ] `init --mode production` — 2 server deploy (Coolify + worker)
- [ ] Interactive TUI dashboard

## 🛠️ Tech Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript
- **CLI Framework:** Commander.js
- **Interactive Prompts:** Inquirer.js
- **Styling:** Chalk (colors) + Ora (spinners)
- **HTTP Client:** Axios
- **YAML Parser:** js-yaml
- **Cloud APIs:** Hetzner Cloud API v1, DigitalOcean API v2, Vultr API v2, Linode API v4
- **Linting:** ESLint 10 + typescript-eslint
- **Formatting:** Prettier

## 📖 CLI Reference

### Commands

```bash
# Deploy new Coolify instance (interactive)
quicklify init

# Deploy non-interactively (CI/CD friendly)
export HETZNER_TOKEN="your-api-token"
quicklify init --provider hetzner --region nbg1 --size cax11 --name my-server

# Deploy with auto firewall + SSH hardening
quicklify init --full-setup

# Deploy from a YAML config file
quicklify init --config quicklify.yml

# Deploy using a template
quicklify init --template production --provider hetzner

# List all registered servers
quicklify list

# Check server and Coolify status
quicklify status 123.45.67.89
quicklify status my-server
quicklify status --all                   # Check all servers at once
quicklify status my-server --autostart   # Restart Coolify if it's down

# Destroy a server (with double confirmation)
quicklify destroy 123.45.67.89
quicklify destroy my-server

# Remove a server from local config (without destroying cloud server)
quicklify remove my-server
quicklify remove 123.45.67.89

# Manage default configuration
quicklify config set provider hetzner
quicklify config set region nbg1
quicklify config get provider
quicklify config list
quicklify config reset

# SSH into a server
quicklify ssh my-server
quicklify ssh 123.45.67.89 -c "docker ps"

# Update Coolify on a server
quicklify update my-server
quicklify update --all                   # Update all servers sequentially

# Restart a server
quicklify restart my-server

# View Coolify logs (last 50 lines)
quicklify logs my-server

# Follow Coolify logs in real-time
quicklify logs my-server --follow

# View Docker or system logs
quicklify logs my-server --service docker --lines 100
quicklify logs my-server --service system

# Show CPU/RAM/Disk usage
quicklify monitor my-server

# Show usage with Docker containers
quicklify monitor my-server --containers

# Check health of all servers
quicklify health

# Run environment diagnostics
quicklify doctor

# Firewall management
quicklify firewall setup my-server           # Install UFW + Coolify ports
quicklify firewall add my-server --port 3000  # Open port 3000/tcp
quicklify firewall add my-server --port 53 --protocol udp  # Open port 53/udp
quicklify firewall remove my-server --port 3000  # Close port 3000
quicklify firewall list my-server             # Show firewall rules
quicklify firewall status my-server           # Check UFW active/inactive
quicklify firewall setup my-server --dry-run  # Preview without executing

# Domain management
quicklify domain add my-server --domain example.com     # Bind domain + HTTPS
quicklify domain add my-server --domain example.com --no-ssl  # HTTP only
quicklify domain remove my-server             # Revert to IP:8000
quicklify domain check my-server --domain example.com   # Verify DNS
quicklify domain list my-server               # Show current domain
quicklify domain add my-server --domain example.com --dry-run  # Preview

# SSH hardening & security
quicklify secure status my-server            # Show security settings
quicklify secure audit my-server             # Security score (0-4)
quicklify secure setup my-server             # Harden SSH + install fail2ban
quicklify secure setup my-server --port 2222  # Change SSH port
quicklify secure setup my-server --dry-run    # Preview without executing

# Backup Coolify database and config
quicklify backup my-server                   # Full backup (pg_dump + config)
quicklify backup --all                       # Backup all servers sequentially
quicklify backup my-server --dry-run         # Preview backup steps

# Restore from a backup
quicklify restore my-server                  # Interactive backup selection
quicklify restore my-server --backup 2026-02-21_15-30-45-123  # Specific backup
quicklify restore my-server --dry-run        # Preview restore steps

# Export/Import server list
quicklify export                             # Export to ./quicklify-export.json
quicklify export /path/to/file.json          # Export to custom path
quicklify import /path/to/file.json          # Import servers (skips duplicates)

# Add existing Coolify server to management
quicklify add                                # Interactive (provider, token, IP, verify)
quicklify add --provider hetzner --ip 1.2.3.4 --name my-server  # Non-interactive
quicklify add --provider vultr --ip 1.2.3.4 --skip-verify       # Skip Coolify check

# Run full maintenance cycle
quicklify maintain my-server                 # Status → Update → Health → Reboot
quicklify maintain my-server --skip-reboot   # Skip the reboot step
quicklify maintain --all                     # Maintain all servers sequentially
quicklify maintain my-server --dry-run       # Preview maintenance steps

# Show version
quicklify --version

# Show help
quicklify --help
```

### Non-Interactive Mode

Set your API token as an environment variable, then pass all options as flags:

```bash
# Set token (recommended - avoids shell history exposure)
export HETZNER_TOKEN="your-api-token"
# or
export DIGITALOCEAN_TOKEN="your-api-token"
# or
export VULTR_TOKEN="your-api-token"
# or
export LINODE_TOKEN="your-api-token"

# Deploy non-interactively
quicklify init \
  --provider hetzner \
  --region nbg1 \
  --size cax11 \
  --name production-coolify
```

Token resolution order: environment variable > interactive prompt. The `--token` flag is available but **not recommended** as it exposes the token in shell history.

If some flags are missing, only the missing values will be prompted interactively.

### YAML Config File

Create a `quicklify.yml` file for repeatable deployments:

```yaml
# quicklify.yml
template: production
provider: hetzner
region: nbg1
size: cx33
name: my-coolify-prod
fullSetup: true
```

Then deploy with:

```bash
export HETZNER_TOKEN="your-api-token"
quicklify init --config quicklify.yml
```

**Security:** Never store API tokens in config files. Use environment variables (`export HETZNER_TOKEN=...`).

**Config merge priority:** CLI flags > YAML values > template defaults > interactive prompts.

### Templates

Templates provide sensible defaults per provider:

| Template | Hetzner | DigitalOcean | Vultr | Linode | Full Setup |
|----------|---------|--------------|-------|--------|------------|
| `starter` | nbg1 / cax11 (€3.79) | fra1 / s-2vcpu-2gb ($12) | ewr / vc2-2c-4gb ($24) | us-east / g6-standard-2 ($12) | No |
| `production` | nbg1 / cx33 (€5.49) | fra1 / s-2vcpu-4gb ($24) | ewr / vc2-4c-8gb ($48) | us-east / g6-standard-4 ($36) | Yes |
| `dev` | nbg1 / cax11 (€3.79) | fra1 / s-2vcpu-2gb ($12) | ewr / vc2-2c-4gb ($24) | us-east / g6-standard-2 ($12) | No |

```bash
# Quick production deploy
export HETZNER_TOKEN="your-api-token"
quicklify init --template production --provider hetzner --name my-server

# Cheap starter for testing
export DIGITALOCEAN_TOKEN="your-api-token"
quicklify init --template starter --provider digitalocean --name test-server
```

### Interactive Prompts

1. **Provider Selection** - Choose Hetzner Cloud, DigitalOcean, Vultr, or Linode
2. **API Token** - Validated before proceeding
3. **Region Selection** - Choose your preferred datacenter
4. **Server Size** - Filtered by Coolify requirements (2GB RAM, 2 vCPU)
5. **Server Name** - Validates format (lowercase, alphanumeric, hyphens)
6. **Confirmation** - Review summary before deployment

All steps support **← Back** navigation to return to the previous step.

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

### Test Structure

```
tests/
├── __mocks__/              # Mock modules (axios, inquirer, ora, chalk)
├── unit/                   # Unit tests
│   ├── cloudInit.test.ts
│   ├── config.test.ts          # Config CRUD operations
│   ├── config-edge.test.ts     # Config edge cases (corruption, empty files)
│   ├── config-command.test.ts   # Config command subcommands
│   ├── defaults.test.ts        # Default config CRUD
│   ├── destroy.test.ts         # Destroy command unit tests
│   ├── doctor.test.ts           # Doctor command tests
│   ├── domain.test.ts           # Domain command tests
│   ├── firewall.test.ts         # Firewall command tests
│   ├── health-command.test.ts   # Health command tests
│   ├── healthCheck.test.ts     # Health check polling tests
│   ├── healthCheck-edge.test.ts # Health check edge cases (302, 401, 500)
│   ├── list.test.ts            # List command unit tests
│   ├── logger.test.ts
│   ├── logs.test.ts             # Logs command tests
│   ├── monitor.test.ts          # Monitor command tests
│   ├── prompts.test.ts
│   ├── providerFactory.test.ts # Provider factory tests
│   ├── restart.test.ts         # Restart command tests
│   ├── secure.test.ts           # Secure command tests
│   ├── backup.test.ts           # Backup command tests
│   ├── restore.test.ts          # Restore command tests
│   ├── transfer.test.ts         # Export/Import command tests
│   ├── templates.test.ts         # Template definitions tests
│   ├── yamlConfig.test.ts        # YAML config loader tests
│   ├── configMerge.test.ts       # Config merge logic tests
│   ├── init-fullsetup.test.ts   # Init --full-setup tests
│   ├── serverSelect.test.ts    # Server selection utility tests
│   ├── ssh-command.test.ts     # SSH command tests
│   ├── ssh-utils.test.ts       # SSH helper tests
│   ├── status.test.ts          # Status command unit tests
│   ├── update.test.ts          # Update command tests
│   ├── add.test.ts             # Add command tests
│   ├── maintain.test.ts        # Maintain command tests
│   └── validators.test.ts
├── integration/            # Integration tests (provider API calls)
│   ├── hetzner.test.ts         # Including destroyServer tests
│   ├── digitalocean.test.ts    # Including destroyServer tests
│   ├── vultr.test.ts           # Vultr provider tests
│   └── linode.test.ts          # Linode provider tests
└── e2e/                    # End-to-end tests (full command flows)
    ├── init.test.ts
    ├── init-noninteractive.test.ts  # Non-interactive mode E2E
    ├── init-config.test.ts          # YAML config + template E2E
    ├── status.test.ts               # Status command E2E
    └── destroy.test.ts              # Destroy command E2E
```

### CI/CD

Tests run automatically on every push/PR via GitHub Actions across:

- **OS:** Ubuntu, macOS, Windows
- **Node.js:** 20, 22

### Coverage

Current coverage: **98%+ statements/lines**, **91%+ branches**, **98%+ functions**. 947 tests across 45 test suites.

## 🔧 Troubleshooting

**"Invalid API token"**

- Ensure token has Read & Write permissions
- Check for extra spaces when copying
- Regenerate token if needed

**"Server creation failed"**

- Verify cloud account has sufficient funds
- Check account limits (new accounts may have restrictions)
- Try different region or server size

**"Cannot access Coolify UI"**

- Wait 3-5 more minutes (Coolify initialization takes time)
- Check the install log: `ssh root@YOUR_IP "cat /var/log/quicklify-install.log | tail -20"`
- Check firewall settings (should auto-configure)
- Verify server is running in cloud console

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code guidelines, and PR process.

**Areas for contribution:**

- New cloud provider integrations
- CLI improvements
- Documentation
- Bug fixes

## 📄 License

MIT © 2026 Ömer FC

See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Coolify](https://coolify.io/) - The amazing open-source PaaS
- [Hetzner](https://www.hetzner.com/) - Affordable, reliable cloud infrastructure
- [DigitalOcean](https://www.digitalocean.com/) - Developer-friendly cloud platform
- [Vultr](https://www.vultr.com/) - High-performance cloud compute
- [Linode](https://www.linode.com/) - Simple, affordable cloud computing
- All contributors and users!

## 💬 Support & Community

- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/omrfc/quicklify/issues)
- 💡 **Feature Requests:** [GitHub Discussions](https://github.com/omrfc/quicklify/discussions)
- 🐦 **Updates:** [@omrfc](https://twitter.com/omrfc)
- 🌐 **Website:** [quicklify.omrfc.dev](https://quicklify.omrfc.dev)

## ⭐ Show Your Support

If Quicklify helped you, please:

- ⭐ Star this repository
- 🐦 Share on Twitter
- 📝 Write a blog post
- 💬 Tell your friends!

---

**Made with ❤️ by [@omrfc](https://github.com/omrfc)**

*Saving developers time, one deployment at a time.* ⚡
