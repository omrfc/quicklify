import { spawn } from "child_process";
import { assertValidIp, sanitizedEnv, resolveScpPath } from "./ssh.js";
import { SCP_TIMEOUT_MS } from "../constants.js";

// ─── Path Validation ─────────────────────────────────────────────────────────

/**
 * Asserts that a remote SCP path does not contain shell metacharacters.
 * Prevents command injection via crafted remotePath values.
 * Allowed: alphanumeric, hyphens, underscores, dots, forward slashes.
 */
export function assertSafePath(remotePath: string): void {
  // Reject any path containing shell metacharacters: ; | & $ ` ( ) < > \n \r \t space
  if (/[;|&$`()<>\n\r\t ]/.test(remotePath)) {
    throw new Error(`Unsafe remote path rejected: contains shell metacharacters`);
  }
}

// ─── SCP Functions ───────────────────────────────────────────────────────────

export function scpDownload(
  ip: string,
  remotePath: string,
  localPath: string,
  timeoutMs: number = SCP_TIMEOUT_MS,
): Promise<{ code: number; stderr: string }> {
  assertValidIp(ip);
  assertSafePath(remotePath);
  return new Promise((resolve, reject) => {
    let settled = false;
    // stdin must be "ignore" — not "inherit". MCP uses stdin for JSON-RPC transport;
    // inheriting it would corrupt the stream. BatchMode=yes prevents interactive prompts.
    const scpBin = resolveScpPath();
    const child = spawn(
      scpBin,
      ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", `root@${ip}:${remotePath}`, localPath],
      { stdio: ["ignore", "pipe", "pipe"], env: sanitizedEnv() },
    );
    let stderr = "";
    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });
    child.on("close", (code) => {
      if (!settled) { settled = true; clearTimeout(timer); resolve({ code: code ?? 1, stderr }); }
    });
    child.on("error", (err) => {
      if (!settled) { settled = true; clearTimeout(timer); resolve({ code: 1, stderr: err.message }); }
    });

    const timer = setTimeout(() => {
      if (!settled) { settled = true; child.kill("SIGTERM"); reject(new Error(`SCP download timeout after ${timeoutMs}ms`)); }
    }, timeoutMs);
  });
}

export function scpUpload(
  ip: string,
  localPath: string,
  remotePath: string,
  timeoutMs: number = SCP_TIMEOUT_MS,
): Promise<{ code: number; stderr: string }> {
  assertValidIp(ip);
  assertSafePath(remotePath);
  return new Promise((resolve, reject) => {
    let settled = false;
    // stdin must be "ignore" — not "inherit". MCP uses stdin for JSON-RPC transport;
    // inheriting it would corrupt the stream. BatchMode=yes prevents interactive prompts.
    const scpBin = resolveScpPath();
    const child = spawn(
      scpBin,
      ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", localPath, `root@${ip}:${remotePath}`],
      { stdio: ["ignore", "pipe", "pipe"], env: sanitizedEnv() },
    );
    let stderr = "";
    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });
    child.on("close", (code) => {
      if (!settled) { settled = true; clearTimeout(timer); resolve({ code: code ?? 1, stderr }); }
    });
    child.on("error", (err) => {
      if (!settled) { settled = true; clearTimeout(timer); resolve({ code: 1, stderr: err.message }); }
    });

    const timer = setTimeout(() => {
      if (!settled) { settled = true; child.kill("SIGTERM"); reject(new Error(`SCP upload timeout after ${timeoutMs}ms`)); }
    }, timeoutMs);
  });
}
