# Milestones

## v1.2.0 — Generic Server Management (Shipped: 2026-02-28)

**Goal:** Break Coolify dependency, eliminate CLI/MCP code duplication, add bare server management.

**Phases completed:** 3 phases, 12 plans

**Key accomplishments:**
- All CLI commands refactored to thin wrappers around core/ modules (eliminated duplicated business logic)
- `--mode bare` support: provision and manage generic VPS servers without Coolify
- ServerRecord `mode` field with backward-compatible migration (legacy records default to "coolify")
- MCP tools aligned with core/ modules, supporting bare mode via parameter
- Shared constants centralized to src/constants.ts (10 constants, zero duplicates)
- SAFE_MODE bug fixed in restore.ts (now uses canonical isSafeMode())
- 1921 tests passing across 74 suites (95%+ coverage)

**Archive:** [v1.2.0-ROADMAP.md](./milestones/v1.2.0-ROADMAP.md) | [v1.2.0-REQUIREMENTS.md](./milestones/v1.2.0-REQUIREMENTS.md) | [v1.2.0-MILESTONE-AUDIT.md](./milestones/v1.2.0-MILESTONE-AUDIT.md)

---

## v1.1.0 — MCP Server + Security (2026-02-27)

**Goal:** Add Claude AI integration via MCP and harden security.

**Shipped:**
- MCP server with 7 tools (server_info, server_logs, server_manage, server_maintain, server_secure, server_backup, server_provision)
- 12 security fixes (path traversal, assertValidIp, sanitizeStderr, port validation, provider enum, manifest hardening)
- SSH key auto-generation during provision
- Full documentation update

**Last phase:** 0 (pre-GSD)

## v1.0.0 — Initial Release (2026-02-23)

**Goal:** Deploy and manage Coolify on cloud VPS providers via CLI.

**Shipped:**
- 23 CLI commands (init, status, destroy, secure, firewall, domain, backup, restore, snapshot, maintain, logs, etc.)
- 4 cloud providers (Hetzner, DigitalOcean, Vultr, Linode)
- YAML config support
- SAFE_MODE protection
- SSH security hardening + fail2ban
- UFW firewall management
- Domain + SSL management
- Backup/restore + cloud snapshots

**Last phase:** 0 (pre-GSD)

---
*Last updated: 2026-02-28*
