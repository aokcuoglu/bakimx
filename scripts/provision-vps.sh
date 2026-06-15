#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# BakimX — VPS Provisioning Script
# Run once on a fresh Ubuntu 24.04 VPS
# ──────────────────────────────────────────────

echo "=== BakimX VPS Provisioning ==="

# Update system
echo "[1/7] Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

# Install dependencies
echo "[2/7] Installing dependencies..."
apt-get install -y -qq ufw fail2ban curl git rclone

# Configure UFW
echo "[3/7] Configuring UFW..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
echo "y" | ufw enable

# Configure fail2ban
echo "[4/7] Configuring fail2ban..."
cat > /etc/fail2ban/jail.local << 'F2B'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
F2B
systemctl enable fail2ban && systemctl start fail2ban

# Create app directory
echo "[5/7] Creating app directory..."
mkdir -p /opt/bakimx/backups

# Create .env.production from example (user must fill in real values)
if [ ! -f /opt/bakimx/.env.production ]; then
  echo "[5/7] Creating .env.production template..."
  echo "REMEMBER: Edit /opt/bakimx/.env.production with real values!"
fi

# Setup daily backup cron
echo "[6/7] Setting up backup cron..."
cat > /opt/bakimx/backup.sh << 'BACKUP'
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="/opt/bakimx/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec bakimx-db-1 pg_dump -U bakimx bakimx > "${BACKUP_DIR}/bakimx_${TIMESTAMP}.sql"
gzip "${BACKUP_DIR}/bakimx_${TIMESTAMP}.sql"
# Keep only last 7 daily backups
find ${BACKUP_DIR} -name "bakimx_*.sql.gz" -mtime +7 -delete
echo "Backup completed: bakimx_${TIMESTAMP}.sql.gz"
BACKUP
chmod +x /opt/bakimx/backup.sh

(crontab -l 2>/dev/null; echo "0 3 * * * /opt/bakimx/backup.sh >> /var/log/bakimx-backup.log 2>&1") | crontab -

# Hardened SSH
echo "[7/7] Hardening SSH..."
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
systemctl restart ssh

echo ""
echo "=== Provisioning Complete ==="
echo "Next steps:"
echo "  1. Copy docker-compose.yml, Caddyfile, and .env.production to /opt/bakimx/"
echo "  2. Edit /opt/bakimx/.env.production with real values"
echo "  3. Run: cd /opt/bakimx && docker compose up -d"
echo "  4. Run: docker compose run --rm app npx prisma migrate deploy"
echo "  5. Point DNS A records to this server's IP"