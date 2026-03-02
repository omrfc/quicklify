# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.2.1 — Refactor + Security Patch

**Shipped:** 2026-03-02
**Phases:** 3 | **Plans:** 6 | **Sessions:** 1

### What Was Built
- PROVIDER_REGISTRY centralization: single source of truth for all 4 provider identities (14 call sites updated)
- stripSensitiveData consolidation: 4 duplicate functions merged into 1 in base.ts
- SCP security hardening: stdin=ignore, BatchMode=yes, 5-minute SIGTERM timeout
- Token sanitization: .trim() + whitespace-only guard at getProviderToken() boundary
- deployServer() extraction: init.ts 612→243 lines, independent unit tests for deployment logic
- OWASP fix: sanitizeResponseData() whitelist for API error responses

### What Worked
- Single-day execution: all 3 phases completed in ~3 hours (09:16→11:51)
- TDD pattern enabled fast, confident refactoring — no regressions across 2099 tests
- Phase parallelism: Phase 4 and 5 ran independently as planned
- Milestone audit before completion caught 0 gaps — requirements were well-scoped
- Small, focused plans (2 per phase) kept execution tight

### What Was Inefficient
- STATE.md accumulated duplicate YAML frontmatter blocks (6 blocks stacked instead of 1)
- Phase 04-01 SUMMARY.md frontmatter missed REF-01 in requirements-completed field (metadata oversight, not functional gap)
- Accomplishments not extracted by CLI `milestone complete` tool (returned empty array — had to be added manually)

### Patterns Established
- `createMockProvider(overrides)` helper pattern for CloudProvider test setup
- `jest.requireMock()` accessor pattern for typed mock access across describe blocks
- Registry-derived constants pattern: define once as `as const`, derive type + array + maps
- Token sanitization at env-read boundary (not at call sites)
- OWASP whitelist approach for API response data sanitization

### Key Lessons
1. Refactor milestones execute fast because the risk is lower — tests catch regressions immediately
2. Centralized constants (PROVIDER_REGISTRY) eliminate drift across files and make Zod validation trivial
3. Extracting functions to core/ makes them independently testable — deploy.ts tests don't need init wizard mocking
4. OWASP audit after implementation catches security gaps that unit tests miss (e.g., response.data leaking sensitive info)

### Cost Observations
- Model mix: 100% opus (all phases)
- Sessions: 1 continuous session
- Notable: 6 plans in 1 session, ~30 min average per plan including verification

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.2.0 | 3 | 3 (12 plans) | First GSD-tracked milestone, established core/ architecture |
| v1.2.1 | 1 | 3 (6 plans) | Refactor-only milestone, single-day completion, OWASP audit added |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.2.0 | 1921 → 2047 | 95%+ | 0 |
| v1.2.1 | 2047 → 2099 | 95%+ | 0 |

### Top Lessons (Verified Across Milestones)

1. TDD catches regressions during refactoring — verified in both v1.2.0 (core/ extraction) and v1.2.1 (provider + deploy extraction)
2. Small, scoped plans (2-5 tasks each) complete faster and with fewer deviations than large plans
3. Phase-level verification (VERIFICATION.md) before milestone audit reduces audit-time gap discovery to zero
