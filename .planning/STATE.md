# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** One-command server deployment and management across multiple cloud providers
**Current focus:** v1.2.0 — Phase 1: CLI/Core Refactor

## Current Position

Phase: 1 of 3 (CLI/Core Refactor)
Plan: 3 of 5 in current phase
Status: In progress
Last activity: 2026-02-28 — Completed plan 01-03 (add/destroy/restart/health command refactor)

Progress: [██████░░░░] 60%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 6m22s
- Total execution time: 19m7s

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 - CLI/Core Refactor | 3 | 19m7s | 6m22s |

**Recent Trend:**
- Last 5 plans: 01-01 (4m24s), 01-02 (6m7s), 01-03 (8m36s)
- Trend: +

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-GSD] Core/ layer separation chosen for reusability but not fully utilized — CLI and MCP both duplicate core logic
- [v1.2.0 init] Refactor CLI first (Phase 1), then build bare mode on clean foundation (Phase 2), then align MCP (Phase 3)
- [01-01] Centralized 10 shared constants into src/constants.ts (IP_WAIT, COOLIFY_MIN_WAIT, BOOT_MAX_ATTEMPTS, BOOT_INTERVAL, COOLIFY_UPDATE_CMD, COOLIFY_RESTART_CMD, COOLIFY_SOURCE_DIR, COOLIFY_DB_CONTAINER, COOLIFY_DB_USER, COOLIFY_DB_NAME)
- [01-01] QuicklifyResult<T = void> uses generic T for data field — allows typed returns in subsequent plans while domain-specific types (AddServerResult, etc.) remain
- [01-02] Re-export pattern: commands/ import from core/ and re-export for backward test compatibility (import { X } from core; export { X };)
- [01-02] COOLIFY_DB_CONTAINER imported from constants.ts in commands/domain.ts for container name string matching in domainAdd
- [01-03] AddServerParams.apiToken optional field: CLI passes promptApiToken() result directly to addServerRecord() rather than setting env var
- [01-03] health.ts simplified to binary healthy/unreachable via checkCoolifyHealth — "unhealthy" (5xx) removed, aligned with core's validateStatus:true behavior
- [01-03] restart.ts retains polling logic as CLI concern; uses getCloudServerStatus from core/status.ts for status checks

### Pending Todos

None.

### Blockers/Concerns

- Phase 2 risk: Bare mode adds new code paths — test coverage must be maintained at 80%+

## Session Continuity

Last session: 2026-02-28
Stopped at: Completed 01-03-PLAN.md — ready for 01-04/01-05
Resume file: None
