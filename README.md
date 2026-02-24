# quicklify

> English | [Türkçe](README.tr.md)

![Tests](https://github.com/omrfc/quicklify/actions/workflows/ci.yml/badge.svg)
![npm](https://img.shields.io/npm/v/quicklify)
![Downloads](https://img.shields.io/npm/dw/quicklify)
![License](https://img.shields.io/badge/license-MIT-blue)
![GitHub stars](https://img.shields.io/github/stars/omrfc/quicklify?style=flat-square)
[![Socket Badge](https://socket.dev/api/badge/npm/package/quicklify)](https://socket.dev/npm/package/quicklify)

**Deploy Coolify to a cloud VPS with one command.**

Quicklify installs, configures, and manages [Coolify](https://coolify.io) on your cloud server in about 4 minutes. Back up your data, harden security, manage domains, and keep everything updated — all from the terminal.

## Quick Start

```bash
# 1. Get your API token from Hetzner, DigitalOcean, Vultr, or Linode
# 2. Run the installer
npx quicklify init

# 3. Access Coolify at http://<your-ip>:8000
```

That's it. Quicklify handles server provisioning, SSH key setup, firewall configuration, and Coolify installation automatically.

## What Can You Do?

### Deploy
```bash
quicklify init                          # Interactive setup
quicklify init --provider hetzner       # Non-interactive
quicklify init --config quicklify.yml   # From YAML config
quicklify init --template production    # Use a template
```

### Manage
```bash
quicklify list                  # List all servers
quicklify status my-server      # Check server & Coolify status
quicklify status --all          # Check all servers
quicklify ssh my-server         # SSH into server
quicklify restart my-server     # Restart server
quicklify add                   # Add existing Coolify server
quicklify remove my-server      # Remove from local config
```

### Update & Maintain
```bash
quicklify update my-server      # Update Coolify
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
quicklify secure harden my-server     # SSH hardening + fail2ban
quicklify domain add my-server --domain example.com  # Set domain + SSL
```

### Monitor & Debug
```bash
quicklify monitor my-server             # CPU, RAM, disk usage
quicklify logs my-server                 # View Coolify logs
quicklify logs my-server -f              # Follow logs
quicklify health                         # Health check all servers
quicklify doctor                         # Check local environment
```

## Supported Providers

| Provider | Status | Regions | Starting Price |
|----------|--------|---------|---------------|
| [Hetzner Cloud](https://hetzner.cloud) | Stable | EU, US | €3.49/mo |
| [DigitalOcean](https://digitalocean.com) | Stable | Global | $12/mo |
| [Vultr](https://vultr.com) | Stable | Global | $10/mo |
| [Linode (Akamai)](https://linode.com) | Beta | Global | $12/mo |

> **Note:** Linode support is in beta — community testing welcome.

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
| `starter` | Testing, side projects | Smallest instance |
| `production` | Live applications | 4+ vCPU, 8+ GB RAM |
| `dev` | Development & CI/CD | Balanced resources |

```bash
quicklify init --template production --provider hetzner
```

## Security

- API tokens are never stored on disk — prompted at runtime or via environment variables
- SSH keys are auto-generated if needed (Ed25519)
- `--full-setup` enables UFW firewall and SSH hardening automatically
- All SSH connections use `StrictHostKeyChecking=accept-new`
- Config file token detection warns against storing secrets in YAML

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

**Coolify not responding?**
Use `quicklify status my-server --autostart` to check and auto-restart if needed.

**Need to start fresh?**
`quicklify destroy my-server` removes the cloud server entirely.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing, and contribution guidelines.

## What's Next

- Interactive TUI dashboard for server management

## License

MIT — see [LICENSE](LICENSE)

## Support

- [GitHub Issues](https://github.com/omrfrkcpr/quicklify/issues) — Bug reports and feature requests
- [Changelog](CHANGELOG.md) — Version history
