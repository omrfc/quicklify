/**
 * Audit category name constants.
 * Single source of truth for CHECK_REGISTRY category name strings.
 * Using as-const prevents typos in new check files and enables type narrowing.
 */

export const AUDIT_CATEGORIES = {
  SSH: "SSH",
  FIREWALL: "Firewall",
  UPDATES: "Updates",
  AUTH: "Auth",
  DOCKER: "Docker",
  NETWORK: "Network",
  FILESYSTEM: "Filesystem",
  LOGGING: "Logging",
  KERNEL: "Kernel",
  ACCOUNTS: "Accounts",
  SERVICES: "Services",
  BOOT: "Boot",
  SCHEDULING: "Scheduling",
  TIME: "Time",
  BANNERS: "Banners",
  CRYPTO: "Crypto",
  FILE_INTEGRITY: "File Integrity",
  MALWARE: "Malware",
  MAC: "MAC",
  MEMORY: "Memory",
  SECRETS: "Secrets",
  CLOUD_METADATA: "Cloud Metadata",
  SUPPLY_CHAIN: "Supply Chain",
  BACKUP_HYGIENE: "Backup Hygiene",
  RESOURCE_LIMITS: "Resource Limits",
  INCIDENT_READINESS: "Incident Readiness",
  DNS_SECURITY: "DNS Security",
  TLS_HARDENING: "TLS Hardening",
  HTTP_HEADERS: "HTTP Security Headers",
  WAF: "WAF & Reverse Proxy",
  DDOS: "DDoS Hardening",
} as const;

export type AuditCategoryName = (typeof AUDIT_CATEGORIES)[keyof typeof AUDIT_CATEGORIES];
