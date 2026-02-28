---
phase: 02-bare-mode
verified: 2026-02-28T08:17:14Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 2: Bare Mode Verification Report

**Phase Goal:** Users can provision and manage generic VPS servers without Coolify installed
**Verified:** 2026-02-28T08:17:14Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can run `quicklify init --mode bare` and get a provisioned VPS without Coolify installed | VERIFIED | `src/commands/init.ts:291` `isBare = mode === "bare"`, selects `getBareCloudInit()`, skips `waitForCoolify` and `openBrowser`, saves `mode:'bare'` to ServerRecord. `src/index.ts:57` registers `--mode <mode>` on init command. 6 passing tests in `tests/unit/init-bare.test.ts`. |
| 2 | User can run status, destroy, secure, firewall, domain, backup/restore commands against a bare server without Coolify-specific errors | VERIFIED | Destroy/secure/firewall/domain/snapshot: no code changes needed (mode-agnostic at OS/API level); regression tests confirm acceptance of bare ServerRecord. Backup routes to `createBareBackup()`, restore routes to `restoreBareBackup()`, both bypass Coolify DB operations. All regression tests passing. |
| 3 | Bare server status check reports cloud status only (no Coolify health check attempted) | VERIFIED | `src/core/status.ts:45` `coolifyStatus = isBareServer(server) ? "n/a" : await checkCoolifyHealth(server.ip)`. `src/commands/status.ts:133-138` shows SSH info instead of Coolify status. 3 tests in `tests/unit/core-status.test.ts` confirm no axios call on bare servers. |
| 4 | Server records include a `mode` field ("coolify" or "bare") visible in status output | VERIFIED | `src/types/index.ts:38-48` `ServerMode = "coolify" \| "bare"`, `ServerRecord.mode?: ServerMode`. `src/utils/config.ts:26` normalizes legacy records: `{ ...s, mode: s.mode \|\| "coolify" }`. List command (line 23 `mode.padEnd(10)`), status command (line 130 `Mode: ${getServerMode(server)}`), both show mode column. |
| 5 | All existing Coolify commands continue working unchanged on coolify-mode servers | VERIFIED | Full test suite 1871/1871 passing. Mode guard (requireCoolifyMode) returns null for coolify servers, allowing existing flows unchanged. health/update/maintain only skip bare servers in --all loops; single-server coolify path is identical. Backward compat: getServers() defaults missing mode to 'coolify'. |

**Score:** 5/5 truths verified

---

## Required Artifacts

### Plan 02-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/index.ts` | ServerRecord with optional mode field | VERIFIED | Line 38: `export type ServerMode = "coolify" \| "bare"`. Line 48: `mode?: ServerMode` on ServerRecord. Line 61: `mode?: ServerMode` on InitOptions. Line 141: `mode?: ServerMode` on BackupManifest. |
| `src/utils/cloudInit.ts` | getBareCloudInit function | VERIFIED | Exports both `getBareCloudInit` (line 1) and `getCoolifyCloudInit` (line 64). Bare script installs fail2ban, ufw, unattended-upgrades. No "coolify" or "coollabs" references. Sanitizes server name with same regex. |
| `src/utils/modeGuard.ts` | Mode detection and guard utilities | VERIFIED | Exports `getServerMode`, `isBareServer`, `requireCoolifyMode`. All three functions implemented correctly per spec. 11 tests passing. |
| `src/utils/config.ts` | getServers with backward-compat mode defaulting | VERIFIED | Line 26: `return parsed.map((s: ServerRecord) => ({ ...s, mode: s.mode \|\| "coolify" }))`. All legacy records default to 'coolify' at read time. |

### Plan 02-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/provision.ts` | provisionServer with bare mode path | VERIFIED | Line 22: `mode?: ServerMode` in ProvisionConfig. Lines 126-129: `mode === "bare" ? getBareCloudInit() : getCoolifyCloudInit()`. Line 212: `mode` saved to ServerRecord. |
| `src/commands/init.ts` | init command with --mode flag support | VERIFIED | Lines 211-213 and 244-246: `options.mode` threaded to `deployServer()`. Lines 291-293: bare cloud-init selection. Lines 428-429: bare path skips waitForCoolify. Lines 443-454: bare early-return with SSH info, no openBrowser. Lines 430-440: saves `mode:'bare'` to record. |
| `src/commands/add.ts` | add command with --mode flag support | VERIFIED | Line 14: `mode?: string` in AddOptions. Line 75: mode-aware default name. Lines 101-108: threads `mode` to `addServerRecord()`. |
| `src/index.ts` | Commander.js --mode option on init and add commands | VERIFIED | Line 57: `--mode <mode>` on init. Line 197: `--mode <mode>` on add. |
| `src/core/manage.ts` | addServerRecord with mode param | VERIFIED | Line 56: `mode?: ServerMode` in AddServerParams. Line 121: `const mode: ServerMode = params.mode \|\| "coolify"`. Lines 124-152: bare mode skips Coolify SSH verification entirely. Line 164: `mode` saved to ServerRecord. |

### Plan 02-03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/commands/status.ts` | Mode-aware status display | VERIFIED | Line 11: `isBareServer, getServerMode` imported. Line 29: `getServerMode(r.server)` in table. Lines 133-155: bare branch shows SSH info, skips Coolify line and autostart. `printStatusSummary` counts bare separately. |
| `src/commands/list.ts` | Mode column in server list | VERIFIED | Line 3: `getServerMode` imported. Line 16: `Mode` in table header. Line 23: `mode.padEnd(10)` in row. |
| `src/commands/health.ts` | Coolify-only guard | VERIFIED | Line 3: `isBareServer` imported. Lines 35-46: filters bare servers, warns and skips each, only health-checks coolify servers. |
| `src/commands/update.ts` | Coolify-only guard | VERIFIED | Line 9: `isBareServer, requireCoolifyMode` imported. Lines 128-132: `requireCoolifyMode` guard after resolveServer (single-server). Lines 92-98: bare filter+warn in updateAll loop. |
| `src/commands/maintain.ts` | Coolify-only guard | VERIFIED | Line 8: `isBareServer, requireCoolifyMode` imported. Lines 314-318: `requireCoolifyMode` guard (single-server). Lines 274-280: bare filter+warn in maintainAll loop. |
| `src/commands/logs.ts` | Mode-aware log service selection | VERIFIED | Line 4: `isBareServer` imported. Line 29: bare servers default to 'system' service. Lines 38-43: explicit error if bare+coolify service. |
| `src/core/status.ts` | Mode-aware checkServerStatus | VERIFIED | Line 5: `isBareServer` imported. Line 45: ternary skips `checkCoolifyHealth` for bare, returns 'n/a'. |

### Plan 02-04 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/backup.ts` | Bare backup/restore functions | VERIFIED | Lines 128-148: `buildBareConfigTarCommand`, `buildBareRestoreConfigCommand`, `buildBareCleanupCommand` exported. Lines 152-206: `createBareBackup` — sshExec with bare tar, scpDownload, manifest with `mode:'bare'` and `coolifyVersion:'n/a'`. Lines 208-268: `restoreBareBackup` — path traversal guard, scpUpload, sshExec extract, no Coolify stop/start commands. |
| `src/commands/backup.ts` | Mode-aware backup command | VERIFIED | Line 8: `isBareServer` imported. Line 19: `createBareBackup` imported. Lines 46-64: bare route in `backupSingleServer`. Lines 224-243: bare route in single-server `backupCommand`. |
| `src/commands/restore.ts` | Mode-aware restore command | VERIFIED | Line 6: `isBareServer` imported. Line 21: `restoreBareBackup` imported. Lines 47-53: SAFE_MODE guard before mode routing. Lines 147-157: bare route calls `restoreBareBackup`, shows service restart hint. |

---

## Key Link Verification

### Plan 02-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/utils/modeGuard.ts` | `src/types/index.ts` | import ServerRecord | WIRED | Line 1: `import type { ServerRecord, ServerMode } from "../types/index.js"` |
| `src/utils/config.ts` | `src/types/index.ts` | ServerRecord with mode field | WIRED | Line 4: `import type { ServerRecord }`. Line 26: `mode: s.mode \|\| "coolify"` |

### Plan 02-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/core/provision.ts` | `src/utils/cloudInit.ts` | getBareCloudInit import | WIRED | Line 4: `import { getCoolifyCloudInit, getBareCloudInit } from "../utils/cloudInit.js"`. Used at line 128. |
| `src/commands/init.ts` | `src/core/provision.ts` | mode threaded through deployServer | WIRED | Line 16: `import { getCoolifyCloudInit, getBareCloudInit }`. Line 213: `options.mode` passed. Line 292: `isBare ? getBareCloudInit() : getCoolifyCloudInit()`. |
| `src/index.ts` | `src/commands/init.ts` | Commander --mode option | WIRED | Line 57 of index.ts: `.option("--mode <mode>", ...)`. |

### Plan 02-03 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/commands/status.ts` | `src/utils/modeGuard.ts` | isBareServer import | WIRED | Line 11: `import { isBareServer, getServerMode } from "../utils/modeGuard.js"`. Used at lines 29, 37, 40, 43, 46, 133. |
| `src/commands/health.ts` | `src/utils/modeGuard.ts` | isBareServer import | WIRED | Line 3: `import { isBareServer } from "../utils/modeGuard.js"`. Used at lines 35-36, 38. |
| `src/commands/update.ts` | `src/utils/modeGuard.ts` | requireCoolifyMode import | WIRED | Line 9: `import { isBareServer, requireCoolifyMode }`. Used at line 92 (loop), line 128 (single). |
| `src/core/status.ts` | `src/types/index.ts` | ServerRecord mode field | WIRED | Line 5: `import { isBareServer }`. Line 45: `isBareServer(server) ? "n/a" : await checkCoolifyHealth()`. |

### Plan 02-04 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/commands/backup.ts` | `src/core/backup.ts` | createBareBackup import | WIRED | Line 19: `import { ..., createBareBackup } from "../core/backup.js"`. Used at lines 50, 228. |
| `src/commands/restore.ts` | `src/core/backup.ts` | restoreBareBackup import | WIRED | Line 21: `import { ..., restoreBareBackup } from "../core/backup.js"`. Used at line 148. |
| `src/commands/backup.ts` | `src/utils/modeGuard.ts` | isBareServer for routing | WIRED | Line 8: `import { isBareServer } from "../utils/modeGuard.js"`. Used at lines 46, 208, 224. |
| `src/commands/restore.ts` | `src/utils/modeGuard.ts` | isBareServer for mode-aware routing | WIRED | Line 6: `import { isBareServer } from "../utils/modeGuard.js"`. Used at line 147. |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BARE-01 | 02-02 | User can provision a server without Coolify via `--mode bare` | SATISFIED | `provisionServer` selects `getBareCloudInit()` for bare mode; `initCommand` bare path skips waitForCoolify + openBrowser; `--mode` flag registered on init command. 6 init-bare + 6 provision-bare tests passing. |
| BARE-02 | 02-03 | User can check bare server status (cloud status only, no Coolify health check) | SATISFIED | `checkServerStatus` returns `coolifyStatus:'n/a'` for bare; status display shows Mode field and SSH info. 3 core-status + 4 status tests passing. |
| BARE-03 | 02-03 | User can destroy a bare server (same SAFE_MODE protection) | SATISFIED | destroyCommand operates at cloud API level — mode-independent. Regression test `tests/unit/destroy.test.ts:187` passes. |
| BARE-04 | 02-03 | User can run security hardening on a bare server | SATISFIED | secureCommand operates via SSH — mode-independent. Regression test `tests/unit/secure.test.ts:534` passes. |
| BARE-05 | 02-03 | User can manage firewall on a bare server | SATISFIED | firewallCommand operates via SSH — mode-independent. Regression tests `tests/unit/firewall.test.ts:540,555` pass. |
| BARE-06 | 02-03 | User can set custom domain on a bare server (with SSL) | SATISFIED | domainCommand operates via SSH — mode-independent. Regression test `tests/unit/domain.test.ts:543` passes. |
| BARE-07 | 02-04 | User can backup/restore a bare server (system-level, no Coolify DB) | SATISFIED | `createBareBackup` tars /etc/ config files; manifest includes `mode:'bare'` and `coolifyVersion:'n/a'`. `restoreBareBackup` extracts without Coolify stop/start. SAFE_MODE blocks all restore before mode routing. 29+12 tests passing. |
| BARE-08 | 02-01 | ServerRecord stores `mode: "coolify" \| "bare"` to track server type | SATISFIED | `src/types/index.ts` exports `ServerMode` type, `ServerRecord.mode?: ServerMode`. `getServers()` normalizes legacy records. Config tests verify defaulting behavior. |
| BARE-09 | 02-01, 02-03 | Existing Coolify commands continue working unchanged (backward compatible) | SATISFIED | Full suite 1871/1871 tests passing with no regressions. Mode defaulting ensures legacy records read as 'coolify'. requireCoolifyMode returns null for coolify servers, passing control to existing logic. |

**All 9 BARE-* requirements satisfied. No orphaned requirements found.**

---

## Anti-Patterns Found

No anti-patterns detected in any phase-modified file. Scan covered:
- `src/utils/modeGuard.ts`, `src/utils/cloudInit.ts`, `src/utils/config.ts`
- `src/types/index.ts`
- `src/core/provision.ts`, `src/core/manage.ts`, `src/core/status.ts`, `src/core/backup.ts`
- `src/commands/init.ts`, `src/commands/add.ts`, `src/commands/status.ts`, `src/commands/list.ts`
- `src/commands/health.ts`, `src/commands/update.ts`, `src/commands/maintain.ts`, `src/commands/logs.ts`
- `src/commands/backup.ts`, `src/commands/restore.ts`

No TODO/FIXME comments, no placeholder returns (return null / return {} patterns unrelated to logic), no console.log-only stubs found.

---

## Human Verification Required

### 1. Interactive init --mode bare flow

**Test:** Run `quicklify init --mode bare` interactively (without flags), select a real provider, and complete the flow.
**Expected:** Bare cloud-init script deployed; server boots without Coolify installed; SSH connection info displayed instead of browser open + Coolify dashboard link.
**Why human:** Requires a real cloud provider API token and live server creation to verify cloud-init actually runs and Coolify is absent.

### 2. Bare server backup/restore on live server

**Test:** Run `quicklify backup <bare-server>` then `quicklify restore <bare-server>` against a live bare VPS.
**Expected:** /etc/nginx, /etc/ssh/sshd_config, /etc/ufw, /etc/fail2ban, /etc/crontab backed up as tar; restore extracts them to /etc; service restart hint shown.
**Why human:** Requires SSH access to a live server; unit tests mock SSH operations.

---

## Build and Test Results

| Check | Result |
|-------|--------|
| `npm run build` | PASSED (TypeScript compile, no errors) |
| `npm test` (full suite) | PASSED (1871/1871 tests) |
| Bare-mode unit tests | PASSED (114/114: modeGuard, cloudInit, provision-bare, init-bare, manage-bare, add-bare, core-status, core-backup, backup-bare, restore-bare) |
| Command guard tests | PASSED (586/586: status, list, health, update, maintain, logs, destroy, secure, firewall, domain, snapshot) |

---

## Gaps Summary

No gaps. All 5 observable truths are verified. All 18 artifacts exist, are substantive, and are wired. All 9 BARE requirements are satisfied. Build and full test suite pass cleanly.

---

_Verified: 2026-02-28T08:17:14Z_
_Verifier: Claude (gsd-verifier)_
