#!/usr/bin/env node
// PreToolUse hook: Block kastell destroy / server-delete commands (hard block)

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

    if (/\bkastell\s+(destroy|server-delete)\b/.test(cmd)) {
      process.stdout.write(JSON.stringify({
        decision: 'block',
        reason: 'Destructive kastell operation detected. Use kastell destroy with --force flag directly in terminal, not through Claude Code.',
      }));
      process.exit(2);
    }
  } catch {}

  // Not destructive or parse error — allow
  process.exit(0);
});
