# Template: Audit Check — $1

## Files to Create

1. `src/core/audit/<category>/$1.ts` — check implementation
2. Update `src/core/audit/catalog.ts` — register the new check

## Check Implementation

```typescript
// src/core/audit/<category>/$1.ts
import type { AuditCheckResult } from '../../types/audit.js';

export const CHECK_KEY = '<CATEGORY>-NN'; // e.g., 'NET-15', 'SSH-20'

export async function check$1(sshOutput: string): Promise<AuditCheckResult> {
  // Parse SSH output for the specific setting
  // Return structured result
  return {
    key: CHECK_KEY,
    title: 'TODO: Human-readable check title',
    passed: false, // evaluate condition from sshOutput
    currentValue: 'TODO: actual value found',
    expectedValue: 'TODO: what it should be',
    severity: 'medium', // 'critical' | 'high' | 'medium' | 'low' | 'info'
    category: '<category>',
    remediation: 'TODO: how to fix',
  };
}
```

## Catalog Registration

```typescript
// In src/core/audit/catalog.ts — add to the appropriate category array
{
  key: '<CATEGORY>-NN',
  title: 'TODO: check title',
  category: '<category>',
  severity: 'medium',
  frameworks: [], // 'CIS' | 'PCI-DSS' | 'HIPAA' (if applicable)
}
```

## Next Steps

- [ ] Choose the correct audit category (27 categories: network, ssh, firewall, docker, etc.)
- [ ] Assign a unique check key following the `<CATEGORY>-NN` pattern
- [ ] Ensure `passed` value matches `currentValue` evaluation (not a copy-paste from another check)
- [ ] Add SSH command to the category's batch query (avoid extra SSH round-trips)
- [ ] Write test: mock SSH output, verify check returns correct passed/failed
- [ ] Run full audit test suite: `npm test -- --testPathPattern=audit`
- [ ] Verify check count increased: `kastell audit --json | jq '.summary.totalChecks'`
