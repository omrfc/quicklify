# Features Research: Kastell v1.3

**Date:** 2026-03-05
**Confidence:** HIGH

## How Dokploy Works

- **Installation:** `curl -sSL https://dokploy.com/install.sh | sh` (Docker Compose based)
- **Ports:** 3000 (UI/API), 80/443 (Traefik reverse proxy)
- **Data directory:** `/etc/dokploy/`
- **Orchestration:** Docker Swarm services
- **API auth:** `x-api-key` header
- **Uninstall:** Docker cleanup + remove `/etc/dokploy`

### Coolify vs Dokploy Comparison

| Aspect | Coolify | Dokploy |
|--------|---------|---------|
| Install | curl script | curl script |
| Port (UI) | 8000 | 3000 |
| Port (proxy) | 80/443 | 80/443 (Traefik) |
| Data dir | /data/coolify | /etc/dokploy |
| Orchestration | Docker | Docker Swarm |
| API auth | Token-based | x-api-key header |
| Health endpoint | Unauthenticated /api/health | Authenticated /api/admin.getOne |
| Backup data | /data/coolify dir | /etc/dokploy dir + PostgreSQL |

## Feature Categories

### Table Stakes (v1.3 — Must Have)

1. **Platform adapter interface** — abstract PlatformAdapter with provision/health/backup methods
2. **Coolify adapter** — refactor existing Coolify logic into adapter
3. **Dokploy cloud-init script** — install Dokploy + open port 3000
4. **Dokploy health check** — GET /api/admin.getOne with API key
5. **Dokploy backup** — SSH + SCP `/etc/dokploy` (mirrors Coolify pattern)
6. **ServerRecord platform field** — track which platform is installed
7. **Mode guards update** — platform-aware guards for Dokploy-only operations
8. **Status check** — Dokploy-specific status via API
9. **MCP tool routing** — route to correct adapter based on server platform
10. **Firewall rules** — open port 3000 for Dokploy UI

### Differentiators (v1.5 — Deferred)

1. **Dokploy restore** — restore from backup
2. **Dokploy API integration** — project/service management
3. **Version detection** — detect Dokploy version via API
4. **Auto-detection** — detect if server has Coolify or Dokploy installed
5. **Swarm status** — Docker Swarm service health monitoring
6. **Dokploy log viewing** — container logs via API

### Anti-Features (Never Build)

1. User/database management inside Dokploy (Dokploy handles this)
2. Application deployment (Dokploy's job, not Kastell's)
3. Dokploy API key management (user manages their own keys)
4. Docker Swarm cluster management
5. Dokploy config file editing
6. Certificate management (Traefik handles this)
7. Restore in v1.3 (deferred to v1.5 per scope decision)

## Feature Dependencies

```
PlatformAdapter interface
  ├── CoolifyAdapter (refactor existing)
  │     └── Existing tests must pass
  ├── DokployAdapter
  │     ├── cloud-init script
  │     ├── health check (needs API key)
  │     └── backup (needs SSH)
  ├── ServerRecord.platform field
  │     └── Backward compat migration
  └── MCP tool routing
        └── Platform-aware tool dispatch
```

## Low-Confidence Items (Verify on Live Instance)

- Exact PostgreSQL container name in Dokploy Swarm
- Whether `/etc/dokploy` includes all state or just config
- Dokploy install script behavior on Ubuntu 22 vs 24
- API key generation timing (available immediately after install?)
- Traefik port conflicts if Coolify was previously installed

---
*Research completed: 2026-03-05*
