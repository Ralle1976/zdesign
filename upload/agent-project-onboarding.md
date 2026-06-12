# Agent Project Onboarding Runbook

This runbook defines the practical operating model for connecting new projects
from different AI/dev agents without giving those agents broad server access.

## Operating Model

- Control Tower is the only deployment gate. Agents do not receive SSH, root
  access, Docker socket access, or global production secrets.
- GitHub is the source of truth. Production deployments must reference an
  explicit commit SHA, not just a moving branch name.
- Every agent uses its own scoped API key from `API_KEYS_JSON`.
- Every node-agent uses its own per-server token from `AGENT_TOKENS_JSON`.
- Every project path must be allowlisted on the target node-agent via
  `AGENT_ALLOWED_PROJECTS_JSON`.
- All mutating operations must be audited with actor, project, environment,
  commit, result, and error details.

The simple rule: agents may request actions; Control Tower decides whether the
request is allowed; node-agents execute only for allowlisted paths.

## Recommended Two-IONOS Topology

Use one IONOS server as the control plane and both IONOS servers as deployment
workers:

- `ionos-control`: Control Tower API, Dashboard, audit database, reverse proxy.
- `ionos-srv1`: node-agent for projects hosted on server 1.
- `ionos-srv2`: node-agent for projects hosted on server 2.

If the control plane also hosts projects, it should run a local node-agent too.
The current example config contains `ionos-srv2`; add `ionos-srv1` only after
its IP address, SSH key, role, domains, and SSH host key fingerprint are known.

Agent network exposure should stay narrow:

- Same server: bind node-agent to `127.0.0.1`.
- Cross-server: prefer private networking or VPN. If that is not available,
  firewall the node-agent port so only the Control Tower server can reach it.
- Public internet: expose only HTTPS through NGINX. Do not expose Redis,
  Grafana, Prometheus, Docker, or node-agent ports publicly.

## Access Tiers

Use separate keys per agent and per responsibility:

- `observer`: `read` only, limited to selected projects.
- `builder`: `read`, `sync`, `build`, usually staging only.
- `deployer`: `read`, `sync`, `build`, `deploy`, limited to one project and
  one environment. Production still requires `commit_sha`.
- `rollbacker`: `read`, `rollback`, restricted to trusted operators.
- `admin`: human/admin use only. Do not give admin keys to AI agents.

Example deployment key:

```json
{
  "agent-lyricflow-prod": {
    "token_sha256": "sha256-of-agent-token",
    "actor": "codex-lyricflow",
    "scopes": ["read", "sync", "build", "deploy"],
    "projects": ["lyricflow"],
    "environments": ["production"],
    "expires_at": "2026-12-31T23:59:59Z"
  }
}
```

Prefer `token_sha256` in production env files when possible. Keep the plaintext
token only in the client-side secret store.

## MCP And REST Access

REST is the most explicit multi-agent interface because each request carries
its own `X-API-Key`.

HTTP MCP also supports per-agent authentication:

- `Authorization: Bearer <agent-api-key>`
- or `X-API-Key: <agent-api-key>`

If neither header is present, the MCP server falls back to `MCP_API_KEY`. That
fallback is useful for local single-client operation, but shared production MCP
access should use per-agent headers so audit and scope checks identify the real
actor.

## New Project Request

Every new project should arrive as a small reviewed request, not as ad-hoc SSH
commands. Required fields:

- `project_id`: stable lowercase identifier.
- `repo`: GitHub `owner/name`.
- `default_branch`: branch used when no branch is specified.
- `target_server_id`: configured server id.
- `environment`: `production`, `staging`, or `development`.
- `repo_path`: absolute path under a narrow prefix such as `/opt/<project_id>`.
- `compose_file`: usually `docker-compose.yml`.
- `test_commands`: commands that must pass before deployment.
- `build_commands`: optional build commands.
- `deploy_commands`: optional override commands; empty means Docker Compose
  deploy flow.
- `domain`: optional public domain/subdomain.
- `healthcheck_url`: optional post-deploy health URL.
- `requested_scopes`: the minimum scopes needed by the requesting agent.

Review checklist before accepting:

- The GitHub repo and branch are correct.
- The target server is correct for the intended environment.
- The repo path is not broad, not shared, and not user-writable by unrelated
  services.
- Commands are arrays of strings, not shell strings.
- The project has no secrets committed to Git.
- Any required runtime secrets are documented for the server `.env` or secret
  store.
- Domain, NGINX, TLS, and ports are understood before production traffic moves.
- Rollback target is known: previous successful commit or an explicit SHA.

## Onboarding Steps

1. Agent or developer opens a project request manifest.
2. Admin reviews repo, branch, target server, commands, domain, and required
   secrets.
3. Add the project to `configs/projects.yml`.
4. Add the project path to the target server's `AGENT_ALLOWED_PROJECTS_JSON`.
5. Add or rotate a scoped API key in `API_KEYS_JSON` for that agent/project.
6. Ensure the target server is registered in `SERVER_REGISTRATION_JSON` or via
   the server API.
7. Verify SSH host keys and install/update the node-agent on the target server.
8. Run `project_status` and confirm the Git preflight is clean.
9. Run `sync_project` and `build_project`.
10. Deploy production only with an explicit `commit_sha`.
11. Check logs, audit events, and health URL.

## Deployment Flow For Agents

Agents should follow this order:

1. Push work to GitHub.
2. Provide the exact commit SHA intended for deployment.
3. Call `project_status`.
4. Call `sync_project` with `dry_run=true` if supported by the client flow.
5. Call `build_project`.
6. Call `deploy_project` with `commit_sha`.
7. Read `get_logs` and report the audited result.

Agents must stop and report instead of trying to repair automatically when:

- local repo has uncommitted changes,
- branch diverged,
- target commit is unavailable,
- build or tests fail,
- API key scope is insufficient,
- node-agent path is not allowlisted,
- deployment kill switch is enabled.

## Minimum Server Hardening

- SSH key auth only; no password login.
- Dedicated deploy user where possible; avoid long-term root deployment.
- `ufw` or provider firewall:
  - public: `80/tcp`, `443/tcp`
  - restricted admin CIDR: `22/tcp`
  - private/control-plane only: node-agent port such as `9071/tcp`
  - local/private only: Redis, Prometheus, Grafana
- NGINX terminates TLS for the public Control Tower endpoint.
- FastAPI docs stay disabled in production.
- `.env` is never committed and should be `chmod 600`.
- Rotate keys on agent handoff, suspected leak, or project ownership change.

## Decision Point

For day-one production, use REST plus scoped keys for external agents and MCP
with per-agent HTTP headers for MCP-capable clients. Avoid a shared global MCP
key for multiple agents.
