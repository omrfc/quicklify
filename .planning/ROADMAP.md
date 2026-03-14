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
- ⬜ **v1.7 Guard Core** — guard daemon, lock --production, fleet, doctor, bildirimler, backup --schedule, risk trend
- ⬜ **v2.0 Plugin Ekosistemi** — Claude Code marketplace, SKILL.md (cross-platform: Cursor/Gemini CLI/Kiro), slash commands, chained workflows, audit --explain, validate_plugins.py CI
- ⬜ **v3.0 Dashboard + Managed Servis** — premium web dashboard, managed servis ($49/$99/$299+), ilk musteri LA ROMA

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

## Paralel Track: kastell.dev Website

> v1.5 (audit) ile paralel — audit publish oldugunda website hazir olmali.

- [ ] Logo kesinlesmeli (website oncesi)
- [ ] kastell.dev website (ayri repo)
- [ ] kastell.dev acilinca -> GitHub + npm homepage'e kastell.dev koy
- [ ] quicklify.omrfc.dev -> kastell.dev redirect yap, sonra kapat

## Backlog (Hook'lar)

> Milestone'a bagli degil, ihtiyac oldukca ekle. Gelistirici DX'i, kullaniciya deger katmiyor.

- [ ] SessionStart -> CHANGELOG + current focus yukle
- [ ] Stop -> TS hata/CHANGELOG/README kontrolu (prompt hook)
- [ ] PreCompact -> CHANGELOG snapshot
- [ ] SessionEnd -> uncommitted changes uyarisi
- [ ] SessionStart -> kastell audit --silent
- [ ] Deploy sonrasi Telegram bildirimi (HTTP hook + n8n)
- [ ] Kastell MCP auto-allow
- [ ] PostToolUse/Bash -> session.log
- [ ] UserPromptSubmit -> platform/versiyon enjeksiyonu

## Periyodik Bakim

- [ ] MEMORY.md stale bilgi kontrolu (her 2-3 major gorev)
- [ ] LESSONS.md yeni ders ekleme (hata cikinca)
- [ ] Oturum sonu: CHANGELOG, README, README.tr, SECURITY.md, llms.txt

## Progress

All phases through v1.6 complete. See individual milestone archives for phase-level progress tables.

**Next milestone:** v1.7 Guard Core — phases TBD (not yet planned)

---
*Roadmap created: 2026-02-27*
*Last updated: 2026-03-11 — v1.6 milestone archived*
