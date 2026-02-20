import inquirer from "inquirer";
import { resolveServer, promptApiToken } from "../utils/serverSelect.js";
import { checkSshAvailable, sshExec } from "../utils/ssh.js";
import { createProviderWithToken } from "../utils/providerFactory.js";
import { logger, createSpinner } from "../utils/logger.js";

const COOLIFY_UPDATE_CMD = "curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash";

export async function updateCommand(query?: string): Promise<void> {
  if (!checkSshAvailable()) {
    logger.error("SSH client not found. Required for Coolify update.");
    logger.info("Windows: Settings > Apps > Optional Features > OpenSSH Client");
    logger.info("Linux/macOS: SSH is usually pre-installed.");
    return;
  }

  const server = await resolveServer(query, "Select a server to update:");
  if (!server) return;

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Update Coolify on "${server.name}" (${server.ip})? This may cause brief downtime.`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info("Update cancelled.");
    return;
  }

  const apiToken = await promptApiToken(server.provider);
  const spinner = createSpinner("Validating access...");
  spinner.start();

  try {
    const provider = createProviderWithToken(server.provider, apiToken);
    const status = await provider.getServerStatus(server.id);
    if (status !== "running") {
      spinner.fail(`Server is not running (status: ${status})`);
      return;
    }
    spinner.succeed("Server verified");
  } catch (error: unknown) {
    spinner.fail("Failed to verify server");
    logger.error(error instanceof Error ? error.message : String(error));
    return;
  }

  logger.info("Running Coolify update script...");
  logger.info("This may take several minutes. Please wait.");
  console.log();

  const result = await sshExec(server.ip, COOLIFY_UPDATE_CMD);

  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);

  if (result.code === 0) {
    logger.success("Coolify update completed successfully!");
    logger.info(`Access Coolify: http://${server.ip}:8000`);
  } else {
    logger.error(`Update failed with exit code ${result.code}`);
    logger.info("Check the output above for details.");
  }
}
