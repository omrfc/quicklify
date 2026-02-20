import inquirer from "inquirer";
import { resolveServer, promptApiToken } from "../utils/serverSelect.js";
import { createProviderWithToken } from "../utils/providerFactory.js";
import { logger, createSpinner } from "../utils/logger.js";

export async function restartCommand(query?: string): Promise<void> {
  const server = await resolveServer(query, "Select a server to restart:");
  if (!server) return;

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Restart server "${server.name}" (${server.ip})? This will cause brief downtime.`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info("Restart cancelled.");
    return;
  }

  const apiToken = await promptApiToken(server.provider);

  const spinner = createSpinner("Rebooting server...");
  spinner.start();

  try {
    const provider = createProviderWithToken(server.provider, apiToken);
    await provider.rebootServer(server.id);
    spinner.succeed("Reboot initiated");

    const pollSpinner = createSpinner("Waiting for server to come back online...");
    pollSpinner.start();

    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        const status = await provider.getServerStatus(server.id);
        if (status === "running") {
          pollSpinner.succeed("Server is running");
          console.log();
          logger.success(`Server "${server.name}" restarted successfully`);
          logger.info(`Access Coolify: http://${server.ip}:8000`);
          return;
        }
      } catch {
        // Server might be temporarily unreachable during reboot
      }
      attempts++;
      pollSpinner.text = `Waiting for server... (${attempts}/${maxAttempts})`;
    }

    pollSpinner.warn("Server did not come back in time");
    logger.warning("The server may still be rebooting. Check status later with: quicklify status");
  } catch (error: unknown) {
    spinner.fail("Failed to reboot server");
    logger.error(error instanceof Error ? error.message : String(error));
  }
}
