# Infrastructure Control Tower

Autonomous infrastructure management API with AI-powered decision making.

## MCP Deployment Control Tower

This repo now includes a secure MCP/REST deployment layer for IONOS VPS operation:

- YAML-backed project registry in `configs/projects.yml`
- scoped API keys for AI/Codex tools
- safe Git preflight before sync/deploy
- production deploys pinned to commit SHAs
- node-agent repo path allowlist
- SQLite audit history
- admin-controlled audit log API
- production go-live acceptance check
- dry-run-first UFW firewall baseline for VPS ports
- MCP tools for `status`, `list_projects`, `project_status`, `sync_project`, `build_project`, `deploy_project`, `rollback_project`, and `get_logs`

See `docs/mcp-deployment-control-tower.md` for setup, security model, API usage, rollback and IONOS VPS notes.
See `docs/agent-project-onboarding.md` for the recommended multi-agent onboarding flow, access tiers, and two-IONOS operating model.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Control Tower API                            │
│  ┌──────────┐ ┌───────────┐ ┌───────────┐ ┌──────────┐ ┌─────┐  │
│  │ Servers  │ │ Containers│ │ Deployments│ │  Backups │ │ AI  │  │
│  └──────────┘ └───────────┘ └───────────┘ └──────────┘ └─────┘  │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐ │
│  │                    Notification Service                    │ │
│  │              (Telegram, Email, Slack, etc.)                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│ Node Agent 1│      │ Node Agent 2│      │ Node Agent N│
│  (hostinger)│      │ (ionos-srv1)│      │             │
└─────────────┘      └─────────────┘      └─────────────┘
```

## Quick Start

### Using Docker Compose

```bash
# Clone and start
cd infra-control-tower
bash scripts/local-release-check.sh
bash scripts/package-release.sh
bash scripts/verify-release-artifact.sh --archive dist/release/<release>.tar.gz --checksum dist/release/<release>.tar.gz.sha256
bash scripts/release-handoff-report.sh --archive dist/release/<release>.tar.gz --checksum dist/release/<release>.tar.gz.sha256
# On the VPS, prepare .env before the remote install:
bash scripts/generate-production-env.sh --domain control.example.org --output .env
# From the trusted local checkout, dry-run first, then repeat with --yes:
bash scripts/ship-release.sh --ssh-target root@your-vps --archive dist/release/<release>.tar.gz --checksum dist/release/<release>.tar.gz.sha256
# For non-interactive VPS checks/transfers, add e.g.:
#   --ssh-key ~/.ssh/ionos_deploy --ssh-port 22 --ssh-connect-timeout 10 --ssh-batch-mode
# Review .env and adjust project/server values where needed.
bash scripts/vps-preflight.sh --ssh-target root@your-vps --domain control.example.org --project-path /opt/lyricflow
# On the VPS, dry-run first, then apply only after reviewing existing rules:
sudo bash scripts/firewall-ufw.sh --admin-cidr <your-admin-ip>/32
sudo bash scripts/firewall-ufw.sh --admin-cidr <your-admin-ip>/32 --enable --yes
bash scripts/setup-control-tower.sh --env-file .env
bash scripts/register-servers.sh --servers-file configs/servers.example.json --dry-run
bash scripts/migrate-from-ssh.sh --env-file .env --targets-file configs/agent-targets.example.json --dry-run
CONTROL_TOWER_URL=https://control.example.org CONTROL_TOWER_API_KEY=replace-with-read-key PROJECT_ID=lyricflow \
  bash scripts/go-live-check.sh --ssh-target root@your-vps --domain control.example.org --project-path /opt/lyricflow
CONTROL_TOWER_URL=https://control.example.org CONTROL_TOWER_API_KEY=replace-with-read-key PROJECT_ID=lyricflow \
  bash scripts/go-live-report.sh -- --ssh-target root@your-vps --domain control.example.org --project-path /opt/lyricflow

# Check health
curl http://localhost:8000/health
```

### Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -e ".[dev]"

# Run the server
uvicorn control-tower.api.main:app --reload --port 8000
```

## API Endpoints

### Servers
- `GET /api/v1/servers` - List all servers
- `GET /api/v1/servers/{id}` - Get server details
- `POST /api/v1/servers` - Register new server
- `DELETE /api/v1/servers/{id}` - Unregister server
- `POST /api/v1/servers/{id}/heartbeat` - Server heartbeat

### Containers
- `GET /api/v1/servers/{server_id}/containers` - List containers
- `GET /api/v1/servers/{server_id}/containers/{name}/stats` - Container stats
- `GET /api/v1/servers/{server_id}/containers/{name}/logs` - Container logs
- `POST /api/v1/servers/{server_id}/containers/{name}/restart` - Restart container
- `POST /api/v1/servers/{server_id}/containers/{name}/stop` - Stop container
- `POST /api/v1/servers/{server_id}/containers/{name}/start` - Start container

### Deployments
- `GET /api/v1/deployments` - List deployments
- `GET /api/v1/deployments/{id}` - Get deployment details
- `POST /api/v1/deployments` - Create deployment
- `POST /api/v1/deployments/{id}/start` - Start deployment
- `POST /api/v1/deployments/{id}/complete` - Mark completed
- `POST /api/v1/deployments/{id}/rollback` - Rollback deployment

### Backups
- `GET /api/v1/backups` - List backups
- `GET /api/v1/backups/{id}` - Get backup details
- `POST /api/v1/backups` - Create backup
- `POST /api/v1/backups/{id}/restore` - Restore backup

### Approvals
- `GET /api/v1/approvals` - List approval requests
- `GET /api/v1/approvals/{id}` - Get approval details
- `POST /api/v1/approvals` - Create approval request
- `POST /api/v1/approvals/{id}/respond` - Approve/reject
- `DELETE /api/v1/approvals/{id}` - Cancel approval

### AI
- `POST /api/v1/ai/query` - Query AI brain
- `GET /api/v1/ai/decisions` - Recent AI decisions
- `POST /api/v1/ai/decisions` - Record AI decision
- `POST /api/v1/ai/approve-action` - Approve AI action

### Audit
- `GET /api/v1/audit` - Query audit events; global queries require admin scope

## Authentication

All API endpoints (except `/health`) require the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key" http://localhost:8000/api/v1/servers
```

## Environment Variables

See `.env.example` for all configuration options.

| Variable | Description | Default |
|----------|-------------|---------|
| `API_KEY` | Master API key | `dev-api-key` |
| `API_DOCS_ENABLED` | Enable `/docs`, `/redoc`, and `/openapi.json`; keep false in production | `false` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | - |
| `TELEGRAM_CHAT_ID` | Telegram chat ID | - |
| `S3_ENDPOINT` | S3 endpoint URL | - |
| `S3_ACCESS_KEY` | S3 access key | - |
| `S3_SECRET_KEY` | S3 secret key | - |
| `S3_BUCKET` | S3 bucket name | `infra-backups` |
| `AGENT_API_KEY` | Agent-scoped heartbeat API key | - |
| `AGENT_TOKENS_JSON` | Per-node agent tokens by `node_id`; minimum 32 characters | - |
| `AGENT_DEPLOY_TARGETS_JSON` | Optional explicit node-agent deployment targets | `[]` |
| `SERVER_REGISTRATION_JSON` | Optional explicit Control Tower server registrations | `[]` |
| `CORS_ALLOWED_ORIGINS` | Browser origins allowed to call the API | - |

## Project Structure

```
infra-control-tower/
├── control-tower/
│   ├── api/
│   │   ├── core/          # Config, security
│   │   ├── models/        # Pydantic models
│   │   ├── routers/       # API routes
│   │   └── services/      # Business logic
│   ├── dashboard/         # Web dashboard (future)
│   ├── Dockerfile
│   └── docker-compose.yml
├── node-agent/           # Agent binary (future)
├── shared/               # Shared types and schemas
├── scripts/              # Utility scripts (future)
├── pyproject.toml
└── README.md
```

## Development

```bash
# Run tests
pytest

# Run linting
ruff check .

# Format code
ruff format .
```

## CI

GitHub Actions runs the same core checks used for local release confidence:
Python tests, Ruff, compile checks, shell syntax checks, production env dry-runs,
secret scanning, release artifact verification, Docker Compose config, dashboard
build, and `npm audit`. The Python suite includes MCP tool registration and
API-key scope regression tests. The same local bundle can be run with
`bash scripts/local-release-check.sh`. The
production `bash scripts/go-live-check.sh` is syntax-checked in CI and should be
run against the real VPS before declaring the system live.

Create a reviewed transfer artifact with `bash scripts/package-release.sh`.
The package excludes Git metadata, env files, `node_modules`, build outputs,
caches, databases and logs, and writes a manifest plus SHA256 checksum next to
the tarball.

Verify an artifact before copying it with
`bash scripts/verify-release-artifact.sh --archive <tar.gz> --checksum <tar.gz.sha256>`.
The verifier checks SHA256, tar path safety, required runtime files, forbidden
generated/secret paths and manifest consistency. Dirty manifests are rejected
unless `--allow-dirty-manifest` is passed for an explicit non-production handoff.

Write a local handoff packet with
`bash scripts/release-handoff-report.sh --archive <tar.gz> --checksum <tar.gz.sha256>`.
It verifies the artifact and stores Markdown/JSON evidence with commit, SHA256,
manifest state, optional git bundle checksum and next safe VPS commands.

Copy and install a release over SSH with
`bash scripts/ship-release.sh --ssh-target <user@host> --archive <tar.gz> --checksum <tar.gz.sha256>`.
It defaults to dry-run, verifies the release artifact, stages the archive and
installer on the VPS, and calls `install-release.sh` remotely only with `--yes`.
Use `--ssh-key`, `--ssh-port`, `--ssh-connect-timeout` and `--ssh-batch-mode`
for reproducible non-interactive VPS automation.

Write a redacted go-live evidence report with `bash scripts/go-live-report.sh`.
It runs `go-live-check.sh`, stores Markdown and JSON under `dist/go-live`, and
exits with the same status as the underlying check.

Prepare the recommended VPS firewall baseline with
`sudo bash scripts/firewall-ufw.sh`. It defaults to dry-run, keeps SSH plus
80/443 reachable, does not reset UFW, and requires explicit CIDRs for internal
ports such as 8000, 3001, 9071, 6379, 9090 or 3030.

Install a copied release artifact on the VPS with
`bash scripts/install-release.sh --archive <tar.gz> --checksum <tar.gz.sha256> --yes`.
The installer defaults to dry-run, verifies the archive, extracts into
`/opt/infra-control-tower/releases`, switches `/opt/infra-control-tower/current`,
and preserves `/opt/infra-control-tower/.env` outside the release directory.

Rollback the Control Tower release symlink with
`bash scripts/rollback-release.sh --yes`. It defaults to the previous release
and does not delete release directories or modify `.env`.

On Windows/WSL, keep Node/npm and `node_modules` on the same platform. If the
dashboard dependencies were installed with Windows Node, run
`bash scripts/local-release-check.sh --skip-dashboard` and verify the dashboard
from PowerShell with `npm run build` and `npm audit --audit-level=moderate`.

## License

Private - All rights reserved.
