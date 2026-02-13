#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init.js";

const program = new Command();

program
  .name("quicklify")
  .description("Automate Coolify deployment on cloud providers")
  .version("0.1.0");

program
  .command("init")
  .description("Deploy a new Coolify instance on a cloud provider")
  .action(initCommand);

program.parse();
