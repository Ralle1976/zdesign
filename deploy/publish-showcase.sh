#!/usr/bin/env bash
# Publish the showcase SOURCE to Ralle1976/zdesign-showcase (the git source of
# truth the Control-Tower node-agent pulls). The actual DEPLOY is `deploy_project`
# via the Control Tower (git pull + docker compose up), NOT this script.
set -euo pipefail
cd "$(dirname "$0")/../showcase"
git add -A
git -c user.name="Ralle1976" -c user.email="Ralle1976@users.noreply.github.com" \
  commit -m "showcase update $(date -u +%Y-%m-%dT%H:%M:%SZ)" || echo "(nothing to commit)"
git push origin main
echo "✓ source pushed → github.com/Ralle1976/zdesign-showcase"
echo "→ now deploy via Control Tower: deploy_project(project_id=zdesign-showcase, commit_sha=<HEAD>, environment=production, server_id=ionos-srv2)"
