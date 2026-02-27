# Quicklify

## What This Is

Quicklify is a CLI tool and MCP server that deploys and manages Coolify instances on cloud VPS providers (Hetzner, DigitalOcean, Vultr, Linode). It handles the full lifecycle: provisioning, security hardening, domain management, firewall, backups, snapshots, monitoring, and maintenance — all from a single command line or via Claude AI integration.

## Core Value

One-command server deployment and management across multiple cloud providers, accessible both from CLI and AI assistants.

## Requirements

### Validated

<!-- Shipped and confirmed valuable in v1.0.0 and v1.1.0 -->

- ✓ CLI provisions Coolify servers on Hetzner, DigitalOcean, Vultr, Linode — v1.0.0
- ✓ Server status checks (cloud + Coolify health) — v1.0.0
- ✓ SSH security hardening + fail2ban — v1.0.0
- ✓ UFW firewall setup and port management — v1.0.0
- ✓ Custom domain + SSL management — v1.0.0
- ✓ Coolify backup/restore via SSH — v1.0.0
- ✓ Cloud provider snapshots — v1.0.0
- ✓ Server maintenance (update + reboot) — v1.0.0
- ✓ Log viewing (Coolify, Docker, system) — v1.0.0
- ✓ Server destroy with SAFE_MODE protection — v1.0.0
- ✓ YAML config for automated provisioning — v1.0.0
- ✓ MCP server with 7 tools for Claude integration — v1.1.0
- ✓ 12 security hardening measures (path traversal, assertValidIp, sanitizeStderr, etc.) — v1.1.0
- ✓ SSH key auto-generation during provision — v1.1.0

### Active

<!-- Current scope: v1.2.0 - Generic Server Management -->

- [ ] CLI commands import from core/ (eliminate code duplication)
- [ ] `--mode bare` support for non-Coolify servers
- [ ] MCP provision flow improvements

### Out of Scope

- Dokploy platform support — deferred to v1.3.0
- Telegram bot integration — deferred to v1.4.0
- Website / interactive command builder — deferred to v1.5.0
- GUI / web dashboard — CLI-first philosophy

## Context

- Published on npm as `quicklify` (v1.1.0)
- 23 CLI commands + 7 MCP tools
- 1758 tests across 64 suites (80% coverage threshold)
- CI: GitHub Actions (3 OS x 2 Node versions = 6 matrix)
- Codebase: TypeScript + Commander.js + Inquirer.js + Axios + MCP SDK + Zod
- Architecture: Commands → Core → Providers (plugin pattern)
- Known issue: CLI commands and MCP tools duplicate logic that exists in core/

## Constraints

- **Node.js**: 20+ required (engines field in package.json)
- **Backward compatibility**: Existing CLI commands must not break
- **npm package**: Must remain publishable, no breaking changes to bin entries
- **SSH dependency**: Server operations require SSH client on user machine
- **Provider APIs**: Rate limited, operations must be idempotent where possible

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Commander.js for CLI | Mature, well-documented, TypeScript support | ✓ Good |
| Provider plugin pattern | Easy to add new cloud providers | ✓ Good |
| MCP SDK for AI integration | Standard protocol, Claude-native | ✓ Good |
| SAFE_MODE env var | Prevent accidental destructive operations | ✓ Good |
| Core/ layer separation | Reusable logic across CLI and MCP | ⚠️ Revisit — not fully utilized, CLI duplicates core |

---
*Last updated: 2026-02-27 after milestone v1.2.0 initialization*
