#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initCommand } from "./commands/init.js";
import { listCommand } from "./commands/list.js";
import { statusCommand } from "./commands/status.js";
import { destroyCommand } from "./commands/destroy.js";
import { configCommand } from "./commands/config.js";
import { sshCommand } from "./commands/ssh.js";
import { updateCommand } from "./commands/update.js";
import { restartCommand } from "./commands/restart.js";
import { logsCommand } from "./commands/logs.js";
import { monitorCommand } from "./commands/monitor.js";
import { healthCommand } from "./commands/health.js";
import { doctorCommand } from "./commands/doctor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));

const program = new Command();

program
  .name("quicklify")
  .description("Automate Coolify deployment on cloud providers")
  .version(pkg.version);

program
  .command("init")
  .description("Deploy a new Coolify instance on a cloud provider")
  .option("--provider <provider>", "Cloud provider (hetzner, digitalocean)")
  .option("--token <token>", "API token (or set HETZNER_TOKEN / DIGITALOCEAN_TOKEN env var)")
  .option("--region <region>", "Server region")
  .option("--size <size>", "Server size")
  .option("--name <name>", "Server name")
  .action(initCommand);

program.command("list").description("List all registered servers").action(listCommand);

program
  .command("status [query]")
  .description("Check server and Coolify status")
  .action(statusCommand);

program
  .command("destroy [query]")
  .description("Destroy a registered server")
  .action(destroyCommand);

program
  .command("config [subcommand] [args...]")
  .description("Manage default configuration")
  .action((subcommand?: string, args?: string[]) => configCommand(subcommand, args));

program
  .command("ssh [query]")
  .description("SSH into a registered server")
  .option("-c, --command <command>", "Execute a single command via SSH")
  .action((query?: string, options?: { command?: string }) => sshCommand(query, options));

program
  .command("update [query]")
  .description("Update Coolify on a registered server")
  .action(updateCommand);

program
  .command("restart [query]")
  .description("Restart a registered server")
  .action(restartCommand);

program
  .command("logs [query]")
  .description("View server logs (Coolify, Docker, or system)")
  .option("-n, --lines <lines>", "Number of log lines to show", "50")
  .option("-f, --follow", "Follow log output in real-time")
  .option("-s, --service <service>", "Log service: coolify, docker, system", "coolify")
  .action(
    (query?: string, options?: { lines?: string; follow?: boolean; service?: string }) =>
      logsCommand(query, options),
  );

program
  .command("monitor [query]")
  .description("Show server resource usage (CPU, RAM, Disk)")
  .option("--containers", "Show Docker container list")
  .action(
    (query?: string, options?: { containers?: boolean }) => monitorCommand(query, options),
  );

program.command("health").description("Check health of all registered servers").action(healthCommand);

program
  .command("doctor")
  .description("Check your local environment and configuration")
  .option("--check-tokens", "Validate provider API tokens")
  .action((options?: { checkTokens?: boolean }) => doctorCommand(options, pkg.version));

program.parse();
