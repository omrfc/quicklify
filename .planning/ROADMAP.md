# Roadmap: Kastell (formerly Quicklify)

## Milestones

- ✅ **v1.0.0 Initial Release** — Phases pre-GSD (shipped 2026-02-23)
- ✅ **v1.1.0 MCP Server + Security** — Phases pre-GSD (shipped 2026-02-27)
- ✅ **v1.2.0 Generic Server Management** — Phases 1-3 (shipped 2026-02-28)
- ✅ **v1.2.1 Refactor + Security Patch** — Phases 4-6 (shipped 2026-03-02)
- ✅ **v1.3 Kastell Rebrand + Dokploy** — Phases 7-10 (shipped 2026-03-06)
- ✅ **v1.4 TUI + Dokploy + DX** — Phases 11-15 (shipped 2026-03-07)
- ✅ **v1.5 Security + Dokploy + Audit** — Phases 16-22 (shipped 2026-03-08)
- ✅ **v1.6 Audit Expand + Evidence + Altyapi** — Phases 23-27 (shipped 2026-03-11)
- ✅ **v1.7 Guard Core** — Phases 28-33 (shipped 2026-03-14)
- ✅ **v1.8 Fleet + Notifications** — Phases 34-40 (shipped 2026-03-15)
- ✅ **v1.9 Cleanup + Polish** — Phases 41-43 (shipped 2026-03-15)
- ✅ **v1.10 Audit Pro** — Phases 44-52.1 (shipped 2026-03-17)
- ✅ **v1.11 MCP Polish + Audit UX + Lock Expansion** — Phases 53-56 (shipped 2026-03-18)
- ✅ **v1.12 Lock Advanced + Audit Explain** — Phases 57-62 (shipped 2026-03-18)
- ✅ **v1.13 Foundation + Housekeeping** — Phases 63-71 (shipped 2026-03-19, npm 1.13.0)
- 🚧 **v1.14 Test Excellence + Server Ops** — Phases 72-86 (planned)
- ⬜ **v1.15 Web Security + Auto-Fix + Telegram** — Phases 87-92 (planned)
- ⬜ **v2.0 Plugin Ekosistemi** — **Üç katmanlı mimari:** (1) Kastell CLI npm, (2) Kastell Claude Code Plugin marketplace'te, (3) Kastell Plugin Ekosistemi (`kastell plugin install`). **Kastell Plugin Sistemi:** In-process (v3.0'da out-of-process), npm dağıtım (`kastell-plugin-*` naming), 4 capability (audit check/CLI komut/MCP tool/fix strateji), `kastell-plugin.json` manifest (Zod validation), plugin başına allowedTools limiti (4-5 max), `${CLAUDE_PLUGIN_DATA}` altında metadata.json (use_count, last_used), opsiyonel skill/ klasörü → Claude Code entegrasyonu. **Plugin sırası:** LA ROMA (internal battle-test) → kastell-auditor (audit→analiz→fix demo workflow, hem test hem marketing) → kastell-plugin-wordpress (ilk public) → docker-compose → hipaa/pci. **Marketplace:** marketplace.json npm source, kastell.dev plugin directory, wvw.dev listing. **Ek:** SKILL.md cross-platform (Cursor/Gemini CLI/Kiro), slash commands, chained workflows, validate_plugins.py CI, structured error kategorileri (transient/validation/business/permission), server_secure tool split, MCP Resources (check catalog + server listesi), MCP Prompts (harden/diagnose/setup workflow template'leri — `/mcp__kastell__xxx` komutları olarak görünür), MCP `server.instructions` alanı (Tool Search lazy-loading desteği — 13+ tool'da kritik), Streamable HTTP transport (remote MCP kullanım — 13+ platform desteği, güvenlik gereksinimleri: Origin validation, Rate limiting, DNS rebinding koruması, MCP spec zorunlu), Anthropic MCP Registry listing, PostToolUse hook normalization, MCP error response standardizasyonu, MCP `structuredContent` + `outputSchema` (typed response — server_audit, server_fleet, server_doctor, server_info öncelikli), MCP `listChanged` notification (dynamic tool updates), MCP progress notifications (audit 413 check, lock 19 step, maintain 5 step ilerleme bildirimi), MCP elicitation (provision: provider/region/size seçimi, secure: port/protocol form, manage: IP/provider/mode), MCP content annotations (audience: user vs assistant, priority: 0-1), MCP completion/autocomplete (prompt arg + resource template parametreleri), MCP cancellation (uzun operasyonları iptal), MCP pagination (fleet/resource list'ler için cursor-based), bağımsız CI review instance, `kastell init` iyileştirme (post-deploy lock önerisi, token kaydetme — çekirdek wizard zaten mevcut: `src/commands/init.ts`), adapter contract dokümantasyonu, Guard v2.0 FSM (snapshot/rollback + CrowdSec topluluk istihbaratı entegrasyonu), **kastell fix (tam)** — yüksek riskli fix'ler (Nginx reconfig, TLS setup, firewall reset) plugin capability olarak (`kastell-plugin-*` fix strateji), **WAF yönetim plugin** — Coraza/ModSecurity kurulum ve config yönetimi (`kastell-plugin-waf`), **self-improving skills** (plugin sayısı 10+ olunca tetiklenecek), **Telegram Advanced** — scheduled raporlar (günlük fleet özeti, haftalık audit rapor cron/scheduler ile), SSL sertifika süre dolum hatırlatma (P85 TLS ile bağlantılı), per-server bildirim tercihleri (notify.yaml'da sunucu bazlı on/off), Telegram inline keyboard (aksiyon butonları: "Audit Çalıştır", "Doctor Kontrol")
- ⬜ **v3.0 Dashboard + Managed Servis** — premium web dashboard, managed servis ($49/$99/$299+), ilk musteri LA ROMA, Batch API scheduled reports (fleet gece batch audit → sabah rapor), multi-pass audit architecture (per-category + cross-category correlation), confidence-based check routing (false positive → manual review), guard structured handoff (alert context: ne oldu, severity, önerilen aksiyon), MCP OAuth 2.1 (HTTP transport + PKCE + RFC 8707, SaaS multi-tenant auth), MCP Tasks (async/durable — provision/audit polling, deneysel spec stabilize olunca)

## Phases

<details>
<summary>✅ v1.0.0 Initial Release — SHIPPED 2026-02-23</summary>

23 CLI commands, 4 cloud providers, YAML config, SAFE_MODE, SSH hardening, firewall, domain/SSL, backup/restore, snapshots. Pre-GSD — no phase plans tracked.

</details>

<details>
<summary>✅ v1.1.0 MCP Server + Security — SHIPPED 2026-02-27</summary>

MCP server with 7 tools, 12 security fixes, SSH key auto-generation, full docs update. Pre-GSD — no phase plans tracked.

</details>

<details>
<summary>✅ v1.2.0 Generic Server Management — SHIPPED 2026-02-28</summary>

- [x] Phase 1: CLI/Core Refactor (5/5 plans) — completed 2026-02-28
- [x] Phase 2: Bare Mode (4/4 plans) — completed 2026-02-28
- [x] Phase 3: MCP Refactor (3/3 plans) — completed 2026-02-28

3 phases, 12 plans, 18 requirements. Full details: [v1.2.0-ROADMAP.md](./milestones/v1.2.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.2.1 Refactor + Security Patch — SHIPPED 2026-03-02</summary>

- [x] Phase 4: Provider & Utility Consolidation (2/2 plans) — completed 2026-03-02
- [x] Phase 5: SCP Security Hardening (2/2 plans) — completed 2026-03-02
- [x] Phase 6: init.ts Extract (2/2 plans) — completed 2026-03-02

3 phases, 6 plans, 6 requirements. Full details: [v1.2.1-ROADMAP.md](./milestones/v1.2.1-ROADMAP.md)

</details>

<details>
<summary>✅ v1.3 Kastell Rebrand + Dokploy Adapter — SHIPPED 2026-03-06</summary>

- [x] Phase 7: Kastell Rebrand (3/3 plans) — completed 2026-03-05
- [x] Phase 8: Platform Adapter Foundation (2/2 plans) — completed 2026-03-06
- [x] Phase 9: Dokploy Adapter (2/2 plans) — completed 2026-03-06
- [x] Phase 10: Fix addServerRecord Platform Routing (1/1 plan) — completed 2026-03-06

4 phases, 8 plans, 24 requirements. Full details: [v1.3-ROADMAP.md](./milestones/v1.3-ROADMAP.md)

</details>

<details>
<summary>✅ v1.4 TUI + Dokploy + DX — SHIPPED 2026-03-07</summary>

- [x] Phase 11: Dokploy Lifecycle Completion (2/2 plans) — completed 2026-03-07
- [x] Phase 12: Bug Fixes (1/1 plan) — completed 2026-03-07
- [x] Phase 13: Developer Experience (3/3 plans) — completed 2026-03-07
- [x] Phase 14: TUI Enhancements (2/2 plans) — completed 2026-03-07
- [x] Phase 15: Documentation (1/1 plan) — completed 2026-03-07

5 phases, 9 plans, 15 requirements. Full details: [v1.4-ROADMAP.md](./milestones/v1.4-ROADMAP.md)

</details>

<details>
<summary>✅ v1.5 Security + Dokploy + Audit — SHIPPED 2026-03-08</summary>

- [x] Phase 16: Guvenlik Fixleri (11 items, pre-GSD) — completed 2026-03-08
- [x] Phase 17: Dokploy Tamamlama (3/3 plans) — completed 2026-03-08
- [x] Phase 18: Token Guvenligi (2/2 plans) — completed 2026-03-08
- [x] Phase 19: Code Quality Refactoring (4/4 plans) — completed 2026-03-08
- [x] Phase 20: kastell audit (5/5 plans) — completed 2026-03-08
- [x] Phase 21: Wire tokenBuffer — Gap Closure (absorbed into P18) — completed 2026-03-08
- [x] Phase 22: Platform Auto-Detect — Gap Closure (absorbed into P17) — completed 2026-03-08

7 phases, 14 plans, 37 requirements. Full details: [v1.5-ROADMAP.md](./milestones/v1.5-ROADMAP.md)

</details>

<details>
<summary>✅ v1.6 Audit Expand + Evidence + Altyapi — SHIPPED 2026-03-11</summary>

- [x] Phase 23: Infrastructure Foundation (3/3 plans) — completed 2026-03-09
- [x] Phase 24: Audit Snapshots (2/2 plans) — completed 2026-03-11
- [x] Phase 25: Audit Diff and Compare (2/2 plans) — completed 2026-03-11
- [x] Phase 26: Evidence Collection (2/2 plans) — completed 2026-03-11
- [x] Phase 27: Adapter Contract Documentation (1/1 plan) — completed 2026-03-11

5 phases, 10 plans, 19 requirements. Full details: [v1.6-ROADMAP.md](./milestones/v1.6-ROADMAP.md)

</details>

<details>
<summary>✅ v1.7 Guard Core — SHIPPED 2026-03-14</summary>

- [x] Phase 28: Lock (2/2 plans) — completed 2026-03-14
- [x] Phase 29: Backup Schedule (2/2 plans) — completed 2026-03-14
- [x] Phase 30: Guard Daemon (2/2 plans) — completed 2026-03-14
- [x] Phase 31: Risk Trend (2/2 plans) — completed 2026-03-14
- [x] Phase 32: Doctor (2/2 plans) — completed 2026-03-14
- [x] Phase 33: MCP + Completions (2/2 plans) — completed 2026-03-14

6 phases, 12 plans, 35 requirements. Full details: [v1.7-ROADMAP.md](./milestones/v1.7-ROADMAP.md)

</details>

<details>
<summary>✅ v1.8 Fleet + Notifications — SHIPPED 2026-03-15</summary>

- [x] Phase 34: Layer Violation Fix (1/1 plan) — completed 2026-03-14
- [x] Phase 35: Adapter Deduplication (1/1 plan) — completed 2026-03-14
- [x] Phase 36: Notification Module (2/2 plans) — completed 2026-03-14
- [x] Phase 37: Doctor Fix (1/1 plan) — completed 2026-03-14
- [x] Phase 38: Fleet Visibility (2/2 plans) — completed 2026-03-14
- [x] Phase 39: Guard Notification Integration (1/1 plan) — completed 2026-03-14
- [x] Phase 40: Shell Completions + Polish (2/2 plans) — completed 2026-03-14

7 phases, 10 plans, 19 requirements. Full details: [v1.8-ROADMAP.md](./milestones/v1.8-ROADMAP.md)

</details>

<details>
<summary>✅ v1.9 Cleanup + Polish — SHIPPED 2026-03-15</summary>

- [x] Phase 41: Bug Fixes + Docs (2/2 plans) — completed 2026-03-15
- [x] Phase 42: Security Hardening (2/2 plans) — completed 2026-03-15
- [x] Phase 43: Dependency Hygiene + Code Quality (2/2 plans) — completed 2026-03-15

3 phases, 6 plans, 8 requirements. Full details: [v1.9-ROADMAP.md](./milestones/v1.9-ROADMAP.md)

</details>

<details>
<summary>✅ v1.10 Audit Pro (Phases 44-52.1) — SHIPPED 2026-03-17</summary>

- [x] Phase 44: Architecture Refactor (3/3 plans) — completed 2026-03-15
- [x] Phase 45: Score & Schema Versioning (2/2 plans) — completed 2026-03-15
- [x] Phase 46: New Categories Wave 1 (2/2 plans) — completed 2026-03-15
- [x] Phase 47: New Categories Wave 2 (2/2 plans) — completed 2026-03-15
- [x] Phase 48: Kastell-Only Categories (4/4 plans) — completed 2026-03-15
- [x] Phase 49: Existing Category Deepening (8/8 plans) — completed 2026-03-16
- [x] Phase 50: Compliance Mapping (2/2 plans) — completed 2026-03-16
- [x] Phase 51: CLI & MCP Integration (3/3 plans) — completed 2026-03-16
- [x] Phase 52: Quality, UX & Calibration (3/3 plans) — completed 2026-03-16
- [x] Phase 52.1: Gap Closure (1/1 plan) — completed 2026-03-17

10 phases, 30 plans, 52 requirements. Full details: [v1.10-ROADMAP.md](./milestones/v1.10-ROADMAP.md)

</details>

<details>
<summary>✅ v1.11 MCP Polish + Audit UX + Lock Expansion (Phases 53-56) — SHIPPED 2026-03-18</summary>

- [x] Phase 53: MCP Description Overhaul + Skill Rules (1/1 plan) — completed 2026-03-17
- [x] Phase 54: Audit UX Fixes (2/2 plans) — completed 2026-03-17
- [x] Phase 55: Tech Debt + Known-Hosts Fix (2/2 plans) — completed 2026-03-17
- [x] Phase 56: Lock Expansion (2/2 plans) — completed 2026-03-18

4 phases, 7 plans, 29 requirements. Full details: [v1.11-ROADMAP.md](./milestones/v1.11-ROADMAP.md)

</details>

<details>
<summary>✅ v1.12 Lock Advanced + Audit Explain (Phases 57-62) — SHIPPED 2026-03-18</summary>

- [x] Phase 57: Audit Explain (2/2 plans) — completed 2026-03-18
- [x] Phase 58: Lock Depth -- auditd + sysctl (2/2 plans) — completed 2026-03-18
- [x] Phase 59: Lock Depth -- pwquality (1/1 plan) — completed 2026-03-18
- [x] Phase 60: SSH Cipher Hardening (1/1 plan) — completed 2026-03-18
- [x] Phase 61: Docker Runtime Hardening (2/2 plans) — completed 2026-03-18
- [x] Phase 62: Milestone CLI Fix (1/1 plan) — completed 2026-03-18

6 phases, 8 plans, 21 requirements. Full details: [v1.12-ROADMAP.md](./milestones/v1.12-ROADMAP.md)

</details>

<details>
<summary>✅ v1.13 Foundation + Housekeeping (Phases 63-71) — SHIPPED 2026-03-19</summary>

- [x] Phase 63: Command Business Logic Extraction (2/2 plans) — completed 2026-03-18
- [x] Phase 64: Adapter Dispatch Fix (2/2 plans) — completed 2026-03-18
- [x] Phase 65: Plugin Scaffold (1/1 plan) — completed 2026-03-19
- [x] Phase 66: kastell-ops Skill (1/1 plan) — completed 2026-03-19
- [x] Phase 67: Remaining Skills (2/2 plans) — completed 2026-03-19
- [x] Phase 68: Agents (1/1 plan) — completed 2026-03-19
- [x] Phase 69: Hooks (1/1 plan) — completed 2026-03-19
- [x] Phase 70: Plugin Validation + Marketplace (2/2 plans) — completed 2026-03-19
- [x] Phase 71: Documentation + Discoverability (4/4 plans) — completed 2026-03-19

9 phases, 16 plans. Full details: [v1.13-ROADMAP.md](./milestones/v1.13-ROADMAP.md)

</details>

### Post-v1.13 Backlog (Completed 2026-03-20)

Claude Code DX & config iyileştirmeleri — repo dışı, `~/.claude/` config değişiklikleri:

- [x] Telegram bildirim hook (Stop → notify-telegram.js)
- [x] Kastell MCP auto-allow (10 read-only tool, destructive hariç)
- [x] UserPromptSubmit platform/versiyon enjeksiyonu (prompt-platform-inject.js)
- [x] TypeScript LSP plugin (typescript-lsp@claude-plugins-official)
- [x] Stop hook ses bildirimi (stop-sound.js → PowerShell Asterisk)
- [x] Status line (ccstatusline — daha önce kurulmuştu)

### v1.14 Test Excellence + Server Ops (Planned)

**Milestone Goal:** Test kalitesini ölçülebilir şekilde iyileştirmek (mutation testing, coverage gap, integration/contract/snapshot test katmanları), lock skorunu yükseltmek, TLS ve HTTP güvenlik audit kategorilerini eklemek, ve snapshot restore + server cloud ID lookup gibi eksik server operasyonlarını tamamlamak.

- [x] **Phase 72: Stryker Setup + Baseline** — Stryker kurulumu, jest-runner yapılandırması, core/ modüllerinde baseline mutation score raporu (completed 2026-03-21)
- [ ] **Phase 73: Coverage Gap — Formatters + SSH** — formatters/index.ts %47→%90+, formatters/terminal.ts + summary.ts %90+, ssh.ts %83→%90+
- [ ] **Phase 74: Coverage Gap — Bare Mode + Threshold** — Bare server mode test güçlendirme, global coverage threshold %80→%90
- [ ] **Phase 75: MCP Tool Testing** — 13 MCP tool için error path, malformed input ve edge case testleri (NOT: v1.13'te CLI↔MCP parity audit yapıldı, 3 bug fix'lendi — P75 bunu formalize edecek)
- [ ] **Phase 76: Integration Testing** — Provider workflow, command→core→adapter akış, MCP→core entegrasyon, staging workflow
- [ ] **Phase 77: Contract Testing** — Provider contract (4 provider, describe.each), MCP tool contract, core function contract
- [ ] **Phase 78: Snapshot Testing** — Formatter output, CLI help text, audit report format snapshot testleri
- [ ] **Phase 79: CI Hardening + Mutation Gate** — Codecov PR comment, type-safe test helpers, feature-specific coverage gates, CI mutation report + incremental mode + threshold gate, zayıf test güçlendirme
- [ ] **Phase 80: Skill Dynamic Content Injection** — 6 skill + 2 agent'a `!`command`` ile canlı codebase context eklenir
- [ ] **Phase 81: Security Skill Consolidation** — 5 harici güvenlik skill'ini (security-audit, supply-chain, insecure-defaults, sharp-edges, code-review-excellence) tek `kastell-security-check` skill'inde birleştir — Kastell'e özel kurallar ekle, gereksiz genel kuralları çıkar, context tasarrufu yap, release.md'yi tek çağrıyla güncelle
- [ ] **Phase 82: Lock Pro** — Düşük riskli lock iyileştirmeleri: AIDE cron, auditd rule genişletme, rsyslog retention, cron permission hardening, Dokploy daemon.json fix (hedef: 67→82 skor)
- [ ] **Phase 83: Snapshot Restore** — Tüm 4 provider'da snapshot'tan sunucu geri yükleme (Hetzner rebuild, DO restore action, Vultr restore, Linode disk rebuild) + CLI `kastell snapshot restore` + MCP `snapshot-restore` handler
- [ ] **Phase 84: Server Add Cloud ID Lookup** — `kastell add` ile eklenen sunucularda IP'den provider API sorgulayarak cloud ID otomatik bulma → destroy/restart gibi cloud operasyonları mümkün kılma
- [ ] **Phase 85: TLS Hardening Audit Category** — 8 yeni audit check: TLS min version, zayıf cipher tespiti, HSTS + preload, OCSP stapling, cert expiry, DH param strength, TLS compression, certificate chain doğrulama. PCI-DSS 4.2.1 mapping
- [ ] **Phase 86: HTTP Security Headers Audit Category** — 6 yeni audit check: X-Frame-Options/CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CORS yapılandırma, Content-Security-Policy detay. OWASP mapping

## Phase Details

### Test Yaklaşımı (Ersin Koç Mega Test Prompt Adaptasyonu)

Makaleden uyarlanan kurallar — tüm v1.14 fazlarında geçerli:

1. **AAA Pattern zorunlu** — Arrange → Act → Assert, her aşama boş satır + yorum ile ayrılır
2. **Coverage Matrix Checklist** — Her modül testi için 9 kategori kontrol edilir (REQUIREMENTS.md'de detay)
3. **Mock reset** — `jest.resetAllMocks()` (clearAllMocks değil — lesson learned)
4. **Mevcut helper'ları kullan** — `tests/helpers/mockAdapter.ts` factory referans, yeni yardımcı yazmadan önce mevcut kontrol et
5. **Snapshot testleri KABULEDİLEBİLİR** — CLI output ve audit rapor formatı için (makale yasaklıyor ama Kastell P78'de mantıklı)
6. **İki geçişli yaklaşım** — Test yaz → review et (eksik edge case, shallow assertion, duplicate bul → düzelt)
7. **Başarısız test = sinyal** — AI'ın kodu yanlış okuduğu noktayı gösterir, implementasyondaki belirsizliği ortaya çıkarır
8. **`as any` kuralı** — Test kodunda genel `any` yasak AMA runtime wrong-type senaryoları için `as any` cast test edilmeli (Coverage Matrix F kategorisi)
9. **Davranış test et, implementasyon değil** — internal'a bağımlı test yazma

### Phase 72: Stryker Setup + Baseline
**Goal**: Stryker mutation testing is installed, configured, and produces a baseline mutation score report for core/ modules — establishing what percentage of mutants the current test suite catches
**Depends on**: Phase 71 (v1.13 complete)
**Requirements**: MUT-01, MUT-02
**Success Criteria** (what must be TRUE):
  1. `npx stryker run` executes without error and produces an HTML + JSON mutation report
  2. The report covers all modules under `src/core/` with per-file mutant counts and kill rates
  3. A baseline mutation score number is recorded (this is the starting measurement, not a pass/fail threshold)
  4. Stryker config (`stryker.config.mjs`) is committed to the repo with jest-runner and typescript-checker configured
**Plans**: 1 plan
Plans:
- [ ] 72-01-PLAN.md — Install Stryker, configure jest-runner + typescript-checker, run baseline mutation score

### Phase 73: Coverage Gap — Formatters + SSH
**Goal**: The three formatter files and ssh.ts reach 90%+ line coverage — the largest current coverage gaps are closed with targeted error path and edge case tests
**Depends on**: Phase 72
**Requirements**: COV-01, COV-02, COV-04
**Success Criteria** (what must be TRUE):
  1. `formatters/index.ts` coverage rises from ~47% to 90%+ (error paths, empty input, malformed data exercised)
  2. `formatters/terminal.ts` coverage rises from ~85% to 90%+ (color/no-color branches, edge case inputs)
  3. `formatters/summary.ts` coverage rises from ~80% to 90%+ (partial results, zero-check categories)
  4. `ssh.ts` coverage rises from ~83% to 90%+ (timeout path, connection error, retry edge cases)
  5. `npm test` passes with no regressions; coverage report confirms all four targets met
**Plans**: 1 plan
Plans:
- [ ] 72-01-PLAN.md — Install Stryker, configure jest-runner + typescript-checker, run baseline mutation score

### Phase 74: Coverage Gap — Bare Mode + Threshold
**Goal**: Bare server mode error and edge case scenarios are covered by tests, and the global Jest coverage threshold is raised from 80% to 90% — making coverage enforcement meaningful
**Depends on**: Phase 73
**Requirements**: COV-03, COV-05
**Success Criteria** (what must be TRUE):
  1. Bare mode provision error scenarios (invalid config, missing key, unreachable host) each have at least one test
  2. Bare mode config edge cases (empty domains, malformed YAML, unknown provider) are exercised
  3. Jest config thresholds for branches, functions, lines, and statements are all set to 90
  4. `npm test` passes — coverage at or above 90% on all four dimensions
**Plans**: 1 plan
Plans:
- [ ] 72-01-PLAN.md — Install Stryker, configure jest-runner + typescript-checker, run baseline mutation score

### Phase 75: MCP Tool Testing
**Goal**: All 13 MCP tools have error path coverage, reject malformed inputs gracefully, and handle edge cases (concurrent requests, timeouts, partial responses) — MCP tool behavior is fully verified by automated tests
**Depends on**: Phase 74
**Requirements**: MCP-01, MCP-02, MCP-03
**Success Criteria** (what must be TRUE):
  1. Every MCP tool has at least one test for: missing required server, SSH failure, and invalid parameter shape
  2. Malformed inputs (invalid IP, empty string, null, wrong type) cause a structured error response — not an uncaught exception
  3. Concurrent MCP tool invocation tests exist and pass without race conditions or test interference
  4. Timeout and partial response scenarios are simulated by mocks and produce defined behavior
**MCP Spec Uyumluluk Notları** (araştırma sonucu):
  - İki katmanlı hata modeli test edilmeli: Protocol Error (JSON-RPC -32602/-32700) + Tool Execution Error (`isError: true`)
  - `mcpError()` helper zaten `isError: true` set ediyor — 250+ test assertion mevcut ✅
  - MCP spec zorunluluğu: tüm tool input'ları validate edilmeli, output'lar sanitize edilmeli
  - `structuredContent` + `outputSchema` henüz yok — v2.0'da değerlendirilecek (spec opsiyonel)
  - In-memory client-server binding pattern test'lerde kullanılabilir (subprocess overhead yok)
  - mcp-jest framework mevcut (npm) — protocol compliance scoring sağlıyor, P75'te değerlendirilecek
**Plans**: 1 plan
Plans:
- [ ] 72-01-PLAN.md — Install Stryker, configure jest-runner + typescript-checker, run baseline mutation score

### Phase 76: Integration Testing
**Goal**: The full request path from CLI command through core logic to adapter/provider is verified by mock-based integration tests — plus a staging workflow for real-server validation
**Depends on**: Phase 75
**Requirements**: INT-01, INT-02, INT-03, INT-04
**Success Criteria** (what must be TRUE):
  1. Provider workflow tests (create→status→destroy) exist for all 4 providers using mocked API calls
  2. Command→core→adapter chain tests verify that a CLI invocation reaches the correct adapter method
  3. A GitHub Actions workflow file exists with a manual trigger for staging server tests (provision→test→destroy on Hetzner/DO)
  4. MCP handler→core integration tests verify the full path from MCP tool call to core function return value
**Plans**: 1 plan
Plans:
- [ ] 72-01-PLAN.md — Install Stryker, configure jest-runner + typescript-checker, run baseline mutation score

### Phase 77: Contract Testing
**Goal**: The 4 cloud providers, all 13 MCP tools, and core/ functions are bound by automated contract tests — behavioral consistency is enforced, not assumed
**Depends on**: Phase 76
**Requirements**: CTR-01, CTR-02, CTR-03
**Success Criteria** (what must be TRUE):
  1. A `describe.each` provider contract test suite runs against all 4 providers for create, destroy, status, sizes, and restart operations
  2. All 13 MCP tools pass a shared contract test verifying: structured error on failure, consistent response shape, and Zod-validated parameter rejection
  3. Core function contract tests verify that every function in `src/core/` returns a typed result (no untyped throws) and handles the null-server case
**MCP Contract Test Notları** (araştırma sonucu):
  - MCP spec'e göre her tool response: `content: [{type: "text", text: string}]` shape'inde olmalı
  - Hata response: `isError: true` + JSON payload (`error`, opsiyonel `hint`, `suggested_actions`)
  - Kastell'de `mcpSuccess()` ve `mcpError()` helper'lar bu contract'ı garanti ediyor — contract test bu helper'ların tüm tool'larda kullanıldığını doğrulamalı
  - `_kastell_version` her success response'a ekleniyor — contract'ın parçası olarak doğrulanmalı
**Plans**: 1 plan
Plans:
- [ ] 72-01-PLAN.md — Install Stryker, configure jest-runner + typescript-checker, run baseline mutation score

### Phase 78: Snapshot Testing
**Goal**: Formatter output, CLI help text, and audit report structure are protected from silent regression by Jest snapshot tests — unintended output changes are caught before they reach users
**Depends on**: Phase 77
**Requirements**: SNP-01, SNP-02, SNP-03
**Success Criteria** (what must be TRUE):
  1. Snapshot tests exist for audit summary, JSON, and terminal formatter outputs — a format change causes a failing test
  2. Snapshot tests exist for `kastell --help` and at least 5 subcommand help outputs — CLI text changes are caught
  3. Audit report category-grouped structure has a snapshot test — adding or reordering categories is caught
  4. All snapshots are committed; `npm test` passes cleanly with snapshots present
**Plans**: 1 plan
Plans:
- [ ] 72-01-PLAN.md — Install Stryker, configure jest-runner + typescript-checker, run baseline mutation score

### Phase 79: CI Hardening + Mutation Gate
**Goal**: CI produces a Codecov PR comment on every pull request, test helpers are type-safe, per-module coverage gates enforce quality, and Stryker runs in incremental mode with a mutation score threshold gate — the full test quality loop is closed
**Depends on**: Phase 78
**Requirements**: INF-01, INF-02, INF-03, MUT-03, MUT-04, MUT-05, MUT-06
**Success Criteria** (what must be TRUE):
  1. Every PR to main receives an automated Codecov comment showing coverage delta (lines added, coverage change)
  2. Zero `as any` casts remain in test files — all replaced by typed builder or factory helpers
  3. Jest config defines per-module coverage thresholds: audit 95%, provider 90%, MCP 90%
  4. The GitHub Actions CI workflow runs Stryker in incremental mode and publishes the mutation report as a workflow artifact
  5. CI fails if mutation score drops below the baseline recorded in Phase 72 (kademeli gate: report first, threshold second)
  6. Identified weak tests (mutants surviving in high-value modules) are strengthened until mutation score reaches 70%+
**Plans**: 1 plan
Plans:
- [ ] 72-01-PLAN.md — Install Stryker, configure jest-runner + typescript-checker, run baseline mutation score

### Phase 80: Skill Dynamic Content Injection
**Goal**: All 6 skills and 2 agents use `!`command`` syntax to inject live codebase context when invoked — eliminating stale hardcoded references and reducing hallucination
**Depends on**: Phase 79
**Requirements**: DYN-01, DYN-02, DYN-03
**Success Criteria** (what must be TRUE):
  1. `cli-command.md` injects current command list, `mcp-tool.md` injects current MCP tool count, `provider.md` injects registered providers, `testing.md` injects test count
  2. `release.md` injects current version from package.json, `publish.md` injects latest git tag
  3. `kastell-ops` agent injects last audit score, `kastell-fixer` agent injects server count
  4. All injected commands include `2>/dev/null` fallback — skill loading never fails if a command errors
  5. Each skill's frontmatter declares `allowed-tools: Bash` to enable dynamic execution
**Plans**: 1 plan
Plans:
- [ ] 72-01-PLAN.md — Install Stryker, configure jest-runner + typescript-checker, run baseline mutation score

### Phase 81: Security Skill Consolidation
**Goal**: 5 harici güvenlik skill'i tek bir Kastell'e özel `kastell-security-check` skill'inde birleştirilecek — context tasarrufu + proje-spesifik kurallar
**Depends on**: Phase 80
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. `.claude/skills/kastell-security-check.md` oluşturuldu — Kastell SSH/injection, Safe Mode, secret, supply chain, convention kontrollerini tek skill'de toplar
  2. Gereksiz genel kurallar (diğer diller, framework'ler) çıkarıldı — sadece TypeScript/Node/SSH/Cloud Provider odaklı
  3. `release.md` Adım 2 tek bir `/kastell-security-check` çağrısına sadeleştirildi
  4. Eski 5 skill hala global'de mevcut (diğer projeler kullanabilir) — Kastell'de tek skill override eder
  5. İlk release'de test edildi — eski skill'lerle aynı veya daha iyi sonuç
**Plans**: 1 plan
Plans:
- [ ] 72-01-PLAN.md — Install Stryker, configure jest-runner + typescript-checker, run baseline mutation score

### Phase 82: Lock Pro
**Goal**: Lock hardening skoru 67→82+ olacak — düşük riskli 5 iyileştirme ile kullanıcılar reboot sonrası daha güvenli bir sunucu elde edecek
**Depends on**: None (bağımsız faz)
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. AIDE günlük cron scan aktif (lock sonrası `/etc/cron.daily/aide` mevcut)
  2. Auditd kuralları genişletilmiş (file access, privilege escalation rules eklendi)
  3. rsyslog retention yapılandırılmış (30 gün, rotasyon aktif)
  4. Cron erişim sınırlandırılmış (`/etc/cron.allow` + `/etc/at.deny`)
  5. Dokploy/bare modda daemon.json yoksa oluşturuluyor (jq merge başarısız olmuyor)
  6. Gerçek sunucuda lock sonrası audit skoru 80+ (Coolify, Dokploy, Bare üç modda test)
**Plans**: 1 plan
Plans:
- [ ] 72-01-PLAN.md — Install Stryker, configure jest-runner + typescript-checker, run baseline mutation score

### Phase 83: Snapshot Restore
**Goal**: Kullanıcılar snapshot'tan sunucu geri yükleyebilecek — snapshot almanın diğer yarısı tamamlanacak
**Depends on**: None (bağımsız faz)
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. `CloudProvider` interface'ine `restoreSnapshot(serverId, snapshotId)` metodu eklendi
  2. 4 provider'da (Hetzner rebuild, DO restore action, Vultr restore, Linode disk rebuild) implement edildi
  3. CLI: `kastell snapshot restore --server X --snapshot Y` çalışıyor
  4. MCP: `server_backup { action: 'snapshot-restore' }` handler eklendi
  5. SAFE_MODE koruması aktif (destructive operasyon)
  6. Gerçek sunucuda en az 1 provider'da test edildi (snapshot-create → snapshot-restore → SSH bağlantı doğrulama)
**Plans**: 1 plan
Plans:
- [ ] 72-01-PLAN.md — Install Stryker, configure jest-runner + typescript-checker, run baseline mutation score

### Phase 84: Server Add Cloud ID Lookup
**Goal**: `kastell add` ile eklenen sunuculara destroy/restart yapılabilecek — IP'den cloud provider API'si sorgulanarak server ID otomatik bulunacak
**Depends on**: None (bağımsız faz)
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. 4 provider'da IP'den sunucu arama metodu (`findServerByIp`) implement edildi
  2. `kastell add` komutu ekleme sırasında cloud ID'yi otomatik buluyor ve config'e kaydediyor
  3. Daha önce `add` ile eklenmiş sunuculara `kastell destroy` yapılabiliyor
  4. Cloud ID bulunamazsa graceful fallback (mevcut davranış korunur, uyarı verilir)
**Plans**: 1 plan
Plans:
- [ ] 72-01-PLAN.md — Install Stryker, configure jest-runner + typescript-checker, run baseline mutation score

### Phase 85: TLS Hardening Audit Category
**Goal**: Nginx/web sunucuların TLS yapılandırmasını denetleyen 8 yeni audit check eklenir — sertifika, cipher, protokol ve header güvenliği tek seferde kontrol edilir
**Depends on**: Phase 82 (Lock Pro — skor artışı ile birlikte mantıklı)
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. 8 yeni check `src/core/checks/tls.ts` dosyasında: TLS-001 (min version ≥1.2), TLS-002 (zayıf cipher tespiti), TLS-003 (HSTS + preload), TLS-004 (OCSP stapling), TLS-005 (cert expiry <30 gün uyarı), TLS-006 (DH param ≥2048 bit), TLS-007 (TLS compression kapalı), TLS-008 (certificate chain tam)
  2. SSH batch section `nginx -T` ile tüm TLS config'i tarıyor, Nginx yoksa graceful skip
  3. Compliance mapping: PCI-DSS 4.2.1 (TLS-001, TLS-002), CIS (TLS-003, TLS-006)
  4. `kastell audit` çıktısında "TLS Hardening" kategorisi görünüyor, `--list-checks` 8 yeni check listeliyor
  5. Explain mode (`--explain`) tüm 8 check için why + fix açıklaması veriyor
**Plans**: 1 plan
Plans:
- [ ] 72-01-PLAN.md — Install Stryker, configure jest-runner + typescript-checker, run baseline mutation score

### Phase 86: HTTP Security Headers Audit Category
**Goal**: Web sunucuların HTTP güvenlik header'larını denetleyen 6 yeni audit check eklenir — XSS, clickjacking ve data leak vektörleri tespit edilir
**Depends on**: Phase 85 (aynı Nginx parsing altyapısını kullanır)
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. 6 yeni check `src/core/checks/httpHeaders.ts` dosyasında: HDR-001 (X-Frame-Options veya CSP frame-ancestors), HDR-002 (X-Content-Type-Options: nosniff), HDR-003 (Referrer-Policy), HDR-004 (Permissions-Policy), HDR-005 (CORS Access-Control-Allow-Origin wildcard tespiti), HDR-006 (Content-Security-Policy varlığı)
  2. SSH batch section Nginx response header'larını `curl -sI` ile kontrol ediyor, Nginx yoksa graceful skip
  3. Compliance mapping: OWASP A05:2021 (HDR-001, HDR-006), PCI-DSS 6.5.9 (HDR-005)
  4. `kastell audit` çıktısında "HTTP Security Headers" kategorisi görünüyor
  5. Explain mode tüm 6 check için açıklama veriyor
**Plans**: 1 plan
Plans:
- [ ] 72-01-PLAN.md — Install Stryker, configure jest-runner + typescript-checker, run baseline mutation score

### v1.15 Web Security + Auto-Fix + Telegram (Planned)

**Milestone Goal:** Web-facing sunucuların Edge/WAF katmanını denetlemek, audit sonuçlarından otomatik fix döngüsünü başlatmak, DDoS dayanıklılığını artırmak, ve Telegram entegrasyonu ile bildirim + uzaktan kontrol eklemek — Kastell'i "tespit + aksiyon + bildirim" aracına dönüştürmek.

- [ ] **Phase 87: Edge & WAF Audit Category** — 10 yeni audit check: Nginx Cloudflare-only IP kısıtlaması, real_ip_header restore, direkt IP erişim engeli, rate limit (limit_req + limit_conn), fail2ban login izleme, CrowdSec/WAF varlık tespiti (Coraza/ModSecurity/SafeLine/GuardianWAF), Nginx buffer limitleri, UFW CF IP kısıtlaması, ModSecurity/NAXSI. Conditional kategori — Nginx yoksa skip
- [ ] **Phase 88: kastell fix --safe** — Audit'ten çıkan düşük riskli fix'leri tek komutla uygula. SSH config, fail2ban kurulumu, sysctl parametreleri gibi geri alınabilir operasyonlar. `--dry-run` + onay mekanizması zorunlu. Fix öncesi otomatik backup
- [ ] **Phase 89: MCP server_fix Tool** — `fix --safe`'in MCP karşılığı. Claude Code audit sonuçlarını görür → fix önerir → onay alır → SSH üzerinden uygular → check tekrar çalıştırıp doğrular. 14. MCP tool
- [ ] **Phase 90: TCP Stack DDoS Hardening** — Mevcut sysctl check'lerini DDoS özelinde genişlet: tcp_max_syn_backlog, tcp_syn_retries, tcp_tw_reuse, net.ipv4.tcp_max_orphans, conntrack limitleri. Lock komutuna DDoS profili ekle
- [ ] **Phase 91: Telegram Notifications** — `kastell notify setup telegram` (bot token + chat ID config), push bildirimler: provision/lock/maintain/audit sonrası sonuç bildirimi, Guard alarm (CPU/RAM/disk eşik aşımı), audit skor düşüşü uyarısı. `--notify` flag'i tüm operasyonel komutlara. `kastell notify test` bağlantı testi. CLI + MCP desteği
- [ ] **Phase 92: Telegram Bot Commands** — Telegram'dan read-only kastell komutları: /status (fleet durumu), /audit <server> (hızlı skor), /health <server> (sağlık kontrolü), /doctor <server> (proaktif analiz). Destructive komutlar hariç — güvenlik için sadece okuma

### Phase 87: Edge & WAF Audit Category
**Goal**: Nginx ve edge proxy yapılandırmasını denetleyen conditional audit kategorisi eklenir — Cloudflare arkasındaki sunucuların bypass edilemezliği doğrulanır
**Depends on**: Phase 86 (Nginx parsing altyapısı paylaşılır)
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. 10 check `src/core/checks/edgewaf.ts` dosyasında: EW-001 (Nginx Cloudflare IP-only), EW-002 (real_ip_header CF restore), EW-003 (direkt IP erişim engeli), EW-004 (rate limit — limit_req_zone varlığı), EW-005 (fail2ban login jail), EW-006 (CrowdSec/WAF kurulu mu — Coraza, ModSecurity, SafeLine, GuardianWAF), EW-007 (limit_conn_zone — simultaneous connection limiti), EW-008 (Nginx buffer limitleri — client_body_buffer_size, large_client_header_buffers), EW-009 (UFW/iptables seviyesinde Cloudflare IP kısıtlaması — OS firewall katmanı), EW-010 (ModSecurity/NAXSI Nginx WAF modülü aktif mi)
  2. Conditional kategori: Nginx yoksa tüm kategori skip, Cloudflare yoksa EW-001/002/003/009 skip
  3. SSH batch section `nginx -T` + `fail2ban-client status` + `cscli metrics` kullanır
  4. `kastell audit` çıktısında "Edge & WAF" kategorisi görünüyor (varsa)
  5. Explain mode tüm check'ler için why + fix açıklaması veriyor
**Plans**: 1 plan
Plans:
- [ ] 72-01-PLAN.md — Install Stryker, configure jest-runner + typescript-checker, run baseline mutation score

### Phase 88: kastell fix --safe
**Goal**: Audit'ten çıkan düşük riskli sorunları tek komutla otomatik düzelten `kastell fix` komutu eklenir — tespit-aksiyon döngüsü kapanır
**Depends on**: Phase 87
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. `kastell fix --server X` komutu çalışıyor: audit çalıştır → failed check'leri filtrele → safe olanları uygula → tekrar audit → skor değişimini göster
  2. Safe fix kategorileri tanımlı: SSH config (PermitRootLogin, PasswordAuth), fail2ban kurulumu, sysctl parametreleri, UFW temel kurallar
  3. `--dry-run` flag'i tüm fix'leri listeler ama uygulamaz
  4. Her fix öncesi otomatik backup alınıyor (kastell backup entegrasyonu)
  5. Fix sonrası etkilenen check'ler tekrar çalıştırılıp sonuç doğrulanıyor
  6. Yüksek riskli fix'ler (Nginx reconfig, TLS setup, firewall reset) `--safe` kapsamına dahil DEĞİL — kullanıcıya yönlendirme gösterilir
**Plans**: 1 plan
Plans:
- [ ] 72-01-PLAN.md — Install Stryker, configure jest-runner + typescript-checker, run baseline mutation score

### Phase 89: MCP server_fix Tool
**Goal**: `kastell fix` komutunun MCP karşılığı eklenir — Claude Code ve AI IDE'ler audit→fix→verify döngüsünü otomatize edebilir
**Depends on**: Phase 88
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. `server_fix` MCP tool eklendi (14. tool): `{ action: 'fix', server: string, dryRun?: boolean, checks?: string[] }`
  2. Varsayılan davranış: tüm safe fix'leri uygula. `checks` parametresi ile spesifik check'ler seçilebilir
  3. Response'da fix öncesi/sonrası skor, uygulanan fix listesi ve doğrulama sonuçları var
  4. SAFE_MODE aktifken fix uygulanmaz, sadece öneriler listelenir
  5. MCP tool description'ı Claude Code'un audit→fix workflow'unu otomatize etmesine yetecek kadar açık
**Plans**: 1 plan
Plans:
- [ ] 72-01-PLAN.md — Install Stryker, configure jest-runner + typescript-checker, run baseline mutation score

### Phase 90: TCP Stack DDoS Hardening
**Goal**: Mevcut kernel/network audit check'leri DDoS dayanıklılığı odağında genişletilir ve lock komutu DDoS profili kazanır
**Depends on**: None (bağımsız faz)
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. 6+ yeni check network kategorisine eklendi: tcp_max_syn_backlog (≥4096), tcp_syn_retries (≤3), tcp_tw_reuse (aktif), tcp_max_orphans, nf_conntrack_max, somaxconn
  2. `kastell lock` komutu bu parametreleri sysctl hardening adımına dahil ediyor
  3. Check'ler mevcut network kategorisine entegre (yeni kategori değil)
  4. Explain mode DDoS senaryolarını açıklıyor (neden bu değer, saldırı vektörü ne)
  5. Gerçek sunucuda test: lock sonrası tüm yeni check'ler pass
**Plans**: 1 plan
Plans:
- [ ] 72-01-PLAN.md — Install Stryker, configure jest-runner + typescript-checker, run baseline mutation score

### Phase 91: Telegram Notifications
**Goal**: Kastell operasyonları sonrası Telegram'a push bildirim gönderen notification altyapısı eklenir — kullanıcılar sunucu olaylarını mobil'den takip edebilir
**Depends on**: None (bağımsız faz)
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. `kastell notify setup telegram` komutu çalışıyor: bot token + chat ID'yi `~/.kastell/notify.yaml` (veya config'e) kaydediyor
  2. `kastell notify test` ile bağlantı testi yapılabiliyor
  3. `--notify` flag'i şu komutlarda çalışıyor: provision, lock, maintain, audit, fix
  4. Guard daemon alert tetiklediğinde (CPU/RAM/disk eşik) Telegram'a otomatik bildirim
  5. Audit skor düşüşü tespiti: önceki skor cache'den okunur, düşüş varsa uyarı
  6. MCP desteği: server_maintain, server_lock, server_audit tool'larında notify parametresi
  7. Bildirim formatı: sunucu adı, operasyon, sonuç, süre, skor (varsa)
**Plans**: 1 plan
Plans:
- [ ] 72-01-PLAN.md — Install Stryker, configure jest-runner + typescript-checker, run baseline mutation score

### Phase 92: Telegram Bot Commands
**Goal**: Telegram'dan read-only kastell komutları çalıştırılabilir — mobil'den sunucu durumu sorgulama
**Depends on**: Phase 91 (bot altyapısı)
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. Telegram bot şu komutlara yanıt veriyor: /status (fleet), /audit <server> (skor), /health <server>, /doctor <server>
  2. Destructive komutlar yok — sadece read-only operasyonlar
  3. Yetkisiz kullanıcılar engelleniyor (chat ID whitelist)
  4. Bot long-polling veya webhook ile çalışıyor (daemon/servis olarak)
  5. `kastell bot start` / `kastell bot stop` komutları ile bot yönetimi
  6. Yanıt formatı mobil'de okunabilir (kısa, emoji destekli)
**Plans**: 1 plan
Plans:
- [ ] 72-01-PLAN.md — Install Stryker, configure jest-runner + typescript-checker, run baseline mutation score

## Paralel Track: kastell.dev Website

- [x] Logo kesinlesti
- [x] kastell.dev website kuruldu
- [x] GitHub + npm homepage'e kastell.dev konuldu
- [x] quicklify.omrfc.dev -> kastell.dev redirect yapildi
- [ ] Kastell vs Lynis vs OpenSCAP karsilastirma sayfasi (v2.0'a ertelendi — format: objektif tablo + narrative, 4 boyut)

## Backlog (Hook'lar + DX)

> Milestone'a bagli degil. **Kural: Her milestone SHIPPED olduktan sonra, sonraki milestone'a baslamadan once backlog'dan 1 item implemente et. Sira: Grup 0 -> Grup 1 -> Grup 2 -> Grup 3.**

**Grup 0: Security Hooks** (oncelikli -- Wave 1) ✅
- [x] PreToolUse -> block-dangerous-commands (rm -rf, fork bomb, curl|sh engeli)
- [x] PreToolUse -> protect-secrets (~/.kastell/tokens.json, .env, API key dosyalarina erisim engeli)
- [x] PostToolUse -> auto-stage (Edit/Write sonrasi otomatik git add)

**Grup 1: Session Lifecycle** (birlikte yapilmali) ✅
- [x] SessionStart -> session-focus (git durumu + sonraki session plani inject)
- [x] PreCompact -> pre-compact-snapshot (git snapshot dosyaya yaz)
- [x] Stop -> uncommitted-warn (uncommitted degisiklik uyarisi)

**Grup 2: Guvenlik/Kalite** (birlikte yapilmali) → v1.13 Phase 69'da ✅
- [x] Stop -> TS hata/CHANGELOG/README kontrolu (prompt hook)
- [x] PostToolUse/Bash -> session.log
- [x] SessionStart -> kastell audit --silent
- [x] PreToolUse(git commit) -> kastell audit --silent, skor dustuyse uyar (command hook)

**Grup 3: Entegrasyon** — TAMAMLANDI (2026-03-20)
- [x] Deploy sonrasi Telegram bildirimi (notify-telegram.js Stop hook)
- [x] Kastell MCP auto-allow (permissions.allow, 10 read-only tool)
- [x] UserPromptSubmit -> platform/versiyon enjeksiyonu (prompt-platform-inject.js)

## Teknik Borc

- ~~3 dosyada 28 satir re-export~~ -- bilincli karar, borc degil (SILINDI)
- ~~milestone complete CLI accomplishments bos donuyor~~ -- Phase 62'de fix edildi ✅
- ~~3 command'da is mantigi~~ -- v1.13 Phase 63'te ✅
- ~~9 command adapters bypass~~ -- v1.13 Phase 64'te ✅
- [ ] `core/status.ts:40-47` error shape ambiguity -- provider vs health check failure ayirt edilemiyor
- [ ] `serverBackup.handlers.ts` requireCloudServer() helper -- 3x tekrarlanan isBareServer() guard
- [ ] `core/firewall.ts` COOLIFY_PORTS/DOKPLOY_PORTS duplication -- adapter.platformPorts ile aynı veri, v2.0'da constants.ts'e taşınacak
- ~~`defaultLogService` type safety~~ -- ✅ v1.13 audit review'da düzeltildi (interface `string` → `LogService`, `as` cast kaldırıldı)
- [ ] **Lock Pro** (düşük riskli skor iyileştirmeleri, ~67→82 hedef):
  - [ ] AIDE cron schedule (günlük scan) — +3-5 puan
  - [ ] Auditd rule genişletme (file access, privilege escalation) — +3-5 puan
  - [ ] rsyslog retention config — +2-3 puan
  - [ ] Cron permission hardening (/etc/cron.allow, /etc/at.deny) — +2-3 puan
  - [ ] Lock Docker hardening: daemon.json yoksa oluştur (Dokploy modda sessizce atlanıyor — jq merge boş dosyada hata verir)

## Periyodik Bakim

- [ ] MEMORY.md stale bilgi kontrolu (her 2-3 major gorev)
- [ ] LESSONS.md yeni ders ekleme (hata cikinca)
- [ ] Oturum sonu: CHANGELOG, README, README.tr, SECURITY.md, llms.txt

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-27. Prior milestones | v1.2.0-v1.6 | All | Complete | 2026-03-11 |
| 28-33. Guard Core | v1.7 | 12/12 | Complete | 2026-03-14 |
| 34-40. Fleet + Notifications | v1.8 | 10/10 | Complete | 2026-03-15 |
| 41-43. Cleanup + Polish | v1.9 | 6/6 | Complete | 2026-03-15 |
| 44-52.1. Audit Pro | v1.10 | 30/30 | Complete | 2026-03-17 |
| 53-56. MCP Polish + Audit UX + Lock Expansion | v1.11 | 7/7 | Complete | 2026-03-18 |
| 57-62. Lock Advanced + Audit Explain | v1.12 | 8/8 | Complete | 2026-03-18 |
| 63-71. Foundation + Housekeeping | v1.13 | 16/16 | Complete | 2026-03-19 |
| 72. Stryker Setup + Baseline | 1/1 | Complete    | 2026-03-21 | - |
| 73. Coverage Gap — Formatters + SSH | v1.14 | 0/TBD | Not started | - |
| 74. Coverage Gap — Bare Mode + Threshold | v1.14 | 0/TBD | Not started | - |
| 75. MCP Tool Testing | v1.14 | 0/TBD | Not started | - |
| 76. Integration Testing | v1.14 | 0/TBD | Not started | - |
| 77. Contract Testing | v1.14 | 0/TBD | Not started | - |
| 78. Snapshot Testing | v1.14 | 0/TBD | Not started | - |
| 79. CI Hardening + Mutation Gate | v1.14 | 0/TBD | Not started | - |
| 80. Skill Dynamic Content Injection | v1.14 | 0/TBD | Not started | - |
| 81. Security Skill Consolidation | v1.14 | 0/TBD | Not started | - |
| 82. Lock Pro | v1.14 | 0/TBD | Not started | - |
| 83. Snapshot Restore | v1.14 | 0/TBD | Not started | - |
| 84. Server Add Cloud ID Lookup | v1.14 | 0/TBD | Not started | - |
| 85. TLS Hardening Audit Category | v1.14 | 0/TBD | Not started | - |
| 86. HTTP Security Headers Audit Category | v1.14 | 0/TBD | Not started | - |
| 87. Edge & WAF Audit Category | v1.15 | 0/TBD | Not started | - |
| 88. kastell fix --safe | v1.15 | 0/TBD | Not started | - |
| 89. MCP server_fix Tool | v1.15 | 0/TBD | Not started | - |
| 90. TCP Stack DDoS Hardening | v1.15 | 0/TBD | Not started | - |
| 91. Telegram Notifications | v1.15 | 0/TBD | Not started | - |
| 92. Telegram Bot Commands | v1.15 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-27*
*Last updated: 2026-03-20 — v1.15'e P91-P92 (Telegram Notifications + Bot Commands) eklendi, v2.0'a Telegram advanced (scheduled rapor, SSL hatırlatma, per-server tercih) eklendi*
