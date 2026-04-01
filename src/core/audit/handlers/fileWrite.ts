/**
 * File-write fix handler.
 * Writes a line to a file via programmatic SSH — handles `echo 'content' > /path`.
 * Uses idempotency (skip if file already has exact content) and rollback.
 */

import { sshExec } from "../../../utils/ssh.js";
import { cmd, raw, shellEscape } from "../../../utils/sshCommand.js";
import type { FixHandler, HandlerParams, HandlerResult, RollbackStep, DiffLine } from "./index.js";

// Matches: echo 'line' > /path  or  echo "line" > /path  (single > not >>)
const ECHO_WRITE_SINGLE = /^echo\s+'([^']+)'\s*>\s*(\/\S+)$/;
const ECHO_WRITE_DOUBLE = /^echo\s+"([^"]+)"\s*>\s*(\/\S+)$/;

export const fileWriteHandler: FixHandler = {
  match(fixCommand: string): HandlerParams | null {
    const mSingle = fixCommand.match(ECHO_WRITE_SINGLE);
    if (mSingle) {
      return { type: "file-write" as const, line: mSingle[1], path: mSingle[2] };
    }
    const mDouble = fixCommand.match(ECHO_WRITE_DOUBLE);
    if (mDouble) {
      return { type: "file-write" as const, line: mDouble[1], path: mDouble[2] };
    }
    return null;
  },

  async execute(
    ip: string,
    params: HandlerParams,
  ): Promise<HandlerResult & { rollbackStep?: RollbackStep }> {
    const line = params.line as string;
    const path = params.path as string;

    const catResult = await sshExec(ip, cmd("cat", path));
    const previousContent = catResult.code === 0 ? catResult.stdout : "";

    if (previousContent.trim() === line.trim()) {
      return { success: true, skipped: true };
    }

    // useStdin avoids local metachar expansion
    const writeCmd = raw(`echo ${shellEscape(line)} > ${shellEscape(path)}`);
    const writeResult = await sshExec(ip, writeCmd, { useStdin: true });
    if (writeResult.code !== 0) {
      return { success: false, error: writeResult.stderr };
    }

    const rollbackStep: RollbackStep = {
      rollback: async (rollbackIp: string) => {
        if (previousContent) {
          await sshExec(rollbackIp, raw(`printf '%s' ${shellEscape(previousContent)} > ${shellEscape(path)}`), { useStdin: true });
        } else {
          await sshExec(rollbackIp, cmd("rm", "-f", path));
        }
      },
    };

    const diff: DiffLine = {
      handlerType: "file-write" as const,
      key: path,
      before: previousContent ? previousContent.slice(0, 80) : "(empty/missing)",
      after: line,
    };
    return { success: true, rollbackStep, diff };
  },
};
