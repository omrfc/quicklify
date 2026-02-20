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

export interface ServerRecord {
  id: string;
  name: string;
  provider: string;
  ip: string;
  region: string;
  size: string;
  createdAt: string;
}

export interface InitOptions {
  provider?: string;
  token?: string;
  region?: string;
  size?: string;
  name?: string;
}

export interface QuicklifyConfig {
  provider?: string;
  region?: string;
  size?: string;
  name?: string;
}
