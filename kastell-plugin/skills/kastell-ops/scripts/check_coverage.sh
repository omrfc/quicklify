#!/usr/bin/env bash
# check_coverage.sh — Compare audit check count vs test count.
# Usage: bash check_coverage.sh [project-root]
#
# Counts audit checks defined in src/core/audit/checks/ and matching tests.
# Requires: node

set -euo pipefail

PROJECT_ROOT="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

node -e "
const fs = require('fs');
const path = require('path');

const root = process.argv[1];
const checksDir = path.join(root, 'src', 'core', 'audit', 'checks');

if (!fs.existsSync(checksDir)) {
  console.error('Error: ' + checksDir + ' not found');
  process.exit(1);
}

// Read all .ts files in checks dir (excluding index.ts)
const checkFiles = fs.readdirSync(checksDir)
  .filter(f => f.endsWith('.ts') && f !== 'index.ts');

let totalChecks = 0;
const uniqueIds = new Set();
const perFile = [];

for (const file of checkFiles) {
  const content = fs.readFileSync(path.join(checksDir, file), 'utf8');
  const ids = [...content.matchAll(/id:\s*['\"]([^'\"]+)['\"]/g)].map(m => m[1]);
  totalChecks += ids.length;
  ids.forEach(id => uniqueIds.add(id));
  perFile.push({ name: file.replace('.ts', ''), checks: ids.length });
}

// Count categories from index.ts
let categories = 0;
const indexPath = path.join(checksDir, 'index.ts');
if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  categories = (indexContent.match(/sectionName/g) || []).length;
}

// Find audit test files recursively
function findTests(dir) {
  let count = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count += findTests(full);
    else if (entry.name.endsWith('.test.ts') && entry.name.includes('audit') ||
             full.includes('audit') && entry.name.endsWith('.test.ts')) {
      count++;
    }
  }
  return count;
}
const testCount = findTests(path.join(root, 'src'));

// Pre-index all test file contents once (avoids N+1 file reads)
const testIndex = new Set();
function indexTests(dir) {
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) indexTests(full);
      else if (entry.name.endsWith('.test.ts')) {
        const content = fs.readFileSync(full, 'utf8');
        // Extract referenced module names from imports and test descriptions
        for (const match of content.matchAll(/['\"]([^'\"]*audit[^'\"]*)['\"]|from\s+['\"]([^'\"]+)['\"]/g)) {
          const ref = match[1] || match[2] || '';
          ref.split('/').forEach(part => testIndex.add(part.replace('.js', '').replace('.ts', '')));
        }
      }
    }
  } catch {}
}
indexTests(path.join(root, 'src'));
function hasTestFor(name) { return testIndex.has(name); }

console.log('=== Audit Check Coverage ===');
console.log('Project: ' + root);
console.log('');
console.log('Check source files: ' + checkFiles.length);
console.log('Categories:         ' + categories);
console.log('Checks defined:     ' + totalChecks);
console.log('Unique check IDs:   ' + uniqueIds.size);
console.log('Audit test files:   ' + testCount);
console.log('');
console.log('Per-file breakdown:');

perFile.sort((a, b) => a.name.localeCompare(b.name));
for (const f of perFile) {
  const tested = hasTestFor(f.name) ? '✓' : '✗';
  console.log('  ' + tested + ' ' + f.name.padEnd(20) + ' ' + String(f.checks).padStart(3) + ' checks');
}
" "$PROJECT_ROOT"
