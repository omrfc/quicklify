# Template: CLI Command — $1

## Files to Create

1. `src/commands/$1.ts` — thin wrapper (parse args, call core, display result)
2. `src/core/$1.ts` — all business logic (no UI imports)
3. `src/__tests__/core/$1.test.ts` — test the core function, not the command

## Command File (thin wrapper)

```typescript
// src/commands/$1.ts
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { $1Core } from '../core/$1.js';

program
  .command('$1')
  .description('TODO: describe what this command does')
  .option('--server <name>', 'Target server name or IP')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora('Running $1...').start();
    try {
      const result = await $1Core(options);
      spinner.succeed('Done');
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.green(result.message));
      }
    } catch (error) {
      spinner.fail(error instanceof Error ? error.message : 'Unknown error');
      process.exitCode = 1;
    }
  });
```

## Core File (all logic here)

```typescript
// src/core/$1.ts
export interface $1Options { server?: string; json?: boolean; }
export interface $1Result { success: boolean; message: string; }

export async function $1Core(options: $1Options): Promise<$1Result> {
  // ALL business logic here. NO chalk/ora/UI imports.
  // assertValidIp() before SSH. getAdapter(platform) for platform ops.
  // withProviderErrorHandling() for provider calls.
  throw new Error('Not implemented');
}
```

## Test File

```typescript
// src/__tests__/core/$1.test.ts
import { $1Core } from '../../core/$1.js';
jest.mock('../../utils/ssh.js');

describe('$1Core', () => {
  beforeEach(() => jest.resetAllMocks());

  it('should TODO: describe expected behavior', async () => {
    const result = await $1Core({ server: 'test-server' });
    expect(result.success).toBe(true);
  });
});
```

## Next Steps

- [ ] Register command in `src/index.ts`
- [ ] Write tests first (TDD: test core function, not command)
- [ ] Add `isSafeMode()` check if operation is destructive
- [ ] Add `assertValidIp()` before any SSH operation
- [ ] Use `getAdapter(platform)` for platform-specific operations (never import adapters directly)
- [ ] Run `npm run build && npm test && npm run lint`
- [ ] Update README.md command table
