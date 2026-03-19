# Template: Provider — $1

## Files to Create

1. `src/providers/$1.ts` — provider implementation (extends BaseProvider)
2. Update `src/constants.ts` — add to PROVIDER_REGISTRY
3. `src/__tests__/providers/$1.test.ts` — test with mocked API calls

## Provider Implementation

```typescript
// src/providers/$1.ts
import {
  BaseProvider,
  type ProviderServer,
  type CreateServerParams,
  type ProviderResponse,
} from './base.js';

export class $1Provider extends BaseProvider {
  constructor(token: string) {
    super(token, 'https://api.$1.com/v1'); // adjust API base URL
  }

  async listServers(): Promise<ProviderResponse<ProviderServer[]>> {
    return this.request<ProviderServer[]>('GET', '/servers');
  }

  async createServer(params: CreateServerParams): Promise<ProviderResponse<ProviderServer>> {
    return this.request<ProviderServer>('POST', '/servers', { body: params });
  }

  async deleteServer(serverId: string): Promise<ProviderResponse<void>> {
    return this.request<void>('DELETE', `/servers/${serverId}`);
  }

  async getServer(serverId: string): Promise<ProviderResponse<ProviderServer>> {
    return this.request<ProviderServer>('GET', `/servers/${serverId}`);
  }
}
```

## PROVIDER_REGISTRY Entry

```typescript
// In src/constants.ts — add to PROVIDER_REGISTRY (single source of truth)
import { $1Provider } from './providers/$1.js';

export const PROVIDER_REGISTRY = {
  // ... existing providers
  $1: {
    name: '$1',
    envKey: '$1_TOKEN', // e.g., 'OVHCLOUD_TOKEN'
    class: $1Provider,
  },
};
```

## Next Steps

- [ ] Register in `PROVIDER_REGISTRY` (src/constants.ts) — single source of truth
- [ ] Implement `stripSensitiveData()` to remove API tokens from error responses
- [ ] Use `assertValidIp()` before any SSH operation
- [ ] Use `withProviderErrorHandling()` HOF for API error consistency
- [ ] Write tests with mocked axios (mock `axios.create()` → `jest.fn(() => axios)`)
- [ ] Add "Getting Your API Token" section to README.md
- [ ] Run `npm run build && npm test && npm run lint`
