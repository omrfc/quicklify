import { exec } from "child_process";

const SAFE_URL_PATTERN = /^https?:\/\/[\d.]+(?::\d+)?\/?$/;

function isHeadlessEnvironment(): boolean {
  // CI environments
  if (process.env.CI || process.env.GITHUB_ACTIONS) return true;
  // Docker / containers
  if (process.env.DOCKER_CONTAINER || process.env.container) return true;
  // SSH sessions
  if (process.env.SSH_CONNECTION || process.env.SSH_TTY) return true;
  // Linux without display
  if (
    process.platform === "linux" &&
    !process.env.DISPLAY &&
    !process.env.WAYLAND_DISPLAY
  ) {
    return true;
  }
  return false;
}

function getOpenCommand(): string | null {
  switch (process.platform) {
    case "darwin":
      return "open";
    case "win32":
      return "start";
    case "linux":
      return "xdg-open";
    default:
      return null;
  }
}

export function isValidBrowserUrl(url: string): boolean {
  return SAFE_URL_PATTERN.test(url);
}

export function canOpenBrowser(): boolean {
  if (isHeadlessEnvironment()) return false;
  return getOpenCommand() !== null;
}

export function openBrowser(url: string): void {
  if (!isValidBrowserUrl(url)) return;
  if (!canOpenBrowser()) return;

  const command = getOpenCommand();
  /* istanbul ignore next */
  if (!command) return;

  // Windows 'start' requires empty title string to handle URLs
  const fullCommand =
    process.platform === "win32"
      ? `${command} "" "${url}"`
      : `${command} "${url}"`;

  exec(fullCommand, () => {
    // Silent failure by design — browser open is best-effort
  });
}
