#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-gamingbr.pro}"
APP_HTTP_PORT="${APP_HTTP_PORT:-8088}"
EMAIL="${EMAIL:-admin@$DOMAIN}"
INCLUDE_WWW="${INCLUDE_WWW:-0}"
SITE_NAME="${SITE_NAME:-bottrade}"
NGINX_AVAILABLE="/etc/nginx/sites-available/${SITE_NAME}.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/${SITE_NAME}.conf"
SERVER_NAMES="${DOMAIN}"

if [[ "${INCLUDE_WWW}" == "1" ]]; then
  SERVER_NAMES="${DOMAIN} www.${DOMAIN}"
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo DOMAIN=${DOMAIN} APP_HTTP_PORT=${APP_HTTP_PORT} bash scripts/install-cert.sh"
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  apt-get update
  apt-get install -y nginx
fi

if ! command -v certbot >/dev/null 2>&1; then
  apt-get update
  apt-get install -y certbot python3-certbot-nginx
fi

cat > "${NGINX_AVAILABLE}" <<CONF
server {
    listen 80;
    listen [::]:80;
    server_name ${SERVER_NAMES};

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:${APP_HTTP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:${APP_HTTP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
CONF

ln -sfn "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"
nginx -t
systemctl reload nginx

CERT_DOMAINS=(-d "${DOMAIN}")
if [[ "${INCLUDE_WWW}" == "1" ]]; then
  CERT_DOMAINS+=(-d "www.${DOMAIN}")
fi

certbot --nginx \
  "${CERT_DOMAINS[@]}" \
  --non-interactive \
  --agree-tos \
  --email "${EMAIL}" \
  --redirect

systemctl reload nginx
echo "Certificate installed. Open https://${DOMAIN}"
