# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in Quicklify:

1. **DO NOT** open a public issue
2. Email: hello@omrfc.dev
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

Response time: Within 48 hours

## Security Architecture

### Token Handling (A2 — Sensitive Data Exposure)
- API tokens are **never stored on disk** — runtime prompt or environment variables only
- Supported env vars: `HETZNER_TOKEN`, `DIGITALOCEAN_TOKEN`, `VULTR_TOKEN`, `LINODE_TOKEN`
- API tokens collected via interactive secure prompts (masked input) when env vars are not set
- `sanitizedEnv()` strips all keys containing TOKEN, SECRET, PASSWORD, CREDENTIAL from child process environments before every `spawn`/`spawnSync`/`exec` call
- Provider errors sanitized via `stripSensitiveData()` — removes Authorization headers from axios errors before they reach error messages

### Input Validation (A1 — Injection)
- All shell execution uses `spawn`/`spawnSync` with array arguments (never string interpolation into shell commands)
- `assertValidIp()` — IPv4 format and octet range (0-255) validation applied before every SSH/SCP connection and before ssh-keygen calls (defense-in-depth)
- `assertSafePath()` — rejects remote SCP paths containing shell metacharacters (`;`, `|`, `&`, `$`, `` ` ``, `(`, `)`, `<`, `>`, newlines, spaces)
- Server name validation: 3-63 chars, lowercase alphanumeric + hyphens, must start with letter
- `buildHardeningCommand()` — SSH port option validated as integer in range 1-65535 before interpolation into sed command
- YAML config: 22+ security key patterns detected and warned
- MCP tools: Zod schema validation on all inputs (port ranges, provider enums, backup ID regex)

### SSH & Network Security
- `StrictHostKeyChecking=accept-new` for initial connections (first connect accepts key, subsequent connections verify)
- `BatchMode=yes` on non-interactive SSH (prevents stdin hijacking — critical for MCP mode)
- `ConnectTimeout=10` and 30s exec timeout prevent hanging connections
- Stale host key auto-removal with IP re-validation before `ssh-keygen -R` calls
- SSRF defense: `assertValidIp()` on all Coolify health check targets

### File System Security (A5 — Security Misconfiguration)
- Config directory (`~/.quicklify/`) created with `0o700` permissions (owner only)
- Server config file written with `0o600` permissions (owner read/write only)
- Backup directories created with `0o700` permissions
- Backup manifest files written with `0o600` permissions
- Export files written with `0o600` permissions
- Cloud-init install log restricted to `chmod 600` (root only)

### Error Handling & Data Exposure
- `getErrorMessage()` returns only `error.message` — never exposes stack traces to users
- `sanitizeStderr()` redacts home directory paths, IP addresses, `password=`, `token=`, `secret=` patterns from SSH stderr output (200 char limit)
- MCP error responses use `getErrorMessage()` — no stack trace disclosure

### Path Traversal Protection (A5)
- Backup restore: `backupId` regex validation + `path.resolve()` guard ensures backup path stays within the server's backup directory
- Remote SCP paths validated by `assertSafePath()` before use

### Access Control (A3 — Broken Access Control)
- **SAFE_MODE** (`QUICKLIFY_SAFE_MODE=true`, default enabled for MCP) blocks destructive operations: `destroy`, `restore`, `snapshot-delete`, `provision`, `restart`, `maintain`, `snapshot-create`
- Mode guard (`requireCoolifyMode()`) prevents Coolify-specific operations on bare servers

### Import/Export Security
- Sensitive field stripping on import
- Strict file permissions on export
- Format validation with field-level checking
- Duplicate detection by server ID

## OWASP Top 10 Compliance Summary

| Category | Status | Implementation |
|----------|--------|----------------|
| A1 - Injection | Mitigated | `spawn` array args, `assertValidIp`, `assertSafePath`, port integer validation |
| A2 - Sensitive Data Exposure | Mitigated | `sanitizedEnv()` on all child processes, `stripSensitiveData()` on provider errors, tokens never on disk |
| A3 - Broken Access Control | Mitigated | SAFE_MODE blocks destructive ops, mode guard on Coolify-only ops |
| A4 - Insecure Design | N/A | CLI tool, minimal attack surface |
| A5 - Security Misconfiguration | Mitigated | Restrictive file permissions (0o600/0o700), timeout limits, buffer caps |
| A6 - Vulnerable Components | See below | Production: 0 vulnerabilities |
| A7 - XSS | N/A | CLI tool, no web UI |
| A8 - Insecure Deserialization | Mitigated | JSON.parse wrapped in try/catch with safe defaults |
| A9 - Logging & Monitoring | Partial | `sanitizeStderr()` prevents sensitive data in logs |
| A10 - SSRF | Mitigated | `assertValidIp()` on all outbound SSH/HTTP targets |

## Dependency Security

### Production Dependencies (0 known vulnerabilities)
```
npm audit --omit=dev → found 0 vulnerabilities
```

All production dependencies use audited, versioned packages:
- Hetzner Cloud API v1 (via Axios, HTTPS)
- DigitalOcean API v2 (via Axios, HTTPS)
- Vultr API v2 (via Axios, HTTPS)
- Linode API v4 (via Axios, HTTPS)
- Model Context Protocol SDK (`@modelcontextprotocol/sdk`) for MCP server
- Zod for runtime input validation
- Coolify installed via `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash` (official method, HTTPS)

### Dev Dependencies
One moderate-severity ReDoS vulnerability remains in `test-exclude` → `glob` → `minimatch@10.0.0-10.2.2` (jest code coverage toolchain). This is a dev-only dependency not present in production builds. Remediation is blocked by the dependency chain — `npm audit fix --force` would cause lock file breakage per project policy. Risk accepted as dev-only, not exploitable in production.

Security scan: https://socket.dev/npm/package/quicklify

## HTTP Usage

Quicklify accesses Coolify at `http://IP:8000` during initial setup. This is expected because SSL/TLS is not configured on a fresh Coolify installation. Users are warned to set up a domain and enable SSL for production use.
