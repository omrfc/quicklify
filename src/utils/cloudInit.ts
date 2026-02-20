export function getCoolifyCloudInit(serverName: string): string {
  const safeName = serverName.replace(/[^a-z0-9-]/g, "");
  return `#!/bin/bash
set +e
touch /var/log/quicklify-install.log
chmod 600 /var/log/quicklify-install.log
exec > >(tee /var/log/quicklify-install.log) 2>&1

echo "=================================="
echo "Quicklify Auto-Installer"
echo "Server: ${safeName}"
echo "=================================="

# Wait for network connectivity (DO cloud-init may start before network is ready)
echo "Waiting for network connectivity..."
MAX_ATTEMPTS=30
ATTEMPTS=0
while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
  if curl -s --max-time 5 https://cdn.coollabs.io > /dev/null 2>&1; then
    echo "Network is ready!"
    break
  fi
  ATTEMPTS=$((ATTEMPTS + 1))
  echo "Network not ready (attempt $ATTEMPTS/$MAX_ATTEMPTS)..."
  sleep 2
done

# Update system
echo "Updating system packages..."
apt-get update -y

# Install Coolify
echo "Installing Coolify..."
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# Wait for services
echo "Waiting for Coolify services to start..."
sleep 30

# Configure firewall for Coolify
echo "Configuring firewall..."
if command -v ufw &> /dev/null; then
  # DigitalOcean and UFW-enabled systems
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 8000/tcp
  ufw allow 6001/tcp
  ufw allow 6002/tcp
  echo "y" | ufw enable || true
else
  # Hetzner and iptables-based systems
  iptables -A INPUT -p tcp --dport 8000 -j ACCEPT
  iptables -A INPUT -p tcp --dport 22 -j ACCEPT
  iptables -A INPUT -p tcp --dport 80 -j ACCEPT
  iptables -A INPUT -p tcp --dport 443 -j ACCEPT
  iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
  mkdir -p /etc/iptables
  iptables-save > /etc/iptables/rules.v4 || true
  DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent || true
fi

echo "=================================="
echo "Coolify installation completed!"
echo "=================================="
echo ""
echo "Please wait 3-5 more minutes for Coolify to fully initialize."
echo "Then access your instance at: http://YOUR_SERVER_IP:8000"
`;
}
