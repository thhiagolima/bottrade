#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/bottrade}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"

cd "${APP_DIR}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${APP_DIR}/${ENV_FILE}. Copy .env.production.example to ${ENV_FILE} and fill secrets first."
  exit 1
fi

git pull --ff-only
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --build
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps
