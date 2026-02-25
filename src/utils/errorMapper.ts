import axios from "axios";

interface ProviderUrls {
  token: string;
  billing: string;
}

const PROVIDER_URLS: Record<string, ProviderUrls> = {
  hetzner: {
    token: "https://console.hetzner.cloud/projects → API Tokens",
    billing: "https://console.hetzner.cloud/billing",
  },
  digitalocean: {
    token: "https://cloud.digitalocean.com/account/api/tokens",
    billing: "https://cloud.digitalocean.com/account/billing",
  },
  vultr: {
    token: "https://my.vultr.com/settings/#settingsapi",
    billing: "https://my.vultr.com/billing",
  },
  linode: {
    token: "https://cloud.linode.com/profile/tokens",
    billing: "https://cloud.linode.com/account/billing",
  },
};

export function getProviderDisplayName(provider: string): string {
  const names: Record<string, string> = {
    hetzner: "Hetzner Cloud",
    digitalocean: "DigitalOcean",
    vultr: "Vultr",
    linode: "Linode (Akamai)",
  };
  return names[provider] || provider;
}

export function mapProviderError(error: unknown, provider: string): string {
  const urls = PROVIDER_URLS[provider];
  const displayName = getProviderDisplayName(provider);

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    if (status === 401 || status === 403) {
      const tokenUrl = urls?.token || "your provider dashboard";
      return `API token is invalid or expired. Generate a new Read & Write token from ${tokenUrl}`;
    }

    if (status === 402) {
      const billingUrl = urls?.billing || "your provider billing page";
      return `Insufficient account balance. Add funds at ${billingUrl}`;
    }

    if (status === 404) {
      return "Resource not found. The server may have been deleted or the ID is incorrect.";
    }

    if (status === 409) {
      return "Resource conflict. This name or resource may already be in use.";
    }

    if (status === 422) {
      return "Invalid request parameters. Please check your input and try again.";
    }

    if (status === 429) {
      return `${displayName} rate limit exceeded. Wait a moment and try again.`;
    }

    if (status && status >= 500) {
      return `${displayName} API is experiencing issues (HTTP ${status}). Try again later.`;
    }

    // Network errors (no response, only for actual axios errors with a code)
    if (!error.response && error.code) {
      if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        return `Cannot reach ${displayName} API. Check your internet connection.`;
      }
      if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") {
        return `${displayName} API request timed out. Check your connection and try again.`;
      }
      return `Network error connecting to ${displayName}. Check your internet connection.`;
    }
  }

  // Check for common error message patterns
  const message = error instanceof Error ? error.message : String(error);

  if (/insufficient.*(balance|fund|credit)/i.test(message)) {
    const billingUrl = urls?.billing || "your provider billing page";
    return `Insufficient account balance. Add funds at ${billingUrl}`;
  }

  if (/unavailable|not available|sold out/i.test(message)) {
    return "This server type is not available in the selected region. Try a different size or region.";
  }

  return "";
}
