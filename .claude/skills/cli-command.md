# Skill: Yeni CLI Komutu

## Pattern: Commands thin, core fat

```typescript
// src/commands/yeni-komut.ts — sadece parse + delegate
program
  .command('yeni-komut')
  .description('...')
  .option('--flag', 'aciklama')
  .action(async (options) => {
    await yeniKomutCore(options);
  });

// src/core/yeniKomut.ts — asil is burada
export async function yeniKomutCore(options: YeniKomutOptions) {
  // business logic
}
```

## Checklist
- [ ] `src/commands/` altina thin wrapper
- [ ] `src/core/` altina business logic
- [ ] `src/types/` altina gerekli tipler
- [ ] `__tests__/` altina test dosyasi
- [ ] `src/index.ts`'e komutu register et
- [ ] `README.md`'e dokumante et
- [ ] SAFE_MODE gerektiriyor mu? `isSafeMode()` kontrolu ekle
