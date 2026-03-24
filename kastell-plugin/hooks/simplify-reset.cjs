#!/usr/bin/env node
// PostToolUse hook: Delete simplify stamp after successful git commit.
// This ensures /simplify must be run again before the next commit.

const fs = require('fs');
const path = require('path');

// MANDATORY stdin guard — exit silently if stdin unavailable
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

    // Only act on git commit commands
    if (!/\bgit\s+commit\b/.test(cmd)) {
      process.exit(0);
    }

    // Check if commit was successful (output contains commit hash pattern)
    const output = (data.tool_response && (data.tool_response.stdout || data.tool_response.output)) || '';
    const exitCode = data.tool_response && data.tool_response.exitCode;

    // Successful commit: output contains "[main hash]" or "[branch hash]" pattern, or exit code 0
    const commitSucceeded = /\[\w+[\s/][\w-]+ [a-f0-9]+\]/.test(output) || exitCode === 0;

    if (!commitSucceeded) {
      process.exit(0);
    }

    // Delete stamp so next commit requires /simplify again
    let dir = process.cwd();
    while (dir !== path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, '.git'))) break;
      dir = path.dirname(dir);
    }

    const stampFile = path.join(dir, '.claude', '.simplify-stamp');
    try {
      fs.unlinkSync(stampFile);
    } catch {
      // File doesn't exist or can't be deleted — not critical
    }
  } catch {
    // Parse error — don't interfere
  }

  // Always exit 0 — post-commit cleanup must never block
  process.exit(0);
});
