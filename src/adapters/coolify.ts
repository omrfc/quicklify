import type {
  PlatformAdapter,
  HealthResult,
  PlatformStatusResult,
  PlatformBackupResult,
} from "./interface.js";

export class CoolifyAdapter implements PlatformAdapter {
  readonly name = "coolify";

  getCloudInit(_serverName: string): string {
    throw new Error("CoolifyAdapter.getCloudInit not implemented yet");
  }

  async healthCheck(_ip: string): Promise<HealthResult> {
    throw new Error("CoolifyAdapter.healthCheck not implemented yet");
  }

  async createBackup(
    _ip: string,
    _serverName: string,
    _provider: string,
  ): Promise<PlatformBackupResult> {
    throw new Error("CoolifyAdapter.createBackup not implemented yet");
  }

  async getStatus(_ip: string): Promise<PlatformStatusResult> {
    throw new Error("CoolifyAdapter.getStatus not implemented yet");
  }
}
