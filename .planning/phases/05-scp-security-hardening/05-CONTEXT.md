# Phase 5: SCP Security Hardening - Context

**Gathered:** 2026-03-02
**Status:** Ready for execution

<domain>
## Phase Boundary

Harden SCP spawn calls (`scpDownload`/`scpUpload` in `src/core/backup.ts`) against MCP mode hazards and network hangs, and sanitize provider token env var values in `getProviderToken()`. No new features — pure security hardening of existing functions.

</domain>

<decisions>
## Implementation Decisions

### SEC-01: stdin=ignore + BatchMode=yes
- Change `stdio: ["inherit", "pipe", "pipe"]` → `stdio: ["ignore", "pipe", "pipe"]` in both SCP functions
- Add `-o BatchMode=yes` to the SCP args array (before the existing `-o StrictHostKeyChecking=accept-new`)
- Security comment added inline: "stdin must be 'ignore' — not 'inherit'. MCP uses stdin for JSON-RPC transport; inheriting it would corrupt the stream. BatchMode=yes prevents interactive prompts."

### SEC-02: SCP Timeout
- Add `SCP_TIMEOUT_MS = 300_000` constant to `src/constants.ts` (co-located with other timing constants like `BOOT_INTERVAL`)
- Implement timeout via `Promise.race()`-style pattern using `setTimeout` + `child.kill("SIGTERM")` inside the Promise constructor
- Add optional `timeoutMs` parameter with default `SCP_TIMEOUT_MS` to both functions — enables test-time override without fake timers
- Clear the timeout timer on normal process exit to prevent the timer from firing after success
- Reject (throw) with `Error("SCP download/upload timed out after Nms")` — caller (`createBackup`/`createBareBackup`/etc.) catches via the existing `try/catch` and returns `{ success: false, error: ... }`

### SEC-03: Token Trim
- `getProviderToken()` applies `.trim()` to raw env value
- Returns `undefined` for whitespace-only strings via `trimmed || undefined` pattern
- `||` (not `??`) is required — empty string after trim must coerce to `undefined`
- `collectProviderTokensFromEnv()` already checks `if (token)` so no secondary change needed

### Plan Decomposition
- Plan 01: SEC-01 + SEC-02 (same file `backup.ts`, same test file `core-backup.test.ts`)
- Plan 02: SEC-03 (different files `tokens.ts` + `core-tokens.test.ts`)
- Both plans are Wave 1 — no file overlap, can execute in parallel

### TDD Approach
- Both plans use TDD: write failing tests first, then implement
- Plan 01 timeout tests use `jest.useFakeTimers()` + `jest.advanceTimersByTime(300_001)` to avoid slow real timers
- Plan 02 whitespace tests are simple synchronous env var assertions

</decisions>

<specifics>
## Specific Ideas

- The optional `timeoutMs` parameter makes tests cleaner — tests can pass `100` instead of 300_000ms, avoiding fake timer complexity if the executor prefers that approach
- The `|| undefined` pattern in tokens.ts is idiomatic for "empty string is absence" semantics
- Existing callers of scpDownload/scpUpload (4 functions in backup.ts) need no changes — they call with 3 positional args, the timeout parameter defaults

</specifics>

<code_context>
## Existing Code Insights

### Current scpDownload/scpUpload (backup.ts lines 124-166)
- Both use `stdio: ["inherit", "pipe", "pipe"]` — the bug
- Both use `spawn("scp", ["-o", "StrictHostKeyChecking=accept-new", ...])` — BatchMode goes before this
- Both resolve (not reject) on all paths — after timeout the pattern switches to reject for unrecoverable hangs

### Current getProviderToken (tokens.ts lines 4-7)
- Returns `process.env[envKey]` raw — no trim
- Return type is `string | undefined` — trim doesn't change the signature

### Test file core-backup.test.ts
- Already imports `spawn` from `child_process` and mocks it
- Has `createMockProcess()` helper that emits "close" via setTimeout
- `scpDownload` is imported in backup.test.ts (command wrapper), but `scpUpload` and the core versions are only in core-backup.test.ts
- New timeout tests need a "hanging" mock process that never emits "close" — different from existing `createMockProcess`

### Established Patterns
- SCREAMING_SNAKE_CASE constants in constants.ts
- `300_000` numeric separator convention (other constants use `1000`, but 300_000 benefits from visual grouping)
- Section dividers `// ─── Name ───` in complex files

</code_context>

<deferred>
## Deferred Ideas

- None — all ideas are in-scope for this phase

</deferred>

---

*Phase: 05-scp-security-hardening*
*Context gathered: 2026-03-02*
