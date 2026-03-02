import axios from "axios";
import type {
  Region,
  ServerSize,
  ServerConfig,
  ServerResult,
  SnapshotInfo,
  ServerMode,
} from "../types/index.js";

export interface CloudProvider {
  name: string;
  displayName: string;
  validateToken(token: string): Promise<boolean>;
  getRegions(): Region[];
  getServerSizes(): ServerSize[];
  getAvailableLocations(): Promise<Region[]>;
  getAvailableServerTypes(location: string, mode?: ServerMode): Promise<ServerSize[]>;
  uploadSshKey(name: string, publicKey: string): Promise<string>;
  createServer(config: ServerConfig): Promise<ServerResult>;
  getServerStatus(serverId: string): Promise<string>;
  getServerDetails(serverId: string): Promise<ServerResult>;
  destroyServer(serverId: string): Promise<void>;
  rebootServer(serverId: string): Promise<void>;
  createSnapshot(serverId: string, name: string): Promise<SnapshotInfo>;
  listSnapshots(serverId: string): Promise<SnapshotInfo[]>;
  deleteSnapshot(snapshotId: string): Promise<void>;
  getSnapshotCostEstimate(serverId: string): Promise<string>;
}

export function stripSensitiveData(error: unknown): void {
  if (axios.isAxiosError(error)) {
    if (error.config) {
      error.config.headers = undefined as unknown as typeof error.config.headers;
      error.config.data = undefined;
    }
    (error as unknown as Record<string, unknown>).request = undefined;
  }
}
