import { execSync } from "child_process";
import { existsSync, accessSync, constants } from "fs";
import { getServers } from "../utils/config.js";
import { checkSshAvailable } from "../utils/ssh.js";
import { logger } from "../utils/logger.js";
import { CONFIG_DIR } from "../utils/config.js";

export interface CheckResult {
  name: string;
  status: "pass" | "fail" | "warn";
  detail: string;
}

function checkNodeVersion(): CheckResult {
  const version = process.version;
  const major = parseInt(version.slice(1).split(".")[0], 10);
  if (major >= 20) {
    return { name: "Node.js", status: "pass", detail: version };
  }
  return { name: "Node.js", status: "fail", detail: `${version} (requires >= 20)` };
}

function checkNpmVersion(): CheckResult {
  try {
    const version = execSync("npm --version", { stdio: "pipe" }).toString().trim();
    return { name: "npm", status: "pass", detail: `v${version}` };
  } catch {
    return { name: "npm", status: "fail", detail: "not found" };
  }
}

function checkSsh(): CheckResult {
  if (checkSshAvailable()) {
    return { name: "SSH Client", status: "pass", detail: "available" };
  }
  return { name: "SSH Client", status: "warn", detail: "not found (needed for ssh/logs/monitor/update)" };
}

function checkQuicklifyVersion(version?: string): CheckResult {
  if (version) {
    return { name: "quicklify", status: "pass", detail: `v${version}` };
  }
  return { name: "quicklify", status: "warn", detail: "version unknown" };
}

function checkConfigDir(): CheckResult {
  if (!existsSync(CONFIG_DIR)) {
    return { name: "Config Dir", status: "warn", detail: `${CONFIG_DIR} (not created yet)` };
  }
  try {
    accessSync(CONFIG_DIR, constants.R_OK | constants.W_OK);
    return { name: "Config Dir", status: "pass", detail: CONFIG_DIR };
  } catch {
    return { name: "Config Dir", status: "fail", detail: `${CONFIG_DIR} (not writable)` };
  }
}

function checkRegisteredServers(): CheckResult {
  const servers = getServers();
  if (servers.length === 0) {
    return { name: "Servers", status: "warn", detail: "0 registered (run quicklify init)" };
  }
  return { name: "Servers", status: "pass", detail: `${servers.length} registered` };
}

export function runDoctorChecks(version?: string): CheckResult[] {
  return [
    checkNodeVersion(),
    checkNpmVersion(),
    checkSsh(),
    checkQuicklifyVersion(version),
    checkConfigDir(),
    checkRegisteredServers(),
  ];
}

export async function doctorCommand(
  options?: { checkTokens?: boolean },
  version?: string,
): Promise<void> {
  logger.title("Quicklify Doctor");

  const results = runDoctorChecks(version);

  for (const result of results) {
    const colorFn =
      result.status === "pass"
        ? logger.success
        : result.status === "warn"
          ? logger.warning
          : logger.error;
    colorFn(`${result.name}: ${result.detail}`);
  }

  const failures = results.filter((r) => r.status === "fail");
  const warnings = results.filter((r) => r.status === "warn");

  console.log();
  if (failures.length > 0) {
    logger.error(`${failures.length} check(s) failed. Please fix the issues above.`);
  } else if (warnings.length > 0) {
    logger.warning(`All checks passed with ${warnings.length} warning(s).`);
  } else {
    logger.success("All checks passed! Your environment is ready.");
  }

  if (options?.checkTokens) {
    logger.info("Token validation is not yet implemented.");
  }
}
