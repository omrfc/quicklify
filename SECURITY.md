# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.4.x   | :white_check_mark: |
| < 0.4   | :x:                |

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

- All dependencies scanned with Socket.dev
- No credentials stored in code
- API tokens can be provided via environment variables (`HETZNER_TOKEN`, `DIGITALOCEAN_TOKEN`) to avoid shell history exposure
- API tokens collected via interactive secure prompts (masked input) when env vars are not set
- Config directory created with restrictive permissions (`0o700`)
- Server config file written with `0o600` permissions (owner read/write only)
- Cloud-init install log restricted to `chmod 600` (root only)
- Server name validation: 3-63 chars, lowercase alphanumeric + hyphens, must start with letter
- Input validation on all user inputs
- Automated security checks via GitHub Actions

## HTTP Usage

Quicklify accesses Coolify at `http://IP:8000` during initial setup. This is expected because SSL/TLS is not configured on a fresh Coolify installation. Users are warned to set up a domain and enable SSL for production use.

## Third-party Dependencies

Quicklify uses audited dependencies:
- Hetzner Cloud API v1 (via Axios, HTTPS)
- DigitalOcean API v2 (via Axios, HTTPS)
- Coolify installed via `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash` (official method, HTTPS)
- All dependencies regularly updated
- Socket.dev security monitoring enabled

**Note:** The `curl | bash` installation method is the official Coolify installation procedure. The script is fetched over HTTPS from Coolify's CDN.

Security scan: https://socket.dev/npm/package/quicklify
