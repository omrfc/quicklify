/**
 * Systemctl fix handler.
 * Runs systemctl commands (enable, start, restart, reload, stop) via programmatic SSH.
 * Supports `--now` flag and combined `enable --now` syntax.
 */

import { sshExec } from "../../../utils/ssh.js";
import { cmd } from "../../../utils/sshCommand.js";
import type { FixHandler, HandlerParams, HandlerResult, RollbackStep } from "./index.js";

// systemctl <action> [--now] <service>
const SYSTEMCTL_REGEX = /^systemctl\s+(enable|start|restart|reload|stop)\s+(--now\s+)?(\S+)$/;

export const systemctlHandler: FixHandler = {
  match(fixCommand: string): HandlerParams | null {
    const m = fixCommand.match(SYSTEMCTL_REGEX);
    if (!m) return null;
    return {
      type: "systemctl" as const,
      action: m[1],
      now: !!m[2],
      service: m[3],
    };
  },

  async execute(
    ip: string,
    params: HandlerParams,
  ): Promise<HandlerResult & { rollbackStep?: RollbackStep }> {
    const action = params.action as string;
    const now = params.now as boolean;
    const service = params.service as string;

    const args = ["systemctl", action];
    if (now) args.push("--now");
    args.push(service);

    const result = await sshExec(ip, cmd(...args));
    if (result.code !== 0) {
      return { success: false, error: result.stderr || `systemctl ${action} ${service} failed` };
    }

    return { success: true };
  },
};
