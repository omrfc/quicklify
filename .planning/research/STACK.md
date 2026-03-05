# Stack Research: Kastell v1.3

**Date:** 2026-03-05
**Confidence:** HIGH

## Key Findings

### No New Dependencies Needed

Dokploy exposes a REST/OpenAPI API at `http://<ip>:3000/api` with `x-api-key` header auth. Existing `axios` handles this — same pattern as all 4 cloud provider integrations.

### Do NOT Use dokploy npm SDK

The `dokploy` npm package (v0.1.3) is beta with explicit breaking-changes warnings. It wraps 127 endpoints via Fetch API (second HTTP client alongside axios). Kastell only needs 5-8 endpoints. **Unnecessary dependency risk.**

### License Compatibility

All production dependencies (axios, commander, inquirer, chalk, ora, js-yaml, zod, MCP SDK) are MIT-licensed — fully compatible with Apache 2.0.

### License Change Checklist

1. Replace `LICENSE` file content with Apache 2.0 full text
2. `package.json`: `"license": "MIT"` -> `"license": "Apache-2.0"`
3. Create `NOTICE` file (Apache 2.0 convention)
4. No dependency changes required

### Adapter Pattern

Zero new libraries needed. Existing `CloudProvider` interface in `src/providers/base.ts` is the exact template. Define `PlatformAdapter` interface, refactor Coolify logic into `CoolifyAdapter`, add `DokployAdapter`.

## Dokploy API Quick Reference

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `GET /api/admin.getOne` | GET | x-api-key | Health check / Dokploy running |
| `GET /api/server.all` | GET | x-api-key | List servers |
| `GET /api/server.one?serverId=X` | GET | x-api-key | Server details |
| `GET /api/server.validate?serverId=X` | GET | x-api-key | Validate server connectivity |
| `POST /api/backup.create` | POST | x-api-key | Create backup |
| `GET /api/backup.one?backupId=X` | GET | x-api-key | Get backup details |
| `GET /api/project.all` | GET | x-api-key | List projects |

## Dokploy Cloud-Init

```
Install: curl -sSL https://dokploy.com/install.sh | sh
Port: 3000 (must be open in firewall)
Min specs: 2GB RAM, 30GB disk
Data dir: /etc/dokploy
Internal DB: PostgreSQL (Docker container)
```

## Roadmap Implications

- No dependency install phase needed — v1.3 is pure refactoring + new code
- Rebrand can proceed independently of Dokploy adapter — zero coupling
- Dokploy API key management: store alongside provider tokens in config
- Dokploy backup: SSH-driven (like Coolify) — SCP `/etc/dokploy` directory
- Health check divergence: Coolify is unauthenticated (port 8000), Dokploy needs API key or falls back to unauthenticated port 3000

## Open Questions (Low Risk)

- Exact Dokploy backup paths and PostgreSQL container name — can SSH-discover at runtime
- Whether `admin.getOne` requires admin-level API key or any valid key
- Dokploy firewall port requirements: does install script handle UFW?

---
*Research completed: 2026-03-05*
