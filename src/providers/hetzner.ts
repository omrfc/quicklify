import axios from "axios";
import type { CloudProvider } from "./base.js";
import type { Region, ServerSize, ServerConfig, ServerResult } from "../types/index.js";

export class HetznerProvider implements CloudProvider {
  name = "hetzner";
  displayName = "Hetzner Cloud";
  private apiToken: string;
  private baseUrl = "https://api.hetzner.cloud/v1";

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/servers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return true;
    } catch {
      return false;
    }
  }

  async createServer(config: ServerConfig): Promise<ServerResult> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/servers`,
        {
          name: config.name,
          server_type: config.size,
          location: config.region,
          image: "ubuntu-24.04",
          user_data: config.cloudInit,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      return {
        id: response.data.server.id.toString(),
        ip: response.data.server.public_net.ipv4.ip,
        status: response.data.server.status,
      };
    } catch (error: any) {
      throw new Error(
        `Failed to create server: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  async getServerStatus(serverId: string): Promise<string> {
    try {
      const response = await axios.get(`${this.baseUrl}/servers/${serverId}`, {
        headers: { Authorization: `Bearer ${this.apiToken}` },
      });
      return response.data.server.status;
    } catch (error: any) {
      throw new Error(`Failed to get server status: ${error.message}`);
    }
  }

  getRegions(): Region[] {
    return [
      { id: "nbg1", name: "Nuremberg", location: "Germany" },
      { id: "fsn1", name: "Falkenstein", location: "Germany" },
      { id: "hel1", name: "Helsinki", location: "Finland" },
      { id: "ash", name: "Ashburn", location: "USA" },
    ];
  }

  getServerSizes(): ServerSize[] {
    return [
      { id: "cax11", name: "CAX11", vcpu: 2, ram: 4, disk: 40, price: "€3.85/mo", recommended: true },
      { id: "cpx11", name: "CPX11", vcpu: 2, ram: 2, disk: 40, price: "€4.15/mo" },
      { id: "cax21", name: "CAX21", vcpu: 4, ram: 8, disk: 80, price: "€7.05/mo" },
      { id: "cpx21", name: "CPX21", vcpu: 3, ram: 4, disk: 80, price: "€7.35/mo" },
    ];
  }

  async getAvailableLocations(): Promise<Region[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/locations`, {
        headers: { Authorization: `Bearer ${this.apiToken}` },
      });
      return response.data.locations.map((loc: any) => ({
        id: loc.name,
        name: loc.city,
        location: loc.country,
      }));
    } catch {
      return this.getRegions();
    }
  }

  async getAvailableServerTypes(location: string): Promise<ServerSize[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/server_types`, {
        headers: { Authorization: `Bearer ${this.apiToken}` },
      });

      const types = response.data.server_types.filter((type: any) =>
        type.prices.some((p: any) => p.location === location),
      );

      if (types.length === 0) {
        return this.getServerSizes();
      }

      return types.map((type: any) => {
        const price = type.prices.find((p: any) => p.location === location);
        const rawPrice = price?.price_monthly?.gross;
        const priceMonthly = rawPrice ? parseFloat(rawPrice).toFixed(2) : "N/A";
        const isRecommended = type.name === "cax11";

        return {
          id: type.name,
          name: type.name.toUpperCase(),
          vcpu: type.cores,
          ram: type.memory,
          disk: type.disk,
          price: `€${priceMonthly}/mo`,
          ...(isRecommended && { recommended: true }),
        };
      });
    } catch {
      return this.getServerSizes();
    }
  }
}
