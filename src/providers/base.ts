import type { Region, ServerSize, ServerConfig, ServerResult } from "../types/index.js";

export interface CloudProvider {
  name: string;
  displayName: string;
  validateToken(token: string): Promise<boolean>;
  getRegions(): Region[];
  getServerSizes(): ServerSize[];
  createServer(config: ServerConfig): Promise<ServerResult>;
  getServerStatus(serverId: string): Promise<string>;
}
