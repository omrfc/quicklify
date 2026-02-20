import type { Region, ServerSize, ServerConfig, ServerResult } from "../types/index.js";

export interface CloudProvider {
  name: string;
  displayName: string;
  validateToken(token: string): Promise<boolean>;
  getRegions(): Region[];
  getServerSizes(): ServerSize[];
  getAvailableLocations(): Promise<Region[]>;
  getAvailableServerTypes(location: string): Promise<ServerSize[]>;
  createServer(config: ServerConfig): Promise<ServerResult>;
  getServerStatus(serverId: string): Promise<string>;
  getServerDetails(serverId: string): Promise<ServerResult>;
  destroyServer(serverId: string): Promise<void>;
  rebootServer(serverId: string): Promise<void>;
}
