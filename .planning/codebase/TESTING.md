# Testing Patterns

**Analysis Date:** 2026-03-02

## Test Framework

**Runner:**
- Jest 30.x
- Config: `jest.config.cjs` (CommonJS config, required for ESM project)
- Transform: `ts-jest` with `tsconfig.test.json`
- Test root: `tests/` directory

**Assertion Library:**
- Jest built-in (`expect`, matchers)

**Run Commands:**
```bash
npm test                   # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Run with coverage report
```

## Test File Organization

**Location:**
- Separate `tests/` directory (NOT co-located with source)
- Three-tier structure mirroring concern type: `unit/`, `integration/`, `e2e/`

**Naming:**
- Pattern: `<feature>.test.ts` or `<feature>-<variant>.test.ts`
- Variants use suffixes: `-bare` (bare server mode), `-edge` (edge cases), `-safemode`, `-command`
- Examples: `backup-bare.test.ts`, `config-edge.test.ts`, `restore-safemode.test.ts`

**Structure:**
```
tests/
├── __mocks__/         # Manual module mocks (axios, chalk, ora, inquirer)
├── unit/              # 50+ test files — core logic, utils, providers, MCP tools
├── integration/       # 4 provider test files (hetzner, digitalocean, vultr, linode)
└── e2e/               # 10 test files — full command flows, security scenarios
```

## Test Structure

**Suite Organization:**
```typescript
describe("checkCoolifyHealth", () => {
  it("should return 'running' when Coolify responds", async () => {
    mockedAxios.get.mockResolvedValueOnce({ status: 200 });
    const result = await checkCoolifyHealth("1.2.3.4");
    expect(result).toBe("running");
  });
});

// Grouped by mode variant
describe("checkServerStatus - bare mode", () => {
  it("should return coolifyStatus='n/a' for bare server without calling checkCoolifyHealth", async () => {
    const bareServer = { ...sampleServer, mode: "bare" as const };
    ...
  });
});
```

**Patterns:**
- Setup: `beforeEach(() => { jest.clearAllMocks(); })` — always clear mocks between tests
- Environment isolation: save/restore `process.env` in `beforeEach` / `afterAll`
- Teardown: `consoleSpy.mockRestore()`, `processExitSpy.mockRestore()` in `afterEach`
- Assertion: `expect(result).toBe(...)` for primitives, `expect(result).toEqual(...)` for objects
- Negative assertions: `expect(spy).not.toHaveBeenCalled()`, `expect(output).not.toContain(secret)`

**Test description convention:**
- `it("should <verb> <result> when <condition>")` — explicit BDD-style wording
- Error scenarios: `it("should return error when <condition>")`
- Edge cases: `it("should handle <non-obvious scenario>")`

## Mocking

**Framework:** Jest built-in mocking (`jest.mock`, `jest.fn`, `jest.spyOn`)

**Global manual mocks** in `tests/__mocks__/` (auto-applied via `moduleNameMapper` in jest config):
- `tests/__mocks__/axios.ts` — mock axios with `jest.fn()` for get/post/put/delete/patch, includes `isAxiosError` implementation
- `tests/__mocks__/chalk.ts` — chainable proxy that returns identity function (no color codes in output)
- `tests/__mocks__/ora.ts` — mock spinner with `jest.fn()` methods: `start`, `succeed`, `fail`, `warn`, `stop`
- `tests/__mocks__/inquirer.ts` — mock with `jest.fn()` for `prompt`, includes `Separator` class

**Module mocking patterns:**
```typescript
// Mock entire module
jest.mock("../../src/utils/config");
jest.mock("../../src/utils/providerFactory");

// Cast for typed access
const mockedConfig = config as jest.Mocked<typeof config>;
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Use typed mock in tests
mockedAxios.get.mockResolvedValueOnce({ data: { servers: [] } });
mockedConfig.getServers.mockReturnValue([sampleServer]);
```

**Inline module factory mocks** for utilities that need specific return values across the whole file:
```typescript
jest.mock("../../src/utils/healthCheck", () => ({
  waitForCoolify: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../src/utils/config", () => ({
  saveServer: jest.fn(),
  getServers: jest.fn().mockReturnValue([]),
  removeServer: jest.fn(),
  findServer: jest.fn(),
}));
```

**What to Mock:**
- External HTTP calls — always mock `axios` (no real network calls in tests)
- File system — mock `src/utils/config` (no real ~/.quicklify file touched)
- SSH operations — mock `src/utils/ssh` for tests involving SSH commands
- Interactive prompts — mock `inquirer.prompt` with chained `mockResolvedValueOnce` calls
- Browser opening — mock `src/utils/openBrowser`
- Child process — mock `child_process` for `spawnSync`/`execSync` calls
- `process.exit` — `jest.spyOn(process, "exit").mockImplementation(() => {})` to prevent test runner exit

**What NOT to Mock:**
- Pure utility logic that has no side effects (`errorMapper.ts`, `modeGuard.ts`, `configMerge.ts`)
- Type narrowing and data transformation functions
- The module under test itself

**`jest.clearAllMocks()`** in every `beforeEach` — never leave stale mock state between tests.

## Fixtures and Factories

**Test Data:**
```typescript
// Inline constant fixtures — defined at top of test file, shared across describes
const sampleServer = {
  id: "123",
  name: "coolify-test",
  provider: "hetzner",
  ip: "1.2.3.4",
  region: "nbg1",
  size: "cax11",
  createdAt: "2026-02-20T00:00:00Z",
};

// Variant via spread
const bareServer = { ...sampleServer, mode: "bare" as const };
const manualServer = { ...sampleServer, id: "manual-abc123" };

// Factory helper for parametric tests
const makeRecord = (mode?: "coolify" | "bare"): ServerRecord => ({
  id: "1",
  name: "test-server",
  provider: "hetzner",
  ip: "1.2.3.4",
  region: "nbg1",
  size: "cax11",
  createdAt: "2026-01-01T00:00:00Z",
  ...(mode !== undefined ? { mode } : {}),
});
```

**API Response Fixtures:**
```typescript
// Named mock response objects for provider APIs
const hetznerLocationsResponse = {
  data: { locations: [{ name: "nbg1", city: "Nuremberg", country: "Germany" }] },
};

// Chained per-call returns for ordered API sequences
mockedAxios.get
  .mockResolvedValueOnce({ data: { servers: [] } })  // validateToken
  .mockResolvedValueOnce(hetznerLocationsResponse)    // getAvailableLocations
  .mockResolvedValueOnce({ data: { server: { status: "running" } } }); // getServerStatus
```

**Location:** All fixtures defined inline in test files — no shared fixture files.

## Coverage

**Requirements:**
- `coverageThreshold.global`: branches 80%, functions 80%, lines 80%, statements 80%
- Actual: 95%+ across the project (2047 tests, 76 suites)
- Configured in: `jest.config.cjs`

**Coverage collection:**
```javascript
collectCoverageFrom: [
  'src/**/*.ts',
  '!src/index.ts',  // CLI entry point excluded
],
```

**Coverage ignore:**
- `/* istanbul ignore next */` used sparingly — only for untestable OS-specific branches and `process.exit` fallbacks (3 occurrences in entire codebase)

**View Coverage:**
```bash
npm run test:coverage
# Output written to: coverage/
```

## Test Types

**Unit Tests** (`tests/unit/`, 50+ files):
- Scope: Individual functions, utilities, core logic, MCP tool handlers
- Each source module has a corresponding `*.test.ts` file
- Provider `*-bare.test.ts` variants test bare server mode behavior
- MCP tools tested as `mcp-server-*.test.ts` files

**Integration Tests** (`tests/integration/`, 4 files):
- Scope: Provider classes (`HetznerProvider`, `DigitalOceanProvider`, `VultrProvider`, `LinodeProvider`)
- Tests full provider interface including all API methods
- Uses mocked axios but tests the real provider class instances
- Includes security tests: `cause chain sanitization` — verifies API tokens not leaked in error cause chains

**E2E Tests** (`tests/e2e/`, 10 files):
- Scope: Full command flows (init, destroy, status) + security scenarios
- `init.test.ts` — complete multi-provider deployment flow with prompt simulation
- `security-*.test.ts` — dedicated security validation: token exposure, process.title masking, SSH key handling, domain injection

## Common Patterns

**Async Testing:**
```typescript
// Always async/await for async functions
it("should return 'running' when Coolify responds", async () => {
  mockedAxios.get.mockResolvedValueOnce({ status: 200 });
  const result = await checkCoolifyHealth("1.2.3.4");
  expect(result).toBe("running");
});

// Error path testing
it("should reject when provider throws", async () => {
  (mockProvider.getServerStatus as jest.Mock).mockRejectedValue(new Error("Unauthorized"));
  await expect(getCloudServerStatus(server, "bad-token")).rejects.toThrow("Unauthorized");
});
```

**Error Testing:**
```typescript
// Test that errors bubble up correctly
it("should return error result when provider throws", async () => {
  (mockProvider.getServerStatus as jest.Mock).mockRejectedValue(new Error("API failure"));
  const result = await checkServerStatus(server, "bad-token");
  expect(result.serverStatus).toBe("error");
  expect(result.error).toBe("API failure");
});

// Test non-Error thrown values (always covered)
it("should handle non-Error thrown values", async () => {
  (mockProvider.getServerStatus as jest.Mock).mockRejectedValue("string error");
  const result = await checkServerStatus(server, "bad-token");
  expect(result.error).toBe("string error");
});
```

**MCP Response Testing:**
```typescript
// MCP responses always parsed from JSON text
const result = await handleServerInfo({ action: "list" });
const data = JSON.parse(result.content[0].text);
expect(data.servers).toHaveLength(2);
expect(result.isError).toBeUndefined();  // success: no isError

// Error MCP response
expect(result.isError).toBe(true);
expect(data.error).toContain("No servers found");
```

**Process.exit Spying:**
```typescript
processExitSpy = jest.spyOn(process, "exit").mockImplementation((() => {}) as any);
// ... run command ...
expect(processExitSpy).toHaveBeenCalledWith(1);
expect(processExitSpy).not.toHaveBeenCalled();
```

**Console Output Capture:**
```typescript
consoleSpy = jest.spyOn(console, "log").mockImplementation();
// ... run command ...
const allOutput = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
expect(allOutput).toContain("1.2.3.4");
expect(allOutput).not.toContain(secretToken);  // security assertion
```

**setTimeout override for speed (E2E tests):**
```typescript
// Make boot polling resolve instantly
global.setTimeout = ((fn: Function) => { fn(); return 0; }) as any;
// Restore in afterEach
global.setTimeout = originalSetTimeout;
```

**Environment variable isolation:**
```typescript
const originalEnv = process.env;
beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.HETZNER_TOKEN;
});
afterAll(() => {
  process.env = originalEnv;
});
```

**Mock Provider construction** — always build a full `CloudProvider` interface mock inline:
```typescript
const mockProvider: CloudProvider = {
  name: "hetzner",
  displayName: "Hetzner Cloud",
  validateToken: jest.fn().mockResolvedValue(true),
  getRegions: jest.fn().mockReturnValue([]),
  getServerSizes: jest.fn().mockReturnValue([]),
  getAvailableLocations: jest.fn().mockResolvedValue([]),
  getAvailableServerTypes: jest.fn().mockResolvedValue([]),
  uploadSshKey: jest.fn(),
  createServer: jest.fn(),
  getServerStatus: jest.fn(),
  getServerDetails: jest.fn(),
  destroyServer: jest.fn(),
  rebootServer: jest.fn(),
  createSnapshot: jest.fn(),
  listSnapshots: jest.fn(),
  deleteSnapshot: jest.fn(),
  getSnapshotCostEstimate: jest.fn(),
};
```

---

*Testing analysis: 2026-03-02*
