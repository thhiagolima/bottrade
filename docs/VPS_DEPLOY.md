# Deploy VPS

Production domain: `gamingbr.pro`

The production compose file exposes the app only on `127.0.0.1:8088`.
The public HTTPS entrypoint is the host Nginx configured by `scripts/install-cert.sh`.
This avoids taking over ports `80` and `443` from other Docker projects.

## First deploy

Push the project to your Git provider first:

```bash
git init
git add .
git commit -m "Prepare production deploy"
git branch -M main
git remote add origin REPLACE_WITH_REPO_URL
git push -u origin main
```

Then, on the VPS:

```bash
sudo mkdir -p /opt/bottrade
sudo chown -R "$USER:$USER" /opt/bottrade
git clone REPLACE_WITH_REPO_URL /opt/bottrade
cd /opt/bottrade

cp .env.production.example .env.production
nano .env.production

docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
sudo DOMAIN=gamingbr.pro APP_HTTP_PORT=8088 EMAIL=admin@gamingbr.pro bash scripts/install-cert.sh
```

## Updates

```bash
cd /opt/bottrade
bash scripts/deploy-vps.sh
```

## Updates with Infisical

Use this flow after adding production secrets to Infisical and creating a read-only token for the VPS:

```bash
cd /opt/bottrade
export INFISICAL_TOKEN=REPLACE_WITH_MACHINE_IDENTITY_OR_SERVICE_TOKEN
export INFISICAL_PROJECT_ID=REPLACE_WITH_PROJECT_ID
export INFISICAL_ENV=prod
bash scripts/deploy-vps-infisical.sh
```

To also start Grafana Alloy log forwarding, include:

```bash
export ENABLE_OBSERVABILITY=true
bash scripts/deploy-vps-infisical.sh
```

The script writes `.env.production` from Infisical with `chmod 600`, then runs Docker Compose with the same production compose file used by the manual deploy.

## Existing Docker Reverse Proxy

If another Docker project already owns ports `80` and `443`, do not run `scripts/install-cert.sh`.
Use the existing proxy and connect Bottrade to the same Docker network.

Find the proxy container and network:

```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}" | grep -E '0.0.0.0:80|0.0.0.0:443'
docker inspect PROXY_CONTAINER_NAME --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}'
```

Start Bottrade attached to that network:

```bash
cd /opt/bottrade
PROXY_NETWORK=REPLACE_WITH_PROXY_NETWORK \
docker compose -f docker-compose.prod.yml -f docker-compose.proxy.yml --env-file .env.production up -d --build
```

Then configure the existing proxy:

```text
Domain: gamingbr.pro
Forward host/upstream: bottrade-client
Forward port: 80
WebSocket support: enabled
SSL: request/enable certificate for gamingbr.pro
Force HTTPS: enabled
```

If the proxy is Nginx Proxy Manager, create a new Proxy Host with the values above.
If it is Traefik, add the equivalent router/service labels in the proxy project.

If `www.gamingbr.pro` also points to the VPS, install the certificate with:

```bash
sudo DOMAIN=gamingbr.pro INCLUDE_WWW=1 APP_HTTP_PORT=8088 EMAIL=admin@gamingbr.pro bash scripts/install-cert.sh
```
