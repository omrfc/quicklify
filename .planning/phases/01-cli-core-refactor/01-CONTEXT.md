# Phase 1: CLI/Core Refactor - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

CLI komutlarındaki duplicate business logic'i core/ modüllerine taşıyarak komutları thin wrapper haline getirmek. Mevcut davranış %100 korunacak, yeni özellik eklenmeyecek. Shared constant'lar tek noktada toplanacak, test coverage 80%+ kalacak.

</domain>

<decisions>
## Implementation Decisions

### Refactoring Stratejisi
- Komut komut refactor edilecek (her komut ayrı commit)
- En basit komutlardan başlanacak, pattern oturttuktan sonra karmaşık olanlara geçilecek
- Mevcut CLI komutlarının dış davranışı (output format, exit code, flag'ler) %100 aynı kalacak — kullanıcı ve MCP fark etmemeli
- Gerekirse yeni core/ dosyaları oluşturulabilir (ama gereksiz dosya şişkinliği olmadan)

### Core Modül Organizasyonu
- Mevcut core/ dosya yapısı korunacak (domain bazlı: status.ts, provision.ts, secure.ts vb.)
- core/ fonksiyonları sadece data döndürecek — hiçbir console output üretmeyecek (CLI katmanı spinner/output'u yönetir)
- Error handling: Result pattern kullanılacak ({ success: boolean, data?, error? }) — exception fırlatılmayacak
- core/ fonksiyonları tamamen sessiz çalışacak — spinner/progress gösterimi yok. MCP için de ideal

### Constant ve Shared Code Yapısı
- Tüm shared constant'lar tek src/constants.ts dosyasında toplanacak
- Tüm shared type/interface'ler tek src/types.ts dosyasında toplanacak (mevcut genişletilecek)
- utils/ dizini yerinde kalacak (ssh, validation vb. low-level helper'lar) — core/'dan ayrı
- Sadece birden fazla yerde kullanılan magic number ve hardcoded değerler constants.ts'ye çekilecek. Tek yerde kullanılanlar yerinde kalabilir

### Test Stratejisi
- Testler de refactor edilecek — CLI testleri CLI katmanını, core testleri core/ fonksiyonlarını test edecek
- Kod + test aynı commit'te güncellenecek — her commit'te testler geçiyor olmalı
- Mevcut 1758 test davranış değişmediğini kanıtlamak için yeterli
- Her komut refactorında coverage kontrolü yapılacak — düştüyse o adımda düzeltilecek, ileriye bırakılmayacak

### Claude's Discretion
- Komutların refactor sıralaması (basitlik analizi Claude'a ait)
- core/ fonksiyon imzaları (parametre isimleri, return type detayları)
- Result pattern'ın exact yapısı (QuicklifyResult generic type vb.)
- Test dosya isimlendirme ve organizasyonu

</decisions>

<specifics>
## Specific Ideas

- core/ fonksiyonları hem CLI hem MCP tarafından kullanılabilir olmalı (Phase 3'ün temeli)
- Result pattern sayesinde CLI hata mesajını kendisi formatlayabilir, MCP kendi formatında döndürebilir
- constants.ts mevcut IP_WAIT, COOLIFY_MIN_WAIT, BOOT_MAX_ATTEMPTS gibi değerleri içermeli

</specifics>

<deferred>
## Deferred Ideas

- MCP tools'un da core/'dan import etmesi — Phase 3 kapsamında
- Bare mode desteği — Phase 2 kapsamında

</deferred>

---

*Phase: 01-cli-core-refactor*
*Context gathered: 2026-02-27*
