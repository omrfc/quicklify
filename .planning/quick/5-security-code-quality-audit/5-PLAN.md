---
phase: quick
plan: 5
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/ssh.ts
  - src/utils/openBrowser.ts
  - src/core/backup.ts
  - src/commands/init.ts
  - src/core/secure.ts
  - package.json
  - package-lock.json
  - SECURITY.md
autonomous: true
requirements: [SEC-AUDIT]

must_haves:
  truths:
    - "No command injection vectors in shell exec calls"
    - "No sensitive data (tokens, passwords) leaked in error output or logs"
    - "All user-controlled input to shell commands is validated before use"
    - "npm audit devDependency vulnerabilities fixed where possible"
    - "File permissions on sensitive config files are restrictive (0o600/0o700)"
  artifacts:
    - path: "src/utils/ssh.ts"
      provides: "Hardened SSH utility with validated inputs"
    - path: "src/utils/openBrowser.ts"
      provides: "URL-validated browser open with injection protection"
    - path: "src/core/backup.ts"
      provides: "Backup/restore with path traversal guards and sanitized env"
  key_links:
    - from: "src/utils/ssh.ts"
      to: "all SSH callers"
      via: "assertValidIp + sanitizedEnv before every spawn"
      pattern: "assertValidIp.*sanitizedEnv"
---

<objective>
Comprehensive OWASP-focused security audit and code quality review of the entire quicklify src/ directory (~11,800 LOC TypeScript). Identify and fix security vulnerabilities, harden input validation, fix npm audit findings, and document security posture.

Purpose: Ensure quicklify is safe for production use — no command injection, no token leakage, no path traversal, proper file permissions.
Output: Hardened codebase with security fixes applied, npm audit clean (prod deps), updated SECURITY.md.
</objective>

<execution_context>
@C:/Users/Omrfc/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Omrfc/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/utils/ssh.ts
@src/utils/openBrowser.ts
@src/core/backup.ts
@src/core/secure.ts
@src/core/manage.ts
@src/core/tokens.ts
@src/utils/errorMapper.ts
@src/utils/config.ts
@src/utils/sshKey.ts
@src/utils/cloudInit.ts
@src/providers/hetzner.ts
@src/mcp/utils.ts
@src/mcp/tools/serverManage.ts
@src/mcp/tools/serverProvision.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: OWASP Security Audit — Identify and Fix Vulnerabilities</name>
  <files>src/utils/ssh.ts, src/utils/openBrowser.ts, src/core/backup.ts, src/commands/init.ts, src/core/secure.ts</files>
  <action>
Perform a systematic OWASP Top 10 audit across all src/ files. The codebase already has strong foundations (assertValidIp, sanitizedEnv, path traversal guards, stripSensitiveData). Focus on gaps:

**A1 - Injection (Command Injection):**
1. `src/utils/ssh.ts` line 91: `execSync(\`ssh-keygen -R ${ip}\`)` — IP IS validated by assertValidIp on line 89, this is safe. No change needed.
2. `src/commands/init.ts` line 496 and 538: `spawnSync("ssh-keygen", ["-R", server.ip])` — `server.ip` comes from saved ServerRecord which was validated at add/provision time. Safe by design, but add a defensive assertValidIp before each call for defense-in-depth.
3. `src/utils/openBrowser.ts` line 62: `exec(fullCommand)` where fullCommand includes a URL. The URL is validated by SAFE_URL_PATTERN regex on line 3 (`/^https?:\/\/[\d.]+(?::\d+)?\/?$/`) which only allows IP-based URLs. This is safe. No change needed.
4. `src/core/secure.ts` line 80: `buildHardeningCommand` uses `options?.port` in a sed command. The port is a number type from TypeScript, but add explicit integer validation (1-65535 range check) to prevent edge cases if called with NaN or negative numbers.

**A2 - Sensitive Data Exposure:**
5. `src/providers/hetzner.ts` (and other providers): Already call `stripSensitiveData(error)` to remove auth headers from axios errors. Good.
6. `src/utils/errorMapper.ts`: Already has `sanitizeStderr()` that redacts home dirs, IPs, passwords, tokens, secrets. Good.
7. `src/core/tokens.ts`: Reads tokens from env vars only — never logs them. Good.
8. `src/utils/ssh.ts`: `sanitizedEnv()` strips TOKEN/SECRET/PASSWORD/CREDENTIAL from child process env. Good.
9. Review all `catch` blocks in core/ and commands/ — ensure none expose internal stack traces to users. The pattern `getErrorMessage(error)` returns only `error.message`, not stack traces. Good.

**A3 - Broken Access Control:**
10. `src/core/manage.ts`: SAFE_MODE checked via `isSafeMode()` for destructive operations. Verify ALL destructive paths (destroy, restore) check SAFE_MODE. Check the restore command file — ensure SAFE_MODE is checked there too.

**A5 - Security Misconfiguration:**
11. `src/utils/config.ts`: Config dir created with mode 0o700, servers.json written with mode 0o600. Good.
12. `src/core/backup.ts`: Backup dirs created with mode 0o700, manifest written with mode 0o600. Good.
13. `src/utils/cloudInit.ts`: Log file created with chmod 600. Good.

**A7 - Cross-Site Scripting (N/A — CLI tool, no web UI)**

**A8 - Insecure Deserialization:**
14. `src/utils/config.ts` line 22: `JSON.parse(data)` on servers.json — add try/catch to handle corrupt JSON gracefully (already wrapped in try/catch on line 17). Good.
15. `src/core/backup.ts` line 76: `JSON.parse(readFileSync(manifestPath))` — already in try/catch. Good.

**Fixes to apply:**
- `src/commands/init.ts`: Add `assertValidIp(server.ip)` before ssh-keygen calls at lines 496 and 538 (defense-in-depth). Import assertValidIp from utils/ssh.
- `src/core/secure.ts`: In `buildHardeningCommand`, validate port is integer 1-65535 before interpolating into sed command. If invalid, ignore port option.
- `src/core/backup.ts`: In `scpDownload` and `scpUpload`, verify remotePath does not contain shell metacharacters (`;`, `|`, `&`, `$`, backtick). Add a `assertSafePath(path)` helper that rejects paths with these chars.

  </action>
  <verify>
    <automated>cd C:/Users/Omrfc/Documents/quicklify && npm run build && npm test -- --silent 2>&1 | tail -5</automated>
  </verify>
  <done>
    - init.ts ssh-keygen calls have assertValidIp guard
    - buildHardeningCommand validates port range
    - scpDownload/scpUpload reject paths with shell metacharacters
    - All existing 1998 tests still pass
    - Build clean, no TypeScript errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Dependency Audit Fix + Code Quality Review</name>
  <files>package.json, package-lock.json</files>
  <action>
**npm audit fix:**
Run `npm audit fix` to resolve the 2 devDependency vulnerabilities:
- `ajv` < 6.14.0 (ReDoS, moderate) — in eslint's deps
- `minimatch` 9.0.0-9.0.6 / 10.0.0-10.2.2 (ReDoS, high) — in typescript-estree, glob, test-exclude

These are ALL devDependencies (eslint, jest toolchain). No production dependency vulnerabilities exist. Run `npm audit fix` which npm reports can resolve both. If `npm audit fix` does NOT resolve cleanly, do NOT use `--force` or overrides (per CLAUDE.md lessons: overrides cause lock file breakage). Instead, document the remaining devDep vulns as acceptable risk.

After fix:
- Run `npm audit` to verify result
- Run `npm test` to ensure nothing broke
- Run `npm run build` to ensure TypeScript still compiles
- Run `npm run lint` to ensure ESLint still works

**Code quality scan across src/:**
Grep for these anti-patterns and fix if found:
- `// TODO` or `// FIXME` comments that should be resolved or tracked
- `any` type usage that can be narrowed (except in test files)
- Unused imports (ESLint should catch these)
- `console.log` in core/ or utils/ (should use process.stderr.write for non-CLI output) — commands/ is fine since those are CLI output
- Empty catch blocks that swallow errors silently without at least a comment explaining why

Document findings. For items that are intentional (e.g., empty catch in best-effort cleanup), add a `// Intentional: ...` comment if not already documented.
  </action>
  <verify>
    <automated>cd C:/Users/Omrfc/Documents/quicklify && npm audit --omit=dev 2>&1 && npm run build && npm test -- --silent 2>&1 | tail -5</automated>
  </verify>
  <done>
    - `npm audit --omit=dev` shows 0 vulnerabilities (production deps clean)
    - devDependency vulns reduced or documented as acceptable
    - No TODO/FIXME comments left untracked
    - No unintentional `any` types in production code
    - Build + lint + all 1998 tests pass
  </done>
</task>

<task type="auto">
  <name>Task 3: Security Documentation Update</name>
  <files>SECURITY.md</files>
  <action>
Update SECURITY.md to reflect the current security posture after the audit. Include:

1. **Security Architecture Summary:**
   - Token handling: env vars only, never stored on disk, sanitizedEnv strips from child processes
   - SSH: assertValidIp on all IP inputs, StrictHostKeyChecking=accept-new, BatchMode=yes for MCP, sanitized env
   - File permissions: config dir 0o700, servers.json 0o600, backup dirs 0o700, manifests 0o600
   - Error handling: stripSensitiveData on provider errors, sanitizeStderr redacts sensitive patterns
   - Input validation: IP validation, server name validation (3-63 chars, lowercase alphanumeric), path traversal guards on backup restore
   - SAFE_MODE: blocks destructive operations (destroy, restore, provision) when QUICKLIFY_SAFE_MODE=true

2. **OWASP Compliance Notes:**
   - A1 Injection: All shell exec uses spawn with array args (not string interpolation). IP validated before use. SCP paths validated.
   - A2 Sensitive Data: Tokens stripped from child env, error messages sanitized, no logging of secrets
   - A3 Access Control: SAFE_MODE gate on destructive ops
   - A5 Misconfiguration: Restrictive file permissions on all config/backup files

3. **Dependency Security:**
   - Production dependencies: 0 known vulnerabilities
   - Dev dependencies: status after npm audit fix

4. **Reporting:** Keep existing vulnerability reporting instructions.

Do NOT rewrite the entire file from scratch — read the existing SECURITY.md first and update/extend it.
  </action>
  <verify>
    <automated>cd C:/Users/Omrfc/Documents/quicklify && test -f SECURITY.md && echo "SECURITY.md exists" && head -5 SECURITY.md</automated>
  </verify>
  <done>
    - SECURITY.md updated with security architecture summary
    - OWASP compliance documented
    - Dependency audit status documented
    - Vulnerability reporting section preserved
  </done>
</task>

</tasks>

<verification>
1. `npm run build` — TypeScript compiles clean
2. `npm test` — all 1998+ tests pass
3. `npm run lint` — no lint errors
4. `npm audit --omit=dev` — 0 vulnerabilities in production deps
5. Security fixes verified: assertValidIp in init.ts, port validation in secure.ts, path validation in backup.ts
</verification>

<success_criteria>
- Zero production dependency vulnerabilities
- All command injection vectors validated with defense-in-depth guards
- No sensitive data leakage in error messages or child processes
- SECURITY.md documents the complete security architecture
- All existing tests pass, build clean, lint clean
</success_criteria>

<output>
After completion, create `.planning/quick/5-security-code-quality-audit/5-SUMMARY.md`
</output>
