# Quicklify

## What This Is

Quicklify is a CLI tool and MCP server that deploys and manages servers on cloud VPS providers (Hetzner, DigitalOcean, Vultr, Linode). It supports both Coolify-managed and bare (generic) servers. Full lifecycle management: provisioning, security hardening, domain management, firewall, backups, snapshots, monitoring, and maintenance — all from a single command line or via Claude AI integration.

## Core Value

One-command server deployment and management across multiple cloud providers, accessible both from CLI and AI assistants.

## Requirements

### Validated

<!-- Shipped and confirmed valuable -->

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
- ✓ 12 security hardening measures — v1.1.0
- ✓ SSH key auto-generation during provision — v1.1.0
- ✓ CLI commands import from core/ (eliminate code duplication) — v1.2.0
- ✓ `--mode bare` support for non-Coolify servers — v1.2.0
- ✓ MCP tools aligned with core/ + bare mode support — v1.2.0
- ✓ Provider list centralization (PROVIDER_REGISTRY in constants.ts) — v1.2.1
- ✓ stripSensitiveData consolidation to providers/base.ts — v1.2.1
- ✓ SCP stdin=ignore + BatchMode=yes (MCP stream corruption prevention) — v1.2.1
- ✓ SCP timeout for download/upload operations — v1.2.1
- ✓ Token whitespace trim in getProviderToken() — v1.2.1
- ✓ init.ts refactor — deployServer() extracted to core/deploy.ts — v1.2.1

### Active

<!-- Next milestone requirements go here -->

(None yet — define with `/gsd:new-milestone`)

### Out of Scope

- Dokploy platform support — deferred to v1.3.0
- Telegram bot integration — deferred to v1.4.0
- Website / interactive command builder — deferred to v1.5.0
- GUI / web dashboard — CLI-first philosophy

## Context

- Published on npm as `quicklify` (v1.2.0 published 2026-03-01)
- 23 CLI commands + 7 MCP tools
- 2099 tests across 78 suites (95%+ coverage)
- CI: GitHub Actions (3 OS x 2 Node versions = 6 matrix)
- Codebase: ~11,800 LOC TypeScript
- Architecture: Commands (thin wrappers) → Core (business logic) → Providers (plugin pattern)
- Supports two server modes: `coolify` (default, Coolify-managed) and `bare` (generic VPS)
- v1.2.1 shipped: PROVIDER_REGISTRY centralization, SCP security hardening, init.ts extract

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
| Core/ layer separation | Reusable logic across CLI and MCP | ✓ Good — v1.2.0 fully utilized |
| Re-export pattern for backward compat | Commands import from core/ and re-export for test mock compat | ✓ Good |
| ServerMode type (coolify/bare) | Clean mode separation, backward-compatible defaulting | ✓ Good |
| getBareCloudInit separate from Coolify | Bare servers get minimal hardening without Coolify bloat | ✓ Good |
| requireCoolifyMode guard pattern | Consistent mode checking across CLI and MCP | ✓ Good |
| PROVIDER_REGISTRY as const in constants.ts | Single source of truth for all 4 providers + derived types | ✓ Good — v1.2.1 |
| stripSensitiveData in base.ts | Shared provider utility, eliminates 4x duplication | ✓ Good — v1.2.1 |
| SCP stdin=ignore + BatchMode | MCP stream safety + non-interactive hardening | ✓ Good — v1.2.1 |
| Token sanitization at getProviderToken() boundary | DRY — single sanitization point, not at call sites | ✓ Good — v1.2.1 |
| deployServer() in core/deploy.ts | Independently testable deployment logic, init.ts stays thin | ✓ Good — v1.2.1 |
| sanitizeResponseData() whitelist approach | OWASP: only known-safe fields pass through, not blacklist | ✓ Good — v1.2.1 |

---
*Last updated: 2026-03-02 after v1.2.1 milestone*
