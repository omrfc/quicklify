---
phase: 36-notification-module
plan: "02"
subsystem: cli
tags: [commander, inquirer, chalk, ora, notifications, telegram, discord, slack]

# Dependency graph
requires:
  - phase: 36-notification-module plan 01
    provides: loadNotifyConfig, saveNotifyConfig, sendTelegram, sendDiscord, sendSlack — core notify infrastructure
provides:
  - addChannel() function in src/core/notify.ts — interactive + force-flag channel config
  - testChannel() function in src/core/notify.ts — validates config and sends test message
  - src/commands/notify.ts — thin CLI wrapper with notify add and notify test subcommands
  - notify command registered in src/index.ts
affects:
  - 36-notification-module plan 03 (guard integration — will call dispatchWithCooldown)
  - 39-guard-notify (guard script integration)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - notifyCommand(program) registration pattern — takes Command, registers subcommand tree internally
    - addChannel force/interactive dual-path — force=true uses CLI args, force=false uses Inquirer prompts
    - createSpinner from utils/logger (not direct ora import) — testable spinner abstraction

key-files:
  created:
    - src/commands/notify.ts
    - tests/unit/notify-command.test.ts
  modified:
    - src/core/notify.ts
    - src/index.ts

key-decisions:
  - "Used createSpinner from utils/logger (not direct ora import) — enables clean mocking in tests without breaking Jest resetAllMocks"
  - "Used jest.clearAllMocks() in notify-command.test.ts (not resetAllMocks) — module-level mock factories need impl preserved across tests"
  - "notifyCommand(program) takes Command and registers full subcommand tree internally — follows registerAuthCommands pattern (not inline .command() like guard)"

patterns-established:
  - "addChannel: validate → force/interactive branch → loadNotifyConfig → merge → saveNotifyConfig"
  - "testChannel: validate channel → check config exists → spinner → send → print result"

requirements-completed: [NOTF-01, NOTF-02, NOTF-03, NOTF-04]

# Metrics
duration: 7min
completed: 2026-03-14
---

# Phase 36 Plan 02: Notify CLI Commands Summary

**Commander subcommands `kastell notify add <channel>` and `kastell notify test <channel>` wired to core addChannel/testChannel with full Inquirer interactive and --force non-interactive support**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-14T18:13:53Z
- **Completed:** 2026-03-14T18:20:33Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- addChannel() in core/notify.ts — supports all 3 channels, --force mode and interactive Inquirer mode, merges into existing config without clobbering other channels
- testChannel() in core/notify.ts — validates channel name, checks config existence, sends [Kastell]-prefixed test message with ora spinner
- src/commands/notify.ts thin wrapper exposing notify add (--bot-token, --chat-id, --webhook-url, --force) and notify test subcommands
- notify command registered in src/index.ts; `kastell notify --help` shows both subcommands
- 16 new unit tests; full suite 3092 tests green

## Task Commits

1. **Task 1: Create notify command with add/test subcommands and tests** - `246ad5d` (feat)
2. **Task 2: Register notifyCommand in index.ts and verify full build** - `414c2e9` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/commands/notify.ts` - Thin CLI wrapper registering notify add + test subcommands on program
- `src/core/notify.ts` - Added addChannel(), testChannel(), AddChannelOptions interface
- `src/index.ts` - Import + registration of notifyCommand(program)
- `tests/unit/notify-command.test.ts` - 16 unit tests covering addChannel (force + interactive) and testChannel (all 3 channels + error cases)

## Decisions Made

- Used `createSpinner` from `utils/logger` instead of direct `ora` import in notify.ts — avoids Jest resetAllMocks wiping the ora mock implementation; follows logger abstraction pattern
- Used `jest.clearAllMocks()` instead of `jest.resetAllMocks()` in notify-command.test.ts — module-level mock factories (`jest.fn(() => {...})`) lose their implementation after `resetAllMocks`
- `notifyCommand(program: Command)` takes the root program and registers `notify` as a subcommand tree — follows `registerAuthCommands` pattern rather than inline `.command()` chains in index.ts

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Jest `resetAllMocks()` wiped the `ora` mock implementation (via `createSpinner`) causing `Cannot read properties of undefined (reading 'start')` — resolved by switching to `clearAllMocks()` in this test file and mocking `utils/logger` directly instead of `ora` globally.

## Next Phase Readiness

- `kastell notify add <channel>` and `kastell notify test <channel>` fully operational
- addChannel writes ~/.kastell/notify.json; testChannel validates before sending
- Phase 36 Wave 2 complete — notify module (core + CLI) is ready for Phase 39 guard integration
- dispatchWithCooldown from Plan 01 is the primary consumer in the guard script (Phase 39)

---
*Phase: 36-notification-module*
*Completed: 2026-03-14*
