import inquirer from "inquirer";
import { resolveServer } from "../utils/serverSelect.js";
import { destroyCloudServer } from "../core/manage.js";
import { logger, createSpinner } from "../utils/logger.js";

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

  const spinner = createSpinner("Destroying server...");
  spinner.start();

  // Delegate cloud deletion to core
  const result = await destroyCloudServer(server.name);

  if (result.success && result.cloudDeleted) {
    spinner.succeed(`Server "${server.name}" destroyed`);
    logger.success("Server has been removed from your cloud provider and local config.");
    return;
  }

  if (result.success && result.hint) {
    spinner.warn(`Server not found on ${server.provider} (may have been deleted manually)`);
    logger.info("Removed from local config.");
    return;
  }

  // Cloud deletion failed
  spinner.fail("Failed to destroy server");
  if (result.error) logger.error(result.error);
  if (result.hint) logger.info(result.hint);

  const { removeLocal } = await inquirer.prompt([
    {
      type: "confirm",
      name: "removeLocal",
      message: "Remove this server from local config anyway?",
      default: false,
    },
  ]);
  if (removeLocal) {
    const { removeServerRecord } = await import("../core/manage.js");
    const removeResult = removeServerRecord(server.name);
    if (removeResult.success) {
      logger.success("Removed from local config.");
    }
  }
}
