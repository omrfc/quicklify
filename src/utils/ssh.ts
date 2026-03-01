import { spawn, execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

let cachedSshPath: string | null = null;

export function resolveSshPath(): string {
  if (cachedSshPath) return cachedSshPath;

  // Try default PATH first
  try {
    execSync("ssh -V", { stdio: "pipe" });
    cachedSshPath = "ssh";
    return cachedSshPath;
  } catch {
    // Not in PATH, try common locations
  }

  // Windows common SSH locations
  if (process.platform === "win32") {
    const candidates = [
      join(process.env.SystemRoot || "C:\\Windows", "System32", "OpenSSH", "ssh.exe"),
      join(process.env.ProgramFiles || "C:\\Program Files", "OpenSSH", "ssh.exe"),
      join(process.env.LOCALAPPDATA || "", "Programs", "Git", "usr", "bin", "ssh.exe"),
      join(process.env.ProgramFiles || "C:\\Program Files", "Git", "usr", "bin", "ssh.exe"),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        cachedSshPath = candidate;
        return cachedSshPath;
      }
    }
  }

  // Fallback — return "ssh" and let it fail with a clearer error
  cachedSshPath = "ssh";
  return cachedSshPath;
}

export function checkSshAvailable(): boolean {
  try {
    const sshBin = resolveSshPath();
    execSync(`"${sshBin}" -V`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function assertValidIp(ip: string): void {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    throw new Error(`Invalid IP address format`);
  }
  const octets = ip.split(".").map(Number);
  if (octets.some((o) => o < 0 || o > 255)) {
    throw new Error(`Invalid IP address: octets must be 0-255`);
  }
}

export function sanitizedEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    const upper = key.toUpperCase();
    if (
      upper.includes("TOKEN") ||
      upper.includes("SECRET") ||
      upper.includes("PASSWORD") ||
      upper.includes("CREDENTIAL")
    ) {
      delete env[key];
    }
  }
  return env;
}

/**
 * Removes stale host key entry for the given IP from known_hosts.
 * Silently ignores errors (ssh-keygen not available or no entry).
 * IP is validated before use to prevent command injection.
 */
export function removeStaleHostKey(ip: string): void {
  assertValidIp(ip);
  try {
    execSync(`ssh-keygen -R ${ip}`, { stdio: "ignore" });
  } catch {
    // Silently ignore — ssh-keygen may not be available or no entry exists
  }
}

export const HOST_KEY_PATTERN = /Host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED/i;

export function isHostKeyMismatch(stderr: string): boolean {
  return HOST_KEY_PATTERN.test(stderr);
}

export function sshConnect(ip: string): Promise<number> {
  assertValidIp(ip);
  const sshBin = resolveSshPath();
  return new Promise((resolve) => {
    const child = spawn(sshBin, ["-o", "StrictHostKeyChecking=accept-new", `root@${ip}`], {
      stdio: "inherit",
      env: sanitizedEnv(),
    });
    child.on("close", (code) => resolve(code ?? 0));
    child.on("error", () => resolve(1));
  });
}

function sshStreamInner(ip: string, command: string, retried: boolean): Promise<number> {
  const sshBin = resolveSshPath();
  return new Promise((resolve) => {
    const child = spawn(sshBin, ["-o", "StrictHostKeyChecking=accept-new", `root@${ip}`, command], {
      stdio: ["inherit", "inherit", "pipe"],
      env: sanitizedEnv(),
    });
    let stderr = "";
    child.stderr?.on("data", (data: Buffer) => {
      // Cap stderr buffer — only need enough for host key pattern detection
      if (stderr.length < 4096) {
        stderr += data.toString();
      }
    });
    child.on("close", (code) => {
      const exitCode = code ?? 0;
      if (exitCode !== 0 && !retried && isHostKeyMismatch(stderr)) {
        removeStaleHostKey(ip);
        resolve(sshStreamInner(ip, command, true));
      } else {
        resolve(exitCode);
      }
    });
    child.on("error", () => resolve(1));
  });
}

export function sshStream(ip: string, command: string): Promise<number> {
  assertValidIp(ip);
  return sshStreamInner(ip, command, false);
}

function sshExecInner(
  ip: string,
  command: string,
  retried: boolean,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const sshBin = resolveSshPath();
  return new Promise((resolve) => {
    const child = spawn(sshBin, ["-o", "StrictHostKeyChecking=accept-new", `root@${ip}`, command], {
      stdio: ["inherit", "pipe", "pipe"],
      env: sanitizedEnv(),
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });
    child.on("close", (code) => {
      const exitCode = code ?? 1;
      if (exitCode !== 0 && !retried && isHostKeyMismatch(stderr)) {
        removeStaleHostKey(ip);
        resolve(sshExecInner(ip, command, true));
      } else {
        resolve({ code: exitCode, stdout, stderr });
      }
    });
    child.on("error", (err) => resolve({ code: 1, stdout: "", stderr: err.message }));
  });
}

export function sshExec(
  ip: string,
  command: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  assertValidIp(ip);
  return sshExecInner(ip, command, false);
}
