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

If `www.gamingbr.pro` also points to the VPS, install the certificate with:

```bash
sudo DOMAIN=gamingbr.pro INCLUDE_WWW=1 APP_HTTP_PORT=8088 EMAIL=admin@gamingbr.pro bash scripts/install-cert.sh
```
