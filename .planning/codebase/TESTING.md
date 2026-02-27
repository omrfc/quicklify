# Testing Patterns

**Analysis Date:** 2026-02-27

## Test Framework

**Runner:**
- Jest 30.2.0
- Config: `jest.config.cjs`
- Test environment: Node.js
- TypeScript: ts-jest transformer with `tsconfig.test.json`

**Assertion Library:**
- Jest built-in matchers (no external assertion library)
- Common matchers: `.toBe()`, `.toContain()`, `.toHaveBeenCalled()`, `.toHaveBeenCalledWith()`, `.rejects`, `.resolves`

**Run Commands:**
```bash
npm test              # Run all tests
npm run test:watch   # Watch mode for development
npm run test:coverage # Generate coverage report (coverage/)
```

**Coverage Threshold:**
```javascript
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
}
```

Minimum 80% across all metrics required to pass CI.

## Test File Organization

**Location:**
- E2E tests: `tests/e2e/` (command flow integration)
- Integration tests: `tests/integration/` (provider + SSH interactions)
- Unit tests: `tests/unit/` (individual functions, utilities)

**Naming:**
- `{feature}.test.ts` for feature tests: `init.test.ts`, `add.test.ts`, `status.test.ts`
- `{module}.test.ts` for utility tests: `errorMapper.test.ts`, `config.test.ts`, `healthCheck.test.ts`
- Edge cases in `{feature}-edge.test.ts`: `healthCheck-edge.test.ts`, `config-edge.test.ts`

**Test File Count:** 68 files across 4 test suites

## Test Structure

**Organization Pattern:**
```typescript
describe("initCommand E2E", () => {
  let consoleSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation();
    processExitSpy = jest.spyOn(process, "exit").mockImplementation((() => {}) as any);
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe("Hetzner flow", () => {
    it("should complete full deployment flow successfully", async () => {
      // Test body
    });

    it("should abort when user cancels deployment", async () => {
      // Test body
    });
  });

  describe("DigitalOcean flow", () => {
    // Tests for DigitalOcean provider
  });
});
```

**Patterns:**
- `beforeEach()` sets up mocks and clears state
- `afterEach()` restores all spies and patches
- Nested `describe()` blocks group by feature/provider/scenario
- Each `it()` tests single behavior (arrange → act → assert)

## Mocking

**Framework:** Jest mocks with `jest.fn()`, `jest.spyOn()`, `jest.mock()`

**Module Mocking (jest.config.cjs):**
```javascript
moduleNameMapper: {
  '^axios$': '<rootDir>/tests/__mocks__/axios.ts',
  '^ora$': '<rootDir>/tests/__mocks__/ora.ts',
  '^inquirer$': '<rootDir>/tests/__mocks__/inquirer.ts',
  '^chalk$': '<rootDir>/tests/__mocks__/chalk.ts',
}
```

These modules are stubbed in `tests/__mocks__/` with Jest functions.

**Function Mocking (Example from init.test.ts):**
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

**Setup Pattern (init.test.ts):**
```typescript
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;

// Chain promise rejections for sequence of API calls
mockedAxios.get
  .mockResolvedValueOnce({ data: { servers: [] } })        // Call 1
  .mockResolvedValueOnce(hetznerLocationsResponse)          // Call 2
  .mockResolvedValueOnce(hetznerServerTypesResponse)        // Call 3
  .mockResolvedValueOnce(hetznerLocationsResponse)          // Call 4
  .mockResolvedValueOnce(hetznerServerTypesResponse)        // Call 5
  .mockResolvedValueOnce({ data: { server: { ... } } });   // Call 6
```

**What to Mock:**
- External APIs (axios calls to Hetzner, DigitalOcean, etc.)
- User input (inquirer prompts)
- Filesystem (config saves, SSH key generation)
- Timers (setTimeout for instant test execution)
- Console output (logger, console.log)

**What NOT to Mock:**
- Core business logic (error mapping, type conversions)
- Validation functions (IP address validation, server name validation)
- Data structures (Config objects, ServerRecords)
- Synchronous utilities (string formatting, defaults)

## Fixtures and Factories

**API Response Fixtures (init.test.ts):**
```typescript
const hetznerLocationsResponse = {
  data: {
    locations: [
      { name: "nbg1", city: "Nuremberg", country: "Germany" },
      { name: "fsn1", city: "Falkenstein", country: "Germany" },
    ],
  },
};

const hetznerServerTypesResponse = {
  data: {
    server_types: [
      {
        name: "cax11",
        cores: 2,
        memory: 4,
        disk: 40,
        prices: [{ location: "nbg1", price_monthly: { gross: "3.85" } }],
      },
    ],
  },
};
```

**Mock Helper (init.test.ts):**
```typescript
function createAxiosError(
  status: number | undefined,
  code?: string,
): Record<string, unknown> & Error {
  const error = new Error("Request failed") as Error & Record<string, unknown>;
  if (status !== undefined) {
    error.response = {
      status,
      statusText: "Error",
      data: {},
      headers: {},
      config: { headers: {} },
    };
  }
  if (code) {
    error.code = code;
  }
  error.config = { headers: {} };
  return error;
}
```

**Location:**
- Fixtures defined at top of test file, above `describe()`
- Helper functions in same file or imported from `__mocks__/`
- No external fixture files (JSON) used

## Coverage

**Requirements:** 80% minimum across branches, functions, lines, statements

**View Coverage:**
```bash
npm run test:coverage
# Generates: coverage/lcov-report/index.html (open in browser)
```

**Coverage Exclusions (jest.config.cjs):**
```javascript
collectCoverageFrom: [
  'src/**/*.ts',
  '!src/index.ts',  // Entry point with 23 command registrations
],
```

## Test Types

**Unit Tests (`tests/unit/`):**
- Scope: Individual functions and modules in isolation
- Approach: Mock external dependencies
- Examples: `errorMapper.test.ts` tests error mapping functions, `config.test.ts` tests config loading
- Count: ~40 files

**Integration Tests (`tests/integration/`):**
- Scope: Multiple modules interacting (e.g., provider + SSH)
- Approach: Mock external APIs, test workflow coordination
- Examples: SSH key setup integration, provider token validation flow
- Count: ~15 files

**E2E Tests (`tests/e2e/`):**
- Scope: Full command execution flow (user → CLI → provider → result)
- Approach: Mock all I/O (API, SSH, file system), test user interactions
- Examples: `init.test.ts` (23 scenarios), `destroy.test.ts`, `status.test.ts`
- Count: ~13 files

## Common Patterns

**Async Testing (init.test.ts):**
```typescript
it("should complete full deployment flow successfully", async () => {
  // Setup mocks
  mockedInquirer.prompt
    .mockResolvedValueOnce({ provider: "hetzner" })
    .mockResolvedValueOnce({ apiToken: "valid-token" });

  mockedAxios.get.mockResolvedValueOnce(hetznerLocationsResponse);

  // Act
  await initCommand();

  // Assert
  expect(mockedAxios.get).toHaveBeenCalled();
  expect(processExitSpy).not.toHaveBeenCalled();
});
```

**Error Testing (errorMapper.test.ts):**
```typescript
it("should suggest new token for 401 on hetzner", () => {
  const error = createAxiosError(401);
  const result = mapProviderError(error, "hetzner");

  expect(result).toContain("invalid or expired");
  expect(result).toContain("console.hetzner.cloud");
});

it("should handle network error", async () => {
  mockedAxios.get.mockRejectedValueOnce(new Error("Network failed"));

  await expect(initCommand()).rejects.toThrow();
});
```

**Provider-Specific Tests:**
```typescript
describe("Hetzner flow", () => {
  it("should complete Hetzner deployment", async () => { ... });
});

describe("DigitalOcean flow", () => {
  it("should complete DO deployment", async () => { ... });
});

describe("Vultr flow", () => {
  it("should complete Vultr deployment", async () => { ... });
});

describe("Linode flow", () => {
  it("should complete Linode deployment (beta)", async () => { ... });
});
```

**Spy on Native Functions (init.test.ts):**
```typescript
beforeEach(() => {
  consoleSpy = jest.spyOn(console, "log").mockImplementation();
  processExitSpy = jest.spyOn(process, "exit").mockImplementation((() => {}) as any);
});

it("should show output to user", async () => {
  await initCommand();

  const allOutput = consoleSpy.mock.calls.map((c: any[]) => c.join(" ")).join("\n");
  expect(allOutput).toContain("1.2.3.4");
});
```

**Time Mocking (init.test.ts):**
```typescript
beforeEach(() => {
  const originalSetTimeout = global.setTimeout;

  // Make all setTimeout calls resolve instantly
  global.setTimeout = ((fn: Function) => {
    fn();
    return 0;
  }) as any;
});

afterEach(() => {
  global.setTimeout = originalSetTimeout;
});
```

**Environment Variable Management (init.test.ts):**
```typescript
beforeEach(() => {
  const savedEnv: Record<string, string | undefined> = {};

  // Save and clear provider tokens so promptApiToken doesn't pick them up
  for (const key of ["HETZNER_TOKEN", "DIGITALOCEAN_TOKEN", ...]) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  // Restore provider tokens
  for (const key of ["HETZNER_TOKEN", "DIGITALOCEAN_TOKEN", ...]) {
    if (savedEnv[key] !== undefined) process.env[key] = savedEnv[key];
    else delete process.env[key];
  }
});
```

## Test Statistics

- **Total Tests:** 1758 (as of v1.1.0)
- **Test Suites:** 64
- **Success Rate:** 100% on main branch (CI: 6/6 matrix passing)
- **Coverage:** All files in `src/**/*.ts` except `src/index.ts` covered at 80%+ threshold

---

*Testing analysis: 2026-02-27*
