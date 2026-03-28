# Security Audit Report

**Project**: Kastell v1.15.0 (CLI toolkit for server provisioning, securing, and management)
**Date**: 2026-03-28
**Auditor**: Claude Security Audit (4 parallel agents + manual review)
**Frameworks**: OWASP Top 10:2025 + NIST CSF 2.0
**Mode**: full

---

## Executive Summary

| Metric | Count |
|--------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 3 |
| 🟡 Medium | 11 |
| 🟢 Low | 10 |
| 🔵 Informational | 4 |
| 🔲 Gray-box findings | 2 |
| 📍 Security hotspots | 6 |
| 🧹 Code smells | 3 |
| **Total findings** | **39** |

**Overall Risk Assessment**: Kastell demonstrates strong security engineering for a CLI tool managing production servers. The codebase uses `spawn()` with array arguments (no shell injection), validates all IPs before SSH with octal-bypass prevention, sanitizes environment variables, implements SAFE_MODE guards, and uses branded `SshCommand` types for defense-in-depth. No critical vulnerabilities found. Primary risks: plaintext token storage (v1.16 planned), dependency CVE (immediate fix), and bot middleware fail-open. The MCP server intentionally relies on stdio transport isolation for auth (standard MCP architecture).

---

## OWASP Top 10:2025 Coverage

| OWASP ID | Category | Findings | Status |
|----------|----------|----------|--------|
| A01:2025 | Broken Access Control | 3 | 🔴 Needs Attention |
| A02:2025 | Security Misconfiguration | 3 | ✅ Acceptable |
| A03:2025 | Software Supply Chain Failures | 3 | 🔴 Needs Attention |
| A04:2025 | Cryptographic Failures | 3 | 🔴 Needs Attention |
| A05:2025 | Injection | 3 | ✅ Acceptable |
| A06:2025 | Insecure Design | 1 | ✅ Acceptable |
| A07:2025 | Authentication Failures | 2 | ✅ Acceptable |
| A08:2025 | Software or Data Integrity Failures | 3 | 🔴 Needs Attention |
| A09:2025 | Security Logging and Alerting Failures | 3 | 🔴 Needs Attention |
| A10:2025 | Mishandling of Exceptional Conditions | 7 | 🔴 Needs Attention |

---

## NIST CSF 2.0 Coverage

| Function | Categories | Findings | Status |
|----------|-----------|----------|--------|
| GV (Govern) | GV.OC, GV.RM, GV.RR, GV.PO, GV.OV, GV.SC | 3 | 🔴 Needs Attention |
| ID (Identify) | ID.AM, ID.RA, ID.IM | 1 | ✅ Acceptable |
| PR (Protect) | PR.AA, PR.AT, PR.DS, PR.PS, PR.IR | 8 | 🔴 Needs Attention |
| DE (Detect) | DE.CM, DE.AE | 5 | 🔴 Needs Attention |
| RS (Respond) | RS.MA, RS.AN, RS.CO, RS.MI | 0 | ✅ Acceptable |
| RC (Recover) | RC.RP, RC.CO | 0 | ✅ Acceptable |

---

## Compliance Coverage

| Framework | Coverage | Details |
|-----------|----------|---------|
| CWE | 20 unique CWEs identified | CWE-78, CWE-280, CWE-312, CWE-330, CWE-390, CWE-400, CWE-502, CWE-526, CWE-636, CWE-732, CWE-755, CWE-778, CWE-798, CWE-829, CWE-862, CWE-918, CWE-942, CWE-1104, CWE-1188, CWE-1333 |
| SANS/CWE Top 25 | 4/25 entries found | #7 (CWE-78), #9 (CWE-862), #22 (CWE-798), #24 (CWE-400) |
| OWASP ASVS 5.0 | 7/14 chapters with findings | V2, V4, V5, V6, V7, V8, V14 |
| PCI DSS 4.0.1 | 5 requirements relevant | 3.3-3.5, 6.2.4, 6.3, 8.2-8.6, 10.2-10.7 |
| MITRE ATT&CK | 5 techniques mapped | T1059, T1078, T1195, T1499, T1552.001 |
| SOC 2 | 5 criteria with findings | CC6.1, CC6.7, CC6.8, CC7.1, CC7.4 |
| ISO 27001:2022 | 5 controls with findings | A.8.6, A.8.8, A.8.9, A.8.16, A.8.24 |

---

## 🟠 High Findings

### 🟠 [HIGH-001] path-to-regexp ReDoS Vulnerability (CVE)
- **Severity**: 🟠 HIGH
- **OWASP**: A03:2025 (Software Supply Chain Failures)
- **CWE**: CWE-1333 (Inefficient Regular Expression Complexity)
- **NIST CSF**: GV.SC (Supply Chain Risk Management)
- **Compliance**: SANS Top 25 #24 | ASVS V14.2.1 | PCI DSS 6.3 | T1499 | CC6.8 | A.8.8
- **Location**: `node_modules/path-to-regexp` (v8.0.0-8.3.0, transitive dependency)
- **Attack Vector**:
  1. GHSA-j3q9-mxjg-w52f: DoS via sequential optional groups
  2. GHSA-27v5-c462-wpq7: ReDoS via multiple wildcards
  3. Crafted path patterns cause CPU exhaustion
- **Impact**: Denial of service if path-to-regexp processes user-controlled input
- **Vulnerable Code**: `npm audit` reports 1 high severity vulnerability
- **Remediation**: Run `npm audit fix` to upgrade to patched version.

### 🟠 [HIGH-002] Telegram Bot Token Stored in Plaintext
- **Severity**: 🟠 HIGH
- **OWASP**: A04:2025 (Cryptographic Failures)
- **CWE**: CWE-312 (Cleartext Storage of Sensitive Information), CWE-732 (Incorrect Permission Assignment)
- **NIST CSF**: PR.DS (Data Security)
- **Compliance**: SANS Top 25 #22 | ASVS V6.4.1 | PCI DSS 3.4 | T1552.001 | CC6.7 | A.8.24
- **Location**: `src/core/notifyStore.ts:43`, `src/core/auth.ts:24`
- **Attack Vector**:
  1. When OS keychain is unavailable (Windows, headless Linux, Android), bot token and cloud provider tokens stored in plaintext JSON files
  2. On Windows, `mode: 0o600` is **ignored by the OS** — files use default ACL (potentially world-readable)
  3. Any local user/malware reads `~/.kastell/tokens.json` and `~/.kastell/notify-secrets.json`
- **Impact**: Full cloud provider API access (create/destroy servers), Telegram bot control
- **Vulnerable Code**:
  ```typescript
  // src/core/notifyStore.ts:43
  writeFileSync(NOTIFY_SECRETS_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
  // mode: 0o600 is a no-op on Windows!
  ```
- **Remediation**: Encrypt with AES-256-GCM using machine-specific key (planned v1.16). On Windows, consider DPAPI via native binding.

### 🟠 [HIGH-003] No Security Event Logging
- **Severity**: 🟠 HIGH
- **OWASP**: A09:2025 (Security Logging and Alerting Failures)
- **CWE**: CWE-778 (Insufficient Logging)
- **NIST CSF**: DE.CM (Continuous Monitoring)
- **Compliance**: ASVS V7.1.1 | PCI DSS 10.2-10.7 | T1562 | CC7.1 | A.8.16
- **Location**: `src/utils/logger.ts` (entire file)
- **Attack Vector**:
  1. Logger is purely console output (chalk colors) — no timestamps, no file output, no structured logging
  2. No logging for: failed SSH, destructive operations (destroy, provision), MCP tool invocations, configuration changes, SAFE_MODE bypasses
  3. `debugLog` is dead code (0 calls in codebase)
  4. An attacker who gains CLI or MCP access leaves zero forensic trail
- **Impact**: No detection, no alerting, no post-incident forensic capability
- **Vulnerable Code**:
  ```typescript
  // src/utils/logger.ts
  export const logger = {
    info: (message: string) => { console.log(chalk.blue("i"), message); },
    error: (message: string) => { console.log(chalk.red("x"), message); },
  };
  ```
- **Remediation**: Add structured JSON logging to `~/.kastell/security.log` for destructive ops, auth events, SSH connections, and MCP invocations. Priority: v2.0 when daemon mode becomes primary.

---

## 🟡 Medium Findings

### 🟡 [MEDIUM-001] Telegram Bot Middleware Fail-Open on Empty Allowlist
- **Severity**: 🟡 MEDIUM
- **OWASP**: A10:2025 (Mishandling of Exceptional Conditions)
- **CWE**: CWE-280 (Improper Handling of Insufficient Permissions), CWE-1188 (Insecure Default)
- **NIST CSF**: DE.AE (Adverse Event Analysis)
- **Compliance**: ASVS V4.1.1 | CC7.4 | A.8.6
- **Location**: `src/core/bot/middleware.ts:33-38`
- **Attack Vector**: When `allowedChatIds` is empty (default), ALL Telegram users accepted. Also triggered when `notify-channels.json` has corrupt JSON (catch returns `[]`)
- **Impact**: Server inventory, audit scores, health data exposed to any Telegram user
- **Vulnerable Code**:
  ```typescript
  if (allowed.length === 0) {
    await next();  // FAIL-OPEN
    return;
  }
  ```
- **Remediation**: Fail-closed: reject all messages when allowlist is empty.

### 🟡 [MEDIUM-002] Audit Fix Command Metachar Regex Missing Newlines
- **Severity**: 🟡 MEDIUM
- **OWASP**: A05:2025 (Injection)
- **CWE**: CWE-78 (OS Command Injection)
- **NIST CSF**: PR.DS (Data Security)
- **Compliance**: SANS Top 25 #7 | ASVS V5.3.8 | PCI DSS 6.2.4 | T1059 | CC6.6 | A.8.28
- **Location**: `src/core/audit/fix.ts:42`
- **Attack Vector**:
  1. `SHELL_METACHAR` regex blocks `;|&$()><` but NOT `\n`, `\r`, `\0`
  2. A command like `chmod 777 /etc\nwhoami` passes both prefix whitelist and metachar check
  3. When passed to `raw()` and SSH, the newline executes a second command
  4. Practical risk is LOW because fix commands come from hardcoded check definitions, not user input
- **Impact**: Remote code execution if audit check definitions are ever compromised
- **Vulnerable Code**:
  ```typescript
  const SHELL_METACHAR = /[;&|`$()><]/;  // Missing \n \r \0
  ```
- **Remediation**: Add `\n\r\0` to regex: `/[;&|`$()><\n\r\0]/`

### 🟡 [MEDIUM-003] GitHub Actions Not Pinned to SHA
- **Severity**: 🟡 MEDIUM
- **OWASP**: A08:2025 (Software or Data Integrity Failures)
- **CWE**: CWE-829 (Inclusion of Functionality from Untrusted Control Sphere)
- **NIST CSF**: GV.SC (Supply Chain Risk Management)
- **Compliance**: ASVS V14.2.6 | PCI DSS 6.5 | T1195.002 | CC8.1 | A.8.30
- **Location**: All `.github/workflows/*.yml` files
- **Attack Vector**: Tags are mutable — compromised action can be updated keeping same tag. Codecov had a real attack via this vector in 2021
- **Impact**: CI pipeline compromise, NPM_TOKEN exfiltration
- **Vulnerable Code**:
  ```yaml
  - uses: actions/checkout@v4          # Should be @<SHA>
  - uses: actions/setup-node@v4
  - uses: codecov/codecov-action@v5
  ```
- **Remediation**: Pin all actions to full commit SHA. Use Dependabot for SHA updates.

### 🟡 [MEDIUM-004] npm Publish Lacks Provenance Attestation
- **Severity**: 🟡 MEDIUM
- **OWASP**: A08:2025 (Software or Data Integrity Failures)
- **CWE**: CWE-345 (Insufficient Verification of Data Authenticity)
- **NIST CSF**: GV.SC (Supply Chain Risk Management)
- **Compliance**: ASVS V14.2.6 | PCI DSS 6.5 | CC8.1 | A.8.30
- **Location**: `.github/workflows/publish.yml:29`
- **Attack Vector**: Published npm package has no SLSA provenance attestation, making it harder for consumers to verify the package came from the CI pipeline
- **Remediation**: Add `--provenance` to `npm publish`. Use a granular automation token scoped to `kastell` package.

### 🟡 [MEDIUM-005] Hetzner Token Scoped to Entire Staging Job
- **Severity**: 🟡 MEDIUM
- **OWASP**: A02:2025 (Security Misconfiguration)
- **CWE**: CWE-200 (Exposure of Sensitive Information)
- **NIST CSF**: PR.DS (Data Security)
- **Compliance**: ASVS V8.1.1 | CC6.7
- **Location**: `.github/workflows/staging.yml:14-15`
- **Attack Vector**: `HETZNER_TOKEN` is a top-level job env var, available to ALL steps including destroy step that creates GitHub issues
- **Remediation**: Scope `HETZNER_TOKEN` to only the steps that need it (provision, health, audit, destroy).

### 🟡 [MEDIUM-006] sendTelegram Bypasses SSRF Protection
- **Severity**: 🟡 MEDIUM
- **OWASP**: A01:2025 (Broken Access Control — SSRF)
- **CWE**: CWE-918 (Server-Side Request Forgery)
- **NIST CSF**: PR.DS (Data Security)
- **Compliance**: ASVS V12.6.1 | CC6.6
- **Location**: `src/core/notify.ts:88-94`
- **Attack Vector**: `sendDiscord` and `sendSlack` call `assertSafeWebhookUrl()` before HTTP request, but `sendTelegram` does NOT. Mitigated by Zod regex validation on bot token at config time, but `sendTelegram` is a public export callable with unvalidated input.
- **Remediation**: Add URL validation to `sendTelegram` or validate botToken format before URL construction.

### 🟡 [MEDIUM-007] No Unhandled Rejection Handler
- **Severity**: 🟡 MEDIUM
- **OWASP**: A10:2025 (Mishandling of Exceptional Conditions)
- **CWE**: CWE-755 (Improper Handling of Exceptional Conditions)
- **NIST CSF**: DE.AE (Adverse Event Analysis)
- **Compliance**: CC7.4 | A.8.6
- **Location**: `src/index.ts`, `src/mcp/index.ts`
- **Attack Vector**: No `process.on('unhandledRejection')` in CLI or MCP entry points. In MCP server, unhandled promise rejection in a tool handler crashes process silently, terminating MCP connection.
- **Remediation**: Add unhandled rejection handler to both entry points.

### 🟡 [MEDIUM-008] getServers() Fails Open on Corrupted Config
- **Severity**: 🟡 MEDIUM
- **OWASP**: A10:2025 (Mishandling of Exceptional Conditions)
- **CWE**: CWE-636 (Not Failing Securely)
- **NIST CSF**: DE.AE (Adverse Event Analysis)
- **Compliance**: CC7.4
- **Location**: `src/utils/config.ts:24-44`
- **Attack Vector**: Corrupted `servers.json` → empty list returned → no servers to protect → fleet dashboard empty, guard sees nothing to monitor
- **Remediation**: Throw error or exit non-zero for destructive operations when config is corrupted, instead of silently returning empty.

### 🟡 [MEDIUM-009] loadAllowedChatIds Fails Open on JSON Parse Error
- **Severity**: 🟡 MEDIUM
- **OWASP**: A10:2025 (Mishandling of Exceptional Conditions)
- **CWE**: CWE-755 (Improper Handling of Exceptional Conditions)
- **NIST CSF**: DE.AE (Adverse Event Analysis)
- **Location**: `src/core/notifyStore.ts:228-235`
- **Attack Vector**: Malformed JSON in `notify-channels.json` → catch returns `[]` → triggers fail-open in bot middleware (MEDIUM-001)
- **Remediation**: Log warning on parse failure and return sentinel that middleware treats as "deny all".

### 🟡 [MEDIUM-010] Guard Notifications Are Client-Side Only
- **Severity**: 🟡 MEDIUM
- **OWASP**: A09:2025 (Security Logging and Alerting Failures)
- **CWE**: CWE-223 (Omission of Security-relevant Information)
- **NIST CSF**: DE.CM (Continuous Monitoring)
- **Location**: `src/core/guard.ts:99-103`
- **Attack Vector**: Remote guard cron script has no-op `notify()`. Breach notifications only happen when someone runs `kastell guard status` locally. Unattended breaches go unnoticed.
- **Remediation**: Add server-side notification capability (webhook or push) to guard script.

### 🟡 [MEDIUM-011] Cloud Provider API Tokens Also Stored in Plaintext
- **Severity**: 🟡 MEDIUM
- **OWASP**: A04:2025 (Cryptographic Failures)
- **CWE**: CWE-312 (Cleartext Storage of Sensitive Information)
- **NIST CSF**: PR.DS (Data Security)
- **Location**: `src/core/auth.ts:24`
- **Attack Vector**: Same as HIGH-002 but for cloud provider tokens (Hetzner, DO, Vultr, Linode). These tokens can create/destroy servers and access infrastructure.
- **Remediation**: Same as HIGH-002 — encrypt with AES-256-GCM (v1.16 planned).

---

## 🟢 Low & 🔵 Informational Findings

### 🟢 [LOW-001] clearKnownHostKey() Missing IP Validation
- **Severity**: 🟢 LOW
- **OWASP**: A05:2025 (Injection)
- **CWE**: CWE-20 (Improper Input Validation)
- **Location**: `src/utils/ssh.ts:79-81`
- **Details**: Unlike `removeStaleHostKey()` (line 146), `clearKnownHostKey()` does not call `assertValidIp()`. Uses `spawnSync` with array args (no shell injection), but lacks defense-in-depth. Current callers validate IP beforehand.
- **Remediation**: Add `assertValidIp(ip)` at top, use `sanitizedEnv()`.

### 🟢 [LOW-002] Cron Expression Interpolated in Single-Quoted Shell
- **Severity**: 🟢 LOW
- **OWASP**: A05:2025 (Injection)
- **CWE**: CWE-78 (OS Command Injection)
- **Location**: `src/core/backupSchedule.ts:106`
- **Details**: Cron expression interpolated into `raw()` within single quotes. Currently safe because `validateCronExpr()` uses strict regex `/^[0-9*,/-]+$/` per field. But pattern is fragile — if regex is ever relaxed, injection possible.
- **Remediation**: Use `shellEscape()` on entry string before embedding in `raw()`.

### 🟢 [LOW-003] server_lock and server_secure Lack isSafeMode() Check
- **Severity**: 🟢 LOW
- **OWASP**: A01:2025 (Broken Access Control)
- **CWE**: CWE-862 (Missing Authorization)
- **Location**: `src/mcp/tools/serverLock.ts`, `src/mcp/tools/serverSecure.ts`
- **Details**: Unlike destroy/provision/restore which check `isSafeMode()`, these tools can modify production servers with SAFE_MODE=true. `server_lock` applies 24 hardening steps, `server_secure` modifies SSH/firewall/domain. Has `production=true` safety gate but not SAFE_MODE.
- **Remediation**: Document that lock/secure are intentionally exempt, or add isSafeMode() guard.

### 🟢 [LOW-004] Linode Root Password Static Prefix
- **Severity**: 🟢 LOW
- **OWASP**: A04:2025 (Cryptographic Failures)
- **CWE**: CWE-330 (Use of Insufficiently Random Values)
- **Location**: `src/providers/linode.ts:75`
- **Details**: `Ql1!` prefix on every generated password. Reduces entropy by 4 known chars. Mitigated by cloud-init disabling password login.
- **Remediation**: Generate full password from random bytes, inject complexity at random positions.

### 🟢 [LOW-005] Host Key Verification Default TOFU
- **Severity**: 🟢 LOW
- **OWASP**: A07:2025 (Authentication Failures)
- **CWE**: CWE-295 (Improper Certificate Validation)
- **Location**: `src/utils/ssh.ts:18-20`
- **Details**: Default SSH host key policy "accept-new" (Trust On First Use). Standard practice but MITM-vulnerable on first connection. `KASTELL_STRICT_HOST_KEY=true` available.
- **Remediation**: Document risk, recommend strict mode for high-security environments.

### 🟢 [LOW-006] ESLint Config Lacks Security Plugins
- **Severity**: 🟢 LOW
- **OWASP**: A02:2025 (Security Misconfiguration)
- **CWE**: CWE-1078 (Inappropriate Source Code Style)
- **Location**: `eslint.config.js`
- **Details**: Only `eslint:recommended` + `typescript-eslint:recommended`. No `eslint-plugin-security` for automated injection pattern detection.
- **Remediation**: Add `eslint-plugin-security`.

### 🟢 [LOW-007] JSON.parse on SSH Output Without Zod Validation
- **Severity**: 🟢 LOW
- **OWASP**: A08:2025 (Software or Data Integrity Failures)
- **CWE**: CWE-502 (Deserialization of Untrusted Data)
- **Location**: `src/core/doctor.ts:361`, `src/core/audit/checks/docker.ts:89,202`
- **Details**: Some `JSON.parse` calls on SSH command output use `as` type assertions instead of Zod schema validation. Malformed data could cause runtime errors.
- **Remediation**: Add Zod validation for SSH output parsing in security-critical paths.

### 🟢 [LOW-008] Retry Logic Only Handles HTTP 429
- **Severity**: 🟢 LOW
- **OWASP**: A10:2025 (Mishandling of Exceptional Conditions)
- **CWE**: CWE-755 (Improper Handling of Exceptional Conditions)
- **Location**: `src/utils/retry.ts:21-47`
- **Details**: Only 429 (Rate Limit) triggers retry. 502/503/ETIMEDOUT are not retried. Brief cloud provider outage causes immediate failure.
- **Remediation**: Add 502, 503, and network timeout to retryable conditions.

### 🟢 [LOW-009] Notification Delivery Failures Swallowed Silently
- **Severity**: 🟢 LOW
- **OWASP**: A09:2025 (Security Logging and Alerting Failures)
- **CWE**: CWE-778 (Insufficient Logging)
- **Location**: `src/core/notify.ts:76-86`
- **Details**: `sendHttp` returns `{ success: false }` but never logs the failure. If all channels fail, there's no record.
- **Remediation**: Log notification failures to stderr.

### 🟢 [LOW-010] Dead debugLog Export
- **Severity**: 🟢 LOW
- **OWASP**: A02:2025 (Security Misconfiguration)
- **CWE**: CWE-215 (Insertion of Sensitive Information Into Debugging Code)
- **Location**: `src/utils/logger.ts:39-41`
- **Details**: `debugLog` controlled by generic `DEBUG` env var, but never called anywhere (0 usages). Dead code that could be activated by other libraries setting `DEBUG=true`.
- **Remediation**: Remove or rename to `KASTELL_DEBUG`.

### 🔵 [INFO-001] Outdated Dependencies (Non-Vulnerable)
- **Severity**: 🔵 INFO
- **OWASP**: A03:2025
- **Location**: `package.json`
- **Details**: Several packages have newer versions (MCP SDK, axios, eslint, jest, typescript). None have known vulnerabilities.

### 🔵 [INFO-002] MCP Server Relies on Stdio Transport for Auth
- **Severity**: 🔵 INFO
- **OWASP**: A01:2025
- **Location**: `src/mcp/index.ts`
- **Details**: No MCP-level authentication. Standard MCP architecture — stdio transport is inherently authenticated by the calling process. SAFE_MODE defaults to true in MCP config.

### 🔵 [INFO-003] SSH Root Login
- **Severity**: 🔵 INFO
- **OWASP**: A07:2025
- **Location**: `src/utils/ssh.ts:168,202`
- **Details**: All SSH as `root@${ip}`. Standard for server provisioning tools (Ansible, Terraform default to root). Required for hardening operations.

### 🔵 [INFO-004] Source Maps Shipped in npm Package
- **Severity**: 🔵 INFO
- **OWASP**: A02:2025
- **CWE**: CWE-540
- **Location**: `tsconfig.json:15`, `package.json:11-17`
- **Details**: `.js.map` files published to npm. Acceptable for open-source CLI.

---

## 🔲 Gray-Box Findings

### [GRAY-001] Bot Commands Expose Server Inventory When Allowlist Empty
- **Severity**: 🟡 MEDIUM
- **OWASP**: A01:2025
- **CWE**: CWE-200
- **NIST CSF**: PR.DS
- **Tested As**: Unauthenticated Telegram user (when allowlist empty — see MEDIUM-001)
- **Endpoint**: `/health`, `/status`, `/audit`, `/doctor` bot commands
- **Expected**: Only authorized users can view server fleet information
- **Actual**: Any Telegram user sees server names, IPs, audit scores, guard states, doctor findings
- **Remediation**: Fix MEDIUM-001 (fail-closed middleware)

### [GRAY-002] MCP Destructive Ops Properly Gated by SAFE_MODE
- **Severity**: 🔵 INFO
- **OWASP**: A01:2025
- **Tested As**: MCP client (Claude Code)
- **Endpoint**: `server_provision`, `server_manage` (destroy), `server_backup` (restore)
- **Expected**: Destructive operations require explicit opt-in
- **Actual**: SAFE_MODE correctly blocks all destructive operations when enabled. Working as designed.

---

## 📍 Security Hotspots

### [HOTSPOT-001] SSH Command Execution
- **OWASP**: A05:2025 | **CWE**: CWE-78 | **NIST**: PR.DS
- **Location**: `src/utils/ssh.ts:159-359`
- **Why sensitive**: All remote server commands flow through here. `spawn()` with array args, `assertValidIp()`, `sanitizedEnv()`, timeouts — currently safe.
- **Review guidance**: Never change `spawn` to `exec`. Ensure IP validation before every call.

### [HOTSPOT-002] SCP Path Validation
- **OWASP**: A05:2025 | **CWE**: CWE-78 | **NIST**: PR.DS
- **Location**: `src/utils/scp.ts:12-17`
- **Why sensitive**: `assertSafePath()` blocks shell metacharacters. Weakening regex enables RCE.

### [HOTSPOT-003] IP Address Validation
- **OWASP**: A01:2025 | **CWE**: CWE-918 | **NIST**: PR.AA
- **Location**: `src/utils/ssh.ts:90-123`
- **Why sensitive**: Blocks SSRF to private/cloud metadata IPs. Leading zero octal bypass prevented.

### [HOTSPOT-004] Provider API Response Sanitization
- **OWASP**: A04:2025 | **CWE**: CWE-200 | **NIST**: PR.DS
- **Location**: `src/providers/base.ts:46-90`
- **Why sensitive**: Whitelist approach prevents API token leakage in error messages.

### [HOTSPOT-005] SAFE_MODE Guard
- **OWASP**: A01:2025 | **CWE**: CWE-284 | **NIST**: PR.AA
- **Location**: `src/core/manage.ts:15-37`
- **Why sensitive**: Single gate for all destructive operations. Consistently enforced on destroy, provision, restore, snapshot, restart, maintain.

### [HOTSPOT-006] Environment Sanitization
- **OWASP**: A04:2025 | **CWE**: CWE-526 | **NIST**: PR.DS
- **Location**: `src/utils/ssh.ts:125-139`
- **Why sensitive**: Strips TOKEN/SECRET/PASSWORD/CREDENTIAL from SSH subprocess env.

---

## 🧹 Code Smells

### [SMELL-001] Silent Catch Blocks in Configuration I/O
- **OWASP**: A10:2025 | **CWE**: CWE-390 | **NIST**: DE.AE
- **Location**: 192 catch blocks across 76 source files
- **Pattern**: `catch { return {} }` or `catch { /* ignore */ }` for file I/O
- **Security implication**: Silent failures in security-critical config (tokens, allowlists) can trigger fail-open behavior

### [SMELL-002] Inconsistent Error Response Patterns
- **OWASP**: A10:2025 | **CWE**: CWE-755 | **NIST**: DE.AE
- **Location**: Various command/core/MCP files
- **Pattern**: Some paths use `process.exit(1)`, others throw, others return result objects
- **Security implication**: Error path that doesn't properly terminate could continue in inconsistent state

### [SMELL-003] Provider API Success Responses Not Validated
- **OWASP**: A08:2025 | **CWE**: CWE-20 | **NIST**: PR.DS
- **Location**: All `src/providers/*.ts` files
- **Pattern**: `response.data.server.id.toString()` with `as` type assertions, no schema validation
- **Security implication**: Compromised or malfunctioning API could cause null dereference or unexpected behavior

---

## Positive Security Observations

The following areas were audited and found to be **well-implemented**:

1. **Shell Injection Prevention**: `spawn()` with array arguments everywhere. `SshCommand` branded type with `cmd()`/`raw()`/`shellEscape()` provides compile-time safety.
2. **SSRF Protection**: `assertValidIp()` blocks loopback, private, reserved, multicast, and cloud metadata IPs. Leading zero octal bypass prevented. Provider base URLs hardcoded. `assertValidServerId()` prevents path traversal in API URLs.
3. **YAML Safe Parsing**: `yaml.JSON_SCHEMA` prevents `!!js/function` deserialization.
4. **No eval/Function**: Zero `eval()` or `new Function()` in source code.
5. **Environment Sanitization**: `sanitizedEnv()` strips all sensitive env vars before SSH.
6. **API Error Sanitization**: `sanitizeResponseData()` whitelist approach + `stripSensitiveData()` + `sanitizeStderr()`.
7. **Timeouts**: All SSH (30s/120s) and API (15s) operations have explicit timeouts with SIGTERM+SIGKILL cleanup.
8. **Buffer Limits**: SSH stdout/stderr capped at 1MB.
9. **Zod Validation**: MCP tool inputs validated via Zod schemas.
10. **File Permissions**: All sensitive files written with `mode: 0o600` (effective on Linux/macOS).
11. **Git History**: No committed secrets found.
12. **Atomic Config Writes**: `atomicWriteServers()` uses tmp+rename pattern.
13. **File Lock**: `withFileLock()` prevents race conditions with stale lock detection.
14. **Token Buffer Cleanup**: Exit/signal handlers zero token buffers on process termination.
15. **Webhook SSRF Protection**: Discord/Slack URLs validated against private IPs, require HTTPS.
16. **Domain Input Validation**: `isValidDomain()`, `sanitizeDomain()`, SQL escaping via `escapePsqlString()`.
17. **Doctor Fix Whitelist**: `KNOWN_FIX_COMMANDS` uses exact Set match (stronger than prefix-based).

---

## Recommendations Summary

### Priority 1: Immediate (This Week)
1. **`npm audit fix`** — patch path-to-regexp ReDoS (HIGH-001)
2. **Add `\n\r\0` to SHELL_METACHAR** in `src/core/audit/fix.ts:42` (MEDIUM-002)
3. **Bot middleware fail-closed** — deny all when allowlist empty (MEDIUM-001, MEDIUM-009)

### Priority 2: Near-Term (v1.16)
4. **Encrypt token storage** — AES-256-GCM for tokens.json and notify-secrets.json (HIGH-002, MEDIUM-011)
5. **Pin GitHub Actions to SHA** (MEDIUM-003)
6. **Add `--provenance` to npm publish** (MEDIUM-004)
7. **Scope Hetzner token** per-step in staging workflow (MEDIUM-005)
8. **Add unhandled rejection handler** to CLI and MCP entry points (MEDIUM-007)
9. **Add `assertValidIp()` to `clearKnownHostKey()`** (LOW-001)

### Priority 3: Long-Term (v2.0)
10. **Structured security logging** — JSON format to file for forensic capability (HIGH-003)
11. **Server-side guard notifications** — webhook or push for breach alerts (MEDIUM-010)
12. **Validate provider API responses** with Zod schemas (SMELL-003)
13. **Add `eslint-plugin-security`** for automated pattern detection (LOW-006)
14. **Add retry for 502/503** transient errors (LOW-008)

---

## Methodology

| Aspect | Details |
|--------|---------|
| Phases executed | 1 (Recon), 2 (White-box), 3 (Gray-box), 4 (Hotspots), 5 (Smells) |
| Frameworks detected | Node.js/TypeScript CLI (Commander.js), MCP Server (@modelcontextprotocol/sdk), Grammy (Telegram) |
| White-box categories | All 20 categories checked across 4 parallel agents |
| Gray-box testing | MCP client role, Telegram user role (open + restricted) |
| Security hotspots | 6 flagged (SSH, SCP, IP validation, API sanitization, SAFE_MODE, env sanitization) |
| Code smells | 3 identified (silent catches, inconsistent errors, unvalidated API responses) |
| Packs loaded | none |
| Scope exclusions | no (no `.security-audit-ignore` file) |
| Baseline comparison | no (no `.security-audit-baseline.json`) |
| OWASP Top 10:2025 | 10/10 categories covered |
| NIST CSF 2.0 | GV, ID, PR, DE, RS, RC functions covered |
| CWE | 20 unique CWE IDs identified |
| SANS/CWE Top 25 | 4/25 matched |
| ASVS 5.0 | V2, V4, V5, V6, V7, V8, V14 chapters checked |
| Additional frameworks | PCI DSS 4.0.1, MITRE ATT&CK, SOC 2, ISO 27001:2022 |
| Files scanned | ~37,000+ lines TypeScript across 76+ source files |
| Agents deployed | 4 parallel: Recon, Injection+Access, Crypto+Supply+Config, Auth+Integrity+Logging+Error |

---

*Report generated by Claude Security Audit*
