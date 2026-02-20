import axios from "axios";
import { resolveServer, promptApiToken } from "../utils/serverSelect.js";
import { createProviderWithToken } from "../utils/providerFactory.js";
import { logger, createSpinner } from "../utils/logger.js";

export async function statusCommand(query?: string): Promise<void> {
  const server = await resolveServer(query);
  if (!server) return;

  // Ask for API token
  const apiToken = await promptApiToken(server.provider);

  const spinner = createSpinner("Checking server status...");
  spinner.start();

  try {
    const provider = createProviderWithToken(server.provider, apiToken);

    // Check server status via provider API
    const serverStatus = await provider.getServerStatus(server.id);

    // Check Coolify health
    let coolifyStatus = "unknown";
    try {
      await axios.get(`http://${server.ip}:8000`, {
        timeout: 5000,
        validateStatus: () => true,
      });
      coolifyStatus = "running";
    } catch {
      coolifyStatus = "not reachable";
    }

    spinner.succeed("Status retrieved");

    console.log();
    logger.info(`Name:           ${server.name}`);
    logger.info(`Provider:       ${server.provider}`);
    logger.info(`IP:             ${server.ip}`);
    logger.info(`Region:         ${server.region}`);
    logger.info(`Size:           ${server.size}`);
    logger.info(`Server Status:  ${serverStatus}`);
    logger.info(`Coolify Status: ${coolifyStatus}`);
    console.log();

    if (coolifyStatus === "running") {
      logger.success(`Access Coolify: http://${server.ip}:8000`);
      logger.warning("Running on HTTP. Set up a domain + SSL for production use.");
    } else {
      logger.warning("Coolify is not reachable. It may still be installing.");
    }
  } catch (error: unknown) {
    spinner.fail("Failed to check status");
    logger.error(error instanceof Error ? error.message : String(error));
  }
}
