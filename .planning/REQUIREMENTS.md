# Requirements: Quicklify v1.2.1

**Defined:** 2026-03-02
**Core Value:** One-command server deployment and management across multiple cloud providers

## v1.2.1 Requirements

Dokploy (v1.3.0) öncesi altyapı sağlamlaştırma. Yeni feature yok — refactor + güvenlik fix.

### Refactor

- [ ] **REF-01**: Provider listesi (`SUPPORTED_PROVIDERS`) ve env key mapping (`PROVIDER_ENV_KEYS`) `src/constants.ts`'de merkezileşir, 8+ dosyadaki hardcoded liste kaldırılır
- [ ] **REF-02**: `stripSensitiveData()` fonksiyonu 4 provider dosyasından `src/providers/base.ts`'ye taşınır, duplicate kaldırılır
- [ ] **REF-03**: `src/commands/init.ts`'deki ~320 satırlık `deployServer()` fonksiyonu `src/core/deploy.ts`'ye extract edilir, init.ts thin wizard wrapper kalır

### Security

- [ ] **SEC-01**: `scpDownload()`/`scpUpload()` stdin `"ignore"` yapılır ve `-o BatchMode=yes` eklenir (MCP JSON-RPC stream corruption önleme)
- [ ] **SEC-02**: `scpDownload()`/`scpUpload()`'a timeout eklenir (default 300s, ağ kesildiğinde CLI hang önleme)
- [ ] **SEC-03**: `getProviderToken()` `.trim()` ekler ve whitespace-only string'leri `undefined` döner

## Future Requirements

Deferred to v1.3.0+:
- Re-export temizliği (backup/restore)
- ServerRecord.mode required yapma
- Provider API timeout (axios 30s)
- @types/inquirer v9↔v12 uyumsuzluğu

## Out of Scope

| Feature | Reason |
|---------|--------|
| Dokploy platform support | v1.3.0 scope |
| Provider API timeout | Lower priority, Dokploy sonrası |
| Backward-compat re-export cleanup | Test mock chain etkisi büyük, ayrı milestone |
| init.ts wizard state machine refactor | Sadece deployServer() extract edilir, wizard yapısı kalır |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REF-01 | Phase 4 | Pending |
| REF-02 | Phase 4 | Pending |
| SEC-01 | Phase 5 | Pending |
| SEC-02 | Phase 5 | Pending |
| SEC-03 | Phase 5 | Pending |
| REF-03 | Phase 6 | Pending |

**Coverage:**
- v1.2.1 requirements: 6 total
- Mapped to phases: 6
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 — Traceability updated to phases 4-6*
