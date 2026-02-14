import { HetznerProvider } from "../providers/hetzner.js";
import { getDeploymentConfig, confirmDeployment } from "../utils/prompts.js";
import { getCoolifyCloudInit } from "../utils/cloudInit.js";
import { logger, createSpinner } from "../utils/logger.js";

export async function initCommand() {
  logger.title("Quicklify - Deploy Coolify in 4 minutes");

  // For MVP, we only support Hetzner
  // Later: Add provider selection prompt
  logger.info("Using Hetzner Cloud (more providers coming soon!)");

  const provider = new HetznerProvider(""); // Token will be set from config

  // Get deployment configuration
  const config = await getDeploymentConfig(provider);

  // Update provider with actual token
  const providerWithToken = new HetznerProvider(config.apiToken);

  // Confirm deployment
  const confirmed = await confirmDeployment(config, providerWithToken);
  if (!confirmed) {
    logger.warning("Deployment cancelled");
    return;
  }

  try {
    // Validate API token
    const tokenSpinner = createSpinner("Validating API token...");
    tokenSpinner.start();

    const isValid = await providerWithToken.validateToken(config.apiToken);
    if (!isValid) {
      tokenSpinner.fail("Invalid API token");
      logger.error("Please check your API token and try again");
      return;
    }
    tokenSpinner.succeed("API token validated");

    // Generate cloud-init script
    const cloudInit = getCoolifyCloudInit(config.serverName);

    // Create server
    const serverSpinner = createSpinner("Creating VPS server...");
    serverSpinner.start();

    const server = await providerWithToken.createServer({
      name: config.serverName,
      region: config.region,
      size: config.serverSize,
      cloudInit,
    });

    serverSpinner.succeed(`Server created (ID: ${server.id})`);

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
    logger.success(`Access Coolify: https://${server.ip}:8000`);
    console.log();
    logger.info("Default credentials will be shown on first login");
    logger.info("Please wait 1-2 more minutes for Coolify to fully initialize");
    console.log();
  } catch (error: any) {
    logger.error(`Deployment failed: ${error.message}`);
    process.exit(1);
  }
}
