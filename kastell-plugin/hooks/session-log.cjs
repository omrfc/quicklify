#!/usr/bin/env node
// PostToolUse hook: Log Bash command + output to ~/.kastell/session.log

const fs = require('fs');
const path = require('path');
const os = require('os');

const LOG_DIR = path.join(os.homedir(), '.kastell');
const LOG_FILE = path.join(LOG_DIR, 'session.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB rotation threshold
const SECRET_PATTERN = /(?:TOKEN|SECRET|PASSWORD|KEY|CREDENTIAL|BEARER|AUTHORIZATION)\s*[=:]\s*\S+/gi;

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

    // Safety check — matcher already filters, but guard explicitly
    if (data.tool_name !== 'Bash') {
      process.exit(0);
    }

    const cmd = ((data.tool_input && data.tool_input.command) || '').substring(0, 500);
    const rawOut = ((data.tool_response && data.tool_response.output) || '').substring(0, 2000);
    const out = rawOut.replace(SECRET_PATTERN, '[REDACTED]');

    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] CMD: ${cmd}\nOUT: ${out}\n---\n`;

    // Ensure log directory exists (guard avoids redundant mkdirSync on hot path)
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

    // Log rotation: truncate when exceeding threshold
    try {
      const stat = fs.statSync(LOG_FILE);
      if (stat.size > MAX_LOG_SIZE) fs.writeFileSync(LOG_FILE, entry, { mode: 0o600 });
      else fs.appendFileSync(LOG_FILE, entry, 'utf8');
    } catch {
      // File does not exist yet — create with restrictive permissions
      fs.writeFileSync(LOG_FILE, entry, { mode: 0o600 });
    }
  } catch {}

  // Always exit 0 — logging must never block execution
  process.exit(0);
});
