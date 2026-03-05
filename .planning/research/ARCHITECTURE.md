# Architecture Research: Kastell v1.3

**Date:** 2026-03-05
**Confidence:** HIGH

## Platform Adapter Interface Design

### Location: `src/adapters/`

New directory alongside existing `src/providers/`, `src/core/`, etc.

```
src/adapters/
  base.ts          — PlatformAdapter interface + factory
  coolify.ts       — CoolifyAdapter (refactored from existing code)
  dokploy.ts       — DokployAdapter (new)
  index.ts         — re-exports
```

### PlatformAdapter Interface

```typescript
interface PlatformAdapter {
  readonly platform: Platform;           // "coolify" | "dokploy"
  readonly displayName: string;
  readonly defaultPort: number;          // 8000 for Coolify, 3000 for Dokploy
  readonly dataDir: string;              // /data/coolify or /etc/dokploy

  getCloudInitScript(options: CloudInitOptions): string;
  checkHealth(server: ServerRecord): Promise<HealthResult>;
  createBackup(server: ServerRecord, options: BackupOptions): Promise<BackupResult>;
  getStatus(server: ServerRecord): Promise<StatusResult>;
}
```

### Factory Pattern

```typescript
function getAdapter(platform: Platform): PlatformAdapter {
  switch (platform) {
    case "coolify": return new CoolifyAdapter();
    case "dokploy": return new DokployAdapter();
  }
}
```

## ServerRecord Type Evolution

```typescript
// Current
type ServerMode = "coolify" | "bare";

// v1.3 — Add platform field, keep mode for backward compat
type Platform = "coolify" | "dokploy";
type ServerMode = "coolify" | "dokploy" | "bare";

interface ServerRecord {
  // ... existing fields
  mode: ServerMode;          // "coolify" | "dokploy" | "bare"
  platform?: Platform;       // explicit platform (derived from mode if absent)
}
```

**Backward compatibility:** Legacy records without `platform` field default based on `mode`:
- `mode: "coolify"` -> `platform: "coolify"`
- `mode: "dokploy"` -> `platform: "dokploy"`
- `mode: "bare"` -> `platform: undefined`

## Refactoring Map: What Moves Where

### Core Modules Needing Platform Awareness

| Module | Current State | Change Needed |
|--------|--------------|---------------|
| `core/deploy.ts` | Coolify-specific cloud-init | Use `adapter.getCloudInitScript()` |
| `core/status.ts` | Coolify health check | Use `adapter.checkHealth()` |
| `core/backup.ts` | Coolify backup paths | Use `adapter.createBackup()` |
| `core/provision.ts` | References Coolify install | Platform-agnostic via adapter |
| `core/maintain.ts` | Coolify-specific operations | Route through adapter |
| `core/logs.ts` | Docker/Coolify log paths | Platform-aware log paths |
| `utils/modeGuard.ts` | `requireCoolifyMode()` | Add `requireManagedMode()` for any platform |
| `utils/cloudInit.ts` | Coolify + bare scripts | Delegate to adapter |

### What Stays the Same

- `src/providers/` — Cloud providers (Hetzner, DO, Vultr, Linode) are orthogonal to platform
- `src/commands/` — Thin wrappers stay thin, just pass platform param
- `src/utils/ssh.ts` — SSH is platform-agnostic
- `src/utils/config.ts` — Config management unchanged (except path rename)
- `src/constants.ts` — PROVIDER_REGISTRY unchanged, add PLATFORM_REGISTRY

### MCP Tool Changes

MCP tools need platform parameter support:
- `server_provision` — accept `--platform` flag
- `server_info` / `server_manage` / `server_maintain` — route via adapter
- `server_backup` — route via adapter
- `server_logs` — platform-aware log paths

## Suggested Build Order (4 Waves)

### Wave 1: Foundation (No Breakage)
- Define `PlatformAdapter` interface in `src/adapters/base.ts`
- Define `Platform` type in `src/types/index.ts`
- Add `PLATFORM_REGISTRY` to `src/constants.ts`
- Create `CoolifyAdapter` extracting existing logic (no behavior change)

### Wave 2: Integration (Careful Refactoring)
- Update `ServerRecord` type with `platform` field
- Update `getServers()` normalization for backward compat
- Refactor `core/deploy.ts` to use adapter
- Refactor `core/status.ts` to use adapter
- Refactor `core/backup.ts` to use adapter
- Update `modeGuard.ts` for platform awareness

### Wave 3: Dokploy Implementation
- Create `DokployAdapter` implementing interface
- Dokploy cloud-init script
- Dokploy health check
- Dokploy backup
- Tests for all Dokploy operations

### Wave 4: CLI + MCP Integration
- Add `--platform` flag to relevant CLI commands
- Update MCP tools for platform routing
- Update interactive menu for platform selection
- E2E flow testing

## Anti-Patterns to Avoid

1. **Don't over-abstract** — Only abstract what Coolify and Dokploy actually share. If only one platform does something, it's not in the interface
2. **Don't break existing tests** — CoolifyAdapter must produce identical behavior to current code
3. **Don't add platform methods for v1.5 features** — No restore, no API management, no log viewing in interface yet
4. **Don't couple adapter to provider** — Platform (Coolify/Dokploy) is orthogonal to Provider (Hetzner/DO/etc.)
5. **Don't change ServerRecord.mode** without migration — Legacy records must still work

---
*Research completed: 2026-03-05*
