# Skill: Yeni Provider Ekleme

## Pattern

```typescript
// src/providers/yeni-provider.ts
import { BaseProvider } from './base.js';

export class YeniProvider extends BaseProvider {
  async listServers() { ... }
  async createServer() { ... }
  async deleteServer() { ... }
}
```

## PROVIDER_REGISTRY
`src/constants.ts`'deki `PROVIDER_REGISTRY`'e ekle — single source of truth.

```typescript
export const PROVIDER_REGISTRY = {
  // ...mevcut providerlar
  yeni: { name: 'Yeni Provider', class: YeniProvider },
};
```

## Checklist
- [ ] `src/providers/yeni-provider.ts` olustur
- [ ] `PROVIDER_REGISTRY`'e kaydet
- [ ] `src/types/` altina provider tipleri ekle
- [ ] `__tests__/providers/` altina test yaz
- [ ] `stripSensitiveData()` token/key temizligi yapiyor mu?
- [ ] `assertValidIp()` SSH operasyonlarinda kullaniliyor mu?
- [ ] README'ye "Getting Your API Token" bolumu ekle
