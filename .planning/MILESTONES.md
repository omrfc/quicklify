# Milestones

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

## v1.1.0 — MCP Server + Security (2026-02-27)

**Goal:** Add Claude AI integration via MCP and harden security.

**Shipped:**
- MCP server with 7 tools (server_info, server_logs, server_manage, server_maintain, server_secure, server_backup, server_provision)
- 12 security fixes (path traversal, assertValidIp, sanitizeStderr, port validation, provider enum, manifest hardening)
- SSH key auto-generation during provision
- Full documentation update

**Last phase:** 0 (pre-GSD)

---

## v1.2.0 — Generic Server Management (In Progress)

**Goal:** Break Coolify dependency, clean up code duplication, improve MCP provisioning.

**Starting phase:** 1

---
*Last updated: 2026-02-27*
