import axios from "axios";
import { apiClient, stripSensitiveData, withProviderErrorHandling, assertValidServerId, type CloudProvider } from "./base.js";
import { withRetry } from "../utils/retry.js";
import type { Region, ServerSize, ServerConfig, ServerResult, SnapshotInfo, ServerMode } from "../types/index.js";

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

function extractDOError(data: unknown): string | undefined {
  const d = data as DOErrorResponse | undefined;
  return d?.message;
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
      await withRetry(async () => {
        await apiClient.get(`${this.baseUrl}/account`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      });
      return true;
    } catch {
      return false;
    }
  }

  async uploadSshKey(name: string, publicKey: string): Promise<string> {
    try {
      const response = await apiClient.post(
        `${this.baseUrl}/account/keys`,
        { name, public_key: publicKey },
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      return response.data.ssh_key.id.toString();
    } catch (error: unknown) {
      stripSensitiveData(error);
      // Key already exists → find by matching public key
      if (axios.isAxiosError(error) && error.response?.status === 422) {
        const listResponse = await apiClient.get(`${this.baseUrl}/account/keys?per_page=200`, {
          headers: { Authorization: `Bearer ${this.apiToken}` },
        });
        const existing = listResponse.data.ssh_keys.find(
          (k: { public_key: string }) => k.public_key.trim() === publicKey.trim(),
        );
        if (existing) return existing.id.toString();
      }
      throw new Error(
        `Failed to upload SSH key: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }

  async createServer(config: ServerConfig): Promise<ServerResult> {
    return withProviderErrorHandling("create server", async () => {
      const body: Record<string, unknown> = {
        name: config.name,
        size: config.size,
        region: config.region,
        image: "ubuntu-24-04-x64",
        user_data: config.cloudInit,
      };
      if (config.sshKeyIds?.length) {
        body.ssh_keys = config.sshKeyIds.map(Number);
      }
      const response = await apiClient.post(`${this.baseUrl}/droplets`, body, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
      });

      const droplet = response.data.droplet;
      const ip =
        droplet.networks?.v4?.find((n: { type: string }) => n.type === "public")?.ip_address ||
        "pending";

      return {
        id: droplet.id.toString(),
        ip,
        status: droplet.status,
      };
    }, extractDOError);
  }

  async getServerDetails(serverId: string): Promise<ServerResult> {
    assertValidServerId(serverId);
    return withProviderErrorHandling("get server details", () =>
      withRetry(async () => {
        const response = await apiClient.get(`${this.baseUrl}/droplets/${serverId}`, {
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
      }),
    );
  }

  async getServerStatus(serverId: string): Promise<string> {
    assertValidServerId(serverId);
    return withProviderErrorHandling("get server status", () =>
      withRetry(async () => {
        const response = await apiClient.get(`${this.baseUrl}/droplets/${serverId}`, {
          headers: { Authorization: `Bearer ${this.apiToken}` },
        });
        // Normalize DO status: "active" → "running" (init.ts checks for "running")
        const doStatus: string = response.data.droplet.status;
        return doStatus === "active" ? "running" : doStatus;
      }),
    );
  }

  async destroyServer(serverId: string): Promise<void> {
    assertValidServerId(serverId);
    return withProviderErrorHandling("destroy server", async () => {
      await apiClient.delete(`${this.baseUrl}/droplets/${serverId}`, {
        headers: { Authorization: `Bearer ${this.apiToken}` },
      });
    }, extractDOError);
  }

  async rebootServer(serverId: string): Promise<void> {
    assertValidServerId(serverId);
    return withProviderErrorHandling("reboot server", async () => {
      await apiClient.post(
        `${this.baseUrl}/droplets/${serverId}/actions`,
        { type: "reboot" },
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
        },
      );
    }, extractDOError);
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
      return await withRetry(async () => {
        const response = await apiClient.get(`${this.baseUrl}/regions`, {
          headers: { Authorization: `Bearer ${this.apiToken}` },
        });
        return response.data.regions
          .filter((r: DORegion) => r.available)
          .map((r: DORegion) => ({
            id: r.slug,
            name: r.name,
            location: r.slug,
          }));
      });
    } catch (error: unknown) {
      stripSensitiveData(error);
      return this.getRegions();
    }
  }

  async getAvailableServerTypes(location: string, mode?: ServerMode): Promise<ServerSize[]> {
    try {
      return await withRetry(async () => {
        const response = await apiClient.get(`${this.baseUrl}/sizes`, {
          headers: { Authorization: `Bearer ${this.apiToken}` },
        });

        const MIN_RAM_MB = mode === "bare" ? 0 : 2048; // Coolify requires at least 2GB RAM, bare has no minimum
        const MIN_VCPUS = mode === "bare" ? 0 : 2; // Coolify requires at least 2 CPUs
        const sizes = response.data.sizes.filter(
          (s: DOSize) =>
            s.available &&
            s.regions.includes(location) &&
            s.memory >= MIN_RAM_MB &&
            s.vcpus >= MIN_VCPUS,
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
      });
    } catch (error: unknown) {
      stripSensitiveData(error);
      return this.getServerSizes();
    }
  }

  async createSnapshot(serverId: string, name: string): Promise<SnapshotInfo> {
    assertValidServerId(serverId);
    return withProviderErrorHandling("create snapshot", async () => {
      await apiClient.post(
        `${this.baseUrl}/droplets/${serverId}/actions`,
        { type: "snapshot", name },
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      // DO snapshot creation is async; return a pending snapshot info
      return {
        id: "pending",
        serverId,
        name,
        status: "pending",
        sizeGb: 0,
        createdAt: new Date().toISOString(),
        costPerMonth: "pending",
      };
    }, extractDOError);
  }

  async listSnapshots(serverId: string): Promise<SnapshotInfo[]> {
    assertValidServerId(serverId);
    return withProviderErrorHandling("list snapshots", () =>
      withRetry(async () => {
        const response = await apiClient.get(
          `${this.baseUrl}/droplets/${serverId}/snapshots?per_page=100`,
          { headers: { Authorization: `Bearer ${this.apiToken}` } },
        );
        return response.data.snapshots.map(
          (snap: { id: number; name: string; size_gigabytes: number; created_at: string }) => ({
            id: snap.id.toString(),
            serverId,
            name: snap.name,
            status: "available",
            sizeGb: snap.size_gigabytes,
            createdAt: snap.created_at,
            costPerMonth: `$${(snap.size_gigabytes * 0.06).toFixed(2)}/mo`,
          }),
        );
      }),
    extractDOError);
  }

  async deleteSnapshot(snapshotId: string): Promise<void> {
    assertValidServerId(snapshotId);
    return withProviderErrorHandling("delete snapshot", async () => {
      await apiClient.delete(`${this.baseUrl}/snapshots/${snapshotId}`, {
        headers: { Authorization: `Bearer ${this.apiToken}` },
      });
    }, extractDOError);
  }

  async getSnapshotCostEstimate(serverId: string): Promise<string> {
    assertValidServerId(serverId);
    return withProviderErrorHandling("get snapshot cost", () =>
      withRetry(async () => {
        const response = await apiClient.get(`${this.baseUrl}/droplets/${serverId}`, {
          headers: { Authorization: `Bearer ${this.apiToken}` },
        });
        const diskGb = response.data.droplet.disk;
        return `$${(diskGb * 0.06).toFixed(2)}/mo`;
      }),
    extractDOError);
  }
}
