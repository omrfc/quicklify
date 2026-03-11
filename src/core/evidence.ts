/**
 * Evidence collection core module.
 * Collects forensic data from a server via a single batched SSH connection.
 * Writes per-file evidence to a flat directory with SHA256 checksums.
 */

import { createHash } from "crypto";
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  renameSync,
  rmSync,
} from "fs";
import { join, resolve } from "path";

import { sshExec } from "../utils/ssh.js";
import { withFileLock } from "../utils/fileLock.js";
import { CONFIG_DIR } from "../utils/config.js";
import {
  buildEvidenceBatchCommand,
  EVIDENCE_SECTION_INDICES,
} from "./evidenceCommands.js";
import type { KastellResult } from "../types/index.js";

// ─── Public types ──────────────────────────────────────────────────────────────

export interface EvidenceFileEntry {
  filename: string;
  sha256: string;
  sizeBytes: number;
  collectedAt: string;
  status: "collected" | "skipped";
  skipReason?: string;
}

export interface EvidenceManifest {
  schemaVersion: 1;
  server: string;
  ip: string;
  platform: string;
  collectedAt: string;
  evidenceDir: string;
  files: EvidenceFileEntry[];
}

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

export interface EvidenceOptions {
  name?: string;
  output?: string;
  lines: number;
  noDocker: boolean;
  noSysinfo: boolean;
  force: boolean;
  json: boolean;
  quiet: boolean;
}

// ─── Section → filename mapping ────────────────────────────────────────────────

const SECTION_FILENAMES: Record<number, string> = {
  [EVIDENCE_SECTION_INDICES.FIREWALL]: "firewall-rules.txt",
  [EVIDENCE_SECTION_INDICES.AUTH_LOG]: "auth-log.txt",
  [EVIDENCE_SECTION_INDICES.PORTS]: "listening-ports.txt",
  [EVIDENCE_SECTION_INDICES.SYSLOG]: "syslog.txt",
  [EVIDENCE_SECTION_INDICES.SYSINFO]: "system-info.txt",
  [EVIDENCE_SECTION_INDICES.DOCKER_PS]: "docker-containers.txt",
  [EVIDENCE_SECTION_INDICES.DOCKER_LOGS]: "docker-logs.txt",
};

// ─── Private helpers ───────────────────────────────────────────────────────────

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

function isEmptyOrNa(content: string): boolean {
  const trimmed = content.trim();
  return trimmed === "" || trimmed === "N/A";
}

function writeEvidenceFile(
  dir: string,
  filename: string,
  content: string,
  collectedAt: string,
  entries: EvidenceFileEntry[],
): void {
  if (isEmptyOrNa(content)) {
    entries.push({
      filename,
      sha256: "",
      sizeBytes: 0,
      collectedAt,
      status: "skipped",
      skipReason: "No data returned (N/A or empty)",
    });
    return;
  }

  const filePath = join(dir, filename);
  writeFileSync(filePath, content, { mode: 0o600 });
  const hash = sha256(content);
  entries.push({
    filename,
    sha256: hash,
    sizeBytes: Buffer.byteLength(content, "utf-8"),
    collectedAt,
    status: "collected",
  });
}

function buildSha256Sums(entries: EvidenceFileEntry[]): string {
  return entries
    .filter((e) => e.status === "collected")
    .map((e) => `${e.sha256}  ${e.filename}`)
    .join("\n");
}

function buildDirName(opts: EvidenceOptions): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return opts.name ? `${date}_${opts.name}` : date;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Collect forensic evidence from a server via a single batched SSH connection.
 * Writes per-file evidence to a flat directory with SHA256 checksums.
 */
export async function collectEvidence(
  serverName: string,
  ip: string,
  platform: string,
  opts: EvidenceOptions,
): Promise<KastellResult<EvidenceResult>> {
  const collectedAt = new Date().toISOString();
  const dirName = buildDirName(opts);

  // Resolve evidence directory
  let evidenceDir: string;
  if (opts.output) {
    evidenceDir = resolve(opts.output, dirName);
  } else {
    evidenceDir = join(CONFIG_DIR, "evidence", serverName, dirName);
  }

  // Check for existing directory
  if (existsSync(evidenceDir)) {
    if (!opts.force) {
      return {
        success: false,
        error: `Evidence '${dirName}' already exists. Use --force to overwrite.`,
      };
    }
    rmSync(evidenceDir, { recursive: true, force: true });
  }

  // Create evidence directory
  mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });

  // Build SSH batch command
  const batchCommand = buildEvidenceBatchCommand(platform, opts.lines, {
    noDocker: opts.noDocker,
    noSysinfo: opts.noSysinfo,
  });

  // Execute SSH (exactly one call)
  const sshResult = await sshExec(ip, batchCommand, { timeoutMs: 120_000 });
  if (sshResult.code !== 0) {
    rmSync(evidenceDir, { recursive: true, force: true });
    return {
      success: false,
      error: `SSH failed: ${sshResult.stderr || "non-zero exit code"}`,
    };
  }

  // Parse sections (trim each section to remove surrounding newlines from separator)
  const sections = sshResult.stdout.split("---SEPARATOR---").map((s) => s.trim());
  const entries: EvidenceFileEntry[] = [];

  try {
    for (let i = 0; i < sections.length; i++) {
      const filename = SECTION_FILENAMES[i];
      if (!filename) continue; // Unknown index — skip silently
      writeEvidenceFile(evidenceDir, filename, sections[i], collectedAt, entries);
    }

    // Build manifest
    const manifest: EvidenceManifest = {
      schemaVersion: 1,
      server: serverName,
      ip,
      platform,
      collectedAt,
      evidenceDir,
      files: entries,
    };

    const sha256SumsContent = buildSha256Sums(entries);
    const manifestPath = join(evidenceDir, "MANIFEST.json");
    const sha256SumsPath = join(evidenceDir, "SHA256SUMS");

    // Write manifest and SHA256SUMS atomically under file lock
    await withFileLock(manifestPath, () => {
      const manifestTmp = manifestPath + ".tmp";
      const sha256SumsTmp = sha256SumsPath + ".tmp";
      writeFileSync(manifestTmp, JSON.stringify(manifest, null, 2), { mode: 0o600 });
      renameSync(manifestTmp, manifestPath);
      writeFileSync(sha256SumsTmp, sha256SumsContent, { mode: 0o600 });
      renameSync(sha256SumsTmp, sha256SumsPath);
    });
  } catch (err: unknown) {
    rmSync(evidenceDir, { recursive: true, force: true });
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Failed to write evidence files: ${message}`,
    };
  }

  const collectedCount = entries.filter((e) => e.status === "collected").length;
  const skippedCount = entries.filter((e) => e.status === "skipped").length;

  return {
    success: true,
    data: {
      evidenceDir,
      serverName,
      serverIp: ip,
      platform,
      collectedAt,
      totalFiles: collectedCount,
      skippedFiles: skippedCount,
      manifestPath: join(evidenceDir, "MANIFEST.json"),
    },
  };
}
