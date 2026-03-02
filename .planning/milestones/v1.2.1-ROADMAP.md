# Roadmap: Quicklify

## Milestones

- ✅ **v1.0.0 Initial Release** - Phases pre-GSD (shipped 2026-02-23)
- ✅ **v1.1.0 MCP Server + Security** - Phases pre-GSD (shipped 2026-02-27)
- ✅ **v1.2.0 Generic Server Management** - Phases 1-3 (shipped 2026-02-28)
- 🚧 **v1.2.1 Refactor + Security Patch** - Phases 4-6 (in progress)

## Phases

<details>
<summary>✅ v1.0.0 Initial Release — SHIPPED 2026-02-23</summary>

23 CLI commands, 4 cloud providers, YAML config, SAFE_MODE, SSH hardening, firewall, domain/SSL, backup/restore, snapshots. Pre-GSD — no phase plans tracked.

</details>

<details>
<summary>✅ v1.1.0 MCP Server + Security — SHIPPED 2026-02-27</summary>

MCP server with 7 tools, 12 security fixes, SSH key auto-generation, full docs update. Pre-GSD — no phase plans tracked.

</details>

<details>
<summary>✅ v1.2.0 Generic Server Management — SHIPPED 2026-02-28</summary>

- [x] Phase 1: CLI/Core Refactor (5/5 plans) — completed 2026-02-28
- [x] Phase 2: Bare Mode (4/4 plans) — completed 2026-02-28
- [x] Phase 3: MCP Refactor (3/3 plans) — completed 2026-02-28

3 phases, 12 plans, 18 requirements. Full details: [v1.2.0-ROADMAP.md](./milestones/v1.2.0-ROADMAP.md)

</details>

---

### 🚧 v1.2.1 Refactor + Security Patch (In Progress)

**Milestone Goal:** Consolidate provider duplication, harden SCP security, and extract deployServer() from init.ts — preparing the codebase for Dokploy (v1.3.0) without adding new features.

- [x] **Phase 4: Provider & Utility Consolidation** - Centralize hardcoded provider lists and remove duplicate stripSensitiveData() (completed 2026-03-02)
- [x] **Phase 5: SCP Security Hardening** - Fix SCP stdin leak, add timeout, trim token whitespace (completed 2026-03-02)
- [x] **Phase 6: init.ts Extract** - Extract deployServer() from 619-line init.ts to core/deploy.ts (completed 2026-03-02)

## Phase Details

### Phase 4: Provider & Utility Consolidation
**Goal**: Provider list and utility functions live in exactly one place — constants.ts and base.ts — with all call sites updated
**Depends on**: Nothing (first phase of v1.2.1)
**Requirements**: REF-01, REF-02
**Success Criteria** (what must be TRUE):
  1. `grep -r '"hetzner", "digitalocean"' src/` returns matches only in `src/constants.ts` (no other file hardcodes the provider list)
  2. `grep -rn 'function stripSensitiveData' src/providers/` returns only one match: `src/providers/base.ts`
  3. All 2047+ existing tests pass without modification
  4. Build succeeds and ESLint reports zero errors
**Plans:** 2/2 plans complete
Plans:
- [ ] 04-01-PLAN.md — Create PROVIDER_REGISTRY in constants.ts and update all 14 call sites (REF-01)
- [ ] 04-02-PLAN.md — Move stripSensitiveData() to providers/base.ts, remove from 4 providers (REF-02)

### Phase 5: SCP Security Hardening
**Goal**: SCP operations are safe for MCP mode (no stdin leak, no hang) and token inputs are always sanitized before use
**Depends on**: Nothing (parallel-safe with Phase 4)
**Requirements**: SEC-01, SEC-02, SEC-03
**Success Criteria** (what must be TRUE):
  1. SCP spawn calls use `stdio: ["ignore", ...]` — verified by test assertions in backup.test.ts
  2. SCP spawn calls include `-o BatchMode=yes` in the args array — verified by test assertions
  3. SCP operations throw/reject after a configurable timeout (default 300s) — verified with Jest fake timers
  4. A whitespace-only or leading/trailing-whitespace token string returns `undefined` from `getProviderToken()` — verified by unit test
  5. All 2047+ existing tests pass without modification
**Plans**: TBD

### Phase 6: init.ts Extract
**Goal**: init.ts is a thin wizard wrapper under 350 lines; all deployment logic lives in the independently-testable core/deploy.ts
**Depends on**: Phase 4 (provider constants must exist before deploy.ts imports them)
**Requirements**: REF-03
**Success Criteria** (what must be TRUE):
  1. `wc -l src/commands/init.ts` reports fewer than 350 lines (was 619)
  2. `src/core/deploy.ts` exists and exports `deployServer()` as a named export
  3. `init.ts` imports `deployServer` from `../../core/deploy` and delegates to it
  4. All existing init-related tests pass without modification to the test files themselves
  5. A new `src/__tests__/core/core-deploy.test.ts` (or equivalent) contains unit tests for `deployServer()` in isolation
**Plans**: TBD

## Progress

**Execution Order:** 4 → 5 → 6 (Phase 5 can start after Phase 4 or in parallel; Phase 6 must follow Phase 4)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. CLI/Core Refactor | v1.2.0 | 5/5 | Complete | 2026-02-28 |
| 2. Bare Mode | v1.2.0 | 4/4 | Complete | 2026-02-28 |
| 3. MCP Refactor | v1.2.0 | 3/3 | Complete | 2026-02-28 |
| 4. Provider & Utility Consolidation | 2/2 | Complete   | 2026-03-02 | - |
| 5. SCP Security Hardening | 2/2 | Complete   | 2026-03-02 | - |
| 6. init.ts Extract | 2/2 | Complete   | 2026-03-02 | - |

---
*Roadmap created: 2026-02-27*
*Last updated: 2026-03-02 — Phase 4 plans replanned (2 plans, 1 wave, 4 tasks total)*
