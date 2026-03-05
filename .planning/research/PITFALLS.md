# Pitfalls Research: Kastell v1.3

**Date:** 2026-03-05
**Confidence:** HIGH

## Critical Pitfalls

### P1: String Replacement False Positives
**Risk:** Bulk `quicklify` -> `kastell` replacement hits URLs, paths, or identifiers that shouldn't change.
**Examples:**
- GitHub URLs in docs (`github.com/omrfc/quicklify` should stay until repo transfer)
- npm registry URLs (`npmjs.com/package/quicklify` in deprecation notices)
- CHANGELOG historical entries (should they say kastell or quicklify for old versions?)
- Test snapshots/fixtures with "quicklify" strings

**Prevention:**
- Use targeted replacement, not global find-replace
- Review every occurrence manually or with grep before replacing
- Keep historical references as-is in CHANGELOG (events happened under quicklify name)
- Create a replacement checklist: which files get replaced, which don't

### P2: Config Path Migration Data Loss
**Risk:** `~/.quicklify` -> `~/.kastell` migration can lose data if done wrong.
**Scenarios:**
- User runs old quicklify and new kastell in parallel
- Migration crashes mid-copy (partial state)
- Symlink instead of copy causes confusion
- Windows vs Unix path differences

**Prevention:**
- Copy (don't move) on first run: `~/.quicklify` -> `~/.kastell`
- Only migrate if `~/.kastell` doesn't already exist
- Log migration action clearly
- Never delete `~/.quicklify` automatically — let user clean up
- Test migration on Windows + Unix paths

### P3: npm Deprecation Timing
**Risk:** Deprecating `quicklify` before `kastell` is published leaves users with no working package.
**Correct order:**
1. Publish `kastell@1.3.0` to npm (verified working)
2. THEN `npm deprecate quicklify "Moved to kastell — https://kastell.dev"`
3. Never unpublish quicklify — deprecated packages still install

**Prevention:**
- Script the publish + deprecate as a single workflow
- Verify `npx kastell --version` works before deprecating
- Add deprecation notice to quicklify README before deprecating package

### P4: bin Entry Name Change Breaks Scripts
**Risk:** Users with `quicklify` in shell scripts, CI pipelines, aliases, or cron jobs will break silently.
**Prevention:**
- Document the name change prominently in CHANGELOG
- Consider publishing a `quicklify` wrapper that prints deprecation warning and runs `kastell`
- Update all documentation examples

## Moderate Pitfalls

### P5: Test File Reference Updates
**Risk:** Tests reference "quicklify" in expect() assertions, mock paths, snapshot files.
**Prevention:**
- `grep -r "quicklify" __tests__/ src/**/*.test.ts` before and after replacement
- Run full test suite after every replacement batch
- Don't replace test descriptions that describe historical behavior

### P6: MCP Server Name Change
**Risk:** Claude clients configured with `quicklify` MCP server name won't find `kastell` MCP server.
**Prevention:**
- Update `.mcp.json`, `settings.json`, `~/.claude.json` MCP entries
- Document MCP migration in README
- Consider supporting both names temporarily

### P7: GitHub Actions Workflow Paths
**Risk:** Workflows reference repo name, paths, or package name that change.
**Prevention:**
- Search all `.github/workflows/*.yml` for "quicklify"
- Test CI pipeline on a branch before merging to main
- Update badge URLs in README

### P8: Adapter Interface Bloat
**Risk:** Over-designing PlatformAdapter interface with methods for v1.5+ features.
**Prevention:**
- Only add methods that v1.3 actually needs: cloudInit, healthCheck, backup, status
- Don't add restore, logs, version, etc. — those are v1.5
- Keep interface minimal, extend later

### P9: CoolifyAdapter Behavior Drift
**Risk:** Refactoring existing Coolify logic into CoolifyAdapter introduces subtle behavior changes.
**Prevention:**
- Extract existing code as-is first (pure mechanical refactor)
- Run full test suite after extraction, before any modifications
- Don't "improve" Coolify code during extraction

### P10: Backward Compatibility Break in ServerRecord
**Risk:** Adding `platform` field breaks existing saved server records.
**Prevention:**
- Make `platform` optional (`platform?: Platform`)
- Use `getServers()` normalization (like existing mode migration)
- Default: `mode: "coolify"` -> `platform: "coolify"` automatically

## Minor Pitfalls

### P11: Apache 2.0 NOTICE File
**Risk:** Forgetting to create NOTICE file (Apache 2.0 convention).
**Prevention:** Add to license change checklist. NOTICE file lists project name and copyright.

### P12: package.json bin Field
**Risk:** Changing `"quicklify"` to `"kastell"` in bin field but forgetting to update related npm scripts.
**Prevention:** Search package.json for all "quicklify" references.

### P13: import/require Paths
**Risk:** Internal imports reference config paths or constants with "quicklify".
**Prevention:** `grep -r "quicklify" src/` to find all internal references.

### P14: Docker/Container References
**Risk:** Cloud-init scripts reference "quicklify" in container names, labels, or volumes.
**Prevention:** Search cloud-init templates and scripts for "quicklify".

### P15: Case Sensitivity
**Risk:** "Quicklify" (capitalized) in display strings, help text, error messages may be missed by case-sensitive search.
**Prevention:** Search for both "quicklify" and "Quicklify" patterns. Also check "QUICKLIFY" (env vars).

### P16: Dokploy Port Conflicts
**Risk:** If Coolify was previously on the server, Dokploy's Traefik conflicts with Coolify's proxy on port 80/443.
**Prevention:** Document that Coolify and Dokploy cannot coexist on same server. Validate in provision flow.

### P17: Dokploy API Key Availability
**Risk:** Dokploy API key may not be available immediately after installation (needs initial setup).
**Prevention:** Health check should handle "not yet configured" state gracefully.

### P18: Environment Variable Naming
**Risk:** `QUICKLIFY_SAFE_MODE` and other env vars need renaming to `KASTELL_SAFE_MODE`.
**Prevention:** Support both old and new env var names temporarily, with deprecation warning for old ones.

## Phase Assignment

| Pitfall | Phase | Priority |
|---------|-------|----------|
| P1 String replacement | Phase 1 (Rebrand) | CRITICAL |
| P2 Config migration | Phase 1 (Rebrand) | CRITICAL |
| P3 npm deprecation | Phase 1 (Rebrand) | CRITICAL |
| P4 bin entry change | Phase 1 (Rebrand) | CRITICAL |
| P5 Test references | Phase 1 (Rebrand) | MODERATE |
| P6 MCP name change | Phase 1 (Rebrand) | MODERATE |
| P7 GitHub Actions | Phase 1 (Rebrand) | MODERATE |
| P8 Interface bloat | Phase 2 (Dokploy) | MODERATE |
| P9 CoolifyAdapter drift | Phase 2 (Dokploy) | MODERATE |
| P10 ServerRecord compat | Phase 2 (Dokploy) | MODERATE |
| P11 NOTICE file | Phase 1 (Rebrand) | MINOR |
| P12-P15 Various refs | Phase 1 (Rebrand) | MINOR |
| P16-P17 Dokploy runtime | Phase 2 (Dokploy) | MINOR |
| P18 Env var naming | Phase 1 (Rebrand) | MINOR |

---
*Research completed: 2026-03-05*
