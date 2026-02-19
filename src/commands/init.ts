import { HetznerProvider } from "../providers/hetzner.js";
import { DigitalOceanProvider } from "../providers/digitalocean.js";
import type { CloudProvider } from "../providers/base.js";
import {
  BACK_SIGNAL,
  getProviderConfig,
  getDeploymentConfig,
  getLocationConfig,
  getServerTypeConfig,
  getServerNameConfig,
  confirmDeployment,
} from "../utils/prompts.js";
import { getCoolifyCloudInit } from "../utils/cloudInit.js";
import { logger, createSpinner } from "../utils/logger.js";

function createProvider(providerName: string): CloudProvider {
  switch (providerName) {
    case "hetzner":
      return new HetznerProvider("");
    case "digitalocean":
      return new DigitalOceanProvider("");
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}

function createProviderWithToken(providerName: string, token: string): CloudProvider {
  switch (providerName) {
    case "hetzner":
      return new HetznerProvider(token);
    case "digitalocean":
      return new DigitalOceanProvider(token);
    /* istanbul ignore next */
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}

export async function initCommand() {
  logger.title("Quicklify - Deploy Coolify in 4 minutes");

  // Step 1: Select cloud provider
  const { provider: providerChoice } = await getProviderConfig();
  const provider = createProvider(providerChoice);

  logger.info(`Using ${provider.displayName}`);

  // Step 2: Get API token
  const config = await getDeploymentConfig(provider);

  // Create provider with actual token for API calls
  const providerWithToken = createProviderWithToken(providerChoice, config.apiToken);

  // Step 3: Validate API token
  const tokenSpinner = createSpinner("Validating API token...");
  tokenSpinner.start();

  const isValid = await providerWithToken.validateToken(config.apiToken);
  if (!isValid) {
    tokenSpinner.fail("Invalid API token");
    logger.error("Please check your API token and try again");
    return;
  }
  tokenSpinner.succeed("API token validated");

  // Steps 4-7: Configuration with back navigation
  let step = 4;

  while (step >= 4 && step <= 7) {
    switch (step) {
      case 4: {
        const region = await getLocationConfig(providerWithToken);
        if (region === BACK_SIGNAL) break;
        config.region = region;
        step = 5;
        break;
      }
      case 5: {
        const serverSize = await getServerTypeConfig(providerWithToken, config.region);
        if (serverSize === BACK_SIGNAL) {
          step = 4;
          break;
        }
        config.serverSize = serverSize;
        step = 6;
        break;
      }
      case 6: {
        const serverName = await getServerNameConfig();
        if (serverName === BACK_SIGNAL) {
          step = 5;
          break;
        }
        config.serverName = serverName;
        step = 7;
        break;
      }
      case 7: {
        const confirmed = await confirmDeployment(config, providerWithToken);
        if (confirmed === BACK_SIGNAL) {
          step = 6;
          break;
        }
        if (!confirmed) {
          logger.warning("Deployment cancelled");
          return;
        }
        step = 8;
        break;
      }
    }
  }

  try {
    // Generate cloud-init script
    const cloudInit = getCoolifyCloudInit(config.serverName);

    // Create server with retry on unavailable server type
    let server: { id: string; ip: string; status: string } | undefined;
    let retries = 0;
    const maxRetries = 2;
    const failedTypes: string[] = [];
    const failedLocations: string[] = [];

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
      } catch (createError: unknown) {
        serverSpinner.fail("Server creation failed");
        const errorMsg = createError instanceof Error ? createError.message : "";

        if (errorMsg.includes("already") && errorMsg.includes("used")) {
          logger.warning(`Server name "${config.serverName}" is already in use`);
          logger.info("Please choose a different name:");
          let newName = BACK_SIGNAL;
          while (newName === BACK_SIGNAL) {
            newName = await getServerNameConfig();
          }
          config.serverName = newName;
          retries++;
        } else if (errorMsg.includes("location disabled")) {
          failedLocations.push(config.region);
          logger.warning(`Location "${config.region}" is currently disabled for new servers`);
          logger.info("Please select a different region and server type:");
          let pickedSize = false;
          while (!pickedSize) {
            let newRegion = BACK_SIGNAL;
            while (newRegion === BACK_SIGNAL) {
              newRegion = await getLocationConfig(providerWithToken, failedLocations);
            }
            config.region = newRegion;
            const newSize = await getServerTypeConfig(providerWithToken, config.region);
            if (newSize === BACK_SIGNAL) continue; // back to region
            config.serverSize = newSize;
            pickedSize = true;
          }
          retries++;
        } else if (
          errorMsg.includes("unavailable") ||
          errorMsg.includes("not available") ||
          errorMsg.includes("sold out") ||
          errorMsg.includes("unsupported")
        ) {
          if (retries < maxRetries) {
            failedTypes.push(config.serverSize);
            logger.warning(`Server type "${config.serverSize}" is not available in this location`);
            logger.info("Please select a different server type:");
            let newSize = BACK_SIGNAL;
            while (newSize === BACK_SIGNAL) {
              newSize = await getServerTypeConfig(providerWithToken, config.region, failedTypes);
            }
            config.serverSize = newSize;
            retries++;
          } else {
            throw createError;
          }
        } else {
          throw createError;
        }
      }
    }

    /* istanbul ignore next */
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

    // Refresh server details to get final IP (DO assigns IP after boot)
    if (server.ip === "pending") {
      const details = await providerWithToken.getServerDetails(server.id);
      server.ip = details.ip;
    }

    // Installing Coolify
    const isDigitalOcean = providerChoice === "digitalocean";
    const waitTime = isDigitalOcean ? 300000 : 180000; // DO: 5 min, Hetzner: 3 min
    const waitLabel = isDigitalOcean ? "5-7" : "3-5";
    const installSpinner = createSpinner(`Installing Coolify (this takes ${waitLabel} minutes)...`);
    installSpinner.start();

    // Wait for Coolify installation (cloud-init runs in background)
    await new Promise((resolve) => setTimeout(resolve, waitTime));

    installSpinner.succeed("Coolify installation completed");

    // Success message
    const extraWait = isDigitalOcean ? "3-5" : "1-2";
    logger.title("Deployment Successful!");
    console.log();
    logger.success(`Server IP: ${server.ip}`);
    logger.success(`Access Coolify: http://${server.ip}:8000`);
    console.log();
    logger.info("Default credentials will be shown on first login");
    logger.info(`Please wait ${extraWait} more minutes for Coolify to fully initialize`);
    console.log();
  } catch (error: unknown) {
    logger.error(`Deployment failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
