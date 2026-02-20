import axios from "axios";
import type { CloudProvider } from "./base.js";
import type { Region, ServerSize, ServerConfig, ServerResult } from "../types/index.js";

interface DORegion {
  slug: string;
  name: string;
  available: boolean;
}

interface DOSize {
  slug: string;
  memory: number;
  vcpus: number;
  disk: number;
  price_monthly: number;
  available: boolean;
  regions: string[];
}

interface DOErrorResponse {
  id: string;
  message: string;
}

export class DigitalOceanProvider implements CloudProvider {
  name = "digitalocean";
  displayName = "DigitalOcean";
  private apiToken: string;
  private baseUrl = "https://api.digitalocean.com/v2";

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/account`, {
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
        `${this.baseUrl}/droplets`,
        {
          name: config.name,
          size: config.size,
          region: config.region,
          image: "ubuntu-22-04-x64",
          user_data: config.cloudInit,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      const droplet = response.data.droplet;
      const ip =
        droplet.networks?.v4?.find((n: { type: string }) => n.type === "public")?.ip_address ||
        "pending";

      return {
        id: droplet.id.toString(),
        ip,
        status: droplet.status,
      };
    } catch (error: unknown) {
      if (axios.isAxiosError<DOErrorResponse>(error)) {
        throw new Error(
          `Failed to create server: ${error.response?.data?.message || error.message}`,
        );
      }
      throw new Error(
        `Failed to create server: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getServerDetails(serverId: string): Promise<ServerResult> {
    const response = await axios.get(`${this.baseUrl}/droplets/${serverId}`, {
      headers: { Authorization: `Bearer ${this.apiToken}` },
    });
    const droplet = response.data.droplet;
    const ip =
      droplet.networks?.v4?.find((n: { type: string }) => n.type === "public")?.ip_address ||
      "pending";
    return {
      id: droplet.id.toString(),
      ip,
      status: droplet.status === "active" ? "running" : droplet.status,
    };
  }

  async getServerStatus(serverId: string): Promise<string> {
    try {
      const response = await axios.get(`${this.baseUrl}/droplets/${serverId}`, {
        headers: { Authorization: `Bearer ${this.apiToken}` },
      });
      // Normalize DO status: "active" → "running" (init.ts checks for "running")
      const doStatus: string = response.data.droplet.status;
      return doStatus === "active" ? "running" : doStatus;
    } catch (error: unknown) {
      throw new Error(
        `Failed to get server status: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async destroyServer(serverId: string): Promise<void> {
    try {
      await axios.delete(`${this.baseUrl}/droplets/${serverId}`, {
        headers: { Authorization: `Bearer ${this.apiToken}` },
      });
    } catch (error: unknown) {
      if (axios.isAxiosError<DOErrorResponse>(error)) {
        throw new Error(
          `Failed to destroy server: ${error.response?.data?.message || error.message}`,
        );
      }
      throw new Error(
        `Failed to destroy server: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  getRegions(): Region[] {
    return [
      { id: "nyc1", name: "New York 1", location: "USA" },
      { id: "sfo3", name: "San Francisco 3", location: "USA" },
      { id: "ams3", name: "Amsterdam 3", location: "Netherlands" },
      { id: "sgp1", name: "Singapore 1", location: "Singapore" },
      { id: "lon1", name: "London 1", location: "UK" },
      { id: "fra1", name: "Frankfurt 1", location: "Germany" },
    ];
  }

  getServerSizes(): ServerSize[] {
    // Minimum 2GB RAM required for Coolify
    return [
      { id: "s-2vcpu-2gb", name: "Basic 2GB", vcpu: 2, ram: 2, disk: 60, price: "$12/mo" },
      { id: "s-2vcpu-4gb", name: "Basic 4GB", vcpu: 2, ram: 4, disk: 80, price: "$24/mo" },
      { id: "s-4vcpu-8gb", name: "General 8GB", vcpu: 4, ram: 8, disk: 160, price: "$48/mo" },
    ];
  }

  async getAvailableLocations(): Promise<Region[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/regions`, {
        headers: { Authorization: `Bearer ${this.apiToken}` },
      });
      return response.data.regions
        .filter((r: DORegion) => r.available)
        .map((r: DORegion) => ({
          id: r.slug,
          name: r.name,
          location: r.slug,
        }));
    } catch {
      return this.getRegions();
    }
  }

  async getAvailableServerTypes(location: string): Promise<ServerSize[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/sizes`, {
        headers: { Authorization: `Bearer ${this.apiToken}` },
      });

      const MIN_RAM_MB = 2048; // Coolify requires at least 2GB RAM
      const MIN_VCPUS = 2; // Coolify requires at least 2 CPUs
      const sizes = response.data.sizes.filter(
        (s: DOSize) =>
          s.available && s.regions.includes(location) && s.memory >= MIN_RAM_MB && s.vcpus >= MIN_VCPUS,
      );

      if (sizes.length === 0) {
        return this.getServerSizes();
      }

      return sizes.map((s: DOSize) => ({
        id: s.slug,
        name: s.slug.toUpperCase(),
        vcpu: s.vcpus,
        ram: s.memory / 1024,
        disk: s.disk,
        price: `$${s.price_monthly.toFixed(2)}/mo`,
      }));
    } catch {
      return this.getServerSizes();
    }
  }
}
