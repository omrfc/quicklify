import inquirer from "inquirer";
import { getServers } from "../utils/config.js";
import { resolveServer, promptApiToken, collectProviderTokens } from "../utils/serverSelect.js";
import { createProviderWithToken } from "../utils/providerFactory.js";
import { logger, createSpinner } from "../utils/logger.js";

interface SnapshotOptions {
  all?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

async function snapshotCreate(
  query?: string,
  options?: SnapshotOptions,
): Promise<void> {
  const server = await resolveServer(query, "Select a server to snapshot:");
  if (!server) return;

  const apiToken = await promptApiToken(server.provider);
  const provider = createProviderWithToken(server.provider, apiToken);

  // Get cost estimate
  const costSpinner = createSpinner("Estimating snapshot cost...");
  costSpinner.start();
  let costEstimate = "unknown";
  try {
    costEstimate = await provider.getSnapshotCostEstimate(server.id);
    costSpinner.succeed(`Estimated cost: ${costEstimate}`);
  } catch {
    costSpinner.warn("Could not estimate cost");
  }

  if (options?.dryRun) {
    logger.title("Dry Run - Create Snapshot");
    logger.info(`Server: ${server.name} (${server.ip})`);
    logger.info(`Estimated cost: ${costEstimate}`);
    logger.info(`Snapshot name: quicklify-${Date.now()}`);
    console.log();
    logger.warning("No changes applied. Remove --dry-run to execute.");
    return;
  }

  if (!options?.force) {
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: `Create snapshot of ${server.name}? (Estimated cost: ${costEstimate})`,
        default: true,
      },
    ]);
    if (!confirm) {
      logger.info("Snapshot cancelled.");
      return;
    }
  }

  const snapshotName = `quicklify-${Date.now()}`;
  const spinner = createSpinner(`Creating snapshot "${snapshotName}"...`);
  spinner.start();

  try {
    const snapshot = await provider.createSnapshot(server.id, snapshotName);
    spinner.succeed(`Snapshot created: ${snapshot.name} (${snapshot.id})`);
    logger.info(`Status: ${snapshot.status}`);
    logger.info(`Cost: ${snapshot.costPerMonth}`);
  } catch (error: unknown) {
    spinner.fail("Failed to create snapshot");
    logger.error(error instanceof Error ? error.message : String(error));
  }
}

async function snapshotList(query?: string): Promise<void> {
  const server = await resolveServer(query, "Select a server to list snapshots:");
  if (!server) return;

  const apiToken = await promptApiToken(server.provider);
  const provider = createProviderWithToken(server.provider, apiToken);

  const spinner = createSpinner(`Fetching snapshots for ${server.name}...`);
  spinner.start();

  try {
    const snapshots = await provider.listSnapshots(server.id);
    if (snapshots.length === 0) {
      spinner.succeed(`No snapshots found for ${server.name}`);
      return;
    }

    spinner.succeed(`${snapshots.length} snapshot(s) found for ${server.name}`);
    console.log();

    for (const snap of snapshots) {
      logger.step(
        `${snap.name} | ID: ${snap.id} | Size: ${snap.sizeGb.toFixed(1)} GB | Cost: ${snap.costPerMonth} | Created: ${snap.createdAt}`,
      );
    }
  } catch (error: unknown) {
    spinner.fail("Failed to list snapshots");
    logger.error(error instanceof Error ? error.message : String(error));
  }
}

async function snapshotListAll(): Promise<void> {
  const servers = getServers();
  if (servers.length === 0) {
    logger.info("No servers found. Deploy one with: quicklify init");
    return;
  }

  const tokenMap = await collectProviderTokens(servers);

  for (const server of servers) {
    const token = tokenMap.get(server.provider)!;
    const provider = createProviderWithToken(server.provider, token);

    const spinner = createSpinner(`Fetching snapshots for ${server.name}...`);
    spinner.start();

    try {
      const snapshots = await provider.listSnapshots(server.id);
      if (snapshots.length === 0) {
        spinner.succeed(`${server.name}: No snapshots`);
      } else {
        spinner.succeed(`${server.name}: ${snapshots.length} snapshot(s)`);
        for (const snap of snapshots) {
          logger.step(
            `  ${snap.name} | ID: ${snap.id} | Size: ${snap.sizeGb.toFixed(1)} GB | Cost: ${snap.costPerMonth} | Created: ${snap.createdAt}`,
          );
        }
      }
    } catch (error: unknown) {
      spinner.fail(`${server.name}: Failed to list snapshots`);
      logger.error(error instanceof Error ? error.message : String(error));
    }
    console.log();
  }
}

async function snapshotDelete(
  query?: string,
  options?: SnapshotOptions,
): Promise<void> {
  const server = await resolveServer(query, "Select a server:");
  if (!server) return;

  const apiToken = await promptApiToken(server.provider);
  const provider = createProviderWithToken(server.provider, apiToken);

  // List snapshots to select from
  const listSpinner = createSpinner("Fetching snapshots...");
  listSpinner.start();

  let snapshots;
  try {
    snapshots = await provider.listSnapshots(server.id);
  } catch (error: unknown) {
    listSpinner.fail("Failed to list snapshots");
    logger.error(error instanceof Error ? error.message : String(error));
    return;
  }

  if (snapshots.length === 0) {
    listSpinner.succeed("No snapshots to delete");
    return;
  }

  listSpinner.succeed(`${snapshots.length} snapshot(s) found`);

  const { selectedId } = await inquirer.prompt([
    {
      type: "list",
      name: "selectedId",
      message: "Select a snapshot to delete:",
      choices: snapshots.map((s) => ({
        name: `${s.name} (${s.sizeGb.toFixed(1)} GB, ${s.costPerMonth}, ${s.createdAt})`,
        value: s.id,
      })),
    },
  ]);

  if (!options?.force) {
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: `Delete snapshot ${selectedId}? This cannot be undone.`,
        default: false,
      },
    ]);
    if (!confirm) {
      logger.info("Delete cancelled.");
      return;
    }
  }

  const deleteSpinner = createSpinner("Deleting snapshot...");
  deleteSpinner.start();

  try {
    await provider.deleteSnapshot(selectedId);
    deleteSpinner.succeed("Snapshot deleted");
  } catch (error: unknown) {
    deleteSpinner.fail("Failed to delete snapshot");
    logger.error(error instanceof Error ? error.message : String(error));
  }
}

export async function snapshotCommand(
  subcommand?: string,
  query?: string,
  options?: SnapshotOptions,
): Promise<void> {
  const sub = subcommand || "list";
  const validSubcommands = ["create", "list", "delete"];

  if (!validSubcommands.includes(sub)) {
    logger.error(
      `Invalid subcommand: ${sub}. Choose from: ${validSubcommands.join(", ")}`,
    );
    return;
  }

  switch (sub) {
    case "create":
      await snapshotCreate(query, options);
      break;
    case "list":
      if (options?.all) {
        await snapshotListAll();
      } else {
        await snapshotList(query);
      }
      break;
    case "delete":
      await snapshotDelete(query, options);
      break;
  }
}
