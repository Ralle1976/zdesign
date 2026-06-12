# MCP Deployment Control Tower

This document describes the secure MCP/REST deployment layer added to Infra Control Tower.

For onboarding new projects from multiple AI/dev agents, see
`docs/agent-project-onboarding.md`. The request template lives at
`configs/project-request.example.json`.

## Architecture

- Control Tower API remains the central FastAPI service.
- Node Agent runs on each VPS and performs local Docker/Git actions.
- Project definitions live in `configs/projects.yml`.
- Redis stores live server/container/approval state.
- SQLite stores durable audit/run history at `AUDIT_DB_PATH`.
- MCP tools are exposed by `control-tower.api.mcp_server` and reuse the same project action code as REST.
- Docker Compose initializes the API data volume before the non-root API process starts.

## Security Model

- Use scoped API keys via `API_KEYS_JSON`; keep `API_KEY` only as a local/dev fallback.
- Scopes: `read`, `sync`, `build`, `deploy`, `rollback`, `agent`, `admin`.
- Keys can be restricted by `projects`, `environments`, and `expires_at`.
- HTTP MCP clients can pass per-agent keys with `Authorization: Bearer <token>`
  or `X-API-Key`; `MCP_API_KEY` remains only a process-level fallback.
- Node-agent heartbeats use an `agent`-scoped `AGENT_API_KEY` plus the per-server `AGENT_TOKEN`.
- Node-agent protected endpoints require an `AGENT_TOKEN` of at least 32 characters by default; production preflight rejects `AGENT_REQUIRE_TOKEN=false`.
- Agent tokens are loaded from `AGENT_TOKENS_JSON` and are not accepted in server registration/update payloads.
- Production deploys require a concrete `commit_sha`.
- Project actions use in-process project locks to prevent parallel deploy collisions.
- Node Agent refuses arbitrary repo paths unless `AGENT_ALLOWED_PROJECTS_JSON` allows them.
- Node Agent detects the mounted Docker socket group at startup and then runs as the non-root `agent` user.
- GitHub webhooks require `GITHUB_WEBHOOK_SECRET` and `X-Hub-Signature-256`.
- CORS is disabled by default unless `CORS_ALLOWED_ORIGINS` is set. Production preflight rejects wildcard origins.
- FastAPI docs and OpenAPI JSON are disabled by default; production preflight rejects `API_DOCS_ENABLED=true`.
- Mutating `/api/v1` HTTP requests are centrally audited, except project and GitHub webhook endpoints which write richer domain-specific audit events.
- CI and local release checks include `scripts/secret-scan.py` to catch likely committed API keys, service tokens and private keys.
- The previously hardcoded AI key must be considered compromised and rotated outside Git.

Example scoped key:

```json
{
  "codex-prod": {
    "token": "replace-with-long-random-token",
    "actor": "codex",
    "scopes": ["read", "sync", "build", "deploy", "rollback"],
    "projects": ["lyricflow"],
    "environments": ["production"],
    "expires_at": "2026-12-31T23:59:59Z"
  }
}
```

## Project Configuration

Project definitions are YAML:

```yaml
projects:
  - id: lyricflow
    name: LyricFlow Studio
    repo: Ralle1976/lyricflow-studio
    default_branch: main
    test_commands:
      - ["docker", "compose", "config"]
    build_commands: []
    deploy_commands: []
    locations:
      - server_id: ionos-srv2
        environment: production
        repo_path: /opt/lyricflow
        branch: main
        compose_file: docker-compose.yml
```

Commands must be arrays. The agent does not execute shell strings.

## REST Endpoints

- `GET /health`
- `GET /api/v1/projects`
- `GET /api/v1/projects/{project_id}/status`
- `POST /api/v1/projects/{project_id}/sync`
- `POST /api/v1/projects/{project_id}/build`
- `POST /api/v1/projects/{project_id}/deploy`
- `POST /api/v1/projects/{project_id}/rollback`
- `GET /api/v1/projects/{project_id}/logs`
- `GET /api/v1/audit`
- `POST /api/v1/github/webhook`

Example production deploy:

```bash
curl -X POST "https://control.example.com/api/v1/projects/lyricflow/deploy" \
  -H "X-API-Key: $CONTROL_TOWER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"environment":"production","commit_sha":"0123456789abcdef0123456789abcdef01234567"}'
```

## MCP Usage

Install dependencies and run the MCP server from the repo root:

```bash
pip install -e ".[dev]"
set MCP_API_KEY=replace-with-scoped-api-key
python -m control-tower.api.mcp_server
```

Available MCP tools:

- `status`
- `list_projects`
- `project_status`
- `sync_project`
- `build_project`
- `deploy_project`
- `rollback_project`
- `get_logs`

The Python test suite verifies that this exact MCP tool set is registered, that production deploy calls require `commit_sha`, and that MCP project listing/log access respects API-key project scope.

For HTTP-capable MCP clients, set:

```bash
set MCP_TRANSPORT=streamable-http
python -m control-tower.api.mcp_server
```

## Deployment Flow

1. Resolve project and location from YAML.
2. Check API key scope, project and environment.
3. Acquire project lock.
4. Ask the node-agent to run Git preflight.
5. Abort on local changes, missing remote branch, unavailable commit, or divergence risk.
6. Checkout the exact commit for production.
7. Run configured tests/build commands.
8. Run Docker Compose deploy or configured deploy commands.
9. Record audit event with actor, project, server, environment, commit, result and errors.

## Audit Logging

Project actions and GitHub webhooks write domain-specific audit events. Other mutating API requests under `/api/v1` are logged by HTTP middleware with actor, key id, method, path, status code and client address. Request bodies are not stored, and query/error fields are passed through secret redaction before persistence.

Audit events are available through `GET /api/v1/audit`. A read-scoped key can query its allowed `project_id`; global audit queries require `admin`.

## Rollback

Rollback accepts an explicit `commit_sha`. If omitted, the API attempts to use the latest successful audited deploy commit for that project. If no audited commit exists, rollback is rejected.

Control Tower itself uses release-directory rollback. After installing bundles with `scripts/install-release.sh`, switch back to the previous Control Tower release with:

```bash
bash scripts/rollback-release.sh --install-dir /opt/infra-control-tower --yes
```

The rollback script defaults to dry-run, does not delete releases, does not modify `.env`, and switches only `/opt/infra-control-tower/current`. Pass `--target-release <name>` to select a specific release or `--start` to run `setup-control-tower.sh` after switching.

## IONOS VPS Setup

1. Create a restricted deployment user where possible.
2. Install Docker Engine and Docker Compose plugin.
3. Clone this repository under `/opt/infra-control-tower`.
4. Run the local release gate from a trusted checkout before copying or starting the system:

```bash
bash scripts/local-release-check.sh
```

This bundles Python tests, linting, compile checks, shell syntax, secret scanning, release artifact packaging/verification, production env dry-run, Compose config checks, dashboard build and npm audit. It does not deploy and does not call SSH.

On Windows/WSL, avoid mixing Linux Node with Windows-installed `node_modules`. If needed, run `bash scripts/local-release-check.sh --skip-dashboard` and then run `npm run build` plus `npm audit --audit-level=moderate` from PowerShell in `control-tower/dashboard`.

Create a release bundle for review or transfer:

```bash
bash scripts/package-release.sh
```

The packaging script runs the secret scanner, refuses a dirty worktree unless `--allow-dirty` is passed, excludes Git metadata, env files, `node_modules`, build output, caches, databases and logs, and writes a tarball, JSON manifest and SHA256 checksum under `dist/release`. For the current in-progress checkout, `--allow-dirty` is acceptable only as an explicit handoff artifact; for production, prefer a clean committed worktree. Copy the tarball and `.sha256` file to the VPS, but install it only after the production `.env` exists.

Verify the release artifact before copying it:

```bash
bash scripts/verify-release-artifact.sh \
  --archive dist/release/<release>.tar.gz \
  --checksum dist/release/<release>.tar.gz.sha256
```

The verifier is read-only. It checks SHA256, safe tar paths, required runtime files, absence of env/Git/build/cache/log artifacts, and `RELEASE_MANIFEST.json` consistency. It rejects dirty manifests by default; use `--allow-dirty-manifest` only for an explicit non-production handoff.

Write a local release handoff report:

```bash
bash scripts/release-handoff-report.sh \
  --archive dist/release/<release>.tar.gz \
  --checksum dist/release/<release>.tar.gz.sha256 \
  --bundle dist/release/<branch>.bundle \
  --bundle-checksum dist/release/<branch>.bundle.sha256
```

The handoff report verifies the artifact again and writes Markdown/JSON evidence with commit, SHA256 values, manifest state and the next safe VPS commands. It is not the final production proof; the final proof is the post-install `go-live-report.sh` against the real HTTPS domain.

From a trusted local checkout, preview remote shipment and installation:

```bash
bash scripts/ship-release.sh \
  --ssh-target root@87.106.9.85 \
  --archive dist/release/<release>.tar.gz \
  --checksum dist/release/<release>.tar.gz.sha256 \
  --install-dir /opt/infra-control-tower \
  --ssh-key ~/.ssh/ionos_deploy \
  --ssh-connect-timeout 10 \
  --ssh-batch-mode
```

Re-run the same command with `--yes` to copy the tarball, checksum and installer to the VPS and call `install-release.sh` remotely. Add `--start` only when you intentionally want the installer to build/start services immediately.
`ship-release.sh` runs the same artifact verifier before any SSH/SCP operation. Passing `--allow-dirty-artifact` is possible for reviewed handoff bundles, but should not be used for production.
For non-default SSH setups, `ship-release.sh`, `vps-preflight.sh` and `go-live-check.sh` support `--ssh-key`, `--ssh-port`, `--ssh-connect-timeout` and `--ssh-batch-mode`.

5. Generate a production `.env` file or copy `.env.example` and replace all placeholders:

```bash
bash scripts/generate-production-env.sh \
  --domain control.example.org \
  --output .env \
  --project-id lyricflow \
  --server-id ionos-srv2 \
  --server-ip 87.106.9.85 \
  --repo-path /opt/lyricflow
```

The generator creates long random API keys, agent tokens, webhook secrets and dashboard passwords. It writes them only to the target env file and does not print them.
It creates separate keys for admin/control actions, Codex/MCP deployment actions and node-agent heartbeats.
If `--server-ip` is passed, it also writes a non-secret `AGENT_DEPLOY_TARGETS_JSON` entry for `scripts/migrate-from-ssh.sh`.
It also writes `SERVER_REGISTRATION_JSON` so server registration can be reviewed before being sent to the API.

6. Protect the env file:

```bash
chmod 600 .env
```

7. Install the copied release bundle from an existing trusted checkout or admin tools directory:

```bash
bash scripts/install-release.sh \
  --archive /tmp/infra-control-tower.tar.gz \
  --checksum /tmp/infra-control-tower.tar.gz.sha256 \
  --install-dir /opt/infra-control-tower \
  --env-file /opt/infra-control-tower/.env \
  --yes \
  --no-start
```

The installer verifies the checksum, rejects unsafe archive entries, extracts into `/opt/infra-control-tower/releases/<release>`, switches `/opt/infra-control-tower/current`, preserves `.env` outside the release directory, and defaults to dry-run unless `--yes` is passed. Run without `--no-start` only after the release and env preflight are reviewed.

8. If you build `.env` manually instead of using the generator, create long random values for all API keys, agent tokens, webhook secrets and dashboard passwords. For example:

```bash
openssl rand -hex 32
```

9. Put project repos under allowlisted paths such as `/opt/lyricflow`.
10. Configure the node-agent with `AGENT_ALLOWED_PROJECTS_JSON`.
11. Keep service ports bound to `127.0.0.1` unless a private network or firewall rule explicitly protects them.
12. Run the read-only VPS preflight before starting services or changing NGINX/TLS:

```bash
bash scripts/vps-preflight.sh \
  --ssh-target root@87.106.9.85 \
  --ssh-key ~/.ssh/ionos_deploy \
  --ssh-connect-timeout 10 \
  --ssh-batch-mode \
  --domain control.example.org \
  --control-tower-dir /opt/infra-control-tower \
  --project-path /opt/lyricflow
```

This checks Docker/Compose access, NGINX/Certbot availability, firewall hints, DNS-to-VPS matching, risky public service bindings, `.env` permissions, remote production preflight, Docker Compose config and clean project Git state. It is read-only and does not print secrets.

13. Run the production preflight before starting services:

```bash
bash scripts/production-preflight.sh .env
```

The preflight validates the env file without sourcing it and does not print secret values. It intentionally fails on `.env.example`.

14. Start services:

```bash
bash scripts/setup-control-tower.sh --env-file .env
```

Register known servers from a trusted admin machine:

```bash
export CONTROL_TOWER_URL=https://control.example.com
export CONTROL_TOWER_API_KEY=replace-with-admin-or-register-scope-key
bash scripts/register-servers.sh --servers-file configs/servers.example.json --dry-run
bash scripts/register-servers.sh --servers-file configs/servers.example.json --yes
```

`register-servers.sh` no longer contains hardcoded historical server IPs. It requires either `SERVER_REGISTRATION_JSON` or `--servers-file`, validates the payload, and supports `--dry-run`.

Deploy a node-agent to an IONOS VPS:

```bash
export AGENT_API_KEY=replace-with-agent-scoped-api-key
export AGENT_BIND=127.0.0.1
bash scripts/deploy-agent.sh \
  87.106.9.85 \
  9073 \
  ionos-srv2 \
  replace-with-agent-token \
  https://control.example.com \
  "$AGENT_API_KEY" \
  '{"lyricflow":{"repo_path":"/opt/lyricflow"}}'
```

The script transfers the locally built agent image over SSH, writes the remote agent env file under `/opt/infra-node-agent`, disables legacy path-based deploys, binds the agent to localhost by default and passes the repo allowlist to the remote agent. Keep `AGENT_BIND=127.0.0.1` unless a private network or firewall allowlist protects the port. Do not pass an admin API key as the agent heartbeat key.

For one or more agents, prefer the manifest-based migration helper. It parses `.env` as data, never sources it as shell code, reads per-server tokens from `AGENT_TOKENS_JSON`, and refuses to deploy unless targets are explicitly configured:

```bash
bash scripts/migrate-from-ssh.sh \
  --env-file .env \
  --targets-file configs/agent-targets.example.json \
  --dry-run

bash scripts/migrate-from-ssh.sh \
  --env-file .env \
  --targets-file configs/agent-targets.example.json \
  --yes
```

Use `configs/agent-targets.example.json` only as a template. Keep real server IPs, ports and allowed-project env names reviewed before running without `--dry-run`.

After starting a node-agent, confirm that it can see Docker while still running as UID 1000:

```bash
docker exec -u agent infra-node-agent id
docker exec -u agent infra-node-agent docker ps
docker exec infra-node-agent grep -E '^(Uid|Gid|Groups):' /proc/1/status
```

Run a production readiness check after startup or after every deployment:

```bash
export CONTROL_TOWER_URL=https://control.example.com
export CONTROL_TOWER_API_KEY=replace-with-read-scope-key
export DASHBOARD_URL=https://control.example.com
export AGENT_URL=http://127.0.0.1:9071
export PROJECT_ID=lyricflow
bash scripts/readiness-check.sh
```

The check verifies API health, project registry loading, optional project status/log access, optional dashboard reachability and optional node-agent health. It does not print API keys or agent tokens.

Before declaring the VPS live, run the stricter go-live acceptance check:

```bash
export CONTROL_TOWER_URL=https://control.example.com
export CONTROL_TOWER_API_KEY=replace-with-read-scope-key
export DASHBOARD_URL=https://control.example.com
export PROJECT_ID=lyricflow
bash scripts/go-live-check.sh \
  --ssh-target root@87.106.9.85 \
  --domain control.example.com \
  --project-path /opt/lyricflow
```

The go-live check requires HTTPS unless `--allow-http` is passed for local smoke checks. It verifies public health, rejection of unauthenticated project API calls, target project registry/status/log/audit access, that FastAPI docs are not publicly exposed, unsigned GitHub webhook rejection, optional dashboard reachability, optional node-agent health through a private route or SSH tunnel, and optional strict VPS preflight. Do not mark the service as production-ready until this check passes against the real domain and VPS.

Write a redacted evidence report for the handoff:

```bash
export CONTROL_TOWER_URL=https://control.example.com
export CONTROL_TOWER_API_KEY=replace-with-read-scope-key
export PROJECT_ID=lyricflow
bash scripts/go-live-report.sh -- \
  --ssh-target root@87.106.9.85 \
  --domain control.example.com \
  --project-path /opt/lyricflow
```

The report wrapper runs `go-live-check.sh`, redacts known token values, writes Markdown and JSON under `dist/go-live`, and exits with the same status as the underlying check. Keep the report as operational evidence, but do not paste API keys or agent tokens into it.

Recommended firewall posture:

- Public: 80/443 only through NGINX/Reverse Proxy.
- Control Tower API: bind to `127.0.0.1:8000` and expose only through HTTPS with API key.
- Redis: not public.
- Prometheus/Grafana: bind to localhost, VPN, or admin-only allowlist.
- Node Agent port 9071: private network/VPN/firewall allowlist only; default compose binding is localhost.
- SSH: key-only, restricted to admin/deploy users.

Generate a UFW baseline plan on the VPS before applying it:

```bash
sudo bash scripts/firewall-ufw.sh --admin-cidr 203.0.113.10/32
sudo ufw status numbered
```

Apply only from a stable SSH session after reviewing existing rules:

```bash
sudo bash scripts/firewall-ufw.sh --admin-cidr 203.0.113.10/32 --enable --yes
sudo ufw status numbered
```

The script defaults to dry-run, keeps SSH and public 80/443 reachable, does not reset or delete existing UFW rules, and requires explicit CIDRs for internal/admin ports such as 8000, 3001, 9071, 6379, 9090 or 3030. If old broad allow rules already exist, review and remove them manually after confirming you still have SSH access.

## NGINX and TLS

NGINX/Let's Encrypt automation is intentionally not enabled by default. Host-level NGINX files should be changed only through an explicit, reviewed operation because a bad proxy config can take unrelated services offline.

Render the prepared NGINX config from a trusted checkout:

```bash
bash scripts/render-nginx-config.sh control.example.com 8000 3001 \
  | sudo tee /etc/nginx/sites-available/control.example.com.conf
sudo ln -s /etc/nginx/sites-available/control.example.com.conf /etc/nginx/sites-enabled/control.example.com.conf
sudo nginx -t
sudo systemctl reload nginx
```

Issue or renew TLS certificates with Certbot after DNS points to the VPS:

```bash
sudo certbot --nginx -d control.example.com
sudo nginx -t
sudo systemctl reload nginx
```

Do not expose Redis, Prometheus, Grafana, or node-agent ports publicly to compensate for missing NGINX/TLS. Fix the proxy or firewall instead.

## Known Risks

- Docker socket access is powerful. Keep it limited to the node-agent and protect the agent port.
- Access to `/var/run/docker.sock` is effectively host-root. The agent runs as a non-root Linux user, but the Docker socket itself must still be treated as a high-privilege capability.
- Scoped auto-deploy is intentionally enabled by policy, but it increases blast radius if a deploy key leaks.
- Rotate any secret that was ever committed or pasted into source code.
