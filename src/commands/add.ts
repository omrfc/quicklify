import inquirer from "inquirer";
import ora from "ora";
import chalk from "chalk";
import { getServers, saveServer } from "../utils/config.js";
import { promptApiToken } from "../utils/serverSelect.js";
import { createProviderWithToken } from "../utils/providerFactory.js";
import { sshExec, checkSshAvailable } from "../utils/ssh.js";
import { logger } from "../utils/logger.js";
import type { ServerRecord } from "../types/index.js";

interface AddOptions {
  provider?: string;
  ip?: string;
  name?: string;
  skipVerify?: boolean;
}

export async function addCommand(options: AddOptions = {}): Promise<void> {
  // Step 1: Select provider
  let providerName = options.provider;
  if (!providerName) {
    const { provider } = await inquirer.prompt([
      {
        type: "list",
        name: "provider",
        message: "Select cloud provider:",
        choices: [
          { name: "Hetzner Cloud", value: "hetzner" },
          { name: "DigitalOcean", value: "digitalocean" },
          { name: "Vultr", value: "vultr" },
          { name: "Linode (Akamai)", value: "linode" },
        ],
      },
    ]);
    providerName = provider;
  }

  const validProviders = ["hetzner", "digitalocean", "vultr", "linode"];
  if (!validProviders.includes(providerName!)) {
    logger.error(`Invalid provider: ${providerName}. Use: ${validProviders.join(", ")}`);
    process.exit(1);
    return;
  }

  // Step 2: Get API token
  const token = await promptApiToken(providerName!);
  const provider = createProviderWithToken(providerName!, token);

  // Step 3: Validate token
  const spinner = ora("Validating API token...").start();
  const valid = await provider.validateToken(token);
  if (!valid) {
    spinner.fail("Invalid API token");
    process.exit(1);
    return;
  }
  spinner.succeed("Token validated");

  // Step 4: Get server IP
  let serverIp = options.ip;
  if (!serverIp) {
    const { ip } = await inquirer.prompt([
      {
        type: "input",
        name: "ip",
        message: "Enter server IP address:",
        validate: (input: string) => {
          const trimmed = input.trim();
          if (!trimmed) return "IP address is required";
          if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmed)) {
            return "Invalid IP address format";
          }
          const octets = trimmed.split(".").map(Number);
          if (octets.some((o) => o < 0 || o > 255)) {
            return "Invalid IP address (octets must be 0-255)";
          }
          return true;
        },
      },
    ]);
    serverIp = ip.trim();
  }

  // Step 5: Check for duplicate
  const existingServers = getServers();
  const duplicate = existingServers.find((s) => s.ip === serverIp);
  if (duplicate) {
    logger.error(`Server with IP ${serverIp} already exists: ${duplicate.name}`);
    process.exit(1);
    return;
  }

  // Step 6: Get server name
  let serverName = options.name;
  if (!serverName) {
    const { name } = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Server name:",
        default: "coolify-server",
        validate: (input: string) => {
          const trimmed = input.trim();
          if (!trimmed) return "Server name is required";
          if (trimmed.length < 3 || trimmed.length > 63) {
            return "Server name must be 3-63 characters";
          }
          if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(trimmed)) {
            return "Must start with a letter, end with letter/number, only lowercase letters, numbers, hyphens";
          }
          return true;
        },
      },
    ]);
    serverName = name.trim();
  }

  // Step 7: Verify Coolify is installed (unless --skip-verify)
  if (!options.skipVerify) {
    if (!checkSshAvailable()) {
      logger.warning("SSH not available. Use --skip-verify to skip Coolify verification.");
      process.exit(1);
      return;
    }

    const verifySpinner = ora("Verifying Coolify installation...").start();
    try {
      const result = await sshExec(
        serverIp!,
        "curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/api/health",
      );
      if (result.code === 0 && result.stdout.trim().includes("200")) {
        verifySpinner.succeed("Coolify is running");
      } else {
        // Fallback: check docker containers
        const dockerResult = await sshExec(
          serverIp!,
          "docker ps --format '{{.Names}}' 2>/dev/null | grep -q coolify && echo OK",
        );
        if (dockerResult.code === 0 && dockerResult.stdout.trim().includes("OK")) {
          verifySpinner.succeed("Coolify containers detected");
        } else {
          verifySpinner.warn("Coolify not detected. Server added anyway.");
        }
      }
    } catch {
      verifySpinner.warn("Could not verify Coolify. Server added anyway.");
    }
  }

  // Step 8: Save to config
  const record: ServerRecord = {
    id: `manual-${Date.now()}`,
    name: serverName!,
    provider: providerName!,
    ip: serverIp!,
    region: "unknown",
    size: "unknown",
    createdAt: new Date().toISOString(),
  };

  saveServer(record);

  console.log();
  console.log(chalk.green("Server added successfully!"));
  console.log(`  Name: ${record.name}`);
  console.log(`  IP: ${record.ip}`);
  console.log(`  Provider: ${provider.displayName}`);
  console.log();
  console.log("All commands now work for this server (status, update, backup, etc.)");
}
