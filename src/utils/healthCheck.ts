import axios from "axios";
import { createSpinner } from "./logger.js";

export async function waitForCoolify(
  ip: string,
  minWaitMs: number,
  pollIntervalMs: number = 5000,
  maxAttempts: number = 60,
  port: number = 8000,
): Promise<boolean> {
  const platformName = port === 3000 ? "Dokploy" : "Coolify";
  const spinner = createSpinner(`Installing ${platformName}...`);
  spinner.start();

  // Minimum wait for cloud-init to start
  await new Promise((resolve) => setTimeout(resolve, minWaitMs));

  spinner.text = `Waiting for ${platformName} to be ready...`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await axios.get(`http://${ip}:${port}`, {
        timeout: 5000,
        validateStatus: () => true,
      });
      spinner.succeed(`${platformName} is ready!`);
      return true;
    } catch {
      // Connection refused = platform not running yet
      spinner.text = `Waiting for ${platformName}... (attempt ${attempt}/${maxAttempts})`;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }
  }

  spinner.warn(`${platformName} did not respond in time`);
  return false;
}
