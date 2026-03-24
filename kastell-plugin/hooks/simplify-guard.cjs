#!/usr/bin/env node
// PreToolUse hook: Block git commit if /simplify hasn't been run.
// Checks for .claude/.simplify-stamp file existence.
// Bypass: SKIP_SIMPLIFY=1 environment variable (for trivial commits).

const fs = require('fs');
const path = require('path');

// MANDATORY stdin guard — exit silently if stdin unavailable (e.g. after /clear)
if (!process.stdin || process.stdin.destroyed || !process.stdin.readable) {
  process.exit(0);
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

    // Only check git commit commands (not git add, git status, etc.)
    if (!/\bgit\s+commit\b/.test(cmd)) {
      process.exit(0);
    }

    // Allow bypass via environment variable
    if (process.env.SKIP_SIMPLIFY === '1') {
      process.exit(0);
    }

    // Find project root (walk up to find .git)
    let dir = process.cwd();
    while (dir !== path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, '.git'))) break;
      dir = path.dirname(dir);
    }

    const stampFile = path.join(dir, '.claude', '.simplify-stamp');

    if (!fs.existsSync(stampFile)) {
      process.stdout.write(JSON.stringify({
        decision: 'block',
        reason: '/simplify has not been run before this commit. Run /simplify first, then retry the commit. For trivial commits (typo, 1-line fix), set SKIP_SIMPLIFY=1.',
      }));
      process.exit(2);
    }

    // Stamp exists — allow commit
    process.exit(0);
  } catch {
    // Parse error — don't block
    process.exit(0);
  }
});
