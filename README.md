# quicklify

> Your self-hosted PaaS, fully managed. Deploy, secure, back up — one command at a time.

> English | [Türkçe](README.tr.md)

![Tests](https://github.com/omrfc/quicklify/actions/workflows/ci.yml/badge.svg)
[![Coverage](https://codecov.io/gh/omrfc/quicklify/branch/main/graph/badge.svg)](https://codecov.io/gh/omrfc/quicklify)
![npm](https://img.shields.io/npm/v/quicklify)
![Downloads](https://img.shields.io/npm/dt/quicklify)
![License](https://img.shields.io/badge/license-MIT-blue)
![GitHub stars](https://img.shields.io/github/stars/omrfc/quicklify?style=flat-square)
[![Socket Badge](https://socket.dev/api/badge/npm/package/quicklify)](https://socket.dev/npm/package/quicklify)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fquicklify.omrfc.dev&label=website)](https://quicklify.omrfc.dev)

## Why Quicklify Exists

Most self-hosted servers break because:

- No backup discipline
- No update strategy
- No security hardening
- No monitoring
- No snapshot routine

Stop babysitting your servers. Quicklify was built to fix that.

## Quick Start

```bash
# Interactive mode — no commands to memorize
npx quicklify
```

Running `quicklify` without any arguments launches an **interactive menu** where you can browse all available actions by category, pick what you need with arrow keys, and configure options step by step — no need to remember any command names or flags.

```
? What would you like to do?
  Server Management
❯   Deploy a new server
    Add an existing server
    List all servers
    Check server status
    ...
  Security
    Harden SSH & fail2ban
    Manage firewall (UFW)
    ...
```

Each action includes sub-options (server mode, template, log source, port number, etc.) and a **← Back** option to return to the main menu at any point.

If you already know the commands, you can still use them directly:

```bash
quicklify init                    # Deploy a new server
quicklify status my-server        # Check server status
quicklify backup --all            # Backup all servers
```

Quicklify handles server provisioning, SSH key setup, firewall configuration, and platform installation automatically.

## What Makes Quicklify Different?

| Problem | Solution |
|---------|----------|
| Broke your server with an update? | Pre-update snapshot protection via `maintain` |
| No idea if your server is healthy? | Built-in monitoring, health checks, and `doctor` diagnostics |
| Security is an afterthought? | Firewall, SSH hardening, SSL, and security audits built-in |
| Backups? Maybe someday... | One-command backup & restore with manifest tracking |
| Managing multiple servers? | `--all` flag across backup, maintain, status, and health |
| Existing server not tracked? | `quicklify add` brings any server under management |
| Don't want to memorize commands? | Just run `quicklify` — interactive menu guides you |

## What Can You Do?

### Deploy
```bash
quicklify                               # Interactive menu (recommended)
quicklify init                          # Interactive setup (direct)
quicklify init --provider hetzner       # Non-interactive
quicklify init --config quicklify.yml   # From YAML config
quicklify init --template production    # Use a template
quicklify init --mode bare              # Generic VPS (no Coolify)
```

### Manage
```bash
quicklify list                  # List all servers
quicklify status my-server      # Check server status
quicklify status --all          # Check all servers
quicklify ssh my-server         # SSH into server
quicklify restart my-server     # Restart server
quicklify destroy my-server     # Destroy cloud server entirely
quicklify add                   # Add existing server
quicklify remove my-server      # Remove from local config
quicklify config set key value  # Manage default configuration
quicklify export                # Export server list to JSON
quicklify import servers.json   # Import servers from JSON
```

### Update & Maintain
```bash
quicklify update my-server      # Update Coolify (Coolify servers)
quicklify maintain my-server    # Full maintenance (snapshot + update + health + reboot)
quicklify maintain --all        # Maintain all servers
```

### Back Up & Restore
```bash
quicklify backup my-server      # Backup DB + config
quicklify backup --all          # Backup all servers
quicklify restore my-server     # Restore from backup
```

### Snapshots
```bash
quicklify snapshot create my-server   # Create VPS snapshot (with cost estimate)
quicklify snapshot list my-server     # List snapshots
quicklify snapshot list --all         # List all snapshots across servers
quicklify snapshot delete my-server   # Delete a snapshot
```

### Security
```bash
quicklify firewall status my-server   # Check firewall
quicklify firewall setup my-server    # Configure UFW
quicklify secure audit my-server      # Security audit
quicklify secure setup my-server      # SSH hardening + fail2ban
quicklify domain add my-server --domain example.com  # Set domain + SSL
```

### Monitor & Debug
```bash
quicklify monitor my-server             # CPU, RAM, disk usage
quicklify logs my-server                 # View server logs
quicklify logs my-server -f              # Follow logs
quicklify health                         # Health check all servers
quicklify doctor                         # Check local environment
```

## Supported Providers

| Provider | Status | Regions | Starting Price |
|----------|--------|---------|---------------|
| [Hetzner Cloud](https://hetzner.cloud) | Stable | EU, US | ~€4/mo |
| [DigitalOcean](https://digitalocean.com) | Stable | Global | ~$18/mo |
| [Vultr](https://vultr.com) | Stable | Global | ~$10/mo |
| [Linode (Akamai)](https://linode.com) | Beta | Global | ~$24/mo |

> Prices reflect the default starter template per provider. You can choose a different size during setup. Linode support is in beta — community testing welcome.

## YAML Config

Deploy with a single config file:

```yaml
# quicklify.yml
provider: hetzner
region: nbg1
size: cax11
name: my-coolify
fullSetup: true
domain: coolify.example.com
```

```bash
quicklify init --config quicklify.yml
```

## Templates

| Template | Best For | Includes |
|----------|----------|----------|
| `starter` | Testing, side projects | 1–2 vCPU, 2–4 GB RAM |
| `production` | Live applications | 2–4 vCPU, 4–8 GB RAM, full hardening |
| `dev` | Development & CI/CD | Same as starter, no hardening |

```bash
quicklify init --template production --provider hetzner
```

## Security

Quicklify is built with security as a priority — **2,099 tests** across 78 suites, including dedicated security test suites.

- API tokens are never stored on disk — prompted at runtime or via environment variables
- SSH keys are auto-generated if needed (Ed25519)
- All SSH connections use `StrictHostKeyChecking=accept-new` with IP validation (octet range) and environment filtering
- Shell injection protection on all user-facing inputs (`spawn`/`spawnSync`, no `execSync`)
- Provider error messages are sanitized to prevent token leakage
- stderr sanitization redacts IPs, home paths, tokens, and secrets from error output
- Config file token detection (22+ key patterns, case-insensitive, nested)
- Import/export operations strip sensitive fields and enforce strict file permissions (`0o600`)
- `--full-setup` enables UFW firewall and SSH hardening automatically
- MCP: SAFE_MODE (default: on) blocks all destructive operations, Zod schema validation on all inputs, path traversal protection on backup restore

## Installation

```bash
# Run directly (recommended)
npx quicklify <command>

# Or install globally
npm install -g quicklify
quicklify <command>
```

Requires Node.js 20 or later.

## Troubleshooting

**Server creation fails?**
Run `quicklify doctor --check-tokens` to verify your API token and local environment.

**Server not responding?**
Use `quicklify status my-server --autostart` for Coolify servers, or `quicklify health` to check all servers at once.

**Need to start fresh?**
`quicklify destroy my-server` removes the cloud server entirely.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing, and contribution guidelines.

## MCP Server (AI Integration)

Quicklify includes a built-in [Model Context Protocol](https://modelcontextprotocol.io/) server for AI-powered server management. Works with Claude Code, Cursor, Windsurf, and other MCP-compatible clients.

```json
{
  "mcpServers": {
    "quicklify": {
      "command": "npx",
      "args": ["-y", "-p", "quicklify", "quicklify-mcp"],
      "env": {
        "HETZNER_TOKEN": "your-token",
        "DIGITALOCEAN_TOKEN": "your-token",
        "VULTR_TOKEN": "your-token",
        "LINODE_TOKEN": "your-token"
      }
    }
  }
}
```

Available tools:

| Tool | Actions | Description |
|------|---------|-------------|
| `server_info` | list, status, health | Query server information, check cloud provider & Coolify status |
| `server_logs` | logs, monitor | Fetch Coolify/Docker logs and system metrics via SSH |
| `server_manage` | add, remove, destroy | Register, unregister, or destroy cloud servers |
| `server_maintain` | update, restart, maintain | Update Coolify, restart servers, run full maintenance |
| `server_secure` | secure, firewall, domain | SSH hardening, firewall rules, domain/SSL management (10 subcommands) |
| `server_backup` | backup, snapshot | Backup/restore databases and create/manage VPS snapshots |
| `server_provision` | create | Provision new servers on cloud providers |

> All destructive operations (destroy, restore, snapshot-delete, provision, restart, maintain, snapshot-create) require `SAFE_MODE=false` to execute.

## What's Next

- Scheduled maintenance (cron-based automatic upkeep)
- Dokploy platform support (`--platform dokploy`)

## Philosophy

> Infrastructure should be boring, predictable, and safe.

Quicklify is not a script. It's your DevOps safety layer for self-hosted infrastructure.

## License

MIT — see [LICENSE](LICENSE)

## Support

- [GitHub Issues](https://github.com/omrfc/quicklify/issues) — Bug reports and feature requests
- [Changelog](CHANGELOG.md) — Version history

---

Built by [@omrfc](https://github.com/omrfc)
