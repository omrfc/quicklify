import inquirer from "inquirer";
import { removeServer } from "../utils/config.js";
import { resolveServer } from "../utils/serverSelect.js";
import { logger } from "../utils/logger.js";

export async function removeCommand(query?: string): Promise<void> {
  const server = await resolveServer(query, "Select a server to remove:");
  if (!server) return;

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Remove "${server.name}" (${server.ip}) from local config? (Server will NOT be destroyed)`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info("Remove cancelled.");
    return;
  }

  removeServer(server.id);
  logger.success(`"${server.name}" removed from local config.`);
  logger.info(
    "The cloud server is still running. Use 'destroy' to also delete it from the provider.",
  );
}
