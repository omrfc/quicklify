#!/usr/bin/env node
// PreToolUse hook: Block git commit if staged .ts source files lack matching test files.
// Checks src/**/*.ts files (excluding known non-testable patterns) for a corresponding .test.ts.
// Bypass: SKIP_TEST_CHECK=1 environment variable.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// MANDATORY stdin guard
if (!process.stdin || process.stdin.destroyed || !process.stdin.readable) {
  process.exit(0);
}

// Files/patterns that don't need tests
const EXCLUDE_PATTERNS = [
  /\/types\//,           // type definitions
  /\/types\.ts$/,        // type files
  /\.d\.ts$/,            // declaration files
  /\/constants\.ts$/,    // constants
  /\/index\.ts$/,        // barrel exports
  /\/interface\.ts$/,    // interface definitions
  /\/factory\.ts$/,      // factory (tested via consumers)
  /__tests__\//,         // test files themselves
  /\.test\.ts$/,         // test files
  /\.spec\.ts$/,         // spec files
  /\/mcp\/server\.ts$/,  // MCP server registration (tested via tool tests)
];

function shouldRequireTest(filePath) {
  return !EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

function findTestFile(srcFile, projectRoot) {
  const relative = path.relative(projectRoot, srcFile);
  const parsed = path.parse(relative);
  const baseName = parsed.name;
  const dir = parsed.dir;

  // Pattern 1: __tests__/ alongside source (Kastell convention)
  // src/core/foo.ts → src/core/__tests__/foo.test.ts
  const testPath1 = path.join(projectRoot, dir, '__tests__', `${baseName}.test.ts`);
  if (fs.existsSync(testPath1)) return true;

  // Pattern 2: __tests__ in parent dir
  // src/commands/foo.ts → src/__tests__/commands/foo.test.ts
  const parts = dir.split(path.sep);
  if (parts.length >= 2) {
    const parentTest = path.join(projectRoot, parts[0], '__tests__', ...parts.slice(1), `${baseName}.test.ts`);
    if (fs.existsSync(parentTest)) return true;
  }

  // Pattern 3: test file with similar name anywhere in __tests__
  // Broader search — check if any test file references this module
  try {
    const result = execSync(
      `git ls-files "*.test.ts" 2>/dev/null | xargs grep -l "${baseName}" 2>/dev/null || true`,
      { cwd: projectRoot, encoding: 'utf8', timeout: 3000 }
    ).trim();
    if (result.length > 0) return true;
  } catch {
    // grep failed — don't block
  }

  return false;
}

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 1500);
process.stdin.setEncoding('utf8');
process.stdin.on('error', () => process.exit(0));
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const cmd = (data.tool_input && data.tool_input.command) || '';

    // Only check git commit commands
    if (!/\bgit\s+commit\b/.test(cmd)) {
      process.exit(0);
    }

    // Allow bypass
    if (process.env.SKIP_TEST_CHECK === '1') {
      process.exit(0);
    }

    // Find project root
    let projectRoot = process.cwd();
    try {
      projectRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8', timeout: 2000 }).trim();
    } catch {}

    // Get staged .ts files in src/
    let stagedFiles;
    try {
      const staged = execSync('git diff --cached --name-only --diff-filter=A', {
        cwd: projectRoot, encoding: 'utf8', timeout: 3000
      }).trim();
      if (!staged) {
        process.exit(0); // No new files
      }
      stagedFiles = staged.split('\n')
        .filter(f => f.startsWith('src/') && f.endsWith('.ts'))
        .filter(f => shouldRequireTest(f));
    } catch {
      process.exit(0); // git command failed — don't block
    }

    if (stagedFiles.length === 0) {
      process.exit(0);
    }

    // Check each file for a matching test
    const missing = [];
    for (const file of stagedFiles) {
      const fullPath = path.join(projectRoot, file);
      if (!findTestFile(fullPath, projectRoot)) {
        missing.push(file);
      }
    }

    if (missing.length > 0) {
      process.stdout.write(JSON.stringify({
        decision: 'block',
        reason: `New source files without tests detected:\n${missing.map(f => '  - ' + f).join('\n')}\n\nWrite tests for these files before committing. For non-testable files, use SKIP_TEST_CHECK=1.`,
      }));
      process.exit(2);
    }

    // All files have tests
    process.exit(0);
  } catch {
    process.exit(0);
  }
});
