// Provider-specific IP wait configuration (IP assignment latency varies significantly)
export const IP_WAIT: Record<string, { attempts: number; interval: number }> = {
  hetzner:      { attempts: 10, interval: 3000 },   // 30s (instant IP)
  digitalocean: { attempts: 20, interval: 3000 },   // 60s
  vultr:        { attempts: 40, interval: 5000 },   // 200s (slowest IP assignment)
  linode:       { attempts: 30, interval: 5000 },   // 150s
};

// Provider-specific minimum wait before first Coolify health check
export const COOLIFY_MIN_WAIT: Record<string, number> = {
  hetzner: 60000, digitalocean: 120000, vultr: 180000, linode: 120000,
};

// Server boot polling
export const BOOT_MAX_ATTEMPTS = 30;
export const BOOT_INTERVAL = 1000;

// Coolify commands
export const COOLIFY_UPDATE_CMD = "curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash";
export const COOLIFY_RESTART_CMD =
  "cd /data/coolify/source && docker compose -f docker-compose.yml -f docker-compose.prod.yml restart coolify";

// Coolify database/paths
export const COOLIFY_SOURCE_DIR = "/data/coolify/source";
export const COOLIFY_DB_CONTAINER = "coolify-db";
export const COOLIFY_DB_USER = "coolify";
export const COOLIFY_DB_NAME = "coolify";
