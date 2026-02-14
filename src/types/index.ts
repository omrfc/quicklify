export interface Region {
  id: string;
  name: string;
  location: string;
}

export interface ServerSize {
  id: string;
  name: string;
  vcpu: number;
  ram: number;
  disk: number;
  price: string;
}

export interface ServerConfig {
  name: string;
  size: string;
  region: string;
  cloudInit: string;
}

export interface ServerResult {
  id: string;
  ip: string;
  status: string;
}

export interface DeploymentConfig {
  provider: string;
  apiToken: string;
  region: string;
  serverSize: string;
  serverName: string;
}
