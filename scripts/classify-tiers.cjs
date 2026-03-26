#!/usr/bin/env node
/**
 * Classify all AuditCheck objects in parser files with safeToAutoFix tier.
 * Handles Windows \r\n line endings.
 */

const fs = require('fs');
const path = require('path');

const checksDir = path.join(__dirname, '..', 'src', 'core', 'audit', 'checks');
const SKIP_FILES = ['ssh.ts', 'firewall.ts', 'docker.ts', 'ddos.ts', 'index.ts'];

const GUARDED_PATTERNS = [
  /systemctl\s+restart/,
  /systemctl\s+reload/,
  /service\s+\S+\s+restart/,
  /service\s+\S+\s+reload/,
  /nginx\s+-t/,
  /systemctl\s+enable\s+--now/,
];

const INSTRUCTIONAL_PREFIXES = [
  'Add ', 'Edit ', 'Configure ', 'Ensure ', 'Review ', 'Verify ',
  'See ', 'Update ', 'Use ', 'Remove ', 'Create ',
];

function classifyFixCommand(fixCommand) {
  for (const prefix of INSTRUCTIONAL_PREFIXES) {
    if (fixCommand.startsWith(prefix)) return 'GUARDED';
  }
  for (const pattern of GUARDED_PATTERNS) {
    if (pattern.test(fixCommand)) return 'GUARDED';
  }
  if (fixCommand.startsWith('#') || fixCommand.startsWith('// ')) return 'GUARDED';
  return 'SAFE';
}

function findFixCommandAbove(lines, idx) {
  for (let i = idx - 1; i >= Math.max(0, idx - 10); i--) {
    const line = lines[i];

    // Single-line fixCommand with value
    // Grab EVERYTHING between the outer quotes (greedy, to get full value including \n)
    let m = line.match(/fixCommand:\s*'(.*)'/) ||
            line.match(/fixCommand:\s*"(.*)"/) ||
            line.match(/fixCommand:\s*`(.*)`/);
    if (m) return m[1];

    // Multi-line fixCommand where value starts on next line
    if (/fixCommand:\s*$/.test(line.trim())) {
      // Collect the value from subsequent line(s)
      let fullValue = '';
      for (let j = i + 1; j <= idx; j++) {
        // Full line value (greedy)
        const vm = lines[j].match(/['"](.*)['"]/) || lines[j].match(/`(.*)`/);
        if (vm) {
          fullValue = vm[1];
          break;
        }
      }
      if (fullValue) return fullValue;
    }
  }
  return null;
}

const DIRECT_FILES = new Set(['auth.ts', 'filesystem.ts', 'kernel.ts', 'logging.ts', 'network.ts', 'updates.ts']);

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  const isDirect = DIRECT_FILES.has(fileName);

  if (content.includes('safeToAutoFix')) {
    console.log(`SKIP ${fileName} — already classified`);
    return { changes: 0, safeCount: 0, guardedCount: 0 };
  }

  // Normalize line endings for processing
  const eol = content.includes('\r\n') ? '\r\n' : '\n';

  // For DEF_ARRAY files: update import + interface + mapper
  if (!isDirect) {
    // 1. Update import to include FixTier
    content = content.replace(
      /import type \{([^}]+)\} from ["']\.\.\/types\.js["'];/,
      (match, imports) => {
        if (imports.includes('FixTier')) return match;
        return `import type {${imports.trim()}, FixTier} from "../types.js";`;
      }
    );

    // 2. Add safeToAutoFix to interface - handle \r\n
    content = content.replace(
      /(fixCommand:\s*string;\s*)\r?\n(\s*explain:)/,
      `$1${eol}  safeToAutoFix?: FixTier;${eol}$2`
    );

    // 3. Add def.safeToAutoFix to ALL mapper return objects
    // Pattern: fixCommand: def.fixCommand, ... explain: def.explain
    content = content.replace(
      /(fixCommand:\s*def\.fixCommand,?\s*)\r?\n(\s*)(explain:\s*def\.explain)/g,
      `$1${eol}$2safeToAutoFix: def.safeToAutoFix,${eol}$2$3`
    );
  }

  // 4. Add safeToAutoFix value before each explain: in check definitions
  const lines = content.split(/\r?\n/);
  const newLines = [];
  let changes = 0, safeCount = 0, guardedCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (trimmed.startsWith('explain:') || trimmed.startsWith('explain ')) {
      // Skip interface definition (contains 'string;')
      if (trimmed.includes('string;') || trimmed.includes('string,')) {
        newLines.push(lines[i]);
        continue;
      }

      // Skip if already preceded by safeToAutoFix
      if (i > 0 && lines[i - 1].includes('safeToAutoFix')) {
        newLines.push(lines[i]);
        continue;
      }

      const fixVal = findFixCommandAbove(lines, i);
      if (fixVal !== null) {
        const tier = classifyFixCommand(fixVal);
        if (tier === 'SAFE') safeCount++; else guardedCount++;
        const indent = lines[i].match(/^(\s*)/)[1];
        newLines.push(`${indent}safeToAutoFix: "${tier}",`);
        changes++;
      }
    }
    newLines.push(lines[i]);
  }

  if (changes > 0) {
    const result = newLines.join(eol);
    fs.writeFileSync(filePath, result, 'utf8');
    console.log(`${fileName} (${isDirect ? 'DIRECT' : 'DEF'}): ${changes} checks (${safeCount} SAFE, ${guardedCount} GUARDED)`);
  }
  return { changes, safeCount, guardedCount };
}

const files = fs.readdirSync(checksDir)
  .filter(f => f.endsWith('.ts') && !SKIP_FILES.includes(f))
  .sort();

console.log(`Processing ${files.length} parser files...\n`);

let totalChanges = 0, totalSafe = 0, totalGuarded = 0;

for (const file of files) {
  const result = processFile(path.join(checksDir, file));
  totalChanges += result.changes || 0;
  totalSafe += result.safeCount || 0;
  totalGuarded += result.guardedCount || 0;
}

console.log(`\nTotal: ${totalChanges} checks (${totalSafe} SAFE, ${totalGuarded} GUARDED)`);
