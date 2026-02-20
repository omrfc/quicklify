import axios from "axios";
import { createSpinner } from "./logger.js";

export async function waitForCoolify(
  ip: string,
  minWaitMs: number,
  pollIntervalMs: number = 5000,
  maxAttempts: number = 60,
): Promise<boolean> {
  const spinner = createSpinner("Installing Coolify...");
  spinner.start();

  // Minimum wait for cloud-init to start
  await new Promise((resolve) => setTimeout(resolve, minWaitMs));

  spinner.text = "Waiting for Coolify to be ready...";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await axios.get(`http://${ip}:8000`, {
        timeout: 5000,
        validateStatus: () => true,
      });
      spinner.succeed("Coolify is ready!");
      return true;
    } catch {
      // Connection refused = Coolify not running yet
      spinner.text = `Waiting for Coolify... (attempt ${attempt}/${maxAttempts})`;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }
  }

  spinner.warn("Coolify did not respond in time");
  return false;
}
