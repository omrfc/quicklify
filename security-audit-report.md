# Security Audit Report

**Project**: Kastell v1.15.1 (CLI toolkit for server provisioning, securing, and management)
**Date**: 2026-03-29
**Previous Audit**: 2026-03-28 (v1.15.0)
**Auditor**: Claude Security Audit (Opus 4.6 1M context, manual review)
**Frameworks**: OWASP Top 10:2025 + NIST CSF 2.0
**Mode**: full

---

## Executive Summary

| Metric | Count | Previous (2026-03-28) | Delta |
|--------|-------|-----------------------|-------|
| CRITICAL | 0 | 0 | = |
| HIGH | 1 | 3 | -2 FIXED |
| MEDIUM | 5 | 11 | -6 FIXED |
| LOW | 8 | 10 | -2 FIXED |
| Informational | 4 | 4 | = |
| Gray-box findings | 1 | 2 | -1 FIXED |
| Security hotspots | 7 | 6 | +1 NEW |
| Code smells | 3 | 3 | = |
| **Total findings** | **29** | **39** | **-10** |

**Overall Risk Assessment**: Kastell has significantly improved its security posture since the previous audit (2026-03-28). The P98 security remediation phase addressed 10 of the 14 actionable findings: token storage is now AES-256-GCM encrypted, GitHub Actions are SHA-pinned with Dependabot, npm publish has provenance attestation, bot middleware is fail-closed, SHELL_METACHAR regex covers newlines, unhandled rejection handlers are in place, getServers() fails closed on corruption, sendTelegram validates bot token format, Hetzner token is step-scoped, and debugLog uses KASTELL_DEBUG. Remaining findings are mostly LOW severity or deferred to v2.0 by design.

### Findings Fixed Since Previous Audit

| Previous ID | Title | Status |
|-------------|-------|--------|
| HIGH-001 | path-to-regexp ReDoS | FIXED -- `npm audit` reports 0 vulnerabilities |
| HIGH-002 | Plaintext token storage | FIXED -- AES-256-GCM encryption via `encryption.ts` |
| MEDIUM-001 | Bot middleware fail-open | FIXED -- Now returns early (deny all) when allowlist empty |
| MEDIUM-002 | SHELL_METACHAR missing newlines | FIXED -- Regex now includes `\n\r\0` |
| MEDIUM-003 | GitHub Actions not SHA-pinned | FIXED -- All actions pinned to full SHA with version comments |
| MEDIUM-004 | npm publish lacks provenance | FIXED -- `--provenance` added, `id-token: write` permission set |
| MEDIUM-005 | Hetzner token scoped to entire job | FIXED -- Token now step-scoped in staging.yml |
| MEDIUM-006 | sendTelegram bypasses SSRF | FIXED -- Bot token format validated before URL construction |
| MEDIUM-007 | No unhandled rejection handler | FIXED -- Handlers in both CLI and MCP entry points |
| MEDIUM-008 | getServers() fails open | FIXED -- Now throws on corrupt data instead of returning `[]` |
| MEDIUM-009 | loadAllowedChatIds fails open | MITIGATED -- Combined with MEDIUM-001 fix (middleware deny-all) |
| MEDIUM-011 | Provider tokens plaintext | FIXED -- Same AES-256-GCM encryption as HIGH-002 |
| LOW-001 | clearKnownHostKey missing IP validation | FIXED -- `assertValidIp(ip)` added |
| LOW-010 | Dead debugLog export | FIXED -- Now uses `KASTELL_DEBUG` env var, has real callers |

---

## OWASP Top 10:2025 Coverage

| OWASP ID | Category | Findings | Status |
|----------|----------|----------|--------|
| A01:2025 | Broken Access Control | 1 | Acceptable |
| A02:2025 | Security Misconfiguration | 1 | Acceptable |
| A03:2025 | Software Supply Chain Failures | 1 | Acceptable |
| A04:2025 | Cryptographic Failures | 2 | Acceptable |
| A05:2025 | Injection | 2 | Acceptable |
| A06:2025 | Insecure Design | 0 | Clean |
| A07:2025 | Authentication Failures | 1 | Acceptable |
| A08:2025 | Software or Data Integrity Failures | 1 | Acceptable |
| A09:2025 | Security Logging and Alerting Failures | 2 | Needs Attention |
| A10:2025 | Mishandling of Exceptional Conditions | 3 | Acceptable |

---

## NIST CSF 2.0 Coverage

| Function | Categories | Findings | Status |
|----------|-----------|----------|--------|
| GV (Govern) | GV.OC, GV.RM, GV.RR, GV.PO, GV.OV, GV.SC | 1 | Acceptable |
| ID (Identify) | ID.AM, ID.RA, ID.IM | 0 | Clean |
| PR (Protect) | PR.AA, PR.AT, PR.DS, PR.PS, PR.IR | 5 | Acceptable |
| DE (Detect) | DE.CM, DE.AE | 3 | Needs Attention |
| RS (Respond) | RS.MA, RS.AN, RS.CO, RS.MI | 0 | Clean |
| RC (Recover) | RC.RP, RC.CO | 0 | Clean |

---

## Compliance Coverage

| Framework | Coverage | Details |
|-----------|----------|---------|
| CWE | 15 unique CWEs identified | CWE-78, CWE-200, CWE-215, CWE-295, CWE-312, CWE-330, CWE-390, CWE-502, CWE-526, CWE-755, CWE-778, CWE-798, CWE-862, CWE-1078, CWE-1188 |
| SANS/CWE Top 25 | 2/25 entries found | #7 (CWE-78), #9 (CWE-862) |
| OWASP ASVS 5.0 | 5/14 chapters with findings | V4, V5, V6, V7, V14 |
| PCI DSS 4.0.1 | 3 requirements relevant | 6.2.4, 6.3, 10.2-10.7 |
| MITRE ATT&CK | 3 techniques mapped | T1059, T1078, T1552.001 |
| SOC 2 | 3 criteria with findings | CC6.1, CC6.7, CC7.1 |
| ISO 27001:2022 | 3 controls with findings | A.8.6, A.8.16, A.8.24 |

---

## HIGH Findings

### [HIGH-001] No Security Event Logging

- **Severity**: HIGH
- **OWASP**: A09:2025 (Security Logging and Alerting Failures)
- **CWE**: CWE-778 (Insufficient Logging)
- **NIST CSF**: DE.CM (Continuous Monitoring)
- **Compliance**: ASVS V7.1.1 | PCI DSS 10.2-10.7 | T1562 | CC7.1 | A.8.16
- **Location**: `src/utils/logger.ts` (entire file, lines 1-42)
- **Previous ID**: HIGH-003 (carried forward, deferred to v2.0)
- **Attack Vector**:
  1. Logger is purely console output (chalk colors) -- no timestamps, no file output, no structured logging
  2. No logging for: failed SSH, destructive operations (destroy, provision), MCP tool invocations, configuration changes, SAFE_MODE bypasses
  3. An attacker who gains CLI or MCP access leaves zero forensic trail
- **Impact**: No detection, no alerting, no post-incident forensic capability
- **Vulnerable Code**:
  ```typescript
  // src/utils/logger.ts:4-15
  export const logger = {
    info: (message: string) => {
      console.log(chalk.blue("i"), message);
    },
    error: (message: string) => {
      console.log(chalk.red("x"), message);
    },
  };
  ```
- **Remediation**: Add structured JSON logging to `~/.kastell/security.log` for destructive operations, authentication events, SSH connections, and MCP tool invocations. Include timestamps, event type, actor, target, and outcome fields. Priority: v2.0 when daemon mode becomes primary.

---

## MEDIUM Findings

### [MEDIUM-001] Encryption Key Derivation Uses Static Salt

- **Severity**: MEDIUM
- **OWASP**: A04:2025 (Cryptographic Failures)
- **CWE**: CWE-798 (Use of Hard-Coded Credentials)
- **NIST CSF**: PR.DS (Data Security)
- **Compliance**: ASVS V6.2.1 | PCI DSS 3.5 | T1552.001 | CC6.7 | A.8.24
- **Location**: `src/utils/encryption.ts:95`
- **Attack Vector**:
  1. `scryptSync(machineId, "kastell-v1", 32)` uses a hardcoded static salt `"kastell-v1"`
  2. The machineId itself has limited entropy on some platforms (the fallback at line 89 is `hostname-platform-arch`, which is often guessable)
  3. An attacker who knows the salt and can guess or obtain the machine ID can derive the encryption key
  4. On multi-user systems, any local user can read the same machine ID and derive the same key
- **Impact**: All encrypted tokens (cloud provider API keys, Telegram bot token) can be decrypted by any local user who can read the machine ID
- **Vulnerable Code**:
  ```typescript
  // src/utils/encryption.ts:92-97
  export function getMachineKey(): Buffer {
    if (_cachedKey) return _cachedKey;
    const machineId = getRawMachineId();
    _cachedKey = scryptSync(machineId, "kastell-v1", 32) as Buffer;
    return _cachedKey;
  }
  ```
- **Remediation**: Add a per-installation random salt stored alongside the config (not derived from machine state). The salt does not need to be secret -- it prevents pre-computation attacks. Consider using a user-specific seed (e.g., user SID on Windows, uid on Linux) in addition to machine ID to isolate multi-user scenarios.

### [MEDIUM-002] Encryption Fallback Machine ID Has Low Entropy

- **Severity**: MEDIUM
- **OWASP**: A04:2025 (Cryptographic Failures)
- **CWE**: CWE-330 (Use of Insufficiently Random Values)
- **NIST CSF**: PR.DS (Data Security)
- **Compliance**: ASVS V6.2.2 | CC6.7
- **Location**: `src/utils/encryption.ts:88-89`
- **Attack Vector**:
  1. When platform-specific machine ID retrieval fails (line 84 catch block), the fallback is `hostname()-platform()-arch()`
  2. This combination is trivially enumerable (e.g., `DESKTOP-ABC123-win32-x64`)
  3. Combined with the static salt, the encryption key becomes predictable
  4. On Darwin, the `ioreg` command could fail in sandboxed environments; on Windows, the registry query could fail for non-admin users
- **Impact**: Token encryption becomes decorative if the platform-specific retrieval fails
- **Vulnerable Code**:
  ```typescript
  // src/utils/encryption.ts:84-89
  } catch {
    // Fall through to fallback
  }
  // Fallback: hostname + platform + arch
  return `${hostname()}-${plat}-${arch()}`;
  ```
- **Remediation**: If the platform-specific machine ID cannot be retrieved, generate a random 32-byte value, store it at `~/.kastell/machine-id`, and use that instead of the guessable hostname combination.

### [MEDIUM-003] Guard Notifications Are Client-Side Only

- **Severity**: MEDIUM
- **OWASP**: A09:2025 (Security Logging and Alerting Failures)
- **CWE**: CWE-223 (Omission of Security-relevant Information)
- **NIST CSF**: DE.CM (Continuous Monitoring)
- **Compliance**: CC7.4
- **Location**: `src/core/guard.ts:42-46`
- **Previous ID**: MEDIUM-010 (carried forward, deferred to v2.0 daemon mode)
- **Attack Vector**: Remote guard cron script has no notification capability. Breach notifications only happen when someone runs `kastell guard status` locally. Unattended breaches go unnoticed indefinitely.
- **Impact**: Security breaches on monitored servers are not detected in real-time
- **Vulnerable Code**:
  ```typescript
  // src/core/guard.ts:42-46
  export const GUARD_CRON_EXPR = "*/5 * * * *";
  export const GUARD_SCRIPT_PATH = "/root/kastell-guard.sh";
  export const GUARD_LOG_PATH = "/var/log/kastell-guard.log";
  ```
- **Remediation**: Add server-side notification capability via webhook or push notification to the guard script. This requires daemon mode (v2.0 prerequisite).

### [MEDIUM-004] fileAppend Handler Passes User-Controlled Content to raw()

- **Severity**: MEDIUM
- **OWASP**: A05:2025 (Injection)
- **CWE**: CWE-78 (OS Command Injection)
- **NIST CSF**: PR.DS (Data Security)
- **Compliance**: SANS Top 25 #7 | ASVS V5.3.8 | PCI DSS 6.2.4 | T1059 | CC6.6
- **Location**: `src/core/audit/handlers/fileAppend.ts:51`
- **Attack Vector**:
  1. The `fileAppend` handler extracts a `line` value from fixCommand via regex matching and passes it to `raw()` embedded in single quotes
  2. The line value originates from hardcoded audit check definitions, so practical exploitation requires compromising check definitions
  3. However, if a line contains a single quote (e.g., `net.ipv4.conf.default.log_martians = 1 # POSIX compliant d'oh`), the single-quote escaping is NOT applied, leading to shell command injection on the remote server
  4. The rollback path at line 66 does apply `replace(/'/g, "'\\''")`  but the forward path at line 51 does not
- **Impact**: Remote code execution on the target server if a fix command's line parameter contains single quotes
- **Vulnerable Code**:
  ```typescript
  // src/core/audit/handlers/fileAppend.ts:51
  const appendCmd = raw(`echo '${line}' >> ${path}`);
  ```
- **Remediation**: Apply single-quote escaping to the `line` variable before embedding in the `raw()` call, the same way the rollback path does it: `line.replace(/'/g, "'\\''")`. Better yet, use `cmd("sh", "-c", ...)` with proper argument passing or pipe the content via stdin.

### [MEDIUM-005] File Permissions mode: 0o600 Ineffective on Windows

- **Severity**: MEDIUM
- **OWASP**: A04:2025 (Cryptographic Failures)
- **CWE**: CWE-312 (Cleartext Storage of Sensitive Information)
- **NIST CSF**: PR.DS (Data Security)
- **Compliance**: ASVS V6.4.1 | PCI DSS 3.4 | CC6.7 | A.8.24
- **Location**: Multiple files (33 occurrences across codebase)
- **Attack Vector**:
  1. `writeFileSync(..., { mode: 0o600 })` uses POSIX permission model
  2. On Windows, this is silently ignored -- files use default ACL (potentially world-readable)
  3. Encrypted tokens at `~/.kastell/tokens.json` and `~/.kastell/notify-secrets.json` have no file-level access control on Windows
  4. Since encryption was added (P98), this is mitigated: even if the file is readable, the content is encrypted
- **Impact**: REDUCED since P98 encryption. Previously HIGH (plaintext tokens). Now: encrypted content readable by other local users, but decryption requires machine key derivation (see MEDIUM-001/002 for key weakness)
- **Vulnerable Code**:
  ```typescript
  // src/core/auth.ts:37
  writeFileSync(TOKENS_FILE, JSON.stringify(payload, null, 2), { mode: 0o600 });
  // mode: 0o600 is a no-op on Windows
  ```
- **Remediation**: On Windows, use `icacls` or Node.js native NTFS ACL manipulation to restrict file access to the current user only. Alternatively, use Windows DPAPI via native binding for an additional encryption layer.

---

## LOW Findings

### [LOW-001] Linode Root Password Static Prefix

- **Severity**: LOW
- **OWASP**: A04:2025 (Cryptographic Failures)
- **CWE**: CWE-330 (Use of Insufficiently Random Values)
- **NIST CSF**: PR.DS (Data Security)
- **Location**: `src/providers/linode.ts:75`
- **Previous ID**: LOW-004 (carried forward)
- **Details**: `Ql1!` prefix on every generated password reduces entropy by 4 known chars. Mitigated by cloud-init disabling password login after provisioning.
- **Vulnerable Code**:
  ```typescript
  // src/providers/linode.ts:75
  const rootPass = `Ql1!${crypto.randomBytes(21).toString("base64").slice(0, 28)}`;
  ```
- **Remediation**: Generate full password from random bytes, inject complexity requirements at random positions.

### [LOW-002] Host Key Verification Default TOFU

- **Severity**: LOW
- **OWASP**: A07:2025 (Authentication Failures)
- **CWE**: CWE-295 (Improper Certificate Validation)
- **NIST CSF**: PR.AA (Identity Management)
- **Location**: `src/utils/ssh.ts:18-20`
- **Previous ID**: LOW-005 (carried forward)
- **Details**: Default SSH host key policy "accept-new" (Trust On First Use). Standard practice but MITM-vulnerable on first connection. `KASTELL_STRICT_HOST_KEY=true` available for strict mode.
- **Vulnerable Code**:
  ```typescript
  // src/utils/ssh.ts:18-19
  export function getHostKeyPolicy(): string {
    return process.env.KASTELL_STRICT_HOST_KEY === "true" ? "yes" : "accept-new";
  }
  ```
- **Remediation**: Document risk in security guide. Recommend strict mode for high-security environments.

### [LOW-003] ESLint Config Lacks Security Plugins

- **Severity**: LOW
- **OWASP**: A02:2025 (Security Misconfiguration)
- **CWE**: CWE-1078 (Inappropriate Source Code Style)
- **NIST CSF**: PR.PS (Platform Security)
- **Location**: `eslint.config.js`
- **Previous ID**: LOW-006 (carried forward, deferred to v2.0)
- **Details**: Only `eslint:recommended` + `typescript-eslint:recommended`. No `eslint-plugin-security` or `eslint-plugin-no-secrets` for automated injection pattern detection.
- **Remediation**: Add `eslint-plugin-security` and `eslint-plugin-no-secrets`.

### [LOW-004] JSON.parse on SSH Output Without Zod Validation

- **Severity**: LOW
- **OWASP**: A08:2025 (Software or Data Integrity Failures)
- **CWE**: CWE-502 (Deserialization of Untrusted Data)
- **NIST CSF**: PR.DS (Data Security)
- **Location**: `src/core/doctor.ts:361`, `src/core/audit/checks/docker.ts:89,202`
- **Previous ID**: LOW-007 (carried forward)
- **Details**: Some `JSON.parse` calls on SSH command output use `as` type assertions instead of Zod schema validation. Malformed data could cause runtime errors.
- **Remediation**: Add Zod validation for SSH output parsing in security-critical paths.

### [LOW-005] Retry Logic Only Handles HTTP 429

- **Severity**: LOW
- **OWASP**: A10:2025 (Mishandling of Exceptional Conditions)
- **CWE**: CWE-755 (Improper Handling of Exceptional Conditions)
- **NIST CSF**: DE.AE (Adverse Event Analysis)
- **Location**: `src/utils/retry.ts:21-47`
- **Previous ID**: LOW-008 (carried forward)
- **Details**: Only 429 (Rate Limit) triggers retry. 502/503/ETIMEDOUT are not retried. Brief cloud provider outage causes immediate failure.
- **Vulnerable Code**:
  ```typescript
  // src/utils/retry.ts:21
  if (axios.isAxiosError(error) && error.response?.status === 429) {
  ```
- **Remediation**: Add 502, 503, and network timeout to retryable conditions.

### [LOW-006] Notification Delivery Failures Swallowed Silently

- **Severity**: LOW
- **OWASP**: A09:2025 (Security Logging and Alerting Failures)
- **CWE**: CWE-778 (Insufficient Logging)
- **NIST CSF**: DE.AE (Adverse Event Analysis)
- **Location**: `src/core/notify.ts:76-86`
- **Previous ID**: LOW-009 (carried forward)
- **Details**: `sendHttp` returns `{ success: false }` but never logs the failure. If all channels fail, there is no record.
- **Remediation**: Log notification failures to stderr at minimum.

### [LOW-007] Cron Expression Interpolated in raw() Shell

- **Severity**: LOW
- **OWASP**: A05:2025 (Injection)
- **CWE**: CWE-78 (OS Command Injection)
- **NIST CSF**: PR.DS (Data Security)
- **Location**: `src/core/backupSchedule.ts:106`
- **Previous ID**: LOW-002 (carried forward)
- **Details**: Cron expression interpolated into `raw()` within single quotes. Currently safe because `validateCronExpr()` uses strict regex `/^[0-9*,/-]+$/` per field. Pattern is fragile -- if regex is ever relaxed, injection becomes possible.
- **Remediation**: Use `shellEscape()` on cron expression before embedding in `raw()`.

### [LOW-008] server_lock and server_secure Lack isSafeMode() Check

- **Severity**: LOW
- **OWASP**: A01:2025 (Broken Access Control)
- **CWE**: CWE-862 (Missing Authorization)
- **NIST CSF**: PR.AA (Identity Management)
- **Location**: `src/mcp/tools/serverLock.ts`, `src/mcp/tools/serverSecure.ts`
- **Previous ID**: LOW-003 (carried forward)
- **Details**: Unlike destroy/provision/restore which check `isSafeMode()`, these tools can modify production servers with SAFE_MODE=true. `server_lock` applies 24 hardening steps. Has `production=true` safety gate but not SAFE_MODE.
- **Remediation**: Document that lock/secure are intentionally exempt (hardening is additive security, not destructive), or add isSafeMode() guard.

---

## Informational Findings

### [INFO-001] Outdated Dependencies (Non-Vulnerable)

- **Severity**: INFO
- **OWASP**: A03:2025
- **Location**: `package.json`
- **Details**: `npm audit` reports 0 vulnerabilities. Some packages have newer versions (MCP SDK, axios, eslint, jest, typescript). None have known security issues. Dependabot now configured for GitHub Actions (P98).

### [INFO-002] MCP Server Relies on Stdio Transport for Auth

- **Severity**: INFO
- **OWASP**: A01:2025
- **Location**: `src/mcp/index.ts`
- **Details**: No MCP-level authentication. Standard MCP architecture -- stdio transport is inherently authenticated by the calling process. SAFE_MODE defaults to true in MCP config.

### [INFO-003] SSH Root Login

- **Severity**: INFO
- **OWASP**: A07:2025
- **Location**: `src/utils/ssh.ts:168-169`
- **Details**: All SSH as `root@${ip}`. Standard for server provisioning tools (Ansible, Terraform default to root). Required for hardening operations.

### [INFO-004] Source Maps Shipped in npm Package

- **Severity**: INFO
- **OWASP**: A02:2025
- **CWE**: CWE-540
- **Location**: `tsconfig.json`, `package.json:11-17`
- **Details**: `.js.map` files published to npm. Acceptable for open-source CLI.

---

## Gray-Box Findings

### [GRAY-001] MCP Destructive Ops Properly Gated by SAFE_MODE

- **Severity**: INFO
- **OWASP**: A01:2025
- **Tested As**: MCP client (Claude Code)
- **Endpoint**: `server_provision`, `server_manage` (destroy), `server_backup` (restore)
- **Expected**: Destructive operations require explicit opt-in
- **Actual**: SAFE_MODE correctly blocks all destructive operations when enabled. Working as designed.

### Previous GRAY-001 (Bot Exposure) -- FIXED

The previous finding about bot commands exposing server inventory when allowlist is empty has been fixed. The `allowedChatIdsMiddleware` now returns early (deny all) when `allowed.length === 0` (line 36-37 of `src/core/bot/middleware.ts`).

---

## Security Hotspots

### [HOTSPOT-001] Token Encryption Module

- **OWASP**: A04:2025 | **CWE**: CWE-327 | **NIST**: PR.DS
- **Location**: `src/utils/encryption.ts` (entire file, 97 lines)
- **Why sensitive**: NEW in P98. Central to all token protection. AES-256-GCM with scrypt key derivation. Any change to algorithm, salt, or key derivation breaks all stored tokens.
- **Review guidance**: Never change the scrypt parameters, salt string, or IV size without a migration path. Validate that `getAuthTag()` is always checked during decryption.

### [HOTSPOT-002] SSH Command Execution

- **OWASP**: A05:2025 | **CWE**: CWE-78 | **NIST**: PR.DS
- **Location**: `src/utils/ssh.ts:159-369`
- **Why sensitive**: All remote server commands flow through here. `spawn()` with array args, `assertValidIp()`, `sanitizedEnv()`, timeouts -- currently safe.
- **Review guidance**: Never change `spawn` to `exec`. Ensure IP validation before every call.

### [HOTSPOT-003] SCP Path Validation

- **OWASP**: A05:2025 | **CWE**: CWE-78 | **NIST**: PR.DS
- **Location**: `src/utils/scp.ts:12-17`
- **Why sensitive**: `assertSafePath()` blocks shell metacharacters. Weakening regex enables RCE.

### [HOTSPOT-004] IP Address Validation

- **OWASP**: A01:2025 | **CWE**: CWE-918 | **NIST**: PR.AA
- **Location**: `src/utils/ssh.ts:91-124`
- **Why sensitive**: Blocks SSRF to private/cloud metadata IPs. Leading zero octal bypass prevented.

### [HOTSPOT-005] Provider API Response Sanitization

- **OWASP**: A04:2025 | **CWE**: CWE-200 | **NIST**: PR.DS
- **Location**: `src/providers/base.ts`
- **Why sensitive**: Whitelist approach prevents API token leakage in error messages.

### [HOTSPOT-006] SAFE_MODE Guard

- **OWASP**: A01:2025 | **CWE**: CWE-284 | **NIST**: PR.AA
- **Location**: `src/core/manage.ts:15-37`
- **Why sensitive**: Single gate for all destructive operations. Consistently enforced on destroy, provision, restore, snapshot, restart, maintain.

### [HOTSPOT-007] Environment Sanitization

- **OWASP**: A04:2025 | **CWE**: CWE-526 | **NIST**: PR.DS
- **Location**: `src/utils/ssh.ts:126-140`
- **Why sensitive**: Strips TOKEN/SECRET/PASSWORD/CREDENTIAL from SSH subprocess env.

---

## Code Smells

### [SMELL-001] Silent Catch Blocks in Configuration I/O

- **OWASP**: A10:2025 | **CWE**: CWE-390 | **NIST**: DE.AE
- **Location**: Multiple files across codebase
- **Pattern**: `catch { return {} }` or `catch { /* ignore */ }` for file I/O
- **Security implication**: Silent failures in security-critical config paths can mask corruption or tampering. Notable improvement: `getServers()` now throws on corruption (MEDIUM-008 fixed), but many other paths remain silent.

### [SMELL-002] Inconsistent Error Response Patterns

- **OWASP**: A10:2025 | **CWE**: CWE-755 | **NIST**: DE.AE
- **Location**: Various command/core/MCP files
- **Pattern**: Some paths use `process.exit(1)`, others throw, others return result objects
- **Security implication**: Error path that does not properly terminate could continue in inconsistent state.

### [SMELL-003] Provider API Success Responses Not Validated

- **OWASP**: A08:2025 | **CWE**: CWE-20 | **NIST**: PR.DS
- **Location**: All `src/providers/*.ts` files
- **Pattern**: `response.data.server.id.toString()` with `as` type assertions, no schema validation
- **Security implication**: Compromised or malfunctioning API could cause null dereference or unexpected behavior.

---

## Positive Security Observations

The following areas were audited and found to be **well-implemented**:

1. **Shell Injection Prevention**: `spawn()` with array arguments everywhere. `SshCommand` branded type with `cmd()`/`raw()`/`shellEscape()` provides compile-time safety.
2. **SSRF Protection**: `assertValidIp()` blocks loopback, private, reserved, multicast, and cloud metadata IPs. Leading zero octal bypass prevented. Provider base URLs hardcoded. `assertSafeWebhookUrl()` enforces HTTPS and blocks private IPs.
3. **Token Encryption** (NEW P98): AES-256-GCM with 12-byte random IV, scrypt key derivation, authenticated encryption. Transparent migration from plaintext on first write.
4. **Bot Middleware Fail-Closed** (NEW P98): Empty allowlist now denies all messages (line 36-37 of middleware.ts).
5. **SHELL_METACHAR Guard** (IMPROVED P98): Now includes `\n\r\0` in addition to `;|&$()><`.
6. **sendTelegram SSRF Guard** (NEW P98): Bot token format validated with regex before URL construction.
7. **Unhandled Rejection Handlers** (NEW P98): Both CLI and MCP entry points handle unhandled promise rejections.
8. **getServers() Fail-Closed** (NEW P98): Throws on corrupt data instead of returning empty array.
9. **GitHub Actions SHA-Pinned** (NEW P98): All 3 actions pinned to full commit SHA with version comments. Dependabot configured for weekly updates.
10. **npm Provenance** (NEW P98): `--provenance` flag with `id-token: write` permission.
11. **Hetzner Token Step-Scoped** (NEW P98): Only provision and destroy steps have access.
12. **YAML Safe Parsing**: `yaml.JSON_SCHEMA` prevents `!!js/function` deserialization.
13. **No eval/Function**: Zero `eval()` or `new Function()` in source code.
14. **Environment Sanitization**: `sanitizedEnv()` strips all sensitive env vars before SSH.
15. **API Error Sanitization**: `sanitizeResponseData()` whitelist approach + `stripSensitiveData()` + `sanitizeStderr()`.
16. **Timeouts**: All SSH (30s/120s) and API (15s) operations have explicit timeouts with SIGTERM+SIGKILL cleanup.
17. **Buffer Limits**: SSH stdout/stderr capped at 1MB.
18. **Zod Validation**: MCP tool inputs validated via Zod schemas.
19. **Atomic Config Writes**: `atomicWriteServers()` uses tmp+rename pattern.
20. **File Lock**: `withFileLock()` prevents race conditions with stale lock detection.
21. **Token Buffer Cleanup**: Exit/signal handlers zero token buffers on process termination.
22. **Domain Input Validation**: `isValidDomain()`, `sanitizeDomain()`, SQL escaping.
23. **Fix Handler Atomicity**: Handler chain with reverse-order rollback on failure (D-16).
24. **Fix Handler Idempotency**: Sysctl, fileAppend, packageInstall all check current state before applying (D-11/D-12).
25. **Dependabot** (NEW P98): Configured for github-actions ecosystem with weekly schedule.

---

## Recommendations Summary

### Priority 1: Near-Term (v1.16 or v1.17)

1. **Fix fileAppend handler single-quote injection** -- Apply `line.replace(/'/g, "'\\''")` before embedding in `raw()` (MEDIUM-004)
2. **Add per-installation random salt** for key derivation to prevent pre-computation (MEDIUM-001)
3. **Generate fallback machine ID** from random bytes instead of hostname+platform+arch (MEDIUM-002)

### Priority 2: Long-Term (v2.0)

4. **Structured security logging** -- JSON format to file for forensic capability (HIGH-001)
5. **Server-side guard notifications** -- webhook or push for breach alerts (MEDIUM-003)
6. **Windows NTFS ACL** for sensitive files instead of no-op POSIX mode (MEDIUM-005)
7. **Validate provider API responses** with Zod schemas (SMELL-003)
8. **Add `eslint-plugin-security`** for automated pattern detection (LOW-003)
9. **Add retry for 502/503** transient errors (LOW-005)

---

## Methodology

| Aspect | Details |
|--------|---------|
| Phases executed | 1 (Recon), 2 (White-box), 3 (Gray-box), 4 (Hotspots), 5 (Smells) |
| Frameworks detected | Node.js/TypeScript CLI (Commander.js), MCP Server (@modelcontextprotocol/sdk), Grammy (Telegram) |
| White-box categories | All 10 OWASP Top 10:2025 categories |
| Gray-box testing | MCP client role, Telegram user role |
| Security hotspots | 7 flagged (encryption, SSH, SCP, IP validation, API sanitization, SAFE_MODE, env sanitization) |
| Code smells | 3 identified (silent catches, inconsistent errors, unvalidated API responses) |
| Scope exclusions | none (no `.security-audit-ignore` file) |
| Baseline comparison | Previous audit (2026-03-28) -- 10 findings fixed, 14 resolved total |
| npm audit | 0 vulnerabilities |
| OWASP Top 10:2025 | 10/10 categories covered |
| NIST CSF 2.0 | GV, ID, PR, DE, RS, RC functions covered |
| CWE | 15 unique CWE IDs identified |
| SANS/CWE Top 25 | 2/25 matched (down from 4) |
| Additional frameworks | PCI DSS 4.0.1, MITRE ATT&CK, SOC 2, ISO 27001:2022, OWASP ASVS 5.0 |
| Files scanned | ~37,000+ lines TypeScript across 76+ source files |
| Key P98 files reviewed | encryption.ts, auth.ts, notifyStore.ts, config.ts, ssh.ts, notify.ts, middleware.ts, ci.yml, publish.yml, staging.yml, dependabot.yml |

---

*Report generated by Claude Security Audit (Opus 4.6 1M context)*
