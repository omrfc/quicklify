# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |

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
- API tokens collected via interactive secure prompts (masked input)
- Input validation on all user inputs
- Automated security checks via GitHub Actions

## Third-party Dependencies

Quicklify uses audited dependencies:
- Hetzner Cloud API v1 (via Axios)
- All dependencies regularly updated
- Socket.dev security monitoring enabled

Security scan: https://socket.dev/npm/package/quicklify
