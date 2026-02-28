# Requirements: Quicklify

**Defined:** 2026-02-27
**Core Value:** One-command server deployment and management across multiple cloud providers

## v1.2.0 Requirements

Requirements for v1.2.0 — Generic Server Management. Each maps to roadmap phases.

### Refactor

- [x] **REF-01**: CLI commands delegate to core/ modules instead of duplicating logic
- [x] **REF-02**: Shared constants (IP_WAIT, COOLIFY_MIN_WAIT, BOOT_MAX_ATTEMPTS) extracted to single source
- [x] **REF-03**: Commands only handle CLI concerns (prompts, output, args) — business logic lives in core/
- [x] **REF-04**: No breaking changes to existing CLI command signatures or behavior
- [x] **REF-05**: Test coverage maintained at 80%+ after refactor

### Bare Mode

- [x] **BARE-01**: User can provision a server without Coolify via `--mode bare`
- [x] **BARE-02**: User can check bare server status (cloud status only, no Coolify health check)
- [x] **BARE-03**: User can destroy a bare server (same SAFE_MODE protection)
- [x] **BARE-04**: User can run security hardening on a bare server (secure setup + audit)
- [x] **BARE-05**: User can manage firewall on a bare server (setup, add/remove ports)
- [x] **BARE-06**: User can set custom domain on a bare server (with SSL)
- [x] **BARE-07**: User can backup/restore a bare server (system-level, no Coolify DB)
- [x] **BARE-08**: ServerRecord stores `mode: "coolify" | "bare"` to track server type
- [x] **BARE-09**: Existing Coolify commands continue working unchanged (backward compatible)

### MCP Refactor

- [x] **MCP-01**: MCP tools import and use core/ modules instead of duplicating logic
- [ ] **MCP-02**: MCP provision tool supports bare mode via parameter
- [x] **MCP-03**: MCP tools return consistent error format aligned with core/ error mappers
- [ ] **MCP-04**: No breaking changes to existing MCP tool schemas or behavior

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Platform Support

- **PLAT-01**: User can deploy Dokploy instead of Coolify (`--platform dokploy`)
- **PLAT-02**: User can deploy Caprover (`--platform caprover`)

### Notifications

- **NOTF-01**: Telegram bot for mobile server monitoring
- **NOTF-02**: Webhook notifications for server events

### Website

- **WEB-01**: Interactive command builder on website
- **WEB-02**: Onboarding wizard for first-time users

## Out of Scope

| Feature | Reason |
|---------|--------|
| GUI / web dashboard | CLI-first philosophy, adds maintenance burden |
| Docker Compose support | Coolify/Dokploy handle orchestration |
| Multi-server clustering | Single-server focus for v1.x |
| Custom cloud-init scripts | Too many edge cases, security risk |
| Persistent auth storage | Tokens ephemeral by design (security) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REF-01 | Phase 1 | Partial (01-02: secure/firewall/domain; 01-03: add/destroy/restart/health; 01-04: backup/restore/maintain/update/snapshot done) |
| REF-02 | Phase 1 | Complete (01-01) |
| REF-03 | Phase 1 | Partial (01-02: secure/firewall/domain; 01-03: add/destroy/restart/health; 01-04: backup/restore/maintain/update/snapshot done) |
| REF-04 | Phase 1 | Complete (01-01) |
| REF-05 | Phase 1 | Complete (01-01) |
| BARE-01 | Phase 2 | Complete |
| BARE-02 | Phase 2 | Complete |
| BARE-03 | Phase 2 | Complete |
| BARE-04 | Phase 2 | Complete |
| BARE-05 | Phase 2 | Complete |
| BARE-06 | Phase 2 | Complete |
| BARE-07 | Phase 2 | Complete |
| BARE-08 | Phase 2 | Complete |
| BARE-09 | Phase 2 | Complete |
| MCP-01 | Phase 3 | Complete |
| MCP-02 | Phase 3 | Pending |
| MCP-03 | Phase 3 | Complete |
| MCP-04 | Phase 3 | Pending |

**Coverage:**
- v1.2.0 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-28 — Plan 01-04 completed REF-01/REF-03 partial (backup/restore/maintain/update/snapshot/monitor refactored to core/)*
