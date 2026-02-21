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
  sshKeyIds?: string[];
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
  fullSetup?: boolean;
}

export interface QuicklifyConfig {
  provider?: string;
  region?: string;
  size?: string;
  name?: string;
}

// Firewall
export type FirewallProtocol = "tcp" | "udp";
export interface FirewallRule {
  port: number;
  protocol: FirewallProtocol;
  action: "ALLOW" | "DENY";
  from: string;
}
export interface FirewallStatus {
  active: boolean;
  rules: FirewallRule[];
}

// Secure
export interface SshdSetting {
  key: string;
  value: string;
  status: "secure" | "insecure" | "missing";
}
export interface SecureAuditResult {
  passwordAuth: SshdSetting;
  rootLogin: SshdSetting;
  fail2ban: { installed: boolean; active: boolean };
  sshPort: number;
}

// Backup
export interface BackupManifest {
  serverName: string;
  serverIp: string;
  provider: string;
  timestamp: string;
  coolifyVersion: string;
  files: string[];
}
