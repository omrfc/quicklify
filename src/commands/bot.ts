import type { Command } from "commander";
import { startBot } from "../core/bot/bot.js";

export function botCommand(program: Command): void {
  const bot = program
    .command("bot")
    .description("Telegram bot management");

  bot
    .command("start")
    .description("Start Telegram bot (foreground, Ctrl+C to stop)")
    .action(async () => {
      await startBot();
    });
}
