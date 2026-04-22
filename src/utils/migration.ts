import { existsSync, cpSync } from "fs";
import { secureMkdirSync, secureWriteFileSync } from "./secureWrite.js";
import { homedir } from "os";
import { join } from "path";
import chalk from "chalk";
import { KASTELL_DIR } from "./paths.js";

const OLD_CONFIG_DIR = join(homedir(), ".quicklify");
const NEW_CONFIG_DIR = KASTELL_DIR;
const MIGRATED_FLAG = join(NEW_CONFIG_DIR, ".migrated");

/**
 * Migrate config from ~/.quicklify to ~/.kastell on first run.
 * - If ~/.kastell already exists, does nothing (no overwrite risk).
 * - If ~/.quicklify does not exist, does nothing (fresh install).
 * - Otherwise copies contents and creates .migrated flag.
 */
export function migrateConfigIfNeeded(): void {
  // If new config dir already exists, skip (no overwrite risk)
  if (existsSync(NEW_CONFIG_DIR)) {
    return;
  }

  // If old config dir doesn't exist, skip (fresh install)
  if (!existsSync(OLD_CONFIG_DIR)) {
    return;
  }

  try {
    secureMkdirSync(NEW_CONFIG_DIR, { recursive: true });
    cpSync(OLD_CONFIG_DIR, NEW_CONFIG_DIR, { recursive: true });
    secureWriteFileSync(MIGRATED_FLAG, new Date().toISOString());
    console.warn(
      chalk.yellow(
        "Migrated config from ~/.quicklify to ~/.kastell. You can safely remove ~/.quicklify.",
      ),
    );
  } catch {
    // If copy fails, log warning and continue -- don't crash the CLI
    console.warn(
      chalk.yellow(
        "Warning: Could not migrate config from ~/.quicklify to ~/.kastell. You may need to copy files manually.",
      ),
    );
  }
}
