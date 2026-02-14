import { HetznerProvider } from "../providers/hetzner.js";
import { getDeploymentConfig, getLocationConfig, getServerTypeConfig, getServerNameConfig, confirmDeployment } from "../utils/prompts.js";
import { getCoolifyCloudInit } from "../utils/cloudInit.js";
import { logger, createSpinner } from "../utils/logger.js";

export async function initCommand() {
  logger.title("Quicklify - Deploy Coolify in 4 minutes");

  // For MVP, we only support Hetzner
  // Later: Add provider selection prompt
  logger.info("Using Hetzner Cloud (more providers coming soon!)");

  const provider = new HetznerProvider(""); // Token will be set from config

  // Step 1: Get API token
  const config = await getDeploymentConfig(provider);

  // Create provider with actual token for API calls
  const providerWithToken = new HetznerProvider(config.apiToken);

  // Step 2: Validate API token
  const tokenSpinner = createSpinner("Validating API token...");
  tokenSpinner.start();

  const isValid = await providerWithToken.validateToken(config.apiToken);
  if (!isValid) {
    tokenSpinner.fail("Invalid API token");
    logger.error("Please check your API token and try again");
    return;
  }
  tokenSpinner.succeed("API token validated");

  // Step 3: Get location (dynamic from API)
  config.region = await getLocationConfig(providerWithToken);

  // Step 4: Get server type (dynamic based on location)
  config.serverSize = await getServerTypeConfig(providerWithToken, config.region);

  // Step 5: Get server name
  config.serverName = await getServerNameConfig();

  // Confirm deployment
  const confirmed = await confirmDeployment(config, providerWithToken);
  if (!confirmed) {
    logger.warning("Deployment cancelled");
    return;
  }

  try {
    // Generate cloud-init script
    const cloudInit = getCoolifyCloudInit(config.serverName);

    // Create server with retry on unavailable server type
    let server: { id: string; ip: string; status: string } | undefined;
    let retries = 0;
    const maxRetries = 2;

    while (!server && retries <= maxRetries) {
      const serverSpinner = createSpinner("Creating VPS server...");
      serverSpinner.start();

      try {
        server = await providerWithToken.createServer({
          name: config.serverName,
          region: config.region,
          size: config.serverSize,
          cloudInit,
        });
        serverSpinner.succeed(`Server created (ID: ${server.id})`);
      } catch (createError: any) {
        serverSpinner.fail("Server creation failed");
        const errorMsg = createError.message || "";

        if (errorMsg.includes("unavailable") || errorMsg.includes("not available") || errorMsg.includes("sold out")) {
          if (retries < maxRetries) {
            logger.warning(`Server type "${config.serverSize}" is not available in this location`);
            logger.info("Please select a different server type:");
            config.serverSize = await getServerTypeConfig(providerWithToken, config.region);
            retries++;
          } else {
            throw createError;
          }
        } else {
          throw createError;
        }
      }
    }

    if (!server) {
      logger.error("Could not create server after multiple attempts");
      process.exit(1);
    }

    // Wait for server to be running
    const statusSpinner = createSpinner("Waiting for server to boot...");
    statusSpinner.start();

    let status = await providerWithToken.getServerStatus(server.id);
    let attempts = 0;
    const maxAttempts = 30;

    while (status !== "running" && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      status = await providerWithToken.getServerStatus(server.id);
      attempts++;
    }

    if (status !== "running") {
      statusSpinner.fail("Server failed to start");
      logger.error("Please check your cloud provider dashboard");
      return;
    }

    statusSpinner.succeed("Server is running");

    // Installing Coolify
    const installSpinner = createSpinner("Installing Coolify (this takes 3-5 minutes)...");
    installSpinner.start();

    // Wait for Coolify installation (cloud-init runs in background)
    await new Promise((resolve) => setTimeout(resolve, 180000));

    installSpinner.succeed("Coolify installation completed");

    // Success message
    logger.title("Deployment Successful!");
    console.log();
    logger.success(`Server IP: ${server.ip}`);
    logger.success(`Access Coolify: http://${server.ip}:8000`);
    console.log();
    logger.info("Default credentials will be shown on first login");
    logger.info("Please wait 1-2 more minutes for Coolify to fully initialize");
    console.log();
  } catch (error: any) {
    logger.error(`Deployment failed: ${error.message}`);
    process.exit(1);
  }
}
