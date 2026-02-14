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

# Open port 8000 for Coolify web interface
echo "Configuring firewall..."
iptables -A INPUT -p tcp --dport 8000 -j ACCEPT
iptables -A INPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables-save > /etc/iptables/rules.v4
DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent

echo "=================================="
echo "Coolify installation completed!"
echo "=================================="
echo ""
echo "Please wait 2-3 more minutes for Coolify to fully initialize."
echo "Then access your instance at: https://YOUR_SERVER_IP:8000"
`;
}
