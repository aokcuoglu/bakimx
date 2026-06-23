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
cd /opt/bakimx
BACKUP_DIR="/opt/bakimx/backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Resolve the db container dynamically (robust against compose project-name drift,
# so this never silently breaks like a hardcoded "bakimx-db-1" would).
DB_CONTAINER=$(docker compose --env-file .env.production ps -q db)
[ -n "$DB_CONTAINER" ] || { echo "ERROR: db container not running"; exit 1; }

# Read DB name/user + optional offsite remote without sourcing the whole env file.
PGUSER=$(grep -E '^POSTGRES_USER=' .env.production | cut -d= -f2- | tr -d '"'); PGUSER="${PGUSER:-bakimx}"
PGDB=$(grep -E '^POSTGRES_DB=' .env.production | cut -d= -f2- | tr -d '"'); PGDB="${PGDB:-bakimx}"
RCLONE_REMOTE=$(grep -E '^BAKIMX_RCLONE_REMOTE=' .env.production | cut -d= -f2- | tr -d '"' || true)

OUT="${BACKUP_DIR}/bakimx_${TIMESTAMP}.sql.gz"
# --clean --if-exists makes the dump restorable in-place (see scripts/restore-db.sh)
docker exec "$DB_CONTAINER" pg_dump --clean --if-exists -U "$PGUSER" "$PGDB" | gzip > "$OUT"

# Keep only last 7 daily backups locally
find "$BACKUP_DIR" -name "bakimx_*.sql.gz" -mtime +7 -delete

# Optional OFFSITE copy: set BAKIMX_RCLONE_REMOTE in .env.production (e.g. r2:bakimx-backups)
# after configuring rclone (already installed). Without it, backups die with the VPS disk.
if [ -n "${RCLONE_REMOTE:-}" ] && command -v rclone >/dev/null; then
  rclone copy "$OUT" "$RCLONE_REMOTE" && echo "Offsite copy -> $RCLONE_REMOTE"
fi
echo "Backup completed: $OUT"
BACKUP
chmod +x /opt/bakimx/backup.sh

# 03:15 (not 03:00) to avoid I/O clashing with getirbakim's own 03:00 backup cron.
(crontab -l 2>/dev/null | grep -v '/opt/bakimx/backup.sh'; echo "15 3 * * * /opt/bakimx/backup.sh >> /var/log/bakimx-backup.log 2>&1") | crontab -

# Hardened SSH
echo "[7/7] Hardening SSH..."
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
systemctl restart ssh

echo ""
echo "=== Provisioning Complete ==="
echo "Next steps (see DEPLOY.md + DB.md for detail):"
echo "  1. Copy docker-compose.yml and .env.production to /opt/bakimx/ (no Caddyfile —"
echo "     routing is owned by the getirbakim Nginx; add an app.bakimx.com server block there)."
echo "  2. Edit /opt/bakimx/.env.production with real values."
echo "  3. Run: cd /opt/bakimx && docker compose up -d"
echo "  4. First-ever DB: docker compose run --rm app npx --yes prisma@7.8.0 migrate deploy"
echo "     Existing (db-push'd) DB: ... migrate resolve --applied 0_init   (baseline, no data touched)"
echo "  5. Point DNS A record app.bakimx.com -> this server's IP."