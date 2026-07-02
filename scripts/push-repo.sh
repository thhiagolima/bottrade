#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-}"
BRANCH="${BRANCH:-main}"
COMMIT_MESSAGE="${COMMIT_MESSAGE:-Prepare production deploy}"

if [[ -z "${REPO_URL}" ]]; then
  echo "Usage: REPO_URL=git@github.com:user/repo.git bash scripts/push-repo.sh"
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git init
fi

git add .

if ! git diff --cached --quiet; then
  git commit -m "${COMMIT_MESSAGE}"
fi

git branch -M "${BRANCH}"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "${REPO_URL}"
else
  git remote add origin "${REPO_URL}"
fi

git push -u origin "${BRANCH}"
