import { spawn, execSync } from "child_process";

export function checkSshAvailable(): boolean {
  try {
    execSync("ssh -V", { stdio: "pipe" });
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

export function sshConnect(ip: string): Promise<number> {
  assertValidIp(ip);
  return new Promise((resolve) => {
    const child = spawn("ssh", ["-o", "StrictHostKeyChecking=accept-new", `root@${ip}`], {
      stdio: "inherit",
      env: sanitizedEnv(),
    });
    child.on("close", (code) => resolve(code ?? 0));
    child.on("error", () => resolve(1));
  });
}

export function sshStream(ip: string, command: string): Promise<number> {
  assertValidIp(ip);
  return new Promise((resolve) => {
    const child = spawn("ssh", ["-o", "StrictHostKeyChecking=accept-new", `root@${ip}`, command], {
      stdio: "inherit",
      env: sanitizedEnv(),
    });
    child.on("close", (code) => resolve(code ?? 0));
    child.on("error", () => resolve(1));
  });
}

export function sshExec(
  ip: string,
  command: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  assertValidIp(ip);
  return new Promise((resolve) => {
    const child = spawn("ssh", ["-o", "StrictHostKeyChecking=accept-new", `root@${ip}`, command], {
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
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.on("error", (err) => resolve({ code: 1, stdout: "", stderr: err.message }));
  });
}
