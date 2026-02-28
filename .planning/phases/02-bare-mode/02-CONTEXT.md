# Phase 2: Bare Mode - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can provision and manage generic VPS servers without Coolify installed via `--mode bare`. All existing Coolify commands continue working unchanged. Server records store a `mode` field to distinguish server types.

</domain>

<decisions>
## Implementation Decisions

### Provisioning Flow
- Trigger: `quicklify init --mode bare` (flag on existing command, no separate command)
- Cloud-init: Temel hardening — SSH key + system update + fail2ban + ufw (temel portlar) + unattended-upgrades
- Completion criteria: SSH erişimi hazır olunca tamamlandı sayılır (Coolify health check yok)
- Post-deploy: Tarayıcı açılmaz, sadece SSH bilgisi ve IP gösterilir

### Command Behaviors
- Coolify-specific commands (health, logs, update, maintain): Hata ver ve dur — "Bu komut bare sunucularda kullanılamaz"
- Add command: `quicklify add --mode bare` — Coolify doğrulaması atlanır, sadece SSH + cloud API kontrolü
- Working commands on bare: Tüm infra komutları — status (cloud only), destroy, secure, firewall, domain, snapshot
- Backward compatibility: servers.json'da mode alanı olmayan mevcut sunucular otomatik olarak 'coolify' kabul edilir (kırıcı değişiklik yok)

### Backup Strategy
- Scope: Sistem konfigürasyonu — /etc/ altındaki config dosyaları (nginx, sshd, ufw kuralları, crontab)
- Restore: Config dosyalarını geri yükle, servis restart'larını kullanıcıya bırak
- Manifest: Mevcut BackupManifest yapısına mode:'bare' alanı eklenir (aynı format, tutarlılık)
- SAFE_MODE: Aynı koruma — SAFE_MODE=true bare restore'ı da engeller

### Status Output & Mode Visibility
- Bare status: Cloud status + mode: bare + IP + provider + region gösterilir. Coolify satırı hiç gösterilmez
- Server list: Tablo çıktısına 'Mode' sütunu eklenir (coolify veya bare)
- Coolify sunucuları: mode: coolify sütunu da gösterilir (tutarlılık)
- MCP: Mode bilgisi MCP'ye Phase 3'te eklenir, şimdilik sadece CLI'da

### Claude's Discretion
- Bare cloud-init scriptinin exact içeriği (hangi paketler, hangi ufw kuralları)
- Hata mesajlarının exact metni
- ServerRecord type'ındaki mode alanının implementasyon detayları
- Backup'lanacak exact /etc/ dosya listesi

</decisions>

<specifics>
## Specific Ideas

- init --mode bare, add --mode bare flag isimlendirmesi kesin
- Coolify-özel komutlarda net hata mesajı: "Bu komut bare sunucularda kullanılamaz"
- Backward compat: mode alanı yoksa otomatik 'coolify' — migration scripti gereksiz

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ServerRecord` interface (`src/types/index.ts`): mode alanı eklenecek
- `cloudInit.ts` (`src/utils/cloudInit.ts`): Mevcut Coolify cloud-init scripti — bare versiyonu için referans
- `provision.ts` (`src/core/provision.ts`): Mevcut provisioning workflow — bare path eklenecek
- `healthCheck.ts` (`src/utils/healthCheck.ts`): Coolify health check — bare modda atlanacak
- `config.ts` (`src/utils/config.ts`): getServers/saveServer — mode alanı desteği eklenecek
- `errorMapper.ts` (`src/utils/errorMapper.ts`): Mevcut hata mapping pattern'i — bare hataları için genişletilebilir

### Established Patterns
- CLI commands delegate to core/ modules (Phase 1 refactored this)
- Provider pattern with factory (`providerFactory.ts`)
- Error mappers per domain (provider, SSH, filesystem)
- Spinners for async operations (ora)
- SAFE_MODE environment variable for destructive operation protection
- Manual server detection (id starts with "manual-") — benzer pattern bare mode için kullanılabilir

### Integration Points
- `init.ts` command: --mode flag parse + bare provisioning path
- `add.ts` command: --mode flag parse + bare mode Coolify skip
- `status.ts` (core): mode-aware health check skip
- `backup.ts` (core): mode-aware backup strategy (Coolify DB vs system config)
- `src/index.ts`: Commander.js option registration for --mode flag
- `src/types/index.ts`: ServerRecord interface mode field addition

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-bare-mode*
*Context gathered: 2026-02-28*
