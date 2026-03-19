# Kastell Pitfalls

Known traps, symptoms, and fixes. Severity: HIGH (blocks correct behavior), MEDIUM (causes test/maintenance pain), LOW (minor inconsistency).

---

## 1. Adapter Bypass (HIGH)

**Symptom:** `if (server.platform === 'coolify') { port = 8000 } else { port = 3000 }` in `src/commands/`

**Root cause:** Command accesses platform properties directly instead of using the adapter.

**Fix:** Use `getAdapter(platform)` from `factory.ts` and read `adapter.port`, `adapter.defaultLogService`, `adapter.platformPorts`.

```typescript
// WRONG
const port = server.platform === 'coolify' ? 8000 : 3000;

// CORRECT
import { getAdapter } from '../../src/adapters/factory.js';
const adapter = getAdapter(server.platform);
const port = adapter.port;
```

---

## 2. Business Logic in Commands (HIGH)

**Symptom:** Complex calculations, API calls, try/catch blocks, or SSH calls in `src/commands/*.ts`.

**Root cause:** Logic was not extracted to `src/core/`.

**Fix:** Extract all logic to a new `src/core/<name>.ts` function. Command only calls core and displays the result.

---

## 3. UI in Core (HIGH)

**Symptom:** `chalk.green(...)`, `ora('...').start()`, or `console.log()` in `src/core/*.ts`.

**Root cause:** Core function was handling display instead of returning data.

**Fix:** Core functions return plain data objects. The command layer (or MCP handler) handles display using chalk/ora.

---

## 4. Direct Adapter Import (MEDIUM)

**Symptom:** `import { CoolifyAdapter } from '../../src/adapters/coolify.js'` in a command or core file.

**Root cause:** Bypasses the factory cache and breaks the abstraction boundary.

**Fix:** Always use `getAdapter(platform)` from `src/adapters/factory.ts`.

---

## 5. Inline Adapter Mocks in Tests (MEDIUM)

**Symptom:** `const adapter = { healthCheck: jest.fn(), port: 8000, ... }` scattered across test files.

**Root cause:** Not using the centralized mock factory.

**Fix:** Use `createMockAdapter()` from `tests/helpers/mockAdapter.ts`. When the `PlatformAdapter` interface gains new methods, only `mockAdapter.ts` needs updating.

---

## 6. SSH Batch Grouping (MEDIUM)

**Symptom:** Audit or health commands call `sshExec` 4-6 times sequentially, each fetching partially overlapping data.

**Root cause:** Each check independently fetches data instead of using shared batched results.

**Fix:** Batch fast config commands together (single SSH call), batch slow probe commands together. Use head limits appropriate to the data volume (e.g., `head -50` for audit log checks).

---

## 7. Jest requireActual Crash (MEDIUM)

**Symptom:** Tests crash on Node v24+ with an error related to `jest.requireActual`.

**Root cause:** `jest.requireActual` behavior changed in Node v24.

**Fix:** Use inline `jest.fn()` mocks instead of `jest.requireActual`. For module-level mocks, use `jest.mock()` with a factory function.

---

## 8. Module-Level Side Effects (MEDIUM)

**Symptom:** Test imports a module that registers listeners or modifies globals at load time, causing unexpected behavior when other tests run.

**Root cause:** Module has top-level side effects (e.g., `process.on('SIGINT', ...)` at module scope).

**Fix:** Mock the module in ALL test files that import it, not just the direct test file. Side effects occur at import time.

---

## 9. Hardcoded Port Numbers (LOW)

**Symptom:** `8000` or `3000` literals appear in `src/commands/` or `src/core/` files.

**Root cause:** Port copied from constants instead of read from adapter.

**Fix:** Use `adapter.port` for platform HTTP port, `adapter.platformPorts` for firewall protection list.

---

## 10. PROVIDER_REGISTRY Mismatch (LOW)

**Symptom:** New provider works via direct code path but fails CLI validation, completion, or `--provider` flag parsing.

**Root cause:** Provider added to `src/providers/` but not added to `PROVIDER_REGISTRY` in `src/constants.ts`.

**Fix:** Always add to `PROVIDER_REGISTRY` first — it is the single source of truth for provider enumeration, validation, and display.

---

## 11. SSH Timeout Too Short (LOW)

**Symptom:** Long-running commands (lock, audit, update) fail silently or with cryptic timeout errors.

**Root cause:** Default SSH timeout (30s) is insufficient for operations like platform update (~3 minutes).

**Fix:** Use 180s timeout for slow operations:
```typescript
await sshExec(ip, command, { timeout: 180_000 });
```

---

## 12. describe.each + clearAllMocks (LOW)

**Symptom:** Tests pass individually but fail when the full suite runs. Mock call counts are wrong in later tests.

**Root cause:** `jest.clearAllMocks()` clears call history but does not reset mock implementations. `describe.each` reuses the same mock instance across parameterized runs.

**Fix:** Use `jest.resetAllMocks()` in `beforeEach` when using `describe.each`. This resets both call history and implementations.
