export function getCoolifyCloudInit(serverName: string): string {
  return `#!/bin/bash
set -e

echo "=================================="
echo "Quicklify Auto-Installer"
echo "Server: ${serverName}"
echo "=================================="

# Update system
echo "Updating system packages..."
apt-get update -y

# Install Coolify
echo "Installing Coolify..."
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# Wait for services
echo "Waiting for Coolify services to start..."
sleep 30

echo "=================================="
echo "Coolify installation completed!"
echo "=================================="
echo ""
echo "Please wait 2-3 more minutes for Coolify to fully initialize."
echo "Then access your instance at: https://YOUR_SERVER_IP:8000"
`;
}
