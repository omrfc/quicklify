# Contributing to Quicklify

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

1. **Fork & Clone**

```bash
git clone https://github.com/YOUR_USERNAME/quicklify.git
cd quicklify
```

2. **Install Dependencies**

```bash
npm install
```

3. **Run in Development**

```bash
npm run dev -- init
```

4. **Run Tests**

```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

5. **Build**

```bash
npm run build
```

## Project Structure

```
src/
├── index.ts              # CLI entry point (Commander.js)
├── commands/
│   └── init.ts           # Main deploy command
├── providers/
│   ├── base.ts           # CloudProvider interface
│   ├── hetzner.ts        # Hetzner Cloud implementation
│   └── digitalocean.ts   # DigitalOcean (coming soon)
├── types/
│   └── index.ts          # Shared TypeScript types
└── utils/
    ├── cloudInit.ts      # Cloud-init script generator
    ├── logger.ts         # Chalk-based logging
    ├── prompts.ts        # Inquirer.js prompts
    └── validators.ts     # Input validation

tests/
├── __mocks__/            # Module mocks (axios, inquirer, ora, chalk)
├── unit/                 # Unit tests
├── integration/          # Provider API tests
└── e2e/                  # Full flow tests
```

## Adding a New Cloud Provider

1. Create `src/providers/yourprovider.ts` implementing `CloudProvider` interface
2. Add provider regions, server sizes, and API calls
3. Write tests in `tests/integration/yourprovider.test.ts`
4. Add provider selection to `src/commands/init.ts`

## Pull Request Process

1. Create a feature branch from `main`

```bash
git checkout -b feature/your-feature
```

2. Make your changes following existing code style
3. Write/update tests - we maintain **100% coverage**
4. Ensure all tests pass

```bash
npm test
```

5. Ensure TypeScript compiles without errors

```bash
npx tsc --noEmit
```

6. Commit with a descriptive message

```bash
git commit -m "feat: add awesome feature"
```

We follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `test:` tests
- `ci:` CI/CD changes
- `refactor:` code refactoring
- `chore:` maintenance

7. Push and open a PR against `main`

## Code Guidelines

- TypeScript strict mode is enabled
- No `any` types - use proper interfaces
- All user input must be validated
- Keep dependencies minimal
- Test edge cases (network errors, invalid input, timeouts)

## Areas for Contribution

- New cloud provider integrations (DigitalOcean, Vultr, Linode)
- CLI improvements and new commands
- Better error messages and UX
- Documentation and examples
- Bug fixes

## Questions?

Open a [GitHub Discussion](https://github.com/omrfc/quicklify/discussions) or [Issue](https://github.com/omrfc/quicklify/issues).
