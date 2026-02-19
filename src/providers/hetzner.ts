import axios from "axios";
import type { CloudProvider } from "./base.js";
import type { Region, ServerSize, ServerConfig, ServerResult } from "../types/index.js";

interface HetznerLocation {
  name: string;
  city: string;
  country: string;
}

interface HetznerPrice {
  location: string;
  price_monthly: {
    net: string;
    gross: string;
  };
}

interface HetznerServerType {
  id: number;
  name: string;
  cores: number;
  memory: number;
  disk: number;
  deprecation: unknown;
  prices: HetznerPrice[];
}

interface HetznerDatacenter {
  name: string;
  location: { name: string };
  server_types: { available: number[] };
}

interface HetznerErrorResponse {
  error: {
    message: string;
  };
}

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
    } catch (error: unknown) {
      if (axios.isAxiosError<HetznerErrorResponse>(error)) {
        throw new Error(
          `Failed to create server: ${error.response?.data?.error?.message || error.message}`,
        );
      }
      throw new Error(
        `Failed to create server: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getServerDetails(serverId: string): Promise<ServerResult> {
    const response = await axios.get(`${this.baseUrl}/servers/${serverId}`, {
      headers: { Authorization: `Bearer ${this.apiToken}` },
    });
    return {
      id: response.data.server.id.toString(),
      ip: response.data.server.public_net.ipv4.ip,
      status: response.data.server.status,
    };
  }

  async getServerStatus(serverId: string): Promise<string> {
    try {
      const response = await axios.get(`${this.baseUrl}/servers/${serverId}`, {
        headers: { Authorization: `Bearer ${this.apiToken}` },
      });
      return response.data.server.status;
    } catch (error: unknown) {
      throw new Error(
        `Failed to get server status: ${error instanceof Error ? error.message : String(error)}`,
      );
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
      { id: "cax11", name: "CAX11", vcpu: 2, ram: 4, disk: 40, price: "€3.79/mo" },
      { id: "cx23", name: "CX23", vcpu: 2, ram: 4, disk: 40, price: "€3.49/mo" },
      { id: "cax21", name: "CAX21", vcpu: 4, ram: 8, disk: 80, price: "€6.49/mo" },
      { id: "cx33", name: "CX33", vcpu: 4, ram: 8, disk: 80, price: "€5.49/mo" },
    ];
  }

  async getAvailableLocations(): Promise<Region[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/locations`, {
        headers: { Authorization: `Bearer ${this.apiToken}` },
      });
      return response.data.locations.map((loc: HetznerLocation) => ({
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
      // Get actually available server type IDs from datacenter
      const dcResponse = await axios.get(`${this.baseUrl}/datacenters`, {
        headers: { Authorization: `Bearer ${this.apiToken}` },
      });
      const datacenter = dcResponse.data.datacenters.find(
        (dc: HetznerDatacenter) => dc.location.name === location,
      );
      const availableIds: number[] = datacenter?.server_types?.available || [];

      // Get server type details
      const response = await axios.get(`${this.baseUrl}/server_types`, {
        headers: { Authorization: `Bearer ${this.apiToken}` },
      });

      const MIN_RAM_GB = 2; // Coolify requires at least 2GB RAM
      const types = response.data.server_types.filter(
        (type: HetznerServerType) =>
          !type.deprecation &&
          type.memory >= MIN_RAM_GB &&
          availableIds.includes(type.id) &&
          type.prices.some((p: HetznerPrice) => p.location === location),
      );

      if (types.length === 0) {
        return this.getServerSizes();
      }

      return types.map((type: HetznerServerType) => {
        const price = type.prices.find((p: HetznerPrice) => p.location === location);
        const rawPrice = price?.price_monthly?.net;
        const priceMonthly = rawPrice ? parseFloat(rawPrice).toFixed(2) : "N/A";

        return {
          id: type.name,
          name: type.name.toUpperCase(),
          vcpu: type.cores,
          ram: type.memory,
          disk: type.disk,
          price: `€${priceMonthly}/mo`,
        };
      });
    } catch {
      return this.getServerSizes();
    }
  }
}
