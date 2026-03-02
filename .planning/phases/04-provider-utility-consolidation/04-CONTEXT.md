# Phase 4: Provider & Utility Consolidation - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Centralize hardcoded provider lists and remove duplicate stripSensitiveData() across the codebase. Provider list and utility functions live in exactly one place — constants.ts and base.ts — with all call sites updated. No new features, no behavior changes.

</domain>

<decisions>
## Implementation Decisions

### Consolidation Scope — Full Provider Registry
- Create a single `PROVIDER_REGISTRY` object in `constants.ts` containing: provider name, env variable key, display name, and API base URL
- Derive `SUPPORTED_PROVIDERS` array from `PROVIDER_REGISTRY` keys
- Derive `PROVIDER_ENV_KEYS` mapping from `PROVIDER_REGISTRY` values
- Keep existing `IP_WAIT` and `COOLIFY_MIN_WAIT` constants separate — they serve different purposes (provision timing vs identity)
- Remove all hardcoded provider lists from: `add.ts`, `manage.ts`, `defaults.ts`, `init.ts`, `yamlConfig.ts`, `serverInfo.ts`, `serverManage.ts`, `serverProvision.ts`
- Remove duplicate env key mappings from: `tokens.ts`, `serverSelect.ts`

### init.ts Environment Chain — Convert Now
- Transform the 12-line `if/else if HETZNER_TOKEN / DIGITALOCEAN_TOKEN / ...` chain (lines 113-124) into a 2-line `PROVIDER_ENV_KEYS[provider]` lookup in this phase, not Phase 6
- init.ts Phase 6 refactor will handle the bigger `deployServer()` extraction; this phase only touches the provider validation and env lookup sections

### Type Derivation — as const + Zod Integration
- Define `PROVIDER_REGISTRY` with `as const` assertion
- Derive `SupportedProvider` union type from the registry keys: `type SupportedProvider = keyof typeof PROVIDER_REGISTRY`
- Create a Zod-compatible enum: export a `SUPPORTED_PROVIDERS` tuple for use in `z.enum(SUPPORTED_PROVIDERS)`
- MCP tools (`serverInfo.ts`, `serverManage.ts`, `serverProvision.ts`) replace inline `z.enum(["hetzner", ...])` with the shared constant

### Error Message Standardization
- Create a single `invalidProviderError(value: string): string` helper function
- Function auto-generates the provider list from `SUPPORTED_PROVIDERS` constant
- All 8 files with "Invalid provider" messages switch to this helper
- Helper location: `constants.ts` alongside the registry (zero extra imports needed)

### stripSensitiveData — Standalone Export in base.ts
- Move the identical `stripSensitiveData()` function to `src/providers/base.ts` as a named export
- All 4 provider files (`hetzner.ts`, `digitalocean.ts`, `vultr.ts`, `linode.ts`) import from `base.ts`
- Function signature unchanged: `export function stripSensitiveData(error: unknown): void`
- No provider-specific variations — all 4 implementations are identical (verified)

### Claude's Discretion
- Exact ordering of fields within PROVIDER_REGISTRY entries
- Whether to add JSDoc comments on exported constants/types
- Import organization after changes (follow existing ESM conventions)
- Whether invalidProviderError returns a string or throws directly

</decisions>

<specifics>
## Specific Ideas

- PROVIDER_REGISTRY should make adding a 5th provider (e.g., Dokploy in v1.3.0) a single-object-entry change
- Zod enum derivation enables compile-time safety — if a provider is removed from the registry, all z.enum() call sites fail at build time
- doctor.ts has its own provider-envVar mapping (lines 14-29) — this should also reference the registry

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/constants.ts`: Already has provider-keyed Records (IP_WAIT, COOLIFY_MIN_WAIT) — natural home for PROVIDER_REGISTRY
- `src/core/tokens.ts`: Has PROVIDER_ENV_KEYS mapping (lines 4-7) — will be replaced by registry derivation
- `src/providers/base.ts`: Exports CloudProvider interface — natural home for shared stripSensitiveData

### Established Patterns
- SCREAMING_SNAKE_CASE for module-level constants (e.g., `COOLIFY_UPDATE_CMD`, `BOOT_MAX_ATTEMPTS`)
- ESM imports with `.js` extension throughout the project
- `Record<string, ...>` for provider-keyed lookup tables
- Zod schemas in MCP tools for input validation

### Integration Points
- 8 files import/hardcode provider lists — all need to import from constants.ts
- 4 provider files import axios for stripSensitiveData — base.ts needs axios import
- MCP tools use `z.enum()` inline — switch to shared constant tuple
- `createProviderWithToken()` in tokens.ts uses the env key mapping — switch to registry

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-provider-utility-consolidation*
*Context gathered: 2026-03-02*
