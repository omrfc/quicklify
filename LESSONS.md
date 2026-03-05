# Kastell — Lessons Learned

Bu dosya Kastell (eski Quicklify) gelistirme surecinde ogrenilen dersleri icerir.
Her hatadan ogrenilen dersler buraya eklenir. ASLA tekrarlanmamalidir.

<!-- LESSONS_START -->

## Testing & Mocking

- [2026-02-26] YAPMA: Error handling testinde mock'u dolayli tetikleme (getServers throw -> destroy action server param'siz). jest.spyOn ile core fonksiyonu dogrudan mock'la. Yorum gerektiren test = test smell

## npm & CI/CD

- [2026-02-20] YAPMA: npm overrides ile farkli major versiyonlardaki ayni paketi (minimatch@3 vs @9) ayri hedeflemeye calisma. npm dedup tum kopyalari birlestirir -> glob@7 kirilir, coverage coker
- [2026-02-20] YAPMA: eslint'in ajv@6'sini ajv@8'e override etme. ESLint `ajv/lib/refs/json-schema-draft-04.json` kullanir, ajv@8'de bu path yok
- [2026-02-20] YAPMA: "npm audit fix" vaadine guvenip plan yapma. Override denemeden once `npm test:coverage` dahil tum CI step'leri lokal dogrula
- [2026-02-20] BEST PRACTICE: ESLint 10 `preserve-caught-error` rule: catch bloklarinda yeni Error firlatirken `{ cause: error }` ekle
- [2026-02-23] YAPMA: package-lock.json'i commit'lemeden push etme. CI'da `npm ci` strict mod kullanir, lock file sync degilse tum job'lar FAIL eder
- [2026-02-23] YAPMA: Yeni komut ekleyip (index.ts inline) README, CHANGELOG ve test yazmayi unutma. Release audit'inde yakalanir
- [2026-02-23] YAPMA: Komutlari index.ts icinde inline yazma. Her komut `src/commands/` altinda ayri dosyada olmali (tutarlilik + test edilebilirlik)
- [2026-02-23] YAPMA: Lokalde testler geciyor diye CI'i kontrol etmeden "sorun yok" deme. Lock file, env farklari CI'i kirabilir
- [2026-02-23] BEST PRACTICE: npm publish oncesi kontrol sirasi: build -> eslint -> test -> push -> CI 6/6 -> tag at -> publish workflow -> npm view ile dogrula
- [2026-02-23] BEST PRACTICE: Unused import varsa ESLint yakalar ama CI'da. Push oncesi `npx eslint src/` calistir
- [2026-02-25] YAPMA: npm overrides'da `">=X"` kullanma. `">=4.12.3"` -> bn.js@5.x, `">=3.1.3"` -> minimatch@10.x ceker, lock file kirilir. Scoped override + caret range kullan: `"web-push": { "bn.js": "^4.12.3" }`
- [2026-02-25] BEST PRACTICE: Commit oncesi `npm ci` ile lock file sync kontrolu yap. Override degisikligi lock file'i bozabilir -> CI'da npm ci FAIL eder

## Architecture

- [2026-02-23] YAPMA: Komutlari index.ts icinde inline yazma. Her komut `src/commands/` altinda ayri dosyada olmali
- [2026-02-23] YAPMA: `cloudflare/wrangler-action@v3` kullanma — surum uyumsuzlugu ile sessizce fail olabiliyor. `npx wrangler@3` + env vars ile dogrudan calistir

<!-- LESSONS_END -->
