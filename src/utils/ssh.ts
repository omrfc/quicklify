import { spawn, execSync } from "child_process";

export function checkSshAvailable(): boolean {
  try {
    execSync("ssh -V", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function sshConnect(ip: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("ssh", [`root@${ip}`], {
      stdio: "inherit",
    });
    child.on("close", (code) => resolve(code ?? 0));
    child.on("error", () => resolve(1));
  });
}

export function sshStream(ip: string, command: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("ssh", ["-o", "StrictHostKeyChecking=accept-new", `root@${ip}`, command], {
      stdio: "inherit",
    });
    child.on("close", (code) => resolve(code ?? 0));
    child.on("error", () => resolve(1));
  });
}

export function sshExec(
  ip: string,
  command: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("ssh", ["-o", "StrictHostKeyChecking=accept-new", `root@${ip}`, command], {
      stdio: ["inherit", "pipe", "pipe"],
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
