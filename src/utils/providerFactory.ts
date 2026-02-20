import { HetznerProvider } from "../providers/hetzner.js";
import { DigitalOceanProvider } from "../providers/digitalocean.js";
import type { CloudProvider } from "../providers/base.js";

export function createProvider(providerName: string): CloudProvider {
  switch (providerName) {
    case "hetzner":
      return new HetznerProvider("");
    case "digitalocean":
      return new DigitalOceanProvider("");
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}

export function createProviderWithToken(providerName: string, token: string): CloudProvider {
  switch (providerName) {
    case "hetzner":
      return new HetznerProvider(token);
    case "digitalocean":
      return new DigitalOceanProvider(token);
    /* istanbul ignore next */
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}
