import inquirer from "inquirer";
import { removeServer } from "../utils/config.js";
import { resolveServer, promptApiToken } from "../utils/serverSelect.js";
import { createProviderWithToken } from "../utils/providerFactory.js";
import { logger, createSpinner } from "../utils/logger.js";
import { mapProviderError } from "../utils/errorMapper.js";

export async function destroyCommand(query?: string): Promise<void> {
  const server = await resolveServer(query, "Select a server to destroy:");
  if (!server) return;

  // First confirmation
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Are you sure you want to destroy "${server.name}" (${server.ip})?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info("Destroy cancelled.");
    return;
  }

  // Second confirmation: type server name
  const { confirmName } = await inquirer.prompt([
    {
      type: "input",
      name: "confirmName",
      message: `Type the server name "${server.name}" to confirm:`,
    },
  ]);

  if (confirmName.trim() !== server.name) {
    logger.error("Server name does not match. Destroy cancelled.");
    return;
  }

  // Ask for API token
  const apiToken = await promptApiToken(server.provider);

  const spinner = createSpinner("Destroying server...");
  spinner.start();

  try {
    const provider = createProviderWithToken(server.provider, apiToken);
    await provider.destroyServer(server.id);
    removeServer(server.id);
    spinner.succeed(`Server "${server.name}" destroyed`);
    logger.success("Server has been removed from your cloud provider and local config.");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const isNotFound =
      message.toLowerCase().includes("not found") || message.toLowerCase().includes("not_found");

    if (isNotFound) {
      removeServer(server.id);
      spinner.warn(`Server not found on ${server.provider} (may have been deleted manually)`);
      logger.info("Removed from local config.");
    } else {
      spinner.fail("Failed to destroy server");
      logger.error(message);
      const hint = mapProviderError(error, server.provider);
      if (hint) {
        logger.info(hint);
      }

      const { removeLocal } = await inquirer.prompt([
        {
          type: "confirm",
          name: "removeLocal",
          message: "Remove this server from local config anyway?",
          default: false,
        },
      ]);
      if (removeLocal) {
        removeServer(server.id);
        logger.success("Removed from local config.");
      }
    }
  }
}
