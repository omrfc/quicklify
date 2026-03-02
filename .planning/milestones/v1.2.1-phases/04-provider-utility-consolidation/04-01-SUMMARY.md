---
phase: 04-provider-utility-consolidation
plan: "01"
subsystem: constants/providers
tags: [refactor, centralization, provider-registry, constants, types]
dependency_graph:
  requires: []
  provides: [PROVIDER_REGISTRY, SUPPORTED_PROVIDERS, PROVIDER_ENV_KEYS, PROVIDER_DISPLAY_NAMES, SupportedProvider, invalidProviderError]
  affects: [src/core/tokens.ts, src/core/manage.ts, src/core/provision.ts, src/utils/defaults.ts, src/utils/yamlConfig.ts, src/utils/serverSelect.ts, src/commands/doctor.ts, src/commands/init.ts, src/commands/add.ts, src/utils/prompts.ts, src/mcp/tools/serverInfo.ts, src/mcp/tools/serverManage.ts, src/mcp/tools/serverProvision.ts]
tech_stack:
  added: []
  patterns: [registry-pattern, single-source-of-truth, derived-constants]
key_files:
  created: []
  modified:
    - src/constants.ts
    - src/core/tokens.ts
    - src/core/manage.ts
    - src/core/provision.ts
    - src/utils/defaults.ts
    - src/utils/yamlConfig.ts
    - src/utils/serverSelect.ts
    - src/commands/doctor.ts
    - src/commands/init.ts
    - src/commands/add.ts
    - src/utils/prompts.ts
    - src/mcp/tools/serverInfo.ts
    - src/mcp/tools/serverManage.ts
    - src/mcp/tools/serverProvision.ts
decisions:
  - "Used DOCTOR_VALIDATE_URLS local map in doctor.ts (Option B) — validate URLs differ from apiBaseUrl (e.g. Linode uses /profile not /servers), so keeping them local is correct"
  - "invalidProviderError() quotes the provider value: 'Invalid provider: \"aws\".' — matches yamlConfig.test.ts expectation"
  - "SupportedProvider type exported from constants.ts, not types/index.ts — keeps provider identity co-located with registry"
metrics:
  duration: "8 minutes"
  completed_date: "2026-03-02"
  tasks_completed: 3
  files_modified: 15
---

# Phase 4 Plan 01: PROVIDER_REGISTRY Centralization Summary

**One-liner:** Centralized 4-provider hardcoded lists across 14 files into a single PROVIDER_REGISTRY in constants.ts, deriving all related constants and a SupportedProvider type.

## What Was Built

Created a single source of truth for provider identity in `src/constants.ts`:

```typescript
export const PROVIDER_REGISTRY = {
  hetzner: { envKey: "HETZNER_TOKEN", displayName: "Hetzner Cloud", apiBaseUrl: "..." },
  digitalocean: { envKey: "DIGITALOCEAN_TOKEN", displayName: "DigitalOcean", apiBaseUrl: "..." },
  vultr: { envKey: "VULTR_TOKEN", displayName: "Vultr", apiBaseUrl: "..." },
  linode: { envKey: "LINODE_TOKEN", displayName: "Linode (Akamai)", apiBaseUrl: "..." },
} as const;

export type SupportedProvider = keyof typeof PROVIDER_REGISTRY;
export const SUPPORTED_PROVIDERS = Object.keys(PROVIDER_REGISTRY) as [SupportedProvider, ...SupportedProvider[]];
export const PROVIDER_ENV_KEYS: Record<SupportedProvider, string> = ...;
export const PROVIDER_DISPLAY_NAMES: Record<SupportedProvider, string> = ...;
export function invalidProviderError(value: string): string { ... }
```

All 14 call sites now import from `constants.ts` — no more local provider arrays.

## Tasks Completed

### Task 1: Create PROVIDER_REGISTRY and derived exports in constants.ts
- Added PROVIDER_REGISTRY as const object with envKey, displayName, apiBaseUrl per provider
- Derived SupportedProvider type, SUPPORTED_PROVIDERS tuple, PROVIDER_ENV_KEYS map, PROVIDER_DISPLAY_NAMES map, invalidProviderError() function
- TypeScript compiles cleanly
- **Commit:** dfd2d44

### Task 2: Update core layer and utility files to use registry
- `tokens.ts`: Replaced 5-line local ENV_KEYS with import of PROVIDER_ENV_KEYS
- `manage.ts`: Replaced local VALID_PROVIDERS array; uses SUPPORTED_PROVIDERS + invalidProviderError()
- `provision.ts`: Uses invalidProviderError() for invalid provider message
- `defaults.ts`: Uses SUPPORTED_PROVIDERS + invalidProviderError() for provider validation
- `yamlConfig.ts`: Uses SUPPORTED_PROVIDERS + invalidProviderError(); non-string warning uses SUPPORTED_PROVIDERS.map()
- `serverSelect.ts`: Replaced local envKeys object with PROVIDER_ENV_KEYS import
- `doctor.ts`: Replaced PROVIDER_CONFIG with PROVIDER_REGISTRY (envKey/displayName) + local DOCTOR_VALIDATE_URLS
- All 2047 tests pass
- **Commit:** d809ec0

### Task 3: Update command layer and MCP tools to use registry
- `init.ts`: Uses SUPPORTED_PROVIDERS for validation; 12-line if/else env token chain replaced with 4-line PROVIDER_ENV_KEYS lookup
- `add.ts`: Hardcoded choices replaced with SUPPORTED_PROVIDERS.map(p => PROVIDER_DISPLAY_NAMES[p])
- `prompts.ts`: Same choices update as add.ts
- `serverInfo.ts`: z.enum(SUPPORTED_PROVIDERS), SupportedProvider type annotation
- `serverManage.ts`: z.enum(SUPPORTED_PROVIDERS)
- `serverProvision.ts`: z.enum(SUPPORTED_PROVIDERS), SupportedProvider type annotation
- All 2047 tests pass
- **Commit:** a17ad45

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] invalidProviderError() message format needed quotes around provider value**
- **Found during:** Task 2 — tests ran after updating yamlConfig.ts
- **Issue:** `yamlConfig.test.ts` expected `.toContain('Invalid provider: "aws"')` (with quotes), but the initial `invalidProviderError("aws")` produced `Invalid provider: aws.` (no quotes)
- **Fix:** Updated invalidProviderError() to produce `Invalid provider: "aws". Use ...` (quoted). Also updated `defaults.test.ts` to use `'Invalid provider: "aws"'` since the old format was unquoted and the new canonical format uses quotes.
- **Files modified:** src/constants.ts, tests/unit/defaults.test.ts
- **Commit:** d809ec0

**2. [Rule 1 - Bug] Remaining hardcoded provider string in yamlConfig.ts non-string warning**
- **Found during:** Verification check after Task 3
- **Issue:** `grep -rn '"hetzner", "digitalocean"'` still matched the static `"must be a string"` warning message in yamlConfig.ts
- **Fix:** Replaced static string with `SUPPORTED_PROVIDERS.map((p) => \`"${p}"\`).join(", ")`
- **Files modified:** src/utils/yamlConfig.ts
- **Commit:** 2a6db0d

## Decisions Made

1. **doctor.ts validation URLs stay local** — The `apiBaseUrl` in PROVIDER_REGISTRY (e.g., `https://api.linode.com/v4`) differs from the doctor validation URL (e.g., `/v4/profile`). A local `DOCTOR_VALIDATE_URLS` map is more correct than adding provider-specific paths to the registry.

2. **invalidProviderError() quotes the provider value** — Format is `Invalid provider: "aws". Use ...` matching the pre-existing yamlConfig test expectation.

3. **SupportedProvider type lives in constants.ts** — Keeps provider identity co-located with the registry definition rather than polluting types/index.ts.

4. **providerFactory.ts left unchanged** — As noted in the plan, the switch statement in providerFactory.ts dispatches to concrete classes and is not a validation array.

## Verification Results

```
grep -rn '"hetzner", "digitalocean"' src/ | grep -v constants.ts  →  0 matches
grep -n 'PROVIDER_REGISTRY' src/constants.ts                       →  5 matches
npm test                                                            →  2047/2047 pass
npm run build                                                       →  clean exit
npx eslint src/ --max-warnings=0                                    →  0 errors, 0 warnings
```

## Self-Check: PASSED

Files exist:
- src/constants.ts — FOUND
- src/core/tokens.ts — FOUND
- src/core/manage.ts — FOUND
- src/mcp/tools/serverProvision.ts — FOUND

Commits:
- dfd2d44 — FOUND (feat: PROVIDER_REGISTRY in constants)
- d809ec0 — FOUND (feat: core layer update)
- a17ad45 — FOUND (feat: commands and MCP tools)
- 2a6db0d — FOUND (fix: yamlConfig warning)
