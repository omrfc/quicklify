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

## Security Measures

### Authentication & Tokens
- API tokens are NEVER stored on disk — runtime prompt or env vars only
- Supported env vars: `HETZNER_TOKEN`, `DIGITALOCEAN_TOKEN`, `VULTR_TOKEN`, `LINODE_TOKEN`
- API tokens collected via interactive secure prompts (masked input) when env vars are not set
- Provider errors sanitized via `stripSensitiveData()` — no token leakage in error output

### Input Validation
- All user inputs validated (server names, IPs, ports, domains, backup IDs)
- `assertValidIp()` — IPv4 format + octet range (0-255) validation on all SSH/SCP calls
- Server name validation: 3-63 chars, lowercase alphanumeric + hyphens, must start with letter
- Shell injection protection: `spawnSync`/`spawn` used instead of `execSync` for all SSH operations
- YAML config: 22+ security key patterns detected and warned

### File System Security
- Config directory (`~/.quicklify/`) created with `0o700` permissions (owner only)
- Server config file written with `0o600` permissions (owner read/write only)
- Backup manifest files written with `0o600` permissions
- Export files written with `0o600` permissions
- Cloud-init install log restricted to `chmod 600` (root only)

### SSH & Network
- IP validation (`assertValidIp()`) before every SSH/SCP connection
- Sensitive environment variables filtered from child processes (`sanitizedEnv()`)
- `StrictHostKeyChecking` enabled on interactive SSH connections
- `sanitizeStderr()` redacts IPs, home paths, tokens, and secrets from error output (200 char limit)

### MCP Server Security
- **SAFE_MODE** (default: enabled) — Blocks destructive operations: `destroy`, `restore`, `snapshot-delete`, `provision`, `restart`, `maintain`, `snapshot-create`
- Zod schema validation on all MCP tool inputs (port ranges, provider enums, backup ID regex)
- Path traversal protection on backup restore (`backupId` regex + `path.resolve()` guard)
- `serverIp` excluded from backup manifests — no IP persistence in local files
- Stack trace sanitization in MCP error responses via `getErrorMessage()`
- SSRF defense: `assertValidIp()` on Coolify health checks

### Import/Export
- Sensitive field stripping on import
- Strict file permissions on export
- Format validation with field-level checking
- Duplicate detection by server ID

## HTTP Usage

Quicklify accesses Coolify at `http://IP:8000` during initial setup. This is expected because SSL/TLS is not configured on a fresh Coolify installation. Users are warned to set up a domain and enable SSL for production use.

## Third-party Dependencies

Quicklify uses audited dependencies:
- Hetzner Cloud API v1 (via Axios, HTTPS)
- DigitalOcean API v2 (via Axios, HTTPS)
- Vultr API v2 (via Axios, HTTPS)
- Linode API v4 (via Axios, HTTPS)
- Model Context Protocol SDK (`@modelcontextprotocol/sdk`) for MCP server
- Zod for runtime input validation
- Coolify installed via `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash` (official method, HTTPS)
- All dependencies regularly updated
- Socket.dev security monitoring enabled

**Note:** The `curl | bash` installation method is the official Coolify installation procedure. The script is fetched over HTTPS from Coolify's CDN.

Security scan: https://socket.dev/npm/package/quicklify
