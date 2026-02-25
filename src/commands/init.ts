import { spawnSync } from "child_process";
import type { CloudProvider } from "../providers/base.js";
import type { InitOptions } from "../types/index.js";
import { createProvider, createProviderWithToken } from "../utils/providerFactory.js";
import { saveServer } from "../utils/config.js";
import { waitForCoolify } from "../utils/healthCheck.js";
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
import { mapProviderError } from "../utils/errorMapper.js";
import { findLocalSshKey, generateSshKey, getSshKeyName } from "../utils/sshKey.js";
import { firewallSetup } from "./firewall.js";
import { secureSetup } from "./secure.js";
import { loadYamlConfig } from "../utils/yamlConfig.js";
import { mergeConfig } from "../utils/configMerge.js";
import { getTemplate, getTemplateDefaults, VALID_TEMPLATE_NAMES } from "../utils/templates.js";

export async function initCommand(options: InitOptions = {}): Promise<void> {
  // Load YAML config if --config flag provided
  if (options.config) {
    const { config: yamlConfig, warnings } = loadYamlConfig(options.config);
    for (const w of warnings) {
      logger.warning(w);
    }
    const merged = mergeConfig(options, yamlConfig);
    // Apply merged values back to options
    if (merged.provider && !options.provider) options.provider = merged.provider;
    if (merged.region && !options.region) options.region = merged.region;
    if (merged.size && !options.size) options.size = merged.size;
    if (merged.name && !options.name) options.name = merged.name;
    if (merged.fullSetup !== undefined && options.fullSetup === undefined)
      options.fullSetup = merged.fullSetup;
  } else if (options.template) {
    // Template-only mode (no YAML file)
    const merged = mergeConfig(options);
    if (merged.provider && !options.provider) options.provider = merged.provider;
    if (merged.region && !options.region) options.region = merged.region;
    if (merged.size && !options.size) options.size = merged.size;
    if (merged.name && !options.name) options.name = merged.name;
    if (merged.fullSetup !== undefined && options.fullSetup === undefined)
      options.fullSetup = merged.fullSetup;
  }

  // Validate --template flag
  if (options.template) {
    const tmpl = getTemplate(options.template);
    if (!tmpl) {
      logger.error(
        `Invalid template: "${options.template}". Valid templates: ${VALID_TEMPLATE_NAMES.join(", ")}`,
      );
      process.exit(1);
      return;
    }
    logger.info(`Using template: ${tmpl.name} - ${tmpl.description}`);
  }

  const isNonInteractive = options.provider !== undefined;

  logger.title("Quicklify - Deploy Coolify in minutes");

  let providerChoice: string;
  let apiToken: string;
  let region: string;
  let serverSize: string;
  let serverName: string;

  // Step 1: Select cloud provider
  if (options.provider) {
    if (!["hetzner", "digitalocean", "vultr", "linode"].includes(options.provider)) {
      logger.error(
        `Invalid provider: ${options.provider}. Use "hetzner", "digitalocean", "vultr", or "linode".`,
      );
      process.exit(1);
      return;
    }
    providerChoice = options.provider;
  } else {
    const result = await getProviderConfig();
    providerChoice = result.provider;
  }
  const provider = createProvider(providerChoice);
  logger.info(`Using ${provider.displayName}`);

  // Apply template defaults now that provider is known (handles interactive provider selection)
  if (options.template) {
    const tmplDefaults = getTemplateDefaults(options.template, providerChoice);
    if (tmplDefaults) {
      if (!options.region) options.region = tmplDefaults.region;
      if (!options.size) options.size = tmplDefaults.size;
    }
  }

  // Step 2: Get API token (env var > interactive prompt)
  if (options.token) {
    apiToken = options.token;
    logger.warning(
      "Token passed via --token flag is visible in shell history. Use environment variables instead: export HETZNER_TOKEN=...",
    );
    process.title = "quicklify";
  } else if (providerChoice === "hetzner" && process.env.HETZNER_TOKEN) {
    apiToken = process.env.HETZNER_TOKEN;
  } else if (providerChoice === "digitalocean" && process.env.DIGITALOCEAN_TOKEN) {
    apiToken = process.env.DIGITALOCEAN_TOKEN;
  } else if (providerChoice === "vultr" && process.env.VULTR_TOKEN) {
    apiToken = process.env.VULTR_TOKEN;
  } else if (providerChoice === "linode" && process.env.LINODE_TOKEN) {
    apiToken = process.env.LINODE_TOKEN;
  } else {
    const config = await getDeploymentConfig(provider);
    apiToken = config.apiToken;
  }

  // Step 3: Validate API token
  const providerWithToken = createProviderWithToken(providerChoice, apiToken);
  const tokenSpinner = createSpinner("Validating API token...");
  tokenSpinner.start();

  const isValid = await providerWithToken.validateToken(apiToken);
  if (!isValid) {
    tokenSpinner.fail("Invalid API token");
    logger.error("Please check your API token and try again");
    if (isNonInteractive) {
      process.exit(1);
      return;
    }
    return;
  }
  tokenSpinner.succeed("API token validated");

  // Step 4: Region
  if (options.region) {
    region = options.region;
  } else {
    // Interactive region selection with back navigation
    let step = 4;
    region = "";
    serverSize = "";
    serverName = "";

    while (step >= 4 && step <= 7) {
      switch (step) {
        case 4: {
          const r = await getLocationConfig(providerWithToken);
          if (r === BACK_SIGNAL) break;
          region = r;
          step = 5;
          break;
        }
        case 5: {
          const s = await getServerTypeConfig(providerWithToken, region);
          if (s === BACK_SIGNAL) {
            step = 4;
            break;
          }
          serverSize = s;
          step = 6;
          break;
        }
        case 6: {
          const n = await getServerNameConfig();
          if (n === BACK_SIGNAL) {
            step = 5;
            break;
          }
          serverName = n;
          step = 7;
          break;
        }
        case 7: {
          const config = {
            provider: providerChoice,
            apiToken,
            region,
            serverSize,
            serverName,
          };
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

    // Deploy
    return deployServer(
      providerChoice,
      providerWithToken,
      region,
      serverSize,
      serverName,
      options.fullSetup,
    );
  }

  // Non-interactive or partially interactive: size, name
  if (options.size) {
    serverSize = options.size;
  } else {
    let s = BACK_SIGNAL;
    while (s === BACK_SIGNAL) {
      s = await getServerTypeConfig(providerWithToken, region);
    }
    serverSize = s;
  }

  if (options.name) {
    serverName = options.name;
  } else {
    let n = BACK_SIGNAL;
    while (n === BACK_SIGNAL) {
      n = await getServerNameConfig();
    }
    serverName = n;
  }

  return deployServer(
    providerChoice,
    providerWithToken,
    region,
    serverSize,
    serverName,
    options.fullSetup,
  );
}

async function uploadSshKeyToProvider(provider: CloudProvider): Promise<string[]> {
  let publicKey = findLocalSshKey();
  if (!publicKey) {
    logger.info("No SSH key found. Generating one...");
    publicKey = generateSshKey();
    if (publicKey) {
      logger.success("SSH key generated (~/.ssh/id_ed25519)");
    } else {
      logger.warning("Could not generate SSH key — falling back to password auth");
      logger.info("Server will require password change on first SSH login");
      return [];
    }
  }

  const spinner = createSpinner("Uploading SSH key to provider...");
  spinner.start();
  try {
    const keyId = await provider.uploadSshKey(getSshKeyName(), publicKey);
    spinner.succeed("SSH key uploaded — password-free access enabled");
    return [keyId];
  } catch (error: unknown) {
    spinner.fail("SSH key upload failed — falling back to password auth");
    logger.warning(error instanceof Error ? error.message : String(error));
    return [];
  }
}

async function deployServer(
  providerChoice: string,
  providerWithToken: CloudProvider,
  region: string,
  serverSize: string,
  serverName: string,
  fullSetup?: boolean,
): Promise<void> {
  try {
    // Upload SSH key before creating server
    const sshKeyIds = await uploadSshKeyToProvider(providerWithToken);
    const cloudInit = getCoolifyCloudInit(serverName);

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
          name: serverName,
          region,
          size: serverSize,
          cloudInit,
          sshKeyIds,
        });
        serverSpinner.succeed(`Server created (ID: ${server.id})`);
      } catch (createError: unknown) {
        serverSpinner.fail("Server creation failed");
        const errorMsg = createError instanceof Error ? createError.message : "";

        if (errorMsg.includes("already") && errorMsg.includes("used")) {
          logger.warning(`Server name "${serverName}" is already in use`);
          logger.info("Please choose a different name:");
          let newName = BACK_SIGNAL;
          while (newName === BACK_SIGNAL) {
            newName = await getServerNameConfig();
          }
          serverName = newName;
          retries++;
        } else if (errorMsg.includes("location disabled")) {
          failedLocations.push(region);
          logger.warning(`Location "${region}" is currently disabled for new servers`);
          logger.info("Please select a different region and server type:");
          let pickedSize = false;
          while (!pickedSize) {
            let newRegion = BACK_SIGNAL;
            while (newRegion === BACK_SIGNAL) {
              newRegion = await getLocationConfig(providerWithToken, failedLocations);
            }
            region = newRegion;
            const newSize = await getServerTypeConfig(providerWithToken, region);
            if (newSize === BACK_SIGNAL) continue;
            serverSize = newSize;
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
            failedTypes.push(serverSize);
            logger.warning(`Server type "${serverSize}" is not available in this location`);
            logger.info("Please select a different server type:");
            let newSize = BACK_SIGNAL;
            while (newSize === BACK_SIGNAL) {
              newSize = await getServerTypeConfig(providerWithToken, region, failedTypes);
            }
            serverSize = newSize;
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

    // Refresh server details to get final IP (DO/Vultr assign IP after boot)
    if (server.ip === "pending" || server.ip === "0.0.0.0") {
      let refreshAttempts = 0;
      while (refreshAttempts < 10) {
        const details = await providerWithToken.getServerDetails(server.id);
        if (details.ip && details.ip !== "0.0.0.0" && details.ip !== "pending") {
          server.ip = details.ip;
          break;
        }
        refreshAttempts++;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    // Health check polling instead of blind wait
    const isDigitalOcean = providerChoice === "digitalocean";
    const minWait = isDigitalOcean ? 120000 : 60000;
    const ready = await waitForCoolify(server.ip, minWait);

    // Save server record to config
    saveServer({
      id: server.id,
      name: serverName,
      provider: providerChoice,
      ip: server.ip,
      region,
      size: serverSize,
      createdAt: new Date().toISOString(),
    });

    // Full setup: auto-configure firewall + SSH hardening
    if (fullSetup && ready) {
      // Clear stale known_hosts entry (cloud providers reuse IPs)
      try {
        spawnSync("ssh-keygen", ["-R", server.ip], { stdio: "ignore" });
      } catch {
        // ssh-keygen not available or no entry — harmless
      }

      logger.title("Running full setup (firewall + security)...");
      try {
        await firewallSetup(server.ip, serverName, false);
      } catch (error: unknown) {
        logger.warning(
          `Firewall setup failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      try {
        await secureSetup(server.ip, serverName, undefined, false, true);
      } catch (error: unknown) {
        logger.warning(
          `Security setup failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else if (fullSetup && !ready) {
      logger.warning("Skipping full setup: Coolify is not ready yet.");
      logger.info("Run manually later: quicklify firewall setup && quicklify secure setup");
    }

    // Success message
    logger.title("Deployment Successful!");
    console.log();
    logger.success(`Server IP: ${server.ip}`);
    logger.success(`Access Coolify: http://${server.ip}:8000`);
    console.log();
    if (ready) {
      logger.info("Coolify is ready! Open the URL above to get started.");
    } else {
      logger.warning("Coolify did not respond yet. Please check in a few minutes.");
      logger.info(`You can check status later with: quicklify status ${server.ip}`);
    }

    // Onboarding: next steps
    if (!fullSetup) {
      console.log();
      logger.title("Recommended Next Steps:");
      logger.info(`  1. Set up firewall:     quicklify firewall setup ${serverName}`);
      logger.info(
        `  2. Add a domain:        quicklify domain add ${serverName} --domain example.com`,
      );
      logger.info(`  3. Harden SSH:          quicklify secure setup ${serverName}`);
      logger.info(`  4. Create a backup:     quicklify backup ${serverName}`);
      logger.info("  Or do it all at once:   quicklify init --full-setup");
    } else {
      console.log();
      logger.title("Next Steps:");
      logger.info(
        `  1. Add a domain:        quicklify domain add ${serverName} --domain example.com`,
      );
      logger.info(`  2. Create a backup:     quicklify backup ${serverName}`);
    }

    logger.info("Server saved to local config. Use 'quicklify list' to see all servers.");
    console.log();
    console.log(
      "  \u2b50 Love Quicklify? Give us a star: https://github.com/omrfc/quicklify \u2b50",
    );
    console.log();
  } catch (error: unknown) {
    logger.error(`Deployment failed: ${error instanceof Error ? error.message : String(error)}`);
    const hint = mapProviderError(error, providerChoice);
    if (hint) {
      logger.info(hint);
    }
    process.exit(1);
  }
}
