import type { CloudProvider } from "./base.js";
import type { Region, ServerSize, ServerConfig, ServerResult } from "../types/index.js";

export class DigitalOceanProvider implements CloudProvider {
  name = "digitalocean";
  displayName = "DigitalOcean";
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  async validateToken(_token: string): Promise<boolean> {
    // TODO: Implement DigitalOcean API call
    return false;
  }

  getRegions(): Region[] {
    // TODO: Implement DigitalOcean regions
    return [];
  }

  getServerSizes(): ServerSize[] {
    // TODO: Implement DigitalOcean server sizes
    return [];
  }

  async createServer(_config: ServerConfig): Promise<ServerResult> {
    // TODO: Implement DigitalOcean API call
    throw new Error("Not implemented");
  }

  async getServerStatus(_serverId: string): Promise<string> {
    // TODO: Implement DigitalOcean API call
    return "unknown";
  }
}
