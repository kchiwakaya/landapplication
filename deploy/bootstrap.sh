#!/usr/bin/env bash
# ==============================================================================
# Hardened Server Bootstrap & Deployment Script for land.applications
# Target: p6060@10.100.7.189 (Internal Domain: land.applications)
# ==============================================================================
set -euo pipefail

APP_DIR="/opt/landapplication"
REPO_URL="https://github.com/kchiwakaya/landapplication.git"
DOMAIN="land.applications"
SERVER_IP="10.100.7.189"
APP_USER="${SUDO_USER:-p6060}"

echo "==> [1/6] Installing Docker, Git, and host hardening packages (ufw, fail2ban)..."
if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg git ufw fail2ban openssl
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$APP_USER"
else
  sudo apt-get update
  sudo apt-get install -y git ufw fail2ban openssl curl
  sudo usermod -aG docker "$APP_USER" || true
fi

echo "==> [2/6] Configuring UFW firewall & Fail2Ban (and freeing ports 80/443)..."
sudo systemctl disable --now nginx apache2 2>/dev/null || true
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw delete allow 8000/tcp 2>/dev/null || true
sudo ufw --force enable
sudo systemctl enable --now fail2ban || true

echo "==> [3/6] Registering internal domain ${DOMAIN} (${SERVER_IP}) in /etc/hosts..."
if ! grep -q "${DOMAIN}" /etc/hosts; then
  echo -e "127.0.0.1 ${DOMAIN}\n${SERVER_IP} ${DOMAIN}" | sudo tee -a /etc/hosts >/dev/null
fi

echo "==> [4/6] Preparing ${APP_DIR} and pulling repository..."
sudo mkdir -p "${APP_DIR}"
sudo chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

if [ ! -d "${APP_DIR}/.git" ]; then
  git clone "${REPO_URL}" "${APP_DIR}"
else
  git -C "${APP_DIR}" fetch origin main
  git -C "${APP_DIR}" reset --hard origin/main
fi

echo "==> [5/6] Generating hardened .env (mode 0600)..."
if [ ! -f "${APP_DIR}/.env" ]; then
  SECRET_KEY="$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 56)"
  DB_PASS="$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)"
  cat > "${APP_DIR}/.env" <<EOF
DJANGO_SECRET_KEY=${SECRET_KEY}
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=${DOMAIN},${SERVER_IP},localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://${DOMAIN},https://${DOMAIN},http://${SERVER_IP},https://${SERVER_IP}
CSRF_TRUSTED_ORIGINS=http://${DOMAIN},https://${DOMAIN},http://${SERVER_IP},https://${SERVER_IP}

POSTGRES_DB=land_applications
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${DB_PASS}

HTTP_PORT=80
HTTPS_PORT=443
SEED_DEMO=false
SEED_DEMO_COUNT=0
GUNICORN_WORKERS=3

# Farmer notifications (Google SMTP - fill in credentials to enable live email)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
DEFAULT_FROM_EMAIL=Ministry of Lands and Rural Development <noreply@lands.gov.zw>
EOF
  chmod 600 "${APP_DIR}/.env"
fi

echo "==> [6/6] Building and starting hardened Docker Compose stack..."
cd "${APP_DIR}"
sudo docker compose up -d --build --remove-orphans
sudo docker image prune -f

echo "==> Waiting for healthcheck on http://${DOMAIN}/api/health/ ..."
for i in $(seq 1 20); do
  if curl -fsS -H "Host: ${DOMAIN}" http://127.0.0.1/api/health/ >/dev/null 2>&1; then
    echo "==> SUCCESS: Application is live and healthy at http://${DOMAIN} and https://${DOMAIN}"
    sudo docker compose ps
    exit 0
  fi
  sleep 3
done

echo "==> WARNING: Healthcheck did not respond within timeout. Container status:"
sudo docker compose ps
sudo docker compose logs --tail=50
exit 1

