/**
 * Sysctl fix handler.
 * Applies sysctl -w key=value via programmatic SSH — no shell metacharacters.
 * Implements idempotency (skip if already set) and atomic rollback.
 * Network-related sysctl changes include post-apply SSH connectivity check
 * to prevent SSH lockout (D-20).
 */

import { sshExec } from "../../../utils/ssh.js";
import { cmd } from "../../../utils/sshCommand.js";
import type { FixHandler, HandlerParams, HandlerResult, RollbackStep, DiffLine } from "./index.js";

const SYSCTL_REGEX = /^sysctl\s+-w\s+([\w.]+)=([\w.]+)$/;

function isNetworkSysctl(key: string): boolean {
  return key.startsWith("net.");
}

/** Quick SSH connectivity probe — returns true if SSH is still responsive */
async function sshProbe(ip: string): Promise<boolean> {
  try {
    const result = await sshExec(ip, cmd("echo", "ok"), { timeoutMs: 5_000 });
    return result.stdout.trim() === "ok";
  } catch {
    return false;
  }
}

export const sysctlHandler: FixHandler = {
  match(fixCommand: string): HandlerParams | null {
    const m = fixCommand.match(SYSCTL_REGEX);
    if (!m) return null;
    return { type: "sysctl", key: m[1], value: m[2] };
  },

  async execute(
    ip: string,
    params: HandlerParams,
  ): Promise<HandlerResult & { rollbackStep?: RollbackStep }> {
    const key = params.key as string;
    const value = params.value as string;

    const readResult = await sshExec(ip, cmd("sysctl", "-n", key));
    const currentValue = readResult.stdout.trim();

    // D-12: idempotency
    if (currentValue === value) {
      return { success: true, skipped: true };
    }

    const applyResult = await sshExec(ip, cmd("sysctl", "-w", `${key}=${value}`));
    if (applyResult.code !== 0) {
      return { success: false, error: applyResult.stderr };
    }

    // D-08: atomic rollback support
    const rollbackCmd = cmd("sysctl", "-w", `${key}=${currentValue}`);
    const rollbackStep: RollbackStep = {
      rollback: async (rollbackIp: string) => {
        await sshExec(rollbackIp, rollbackCmd);
      },
    };

    // D-20: SSH connectivity check for network-related sysctl changes
    if (isNetworkSysctl(key)) {
      const alive = await sshProbe(ip);
      if (!alive) {
        try {
          await sshExec(ip, rollbackCmd, { timeoutMs: 5_000 });
        } catch {
          // Best-effort — SSH may be fully broken
        }
        return {
          success: false,
          error: `SSH connectivity lost after applying ${key}=${value} — rolled back to ${currentValue}`,
        };
      }
    }

    const diff: DiffLine = { handlerType: "sysctl", key, before: currentValue, after: value };
    return { success: true, rollbackStep, diff };
  },
};
