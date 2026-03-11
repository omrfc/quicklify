# Phase 26: Evidence Collection - Research

**Researched:** 2026-03-11
**Domain:** SSH batch evidence collection, local filesystem persistence, SHA256 checksums, CLI command + MCP tool registration
**Confidence:** HIGH

## Summary

Phase 26 adds a forensic evidence collection command (`kastell evidence <server>`) that SSHes into a server, collects data across multiple categories in a single batched connection, writes each data item as a flat file inside a timestamped directory, and produces MANIFEST.json + SHA256SUMS for chain-of-custody integrity.

All necessary infrastructure already exists in the codebase. The SSH batch pattern (commands.ts), atomic file write pattern (snapshot.ts), fileLock utility, and config directory root are all directly reusable. No new production dependencies are needed. The implementation is a new module in `src/core/evidence.ts` with a thin CLI wrapper in `src/commands/evidence.ts` and a 9th MCP tool in `src/mcp/tools/serverEvidence.ts`.

**Primary recommendation:** Mirror the audit module's architecture exactly — one batch command builder, one core module returning `KastellResult<EvidenceResult>`, one thin CLI command, one MCP tool. Do not deviate from the established patterns.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Output Structure**
- Default storage: `~/.kastell/evidence/{server}/{timestamp_or_name}/`
- `--output` flag overrides the directory
- Flat directory — all files at one level, no category subdirectories
- Two manifest files: MANIFEST.json (detailed meta: filename, sha256, size, collectedAt) + SHA256SUMS (sha256sum -c compatible text)
- Directory naming: `2026-03-11_pre-incident` format — date + optional name via `--name`
- Duplicate name → error: "Evidence 'X' already exists. Use --force to overwrite."

**Data Scope**
- Core 4 (EVID-02): firewall rules (ufw status), auth.log, listening ports (ss/netstat), system logs (syslog/journal)
- Extra: Docker info (docker ps list + platform container logs)
- Extra: System info (crontab, user list, process list, disk usage)
- Each data source in its own file — independent SHA256 per file
- Log line limit: default 500, adjustable via `--lines`
- Docker logs: all containers list (docker ps) + platform container logs only (Coolify/Dokploy)
- Platform-aware: bare = core 4 + sysinfo, coolify/dokploy = + Docker data

**CLI Interface**
- Top-level command: `kastell evidence <server>`
- Flags: --name, --output, --lines, --json, --no-docker, --no-sysinfo, --quiet, --force
- Terminal output: spinner per step + summary table at end
- Sensitive data warning: yellow warning after collection
- MCP tool: `server_evidence` as 9th tool

**Error Handling**
- Partial collection: accessible data collected, inaccessible marked "skipped" in manifest
- Partial success exit code: 2 (full success: 0, full failure: 1)
- SSH connection failure: fail immediately + clear error, no retry (forensic = time critical)
- SSH timeout: 120 seconds
- Disk space exhaustion: clean up partial evidence directory, do not leave corrupt data
- Bare mode: Docker sections auto-skipped (platform-aware, --no-docker redundant but accepted)

### Claude's Discretion
- Evidence file naming convention (firewall-rules.txt, auth.log, etc.)
- MANIFEST.json exact schema
- SSH batch command organization (how many batches, which sections together)
- MCP tool parameter design
- Spinner message text
- Summary table columns and format

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EVID-01 | User can collect forensic evidence package with single command | CLI command `kastell evidence <server>` + core module; Commander.js pattern documented below |
| EVID-02 | Evidence includes firewall rules, auth.log, listening ports, system logs | SSH batch command builder pattern from audit/commands.ts reused; data sources and SSH commands documented |
| EVID-03 | Evidence manifest includes SHA256 checksums per file | Node.js crypto.createHash('sha256') pattern + MANIFEST.json schema; SHA256SUMS text format documented |
| EVID-04 | Evidence collection uses single SSH connection (batch pattern) | Same `---SEPARATOR---` batch pattern as audit; single `sshExec()` call with 120s timeout |
</phase_requirements>

---

## Standard Stack

### Core (all already in project — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `crypto` | built-in | SHA256 checksums per file | No dependency needed; `createHash('sha256').update(data).digest('hex')` |
| Node.js `fs` | built-in | Atomic file writes (tmp+rename), mkdir, readdir | Same pattern as snapshot.ts |
| `src/utils/ssh.ts` | project | `sshExec(ip, cmd, { timeoutMs: 120_000 })` | Existing SSH execution with configurable timeout |
| `src/utils/fileLock.ts` | project | `withFileLock(manifestPath, fn)` for manifest write | Prevents concurrent evidence writes |
| `src/utils/config.ts` | project | `CONFIG_DIR` = `~/.kastell/` for evidence root | Single source of truth |
| `chalk` | in project | Colored terminal output, yellow sensitive-data warning | Already used in all CLI commands |
| `ora` | in project | `createSpinner(msg)` from `src/utils/logger.ts` | Already used in audit command |

### Installation
```bash
# No new dependencies — all libraries already in project
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
  commands/evidence.ts          # Thin CLI wrapper (Commander.js)
  core/evidence.ts              # Business logic, collectEvidence()
  core/evidenceCommands.ts      # SSH batch command builder
  mcp/tools/serverEvidence.ts   # 9th MCP tool
tests/
  unit/evidence-core.test.ts    # Core logic tests (mocked SSH + fs)
  unit/evidence-command.test.ts # CLI wiring tests
  unit/mcp-server-evidence.test.ts # MCP tool tests
```

### Pattern 1: SSH Batch Collection (single connection, EVID-04)
**What:** All remote commands concatenated with `echo '---SEPARATOR---'` between sections. Single `sshExec()` call captures everything. Output split by separator to recover per-section data.
**When to use:** Any evidence collection — mandatory for EVID-04.

```typescript
// Source: src/core/audit/commands.ts (established pattern)
const SEPARATOR = "echo '---SEPARATOR---'";

export function buildEvidenceBatchCommand(platform: string, lines: number): string {
  // All sections joined into ONE command string — single SSH call
  const sections = [
    firewallSection(),
    SEPARATOR,
    authLogSection(lines),
    SEPARATOR,
    portsSection(),
    SEPARATOR,
    syslogSection(lines),
    SEPARATOR,
    sysinfoSection(),
  ];

  if (platform === "coolify" || platform === "dokploy") {
    sections.push(SEPARATOR, dockerSection(platform, lines));
  }

  return sections.join("\n");
}

// Execution — single connection (EVID-04)
const result = await sshExec(ip, batchCommand, { timeoutMs: 120_000 });
const sections = result.stdout.split("---SEPARATOR---");
```

### Pattern 2: Evidence Directory Creation (atomic, --force handling)
**What:** Create evidence directory using date + optional name. Check for existing dir. Fail fast or overwrite based on --force flag.
**When to use:** Before writing any evidence files.

```typescript
// Source: derived from snapshot.ts pattern (CONFIG_DIR + atomic write)
import { CONFIG_DIR } from "../utils/config.js";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

function buildEvidenceDir(serverName: string, name?: string, outputOverride?: string): string {
  const date = new Date().toISOString().split("T")[0]; // "2026-03-11"
  const dirName = name ? `${date}_${name}` : date;
  const base = outputOverride ?? join(CONFIG_DIR, "evidence", serverName);
  return join(base, dirName);
}

// Check for duplicate before starting SSH
if (existsSync(evidenceDir) && !force) {
  return { success: false, error: `Evidence '${dirName}' already exists. Use --force to overwrite.` };
}
mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
```

### Pattern 3: SHA256 Checksum Per File (EVID-03)
**What:** After writing each file, compute SHA256 of file contents. Accumulate checksums. Write MANIFEST.json + SHA256SUMS at end.
**When to use:** Every file written to the evidence directory.

```typescript
// Source: Node.js built-in crypto
import { createHash } from "crypto";
import { writeFileSync } from "fs";

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

// MANIFEST.json entry per file
interface EvidenceFileEntry {
  filename: string;
  sha256: string;
  sizeBytes: number;
  collectedAt: string;
  status: "collected" | "skipped";
  skipReason?: string;
}

// SHA256SUMS format (sha256sum -c compatible)
// e3b0c44298fc... firewall-rules.txt
function buildSha256Sums(entries: EvidenceFileEntry[]): string {
  return entries
    .filter((e) => e.status === "collected")
    .map((e) => `${e.sha256}  ${e.filename}`)
    .join("\n");
}
```

### Pattern 4: Partial Collection with Skipped Entries (EVID-02)
**What:** Each section's raw output is checked for "N/A" or empty. If unavailable, write a skipped entry in the manifest without creating the file. Continue collecting remaining sections.
**When to use:** When SSH command returns N/A or empty output for a section.

```typescript
// Source: established audit pattern (commands.ts uses || echo 'N/A')
function writeEvidenceFile(
  dir: string,
  filename: string,
  content: string,
  entries: EvidenceFileEntry[],
): void {
  const isSkipped = content.trim() === "N/A" || content.trim() === "";
  const collectedAt = new Date().toISOString();

  if (isSkipped) {
    entries.push({ filename, sha256: "", sizeBytes: 0, collectedAt, status: "skipped", skipReason: "N/A from server" });
    return;
  }

  const filePath = join(dir, filename);
  writeFileSync(filePath, content, "utf-8");
  entries.push({
    filename,
    sha256: sha256(content),
    sizeBytes: Buffer.byteLength(content, "utf-8"),
    collectedAt,
    status: "collected",
  });
}
```

### Pattern 5: KastellResult Return from Core
**What:** All core functions return `KastellResult<T>` — never throw, always return `{ success, data?, error?, hint? }`.
**When to use:** `collectEvidence()` return type.

```typescript
// Source: src/types/index.ts
import type { KastellResult } from "../types/index.js";

export interface EvidenceResult {
  evidenceDir: string;
  serverName: string;
  serverIp: string;
  platform: string;
  collectedAt: string;
  totalFiles: number;
  skippedFiles: number;
  manifestPath: string;
}

export async function collectEvidence(
  ip: string,
  name: string,
  platform: string,
  opts: EvidenceOptions,
): Promise<KastellResult<EvidenceResult>> {
  // ...
  return { success: true, data: evidenceResult };
}
```

### Pattern 6: CLI Command Registration (Commander.js)
**What:** Thin wrapper in `src/commands/evidence.ts`, registered in `src/index.ts`.
**When to use:** All CLI commands follow this pattern.

```typescript
// src/index.ts addition
import { evidenceCommand } from "./commands/evidence.js";

program
  .command("evidence [server]")
  .description("Collect forensic evidence package from a server")
  .option("--name <label>", "Label for evidence directory (e.g. pre-incident)")
  .option("--output <dir>", "Override output directory")
  .option("--lines <n>", "Log lines to collect (default: 500)", "500")
  .option("--no-docker", "Skip Docker data collection")
  .option("--no-sysinfo", "Skip system info collection")
  .option("--quiet", "Suppress spinner output")
  .option("--force", "Overwrite existing evidence with same name")
  .option("--json", "Print manifest to stdout as JSON")
  .action(evidenceCommand);
```

### Pattern 7: MCP Tool Registration
**What:** New file `src/mcp/tools/serverEvidence.ts` with Zod schema + handler. Registered in `src/mcp/server.ts`.
**When to use:** Adding 9th MCP tool.

```typescript
// src/mcp/tools/serverEvidence.ts
import { z } from "zod";
import { getServers } from "../../utils/config.js";
import { collectEvidence } from "../../core/evidence.js";
import { resolveServerForMcp, mcpSuccess, mcpError } from "../utils.js";

export const serverEvidenceSchema = {
  server: z.string().optional().describe("Server name or IP. Auto-selected if only one server."),
  name: z.string().optional().describe("Label for evidence directory"),
  lines: z.number().default(500).describe("Log lines per file (default: 500)"),
  no_docker: z.boolean().default(false).describe("Skip Docker data"),
  no_sysinfo: z.boolean().default(false).describe("Skip system info"),
};

// src/mcp/server.ts: add import + registerTool("server_evidence", ...)
```

### Anti-Patterns to Avoid
- **Multiple SSH connections:** Never open a second `sshExec()` call for a different data category. All data must come from one batched command (EVID-04).
- **Category subdirectories:** All evidence files go at the flat root of the evidence dir, not in `firewall/`, `logs/`, etc.
- **Throwing from core:** `collectEvidence()` must return `KastellResult`, never throw. Caller (CLI) converts to exit code.
- **Exit process.exit(1) mid-stream:** Use `process.exitCode = 2` for partial success — allows async cleanup to finish before process exits.
- **Manifest before files:** Write MANIFEST.json and SHA256SUMS only after all file writes are done. Partial manifest = chain of custody broken.
- **Tests in src/__tests__/:** Jest roots is `tests/` only. All test files go in `tests/unit/`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SHA256 checksums | custom hash loops | `crypto.createHash('sha256')` | Built-in, auditable, zero deps |
| File concurrency | custom lock file | `withFileLock()` from fileLock.ts | Already handles stale locks, EEXIST |
| SSH batch parsing | per-section SSH calls | `---SEPARATOR---` pattern from audit/commands.ts | Guarantees single connection (EVID-04) |
| Atomic file write | direct writeFileSync to final path | tmp file + renameSync (snapshot.ts pattern) | Prevents partial file on crash/OOM |
| Server resolution | inline getServers() lookup | `resolveServer()` (CLI) / `resolveServerForMcp()` (MCP) | Handles edge cases, auto-select when 1 server |
| MCP response shape | custom JSON | `mcpSuccess()` / `mcpError()` from mcp/utils.ts | Consistent MCP response format across all tools |

**Key insight:** Every infrastructure primitive needed already exists. The phase is purely about composition, not invention.

---

## Common Pitfalls

### Pitfall 1: SSH Separator Collision
**What goes wrong:** Evidence data containing the literal string `---SEPARATOR---` corrupts section parsing.
**Why it happens:** Server logs or firewall rules occasionally contain this exact string.
**How to avoid:** Use a less guessable separator, e.g. `---KASTELL-EVIDENCE-SEPARATOR-${Date.now()}---`, or use a separator that is guaranteed to appear on its own line (echo with newlines before/after).
**Warning signs:** Section data appears truncated or merged in tests with crafted input.

### Pitfall 2: Disk Cleanup on Partial Write
**What goes wrong:** Disk exhaustion mid-write leaves a partial evidence directory that looks complete.
**Why it happens:** `writeFileSync` throws on ENOSPC after some files are written.
**How to avoid:** Wrap the entire write loop in try/catch; if catch fires, `rmSync(evidenceDir, { recursive: true, force: true })` before returning error.
**Warning signs:** Manifest missing or SHA256SUMS incomplete; directory present but entry count mismatch.

### Pitfall 3: Exit Code 2 vs process.exit(2)
**What goes wrong:** Using `process.exit(2)` mid-async operation prevents cleanup (manifest write, spinner stop).
**Why it happens:** Phase 25 lesson: `process.exit()` is synchronous and brutal.
**How to avoid:** Use `process.exitCode = 2` at partial-success detection point; let `async function` return normally. Commander.js will propagate exitCode.
**Warning signs:** Spinner never stops / manifest never written on partial collection.

### Pitfall 4: --no-docker Flag Naming in Commander.js
**What goes wrong:** Commander.js automatically negates `--no-X` flags — `options.docker` will be `false` when `--no-docker` is passed, not `options.noDocker`.
**Why it happens:** Commander.js boolean flag inversion convention.
**How to avoid:** Check `options.docker === false` (not `options.noDocker`) in the command handler. Same for `--no-sysinfo` → `options.sysinfo === false`.
**Warning signs:** `--no-docker` flag silently ignored, Docker data still collected.

### Pitfall 5: auth.log vs /var/log/secure
**What goes wrong:** Debian/Ubuntu uses `/var/log/auth.log`; RHEL/CentOS uses `/var/log/secure`. Hardcoding one misses the other.
**Why it happens:** Log path differs by distro.
**How to avoid:** Use `cat /var/log/auth.log 2>/dev/null || cat /var/log/secure 2>/dev/null || echo 'N/A'`
**Warning signs:** auth.log file skipped on CentOS-based servers.

### Pitfall 6: syslog vs journald
**What goes wrong:** Modern systemd servers use journald; older or minimal installs use syslog file.
**Why it happens:** `/var/log/syslog` may not exist on journald-only systems.
**How to avoid:** `journalctl -n {lines} 2>/dev/null || tail -n {lines} /var/log/syslog 2>/dev/null || tail -n {lines} /var/log/messages 2>/dev/null || echo 'N/A'`
**Warning signs:** syslog file empty on Ubuntu 24.04+ servers.

---

## Code Examples

Verified patterns from project source:

### sshExec with 120s timeout
```typescript
// Source: src/utils/ssh.ts — sshExec signature
const result = await sshExec(ip, batchCommand, { timeoutMs: 120_000 });
if (result.code !== 0) {
  return { success: false, error: `SSH failed: ${result.stderr}` };
}
```

### Atomic file write (snapshot.ts pattern)
```typescript
// Source: src/core/audit/snapshot.ts
const tmpFile = filePath + ".tmp";
writeFileSync(tmpFile, content, "utf-8");
renameSync(tmpFile, filePath);
```

### withFileLock for manifest write
```typescript
// Source: src/utils/fileLock.ts
await withFileLock(manifestPath, () => {
  writeFileSync(manifestPath + ".tmp", JSON.stringify(manifest, null, 2), "utf-8");
  renameSync(manifestPath + ".tmp", manifestPath);
  writeFileSync(sha256sumsPath, buildSha256Sums(manifest.files), "utf-8");
});
```

### MCP tool registration (server.ts pattern)
```typescript
// Source: src/mcp/server.ts
server.registerTool("server_evidence", {
  description: "Collect forensic evidence package from a server. Gathers firewall rules, auth.log, listening ports, system logs, and optionally Docker info. Writes to ~/.kastell/evidence/{server}/{date_name}/. Returns manifest with SHA256 checksums per file.",
  inputSchema: serverEvidenceSchema,
  annotations: {
    title: "Evidence Collection",
    readOnlyHint: false,       // writes to local disk
    destructiveHint: false,    // non-destructive to server
    idempotentHint: false,     // --force needed for repeat
    openWorldHint: true,
  },
}, async (params) => {
  return handleServerEvidence(params);
});
```

### Spinner + summary table (audit.ts pattern)
```typescript
// Source: src/commands/audit.ts
const spinner = createSpinner("Collecting firewall rules...");
spinner.start();
// ... collection ...
spinner.succeed("Evidence collected");

// Summary table (chalk-based, no external table lib)
console.log(chalk.bold("\nEvidence Summary"));
console.log(`  Directory: ${chalk.cyan(evidenceResult.evidenceDir)}`);
console.log(`  Files:     ${chalk.green(evidenceResult.totalFiles)} collected, ${chalk.yellow(evidenceResult.skippedFiles)} skipped`);
console.log(chalk.yellow("\n  WARNING: Evidence directory may contain sensitive server data."));
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multiple SSH calls per data category | Single batch with separators | Phase 24 audit (2026) | Mandatory for EVID-04 |
| Direct writeFileSync | tmp + rename atomic write | Phase 23 infra (2026) | Prevents corrupt files on crash |
| Optional ServerRecord.mode | Required mode + auto-migration | Phase 23 (2026) | Platform detection is reliable |
| src/__tests__/ directories | tests/unit/ (Jest roots: ['tests']) | Phase 24 (2026) | Test files must go to tests/unit/ |

**Deprecated/outdated:**
- `__tests__/` alongside src: Jest config roots is `['<rootDir>/tests']` — test files in `src/__tests__/` are NOT picked up.
- Process.exit for non-critical exits: use `process.exitCode` assignment instead (Phase 25 pattern).

---

## Open Questions

1. **Spinner granularity during single-batch collection**
   - What we know: audit uses one spinner for the whole audit run; evidence batch is one SSH call
   - What's unclear: should spinner text update per logical section even though all data arrives at once, or just one spinner for the whole SSH call?
   - Recommendation: single spinner "Collecting evidence from {server}..." → succeed. Per-section "Collecting..." messages require per-call SSH which violates EVID-04.

2. **MANIFEST.json schema version**
   - What we know: snapshot.ts uses `schemaVersion: 1` with Zod `z.literal(1)`
   - What's unclear: should evidence manifest also carry schemaVersion for forward compatibility?
   - Recommendation: yes — add `schemaVersion: 1` to MANIFEST.json for consistency. Low cost, future-proofs.

3. **--output flag and relative paths**
   - What we know: override is user-supplied; path.resolve() needed to handle relative paths
   - What's unclear: should relative paths be resolved from CWD or $HOME?
   - Recommendation: resolve from CWD (`path.resolve(process.cwd(), opts.output)`), matching Unix tool conventions.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (ts-jest) — jest.config.cjs |
| Config file | `jest.config.cjs` (roots: `['<rootDir>/tests']`) |
| Quick run command | `npm test -- --testPathPattern="evidence"` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EVID-01 | `collectEvidence()` returns EvidenceResult with dir path | unit | `npm test -- --testPathPattern="evidence-core"` | Wave 0 |
| EVID-02 | All 4 core data sections appear in evidence dir | unit | `npm test -- --testPathPattern="evidence-core"` | Wave 0 |
| EVID-03 | MANIFEST.json contains sha256 per file + SHA256SUMS text | unit | `npm test -- --testPathPattern="evidence-core"` | Wave 0 |
| EVID-04 | Only one `sshExec` call made per evidence collection | unit | `npm test -- --testPathPattern="evidence-core"` | Wave 0 |
| EVID-01 | CLI command parses all flags and delegates to core | unit | `npm test -- --testPathPattern="evidence-command"` | Wave 0 |
| EVID-01 | MCP tool resolves server + returns manifest JSON | unit | `npm test -- --testPathPattern="mcp-server-evidence"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="evidence"`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/evidence-core.test.ts` — covers EVID-01, EVID-02, EVID-03, EVID-04 (mock sshExec + fs)
- [ ] `tests/unit/evidence-command.test.ts` — CLI flag parsing + core delegation
- [ ] `tests/unit/mcp-server-evidence.test.ts` — MCP tool handler (mock collectEvidence)

*(No framework install needed — Jest already configured)*

---

## Sources

### Primary (HIGH confidence)
- `src/core/audit/commands.ts` — SSH batch pattern with `---SEPARATOR---`, `buildAuditBatchCommands(platform)`
- `src/core/audit/snapshot.ts` — Atomic write pattern (tmp+rename), `withFileLock`, directory creation with `mode: 0o700`
- `src/utils/ssh.ts` — `sshExec(ip, cmd, { timeoutMs })` signature, 120s default for stream ops
- `src/utils/fileLock.ts` — `withFileLock(filePath, fn)` implementation
- `src/utils/config.ts` — `CONFIG_DIR` export (`~/.kastell/`)
- `src/types/index.ts` — `KastellResult<T>`, `ServerRecord`, `Platform` types
- `src/mcp/server.ts` — MCP tool registration pattern (`registerTool`, annotations)
- `src/mcp/utils.ts` — `mcpSuccess()`, `mcpError()`, `resolveServerForMcp()` helpers
- `src/commands/audit.ts` — CLI command structure (spinner, options interface, Commander.js delegation)
- `jest.config.cjs` — `roots: ['<rootDir>/tests']` — confirms test placement rule

### Secondary (MEDIUM confidence)
- Node.js built-in `crypto.createHash('sha256')` — standard SHA256 in Node.js, well-documented
- Commander.js `--no-X` flag negation behavior — documented in Commander.js README, confirmed by project usage

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are existing project dependencies, no new packages
- Architecture: HIGH — patterns copied directly from audit module which is complete and tested
- Pitfalls: HIGH — several derived from Phase 24/25 post-task lessons (test placement, exitCode, Commander.js --no-X)
- SSH commands for data sources: MEDIUM — commands derived from audit/commands.ts existing patterns; exact file paths verified from audit sections but new evidence-specific commands (auth.log, syslog) follow the same `|| echo 'N/A'` fallback convention

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable — no fast-moving dependencies)
