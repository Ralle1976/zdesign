# Z.Design — AGENTS.md

> Projekt-Charta für alle AI-Agents (ZCode, Claude, Codex).

## Projekt

**Name:** Z.Design
**Pfad:** `G:\Andere Computer\Mein Computer\Desktop\Z.Design`

*TODO: projektspezifische Produkt-Charta, Stack, Konventionen hier ergänzen.*


---

## 🧠 Geteiltes Agent-Gedächtnis (Vault)

> **WICHTIG für jeden Agent (ZCode, Claude, Codex):** Es gibt ein gemeinsames Gedächtnis.

**Vault-Ort:** `C:\Users\tango\OneDrive\ZCode-Vault` (Zugriff direkt über Dateisystem)

### Vor einer Aufgabe
1. Vault durchsuchen: `grep -rl "<keyword>" "C:/Users/tango/OneDrive/ZCode-Vault"`
2. Relevante Ordner: `02-Regeln-Definitionen/`, `01-Projekte/`, `04-Code-Snippets/`, `07-Codex-Archiv/chats/`

### Nach einer längeren Session
- Summary in `03-Session-Summaries/` ablegen (Format: `YYYY-MM-DD_<titel>.md`)
- Wiederverwendbare Lösungen in `04-Code-Snippets/`

### Sicherheitsregeln
- **Niemals** echte Secrets/API-Keys in den Vault schreiben
- Nur Referenzen auf Ablageorte (z. B. `~/.zcode/v2/credentials.json`)
- Vault wird über OneDrive synchronisiert

Vollständige Brücken-Datei: `C:/Users/tango/OneDrive/ZCode-Vault/02-Regeln-Definitionen/agents-vault-bruecke.md`

---

## Control-Tower-MCP

Dieses Projekt ist im Control Tower als **`zdesign`** registriert und über den lokalen MCP-Server voll deploybar.

- **Repo:** `Ralle1976/zdesign`
- **Deploy-Ziel(e):**
  - `ionos-srv2` / `production` (Repo-Pfad `/opt/zdesign`, Branch `main`)
- **MCP-Server:** `infra-control-tower` (ZCode User-Scope, `http://127.0.0.1:8765/mcp`)
- **Live-API:** `https://infra.ralle1976.cloud`
- **Hinweis:** Aktuell ohne `test_commands` → `build_project` wird fehlschlagen, bis eine `docker-compose.yml` im Repo liegt.

### Verfügbare MCP-Tools

| Tool | Aufruf |
|---|---|
| Status | `project_status(project_id="zdesign")` |
| Sync | `sync_project(project_id="zdesign", dry_run=true)` |
| Build | `build_project(project_id="zdesign", dry_run=true)` |
| Deploy | `deploy_project(project_id="zdesign", commit_sha="<40-Zeichen-SHA>", dry_run=true)` |
| Logs | `get_logs(project_id="zdesign", limit=20)` |

### Deploy-Regeln

- **Production-Deploy benötigt zwingend einen 40- oder 64-Zeichen `commit_sha`** — kein Branch-Name.
- Vor jedem Deploy: `sync_project` und `build_project` erfolgreich durchlaufen lassen.
- Der Agent führt Git-Preflight durch und blockiert bei uncommitted Changes (Sicherheitsfeature).
- `rollback_project` braucht entweder einen expliciten `commit_sha` oder einen vorherigen erfolgreichen Audit-Eintrag.
- Alle Aktionen werden im Audit-Log gespeichert (`get_logs`).
