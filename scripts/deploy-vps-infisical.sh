#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/bottrade}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
OBSERVABILITY_COMPOSE_FILE="${OBSERVABILITY_COMPOSE_FILE:-docker-compose.observability.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
INFISICAL_ENV="${INFISICAL_ENV:-prod}"
INFISICAL_PATH="${INFISICAL_PATH:-/}"

cd "${APP_DIR}"

if ! command -v infisical >/dev/null 2>&1; then
  echo "Infisical CLI is not installed. Install it on the VPS before using this deploy script."
  exit 1
fi

if [[ -z "${INFISICAL_TOKEN:-}" ]]; then
  echo "INFISICAL_TOKEN is not set. Export a machine identity token or service token before deploy."
  exit 1
fi

export INFISICAL_DISABLE_UPDATE_CHECK="${INFISICAL_DISABLE_UPDATE_CHECK:-true}"

git pull --ff-only

export_args=(--env="${INFISICAL_ENV}" --path="${INFISICAL_PATH}" --format=dotenv --output-file="${ENV_FILE}")
if [[ -n "${INFISICAL_PROJECT_ID:-}" ]]; then
  export_args+=(--projectId="${INFISICAL_PROJECT_ID}")
fi

infisical export "${export_args[@]}"
chmod 600 "${ENV_FILE}"

if [[ "${ENABLE_OBSERVABILITY:-false}" == "true" ]]; then
  docker compose -f "${COMPOSE_FILE}" -f "${OBSERVABILITY_COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --build
  docker compose -f "${COMPOSE_FILE}" -f "${OBSERVABILITY_COMPOSE_FILE}" --env-file "${ENV_FILE}" ps
else
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --build
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps
fi
