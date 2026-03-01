---
phase: quick
plan: 5
subsystem: security
tags: [security, owasp, injection, token-leakage, dependency-audit, hardening]
dependency_graph:
  requires: []
  provides: [hardened-security-posture, zero-prod-vulns, owasp-compliance-docs]
  affects: [src/utils/openBrowser.ts, src/utils/sshKey.ts, src/commands/init.ts, src/core/secure.ts, src/core/backup.ts, SECURITY.md, package-lock.json]
tech_stack:
  added: []
  patterns: [assertSafePath-validation, sanitizedEnv-child-processes, assertValidIp-defense-in-depth]
key_files:
  created: []
  modified:
    - src/utils/openBrowser.ts
    - src/utils/sshKey.ts
    - src/commands/init.ts
    - src/core/secure.ts
    - src/core/backup.ts
    - SECURITY.md
    - package-lock.json
    - tests/unit/openBrowser.test.ts
decisions:
  - "assertSafePath rejects shell metacharacters in SCP remote paths (defense against crafted path injection)"
  - "sanitizedEnv applied to ALL child process spawns including ssh-keygen and browser open — not just SSH"
  - "minimatch 10.0.0-10.2.2 in test-exclude accepted as dev-only risk (no --force override per CLAUDE.md)"
metrics:
  duration: "9m25s"
  completed_date: "2026-03-01"
  tasks_completed: 3
  files_modified: 8
---

# Phase quick Plan 5: Security & Code Quality Audit Summary

**One-liner:** OWASP-focused security hardening with injection guards, full token isolation across all child processes, and npm devDep vuln reduction from 2 to 1.

## Objective

Comprehensive OWASP Top 10 security audit across quicklify's ~11,800 LOC TypeScript codebase. Identify and fix injection vectors, token leakage paths, and dependency vulnerabilities. Document the complete security posture in SECURITY.md.

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | OWASP Security Audit — Identify and Fix Vulnerabilities | 8f569af | Complete |
| 2 | Dependency Audit Fix + Code Quality Review | 67e26ea | Complete |
| 3 | Security Documentation Update | 0188467 | Complete |

## Security Findings and Fixes

### Task 1: OWASP Hardening

**A1 — Command Injection (init.ts ssh-keygen calls):**
- Added `assertValidIp(server.ip)` before both `spawnSync("ssh-keygen", ["-R", server.ip])` calls (lines ~496 and ~540)
- Defense-in-depth: IP was already validated at server creation/import, but explicit validation before each use eliminates any future regression risk

**A1 — Command Injection (secure.ts port interpolation):**
- Added integer validation (`Number.isInteger(port) && port >= 1 && port <= 65535`) before interpolating port into sed command in `buildHardeningCommand()`
- If port is NaN, negative, or out of range, the sed command is silently skipped — no injection risk

**A1 — Command Injection (backup.ts SCP paths):**
- Added `assertSafePath(remotePath)` helper that rejects paths containing: `;`, `|`, `&`, `$`, `` ` ``, `(`, `)`, `\n`, `\r`, `\t`, space
- Applied in both `scpDownload()` and `scpUpload()` before spawning scp

**A2 — Token Leakage (openBrowser.ts):**
- `exec(fullCommand, callback)` was inheriting full `process.env` including provider tokens
- Fixed: `exec(fullCommand, { env: sanitizedEnv() }, callback)` — strips TOKEN/SECRET/PASSWORD/CREDENTIAL keys
- Tests updated to match new 3-argument exec signature

**A2 — Token Leakage (sshKey.ts):**
- `spawnSync("ssh-keygen", [...])` was inheriting full process.env
- Fixed: added `env: sanitizedEnv()` to the spawnSync options

**A2 — Token Leakage (init.ts ssh-keygen):**
- Both ssh-keygen spawnSync calls now pass `env: sanitizedEnv()`

### Task 2: Dependency Audit

**Before:**
- `ajv` < 6.14.0 (moderate, ReDoS) — in eslint
- `minimatch` 9.0.0-9.0.6 / 10.0.0-10.2.1 (high, ReDoS) — multiple paths

**After `npm audit fix`:**
- `ajv` fixed (eslint updated to pull fixed ajv)
- `minimatch` 9.x and most 10.x paths fixed
- Remaining: `minimatch` 10.0.0-10.2.2 in `test-exclude` chain (jest coverage toolchain) — unfixable without `--force`

**Production deps: 0 vulnerabilities (`npm audit --omit=dev` = clean)**

**Code Quality Scan:**
- TODO/FIXME comments: 0
- Explicit `any` types in production code: 0
- Empty catch blocks: all 45 are intentional (best-effort cleanup, polling loops, safe default returns)
- console.log in core/utils: logger utility (intentional CLI output)

### Task 3: SECURITY.md

Updated from basic security notes to comprehensive security architecture documentation covering:
- Token handling (A2): sanitizedEnv on all child processes, stripSensitiveData on provider errors
- Input validation (A1): assertValidIp, assertSafePath, port range validation, server name validation
- SSH security: BatchMode, StrictHostKeyChecking, timeout limits, SSRF defense
- File permissions (A5): 0o600/0o700 across all sensitive files
- OWASP Top 10 compliance table with per-category status and implementation details
- Dependency audit status: production (0 vulns) vs dev (1 acceptable risk)

## Deviations from Plan

### Extra Fixes (Rule 2 — Auto-add missing critical functionality)

**[Rule 2 - Token Leakage] sanitizedEnv in openBrowser.ts exec call**
- **Found during:** Task 1 token leakage grep scan
- **Issue:** `exec(fullCommand)` inherited full process.env including provider API tokens. openBrowser is called right after Coolify setup when tokens are still in env.
- **Fix:** Added `{ env: sanitizedEnv() }` option and imported `sanitizedEnv` from ssh.ts
- **Files modified:** `src/utils/openBrowser.ts`, `tests/unit/openBrowser.test.ts`
- **Commit:** 8f569af

**[Rule 2 - Token Leakage] sanitizedEnv in sshKey.ts spawnSync call**
- **Found during:** Task 1 token leakage grep scan
- **Issue:** `spawnSync("ssh-keygen", ...)` for key generation inherited full process.env
- **Fix:** Added `env: sanitizedEnv()` to spawnSync options and imported `sanitizedEnv`
- **Files modified:** `src/utils/sshKey.ts`
- **Commit:** 8f569af

**[Rule 2 - Token Leakage] sanitizedEnv in init.ts ssh-keygen spawnSync calls**
- **Found during:** Task 1 — while adding assertValidIp, noticed missing sanitizedEnv
- **Issue:** ssh-keygen spawnSync calls in init.ts also inherited full process.env
- **Fix:** Added `env: sanitizedEnv()` to both spawnSync calls
- **Files modified:** `src/commands/init.ts`
- **Commit:** 8f569af

## Verification

- `npm run build` — TypeScript compiles clean
- `npm test` — 1998/1998 tests pass (75/75 suites)
- `npm run lint` — 0 ESLint errors
- `npm audit --omit=dev` — 0 production vulnerabilities
- Security fixes verified: assertValidIp in init.ts, port validation in secure.ts, assertSafePath in backup.ts, sanitizedEnv in openBrowser.ts and sshKey.ts

## Self-Check: PASSED

Files created/modified:
- `src/utils/openBrowser.ts` — FOUND
- `src/utils/sshKey.ts` — FOUND
- `src/commands/init.ts` — FOUND
- `src/core/secure.ts` — FOUND
- `src/core/backup.ts` — FOUND
- `SECURITY.md` — FOUND
- `package-lock.json` — FOUND
- `tests/unit/openBrowser.test.ts` — FOUND

Commits:
- 8f569af (Task 1 security fixes) — FOUND
- 67e26ea (Task 2 dependency audit) — FOUND
- 0188467 (Task 3 SECURITY.md) — FOUND
