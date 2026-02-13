import inquirer from "inquirer";
import type { CloudProvider } from "../providers/base.js";
import type { DeploymentConfig } from "../types/index.js";

export async function getDeploymentConfig(provider: CloudProvider): Promise<DeploymentConfig> {
  const answers = await inquirer.prompt([
    {
      type: "password",
      name: "apiToken",
      message: `Enter your ${provider.displayName} API token:`,
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return "API token is required";
        }
        return true;
      },
    },
    {
      type: "list",
      name: "region",
      message: "Select region:",
      choices: provider.getRegions().map((r) => ({
        name: `${r.name} (${r.location})`,
        value: r.id,
      })),
    },
    {
      type: "list",
      name: "size",
      message: "Select server size:",
      choices: provider.getServerSizes().map((s) => ({
        name: `${s.name} - ${s.vcpu} vCPU, ${s.ram}GB RAM - ${s.price}${s.recommended ? " ⭐ Recommended" : ""}`,
        value: s.id,
      })),
    },
    {
      type: "input",
      name: "serverName",
      message: "Server name:",
      default: "coolify-server",
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return "Server name is required";
        }
        if (!/^[a-z0-9-]+$/.test(input)) {
          return "Server name must contain only lowercase letters, numbers, and hyphens";
        }
        return true;
      },
    },
  ]);

  return {
    provider: provider.name,
    apiToken: answers.apiToken.trim(),
    region: answers.region,
    serverSize: answers.size,
    serverName: answers.serverName.trim(),
  };
}

export async function confirmDeployment(config: DeploymentConfig, provider: CloudProvider): Promise<boolean> {
  const region = provider.getRegions().find((r) => r.id === config.region);
  const size = provider.getServerSizes().find((s) => s.id === config.serverSize);

  console.log("\nDeployment Summary:");
  console.log(`  Provider: ${provider.displayName}`);
  console.log(`  Region: ${region?.name} (${region?.location})`);
  console.log(`  Size: ${size?.name} - ${size?.vcpu} vCPU, ${size?.ram}GB RAM`);
  console.log(`  Price: ${size?.price}`);
  console.log(`  Server Name: ${config.serverName}`);
  console.log();

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "Proceed with deployment?",
      default: true,
    },
  ]);

  return confirm;
}
