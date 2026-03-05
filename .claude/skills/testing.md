# Skill: Test Yazma (Kastell)

## Setup
- Framework: Jest (CJS config: `jest.config.cjs`)
- Calistir: `npm test`
- Coverage: `npm run test:coverage`
- Test dizini: `__tests__/` alongside source

## Pattern

```typescript
// src/core/__tests__/yeniKomut.test.ts
import { yeniKomutCore } from '../yeniKomut.js';

describe('yeniKomutCore', () => {
  it('should ...', async () => {
    const result = await yeniKomutCore({ ... });
    expect(result).toBe(...);
  });
});
```

## Kural
- SSH/network operasyonlarini mock'la
- `assertValidIp()` gecen IP'leri test et, gecmeyenleri de
- SAFE_MODE davranisini test et
- `sanitizeResponseData()` token temizligini test et

## Test Smell — Yapma
- Implementasyon detayina bagimli test yazma
- Mock'u dolayli tetikleme
- Workaround yorumu gerektiren test yazma
- Kucuk refactor'da kirilacak fragile test yazma
