# Project Research Summary

**Project:** Kastell v1.3 (Quicklify rebrand + Dokploy adapter)
**Domain:** CLI infrastructure management / self-hosted PaaS tooling
**Researched:** 2026-03-05
**Confidence:** HIGH

## Executive Summary

Kastell v1.3 is a dual-objective release: rebrand the existing Quicklify CLI to the Kastell identity, and add Dokploy as a second platform adapter alongside Coolify. Research confirms this is a well-scoped milestone with no new dependencies required. The existing tech stack (axios, Commander.js, Zod, etc.) handles everything Dokploy needs — its REST API uses the same `x-api-key` header auth pattern already proven across four cloud provider integrations. The Dokploy npm SDK should be avoided entirely (beta, 127 endpoints wrapped, unnecessary dependency risk when Kastell only needs 5-8 endpoints).

The recommended approach is to execute the rebrand and adapter work as two independent phases, in that order. The rebrand is the riskier half — not technically complex, but high in surface area. Every file, test, config path, env var, npm package name, and MCP entry must be audited for "quicklify" references. The adapter work is architecturally clean: define a `PlatformAdapter` interface, extract existing Coolify logic into `CoolifyAdapter` (pure mechanical refactor), then build `DokployAdapter` on the same contract. The 4-wave build order from architecture research (Foundation, Integration, Dokploy Implementation, CLI+MCP) maps naturally to phases.

The primary risks are all in the rebrand: string replacement false positives destroying URLs or historical references, config path migration (`~/.quicklify` to `~/.kastell`) causing data loss, npm deprecation timing leaving users stranded, and bin name changes breaking existing scripts. For the adapter work, the main risk is over-abstraction — the interface must only include what v1.3 actually ships (cloudInit, healthCheck, backup, status), not speculative v1.5 methods. All risks have clear prevention strategies documented in PITFALLS.md.

## Key Findings

### Recommended Stack

No new dependencies are needed for v1.3. This is pure refactoring plus new code against existing libraries.

**Core technologies (unchanged):**
- **axios**: HTTP client for Dokploy API (same pattern as cloud providers) — already in dependency tree
- **Commander.js + Inquirer.js**: CLI framework — add `--platform` flag to relevant commands
- **Zod**: Validate Dokploy API responses and new ServerRecord.platform field
- **js-yaml**: Config file management unchanged, just path rename

**License change:** MIT to Apache 2.0. All production dependencies are MIT-licensed, fully compatible. Requires: new LICENSE file, NOTICE file, package.json license field update.

**Explicitly rejected:** `dokploy` npm package (v0.1.3 beta, breaking-changes warnings, Fetch API second HTTP client, 127 endpoints when we need 5-8).

### Expected Features

**Must have (v1.3 table stakes):**
- PlatformAdapter interface with provision/health/backup/status methods
- CoolifyAdapter extracting existing logic (zero behavior change)
- DokployAdapter with cloud-init, health check, backup via SSH+SCP
- ServerRecord.platform field with backward-compatible normalization
- Updated mode guards for platform awareness
- MCP tool routing based on server platform
- Firewall rules for Dokploy port 3000
- Full rebrand: package name, bin entry, config paths, env vars, docs

**Should have (v1.5 deferred):**
- Dokploy restore from backup
- Dokploy API-level project/service management
- Auto-detection of installed platform
- Docker Swarm service health monitoring
- Dokploy log viewing via API

**Anti-features (never build):**
- User/database management inside Dokploy
- Application deployment (Dokploy's job)
- Docker Swarm cluster management
- Certificate management (Traefik handles this)

### Architecture Approach

The adapter pattern lives in a new `src/adapters/` directory, orthogonal to the existing `src/providers/` (cloud providers) and `src/core/` (business logic). A `PlatformAdapter` interface defines the contract; a factory function (`getAdapter(platform)`) dispatches to the correct implementation. Six core modules need platform awareness: deploy, status, backup, provision, maintain, and logs. Everything else (providers, SSH, config management) stays untouched.

**Major components:**
1. **PlatformAdapter interface** (`src/adapters/base.ts`) — contract for platform-specific operations
2. **CoolifyAdapter** (`src/adapters/coolify.ts`) — extracted existing Coolify logic, must be behavior-identical
3. **DokployAdapter** (`src/adapters/dokploy.ts`) — new implementation for Dokploy API + SSH operations
4. **PLATFORM_REGISTRY** (`src/constants.ts`) — single source of truth for platform metadata (like PROVIDER_REGISTRY)
5. **ServerRecord evolution** (`src/types/index.ts`) — `platform` optional field with backward compat normalization

### Critical Pitfalls

1. **String replacement false positives (P1)** — Use targeted replacement with manual review, not global find-replace. Keep historical CHANGELOG entries as "quicklify". Create an explicit replacement checklist of which files change and which don't.
2. **Config path migration data loss (P2)** — Copy (never move) `~/.quicklify` to `~/.kastell` on first run. Only migrate if target doesn't exist. Never auto-delete the old directory. Test on Windows + Unix.
3. **npm deprecation timing (P3)** — Publish `kastell@1.3.0` first, verify `npx kastell --version` works, THEN deprecate `quicklify`. Never unpublish, only deprecate.
4. **bin entry name change breaks scripts (P4)** — Document prominently in CHANGELOG. Consider a `quicklify` wrapper that prints deprecation warning and forwards to `kastell`.
5. **CoolifyAdapter behavior drift (P9)** — Extract existing code as-is first (pure mechanical refactor). Run full test suite after extraction, before any modifications. Do not "improve" Coolify code during extraction.

## Implications for Roadmap

Based on combined research, the work splits cleanly into 3 phases with a clear dependency chain.

### Phase 1: Kastell Rebrand

**Rationale:** Must come first because every subsequent phase builds on the new identity. Adapter code written against the old name would need re-renaming.
**Delivers:** Kastell-branded CLI, Apache 2.0 license, config migration, npm publish under new name, quicklify deprecation
**Addresses:** Full rebrand (package name, bin entry, config paths, env vars, display strings, docs, CI workflows, MCP entries)
**Avoids:** P1 (string replacement false positives), P2 (config path migration), P3 (npm deprecation timing), P4 (bin entry change), P5 (test references), P6 (MCP name), P7 (GitHub Actions), P11-P15 (various references), P18 (env var naming)
**Estimated complexity:** HIGH surface area, LOW technical risk — tedious but well-understood work

### Phase 2: Platform Adapter Foundation

**Rationale:** Establishes the abstraction layer before any Dokploy code is written. CoolifyAdapter extraction validates the interface design with existing tests as the safety net.
**Delivers:** PlatformAdapter interface, CoolifyAdapter (behavior-identical refactor), ServerRecord.platform field, updated mode guards, adapter factory, PLATFORM_REGISTRY
**Implements:** Architecture waves 1-2 (Foundation + Integration)
**Avoids:** P8 (interface bloat — only v1.3 methods), P9 (CoolifyAdapter drift — pure mechanical extraction), P10 (ServerRecord backward compat)
**Estimated complexity:** MEDIUM — refactoring with 2099 existing tests as safety net

### Phase 3: Dokploy Adapter + CLI/MCP Integration

**Rationale:** With the abstraction in place, Dokploy is a straightforward implementation of the interface. CLI and MCP integration follows naturally.
**Delivers:** DokployAdapter (cloud-init, health check, backup, status), `--platform` CLI flag, MCP platform routing, interactive menu platform selection, firewall rules for port 3000
**Uses:** axios (Dokploy API calls), existing SSH/SCP utilities (backup), existing cloud-init patterns
**Avoids:** P16 (port conflicts — document Coolify/Dokploy mutual exclusion), P17 (API key availability — graceful "not yet configured" handling)
**Estimated complexity:** MEDIUM — new code but following established patterns from CoolifyAdapter

### Phase Ordering Rationale

- **Rebrand before adapter:** Writing adapter code under the old name and then renaming is double work. Rebrand first eliminates this.
- **CoolifyAdapter before DokployAdapter:** The existing 2099 tests validate the CoolifyAdapter extraction. If extraction breaks tests, the interface design is wrong — fix it before building DokployAdapter on a broken contract.
- **CLI/MCP integration last:** These are thin layers that consume the adapter. They need both the rebrand (correct names) and the adapter (platform routing) to be stable.
- **License change with rebrand:** Natural pairing. New identity, new license, one transition.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Rebrand):** Needs a detailed file-by-file replacement audit. Run `grep -ri "quicklify" src/ __tests__/ .github/ docs/ package.json` and categorize every hit as replace/keep/conditional.
- **Phase 3 (Dokploy):** Dokploy backup paths and PostgreSQL container naming need verification on a live instance. Health check auth requirements (admin vs regular API key) need testing.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Adapter Foundation):** Well-documented adapter/strategy pattern. Existing codebase has the exact template in `src/providers/base.ts`. Architecture research provides the complete interface design and refactoring map.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies. All existing libs verified compatible with Apache 2.0. Dokploy SDK rejection well-reasoned. |
| Features | HIGH | Clear table stakes / differentiator / anti-feature separation. Dokploy API endpoints documented with auth patterns. |
| Architecture | HIGH | Adapter pattern mirrors existing provider pattern. 4-wave build order has clear dependency logic. Refactoring map covers all affected modules. |
| Pitfalls | HIGH | 18 pitfalls identified with prevention strategies. Phase assignment is explicit. Critical pitfalls all have concrete mitigations. |

**Overall confidence:** HIGH

### Gaps to Address

- **Dokploy backup completeness:** Whether `/etc/dokploy` contains all state or just config needs verification on a live instance. PostgreSQL data may need separate container volume backup. Resolve during Phase 3 implementation.
- **Dokploy API key timing:** Unknown whether API key is available immediately after install or requires initial web UI setup. If setup is required, the provision flow needs a "complete setup at http://IP:3000" prompt. Resolve during Phase 3 implementation.
- **Dokploy install script OS support:** Behavior on Ubuntu 22 vs 24 untested. Resolve with a test provision during Phase 3.
- **GitHub repo transfer timing:** Research does not specify when `omrfc/quicklify` becomes `kastelldev/kastell`. This affects GitHub URLs in docs and CI badge paths. Decision needed before Phase 1 planning.
- **Traefik port conflict detection:** If a server previously ran Coolify, Dokploy's Traefik will conflict on ports 80/443. Need a pre-provision check. Resolve during Phase 3.

## Sources

### Primary (HIGH confidence)
- Dokploy official documentation (dokploy.com/docs) — API endpoints, install script, data directories
- Existing Quicklify codebase (v1.2.1) — current architecture, provider patterns, test suite
- npm registry — license compatibility checks, dokploy SDK version/stability assessment

### Secondary (MEDIUM confidence)
- Dokploy GitHub repository — OpenAPI spec review, install script source code
- Community discussions — Dokploy backup strategies, port requirements

### Tertiary (LOW confidence)
- Dokploy PostgreSQL container internals — exact container name and volume paths need live verification
- Dokploy API key generation flow — timing relative to install completion needs testing

---
*Research completed: 2026-03-05*
*Ready for roadmap: yes*
