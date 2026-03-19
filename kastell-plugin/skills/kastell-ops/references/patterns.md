# Kastell Patterns

## Do / Don't

| Do                                                                    | Don't                                                              |
|-----------------------------------------------------------------------|--------------------------------------------------------------------|
| Put all business logic in `src/core/`                                 | Put logic in `src/commands/` — commands are thin wrappers only    |
| Use `getAdapter(platform)` from `factory.ts`                          | Import `CoolifyAdapter` / `DokployAdapter` directly in commands   |
| Use `adapter.port`, `adapter.defaultLogService`, `adapter.platformPorts` | Hardcode port numbers (8000, 3000) in command files            |
| Use `withProviderErrorHandling` HOF for provider operations           | Write per-command try/catch around provider API calls             |
| Use `assertValidIp()` before every SSH operation                      | Call `sshExec` without IP validation                              |
| Use `sanitizedEnv` for subprocess calls                               | Pass raw `process.env` to child processes                         |
| Use `sanitizeResponseData()` for API error responses                  | Leak raw API error objects to the user                            |
| Use `createMockAdapter()` from `tests/helpers/mockAdapter.ts`         | Write inline `{ healthCheck: jest.fn() }` objects in tests        |
| Batch SSH commands (fast config + slow probes) in audit operations    | Call `sshExec` multiple times fetching overlapping data           |
| Return plain data objects from `src/core/` functions                  | Import `chalk` or `ora` in `src/core/` files                      |
| Use `jest.resetAllMocks()` with `describe.each`                       | Use `clearAllMocks()` with `describe.each` (causes cross-test bleed) |

## Testing Patterns

### Pattern 1: Mock Adapter Factory

Use `createMockAdapter()` from `tests/helpers/mockAdapter.ts`. Never write inline mock adapter objects.

```typescript
import { createMockAdapter } from '../../tests/helpers/mockAdapter.js';

// Basic usage — gets correct defaults for the platform
const adapter = createMockAdapter({ name: 'coolify' });
// adapter.port === 8000, adapter.defaultLogService === 'coolify'

// Override specific methods
const adapter = createMockAdapter({
  name: 'dokploy',
  overrides: {
    healthCheck: jest.fn(async () => ({ status: 'not reachable' as const })),
  },
});

// In the test — inject via jest.mock or direct parameter
jest.mock('../../src/adapters/factory.js', () => ({
  getAdapter: jest.fn(() => adapter),
  resolvePlatform: jest.fn(() => 'coolify'),
}));
```

### Pattern 2: SSH Mock

Mock `sshExec` at the module level. Use `mockResolvedValueOnce` for sequential calls.

```typescript
import { sshExec } from '../../src/utils/ssh.js';
jest.mock('../../src/utils/ssh.js');
const mockSshExec = sshExec as jest.MockedFunction<typeof sshExec>;

// Single call
mockSshExec.mockResolvedValueOnce({ code: 0, stdout: 'active', stderr: '' });

// Multiple sequential calls (batch grouping pattern)
mockSshExec
  .mockResolvedValueOnce({ code: 0, stdout: 'ufw active', stderr: '' })  // fast config
  .mockResolvedValueOnce({ code: 0, stdout: '{"load": 0.5}', stderr: '' }); // slow probe
```

### Pattern 3: MCP Handler Test

Import the handler directly and call it with the expected parameters. Assert on `result.content[0].text`.

```typescript
import { handleServerAudit } from '../serverAudit.js';

// Mock the core dependency
jest.mock('../../src/core/audit/runner.js');
import { runAudit } from '../../src/core/audit/runner.js';
const mockRunAudit = runAudit as jest.MockedFunction<typeof runAudit>;

describe('handleServerAudit', () => {
  beforeEach(() => jest.resetAllMocks());

  it('returns audit results', async () => {
    mockRunAudit.mockResolvedValueOnce({ score: 85, checks: [] });

    const result = await handleServerAudit({
      server: 'test-server',
      category: 'ssh',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('85');
  });

  it('returns error on failure', async () => {
    mockRunAudit.mockRejectedValueOnce(new Error('SSH timeout'));

    const result = await handleServerAudit({ server: 'test-server' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('SSH timeout');
  });
});
```

### Pattern 4: Command Test (mock core, not low-level deps)

Test commands by mocking the core module — not `sshExec`, not providers. This verifies delegation.

```typescript
jest.mock('../../src/core/backup.js');
import { backupServer } from '../../src/core/backup.js';
const mockBackupServer = backupServer as jest.MockedFunction<typeof backupServer>;

describe('backup command', () => {
  beforeEach(() => jest.resetAllMocks());

  it('delegates to backupServer core function', async () => {
    mockBackupServer.mockResolvedValueOnce({
      success: true,
      backupPath: '/home/user/.kastell/backups/myserver',
    });

    // Execute command action directly (Commander action callback)
    await backupAction({ server: 'myserver' });

    expect(mockBackupServer).toHaveBeenCalledWith('myserver');
  });
});
```

## Core Function Signature Conventions

Core functions return typed result objects, never throw to the caller:

```typescript
// Pattern: return { success, data?, error?, hint? }
export async function exampleCore(server: string): Promise<ExampleResult> {
  try {
    const record = getServerRecord(server); // throws if not found
    assertValidIp(record.ip);               // throws if invalid
    // ... business logic ...
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
```
