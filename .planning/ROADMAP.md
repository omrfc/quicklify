# Roadmap: Quicklify

## Milestones

- ✅ **v1.0.0 Initial Release** - Phases pre-GSD (shipped 2026-02-23)
- ✅ **v1.1.0 MCP Server + Security** - Phases pre-GSD (shipped 2026-02-27)
- 🚧 **v1.2.0 Generic Server Management** - Phases 1-3 (in progress)

## Phases

<details>
<summary>✅ v1.0.0 Initial Release — SHIPPED 2026-02-23</summary>

23 CLI commands, 4 cloud providers, YAML config, SAFE_MODE, SSH hardening, firewall, domain/SSL, backup/restore, snapshots. Pre-GSD — no phase plans tracked.

</details>

<details>
<summary>✅ v1.1.0 MCP Server + Security — SHIPPED 2026-02-27</summary>

MCP server with 7 tools, 12 security fixes, SSH key auto-generation, full docs update. Pre-GSD — no phase plans tracked.

</details>

---

### 🚧 v1.2.0 Generic Server Management (In Progress)

**Milestone Goal:** Break Coolify dependency by introducing `--mode bare` for generic server management, eliminate CLI/MCP code duplication by routing everything through core/, and improve MCP provision flow.

## Phases

- [x] **Phase 1: CLI/Core Refactor** - CLI commands delegate to core/ modules, eliminating duplicated business logic (completed 2026-02-28)
- [x] **Phase 2: Bare Mode** - Users can provision and manage servers without Coolify using `--mode bare` (completed 2026-02-28)
- [ ] **Phase 3: MCP Refactor** - MCP tools route through core/ and support bare mode via parameter

## Phase Details

### Phase 1: CLI/Core Refactor
**Goal**: CLI commands are thin wrappers around core/ modules — no duplicated business logic
**Depends on**: Nothing (first phase)
**Requirements**: REF-01, REF-02, REF-03, REF-04, REF-05
**Success Criteria** (what must be TRUE):
  1. Every CLI command that had duplicated logic now calls the equivalent core/ function instead
  2. Shared constants (IP_WAIT, COOLIFY_MIN_WAIT, BOOT_MAX_ATTEMPTS) are defined once and imported everywhere
  3. All existing CLI commands produce identical output and behavior before and after refactor
  4. Test suite passes at 80%+ coverage with no regressions after refactor
**Plans**: 5 plans

Plans:
- [x] 01-01-PLAN.md — Extract shared constants to src/constants.ts and define QuicklifyResult type
- [x] 01-02-PLAN.md — Remove duplicated pure functions from secure, firewall, domain commands (import from core/)
- [x] 01-03-PLAN.md — Refactor add, destroy, health, restart commands to delegate to core/manage.ts
- [x] 01-04-PLAN.md — Refactor backup, restore, maintain, update, snapshot commands to delegate to core/
- [x] 01-05-PLAN.md — Finalize init.ts and status.ts refactoring, full test coverage verification

### Phase 2: Bare Mode
**Goal**: Users can provision and manage generic VPS servers without Coolify installed
**Depends on**: Phase 1
**Requirements**: BARE-01, BARE-02, BARE-03, BARE-04, BARE-05, BARE-06, BARE-07, BARE-08, BARE-09
**Success Criteria** (what must be TRUE):
  1. User can run `quicklify init --mode bare` and get a provisioned VPS without Coolify installed
  2. User can run status, destroy, secure, firewall, domain, backup/restore commands against a bare server without Coolify-specific errors
  3. Bare server status check reports cloud status only (no Coolify health check attempted)
  4. Server records include a `mode` field (`"coolify"` or `"bare"`) visible in status output
  5. All existing Coolify commands continue working unchanged on coolify-mode servers
**Plans**: 4 plans

Plans:
- [ ] 02-01-PLAN.md — Foundation: ServerRecord mode field, bare cloud-init script, mode guard utility
- [ ] 02-02-PLAN.md — Provisioning: init --mode bare and add --mode bare commands
- [ ] 02-03-PLAN.md — Mode-aware status/list/health display and Coolify-only command guards
- [ ] 02-04-PLAN.md — Bare server backup/restore with system config targeting

### Phase 3: MCP Refactor
**Goal**: MCP tools use core/ modules and support bare mode — no duplicated logic, consistent errors
**Depends on**: Phase 2
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04
**Success Criteria** (what must be TRUE):
  1. MCP tools call the same core/ functions as CLI commands (no parallel implementation paths)
  2. Claude can provision a bare server via the MCP provision tool by passing `mode: "bare"` as a parameter
  3. MCP tool errors use the same format and messages as core/ error mappers
  4. All existing MCP tool schemas and behaviors are unchanged (no breaking changes for Claude integrations)
**Plans**: 3 plans

Plans:
- [ ] 03-01-PLAN.md — Foundation: shared MCP utils module, restore.ts SAFE_MODE fix, server.ts dynamic version
- [ ] 03-02-PLAN.md — Bare mode for serverProvision, serverManage, serverInfo tools
- [ ] 03-03-PLAN.md — Bare mode for serverBackup, serverMaintain, serverLogs, serverSecure + description updates

## Progress

**Execution Order:** 1 → 2 → 3

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. CLI/Core Refactor | 5/5 | Complete   | 2026-02-28 | - |
| 2. Bare Mode | 4/4 | Complete   | 2026-02-28 | - |
| 3. MCP Refactor | 2/3 | In Progress|  | - |

---
*Roadmap created: 2026-02-27*
*Last updated: 2026-02-28 — Phase 3 planned: 3 plans in 2 waves for MCP refactor*
