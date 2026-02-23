import { HetznerProvider } from "../providers/hetzner.js";
import { DigitalOceanProvider } from "../providers/digitalocean.js";
import { VultrProvider } from "../providers/vultr.js";
import { LinodeProvider } from "../providers/linode.js";
import type { CloudProvider } from "../providers/base.js";

export function createProvider(providerName: string): CloudProvider {
  switch (providerName) {
    case "hetzner":
      return new HetznerProvider("");
    case "digitalocean":
      return new DigitalOceanProvider("");
    case "vultr":
      return new VultrProvider("");
    case "linode":
      return new LinodeProvider("");
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
    case "vultr":
      return new VultrProvider(token);
    case "linode":
      return new LinodeProvider(token);
    /* istanbul ignore next */
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}
