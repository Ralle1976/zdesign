#!/usr/bin/env bash
# Deploy the Z.Design showcase to the IONOS VPS (nginx). Re-run after every
# new generation (e.g. once the cream loop produces updated designs).
#
# Usage:  ZVPS_USER=<ssh-user> bash deploy/deploy-showcase.sh
# Default ZVPS_USER=root. Edit ZVPS_HOST/ZVPS_PATH if they change.
set -euo pipefail

ZVPS_USER="${ZVPS_USER:-root}"
ZVPS_HOST="87.106.9.85"
ZVPS_PATH="/var/www/zdesign-showcase"
LOCAL="showcase/"

if [ ! -d "$LOCAL" ]; then
  echo "✗ $LOCAL not found — run from the repo root (showcase/ must exist)."; exit 1
fi

echo "→ rsync $LOCAL → ${ZVPS_USER}@${ZVPS_HOST}:${ZVPS_PATH}/"
rsync -avz --delete "$LOCAL" "${ZVPS_USER}@${ZVPS_HOST}:${ZVPS_PATH}/"

echo "→ fix ownership + validate + reload nginx"
ssh "${ZVPS_USER}@${ZVPS_HOST}" "chown -R www-data:www-data ${ZVPS_PATH} && nginx -t && systemctl reload nginx"

echo "✓ live at https://z.design.ralle1976.cloud/"
