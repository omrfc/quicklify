import axios from "axios";
import { getServers } from "../utils/config.js";
import { resolveServer, promptApiToken, collectProviderTokens } from "../utils/serverSelect.js";
import { createProviderWithToken } from "../utils/providerFactory.js";
import { checkSshAvailable, sshExec } from "../utils/ssh.js";
import { logger, createSpinner } from "../utils/logger.js";
import { getErrorMessage, mapProviderError, mapSshError } from "../utils/errorMapper.js";
import type { ServerRecord } from "../types/index.js";

const COOLIFY_RESTART_CMD =
  "cd /data/coolify/source && docker compose -f docker-compose.yml -f docker-compose.prod.yml restart coolify";

interface StatusOptions {
  all?: boolean;
  autostart?: boolean;
}

interface StatusResult {
  server: ServerRecord;
  serverStatus: string;
  coolifyStatus: string;
  error?: string;
}

async function checkSingleServer(server: ServerRecord, apiToken: string): Promise<StatusResult> {
  try {
    let serverStatus: string;
    if (server.id.startsWith("manual-")) {
      serverStatus = "unknown (manual)";
    } else {
      const provider = createProviderWithToken(server.provider, apiToken);
      serverStatus = await provider.getServerStatus(server.id);
    }

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

    return { server, serverStatus, coolifyStatus };
  } catch (error: unknown) {
    return {
      server,
      serverStatus: "error",
      coolifyStatus: "unknown",
      error: getErrorMessage(error),
    };
  }
}

async function statusAll(): Promise<void> {
  const servers = getServers();
  if (servers.length === 0) {
    logger.info("No servers found. Deploy one with: quicklify init");
    return;
  }

  const tokenMap = await collectProviderTokens(servers);
  const spinner = createSpinner(`Checking status of ${servers.length} server(s)...`);
  spinner.start();

  const results = await Promise.all(
    servers.map((s) => checkSingleServer(s, tokenMap.get(s.provider)!)),
  );

  spinner.succeed("Status check complete");
  console.log();

  // Table header
  const header = `${"Name".padEnd(20)} ${"IP".padEnd(16)} ${"Provider".padEnd(14)} ${"Server".padEnd(12)} ${"Coolify".padEnd(14)}`;
  console.log(header);
  console.log("─".repeat(header.length));

  for (const r of results) {
    const serverStr = r.error ? "error" : r.serverStatus;
    const coolifyStr = r.coolifyStatus;
    console.log(
      `${r.server.name.padEnd(20)} ${r.server.ip.padEnd(16)} ${r.server.provider.padEnd(14)} ${serverStr.padEnd(12)} ${coolifyStr.padEnd(14)}`,
    );
  }

  console.log();

  const running = results.filter((r) => r.coolifyStatus === "running").length;
  const errors = results.filter((r) => r.error).length;
  if (errors > 0) {
    logger.warning(`${running} running, ${errors} error(s)`);
  } else {
    logger.success(`${running}/${results.length} server(s) with Coolify running`);
  }
}

async function autostartCoolify(server: ServerRecord): Promise<void> {
  if (!checkSshAvailable()) {
    logger.warning("SSH not available. Cannot autostart Coolify.");
    return;
  }

  const spinner = createSpinner("Restarting Coolify via SSH...");
  spinner.start();

  try {
    const result = await sshExec(server.ip, COOLIFY_RESTART_CMD);
    if (result.code === 0) {
      spinner.succeed("Coolify restart command sent");

      // Wait and check again
      await new Promise((resolve) => setTimeout(resolve, 5000));
      try {
        await axios.get(`http://${server.ip}:8000`, {
          timeout: 5000,
          validateStatus: () => true,
        });
        logger.success("Coolify is now running!");
      } catch {
        logger.warning("Coolify may still be starting. Check again in a moment.");
      }
    } else {
      spinner.fail("Coolify restart failed");
      if (result.stderr) logger.error(result.stderr);
    }
  } catch (error: unknown) {
    spinner.fail("Failed to restart Coolify");
    logger.error(getErrorMessage(error));
    const hint = mapSshError(error, server.ip);
    if (hint) logger.info(hint);
  }
}

export async function statusCommand(query?: string, options?: StatusOptions): Promise<void> {
  if (options?.all) {
    return statusAll();
  }

  const server = await resolveServer(query);
  if (!server) return;

  // Ask for API token (skip for manually added servers)
  const apiToken = server.id.startsWith("manual-") ? "" : await promptApiToken(server.provider);

  const spinner = createSpinner("Checking server status...");
  spinner.start();

  try {
    let serverStatus: string;
    if (server.id.startsWith("manual-")) {
      serverStatus = "unknown (manual)";
    } else {
      const provider = createProviderWithToken(server.provider, apiToken);
      serverStatus = await provider.getServerStatus(server.id);
    }

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

      // Autostart: restart Coolify if server is running but Coolify is down
      if (options?.autostart && serverStatus === "running") {
        await autostartCoolify(server);
      }
    }
  } catch (error: unknown) {
    spinner.fail("Failed to check status");
    logger.error(getErrorMessage(error));
    const hint = mapProviderError(error, server.provider);
    if (hint) logger.info(hint);
  }
}
