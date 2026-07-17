# Z.Design — AGENTS.md

> Projekt-Charta und Anweisungen für alle AI-Agents (ZCode, Claude, Codex).
> Auto-generiert am 2026-07-15 — bei Bedarf anpassen.

## Projekt

| Feld | Wert |
|---|---|
| **Name** | Z.Design |
| **Pfad** | `G:\Andere Computer\Mein Computer\Desktop\Z.Design` |
| **Git Remote** | `https://github.com/Ralle1976/zdesign.git` |
| **Stack** | Environment-Config |

*TODO: projektspezifische Produkt-Charta, Konventionen, Build-Befehle hier ergänzen.*


---

## 🧠 Geteiltes Agent-Gedächtnis (Vault)

> **WICHTIG für jeden Agent (ZCode, Claude, Codex):** Es gibt ein gemeinsames Gedächtnis.

**Vault-Ort:** `C:\Users\tango\OneDrive\ZCode-Vault` (Zugriff direkt über Dateisystem)

### Vor einer Aufgabe
1. Vault durchsuchen: `grep -rl "<keyword>" "C:/Users/tango/OneDrive/ZCode-Vault"`
2. Relevante Ordner: `02-Regeln-Definitionen/`, `01-Projekte/`, `04-Code-Snippets/`, `07-Codex-Archiv/`
3. Semantische Suche: `node "C:/Users/tango/OneDrive/ZCode-Vault/06-Agent-Integration/vector-search.mjs" --search "<keyword>"`

### Nach einer längeren Session
- Summary in `03-Session-Summaries/` ablegen (Format: `YYYY-MM-DD_<titel>.md`)
- Wiederverwendbare Lösungen in `04-Code-Snippets/`

### Sicherheitsregeln
- **Niemals** echte Secrets/API-Keys in den Vault schreiben
- Nur Referenzen auf Ablageorte (z. B. `~/.zcode/v2/credentials.json`)
- Vault wird über OneDrive synchronisiert

### Tools verfügbar
- **knowledge-mcp:** MCP-Server mit Tools `knowledge_search`, `knowledge_read`, `knowledge_list`
- **Graphify:** Falls `graphify-out/graph.json` existiert → `graphify query "<frage>"`
- **Vector-Search:** Semantische Suche über alle Vault-Notes

Vollständige Brücken-Datei: `C:/Users/tango/OneDrive/ZCode-Vault/02-Regeln-Definitionen/agents-vault-bruecke.md`


---

<!--MASTER-START-->
## GLOBALE REGELN (Auto-synced v2)

> Dieser Block wird automatisch aus `~/.zcode/masters/AGENTS-MASTER.md` synchronisiert.
> Projekt-spezifische Regeln stehen außerhalb der MASTER-Marker und bleiben erhalten.

### Autonomie-Stufe 3 (Default)
- **Handle selbstständig** bei Code-Edits, Refactors, Configs, Commits auf Feature-Branches.
- **Frage NUR bei**: Production-Deployments, Secret-Rotation, Datenbank-Löschungen, Force-Pushes, Kosten >$5.
- **Keine reflexartige Rückversicherung** bei trivialen Aktionen.
- **Initiative-Pflicht**: nach Abschluss einer Aufgabe automatisch die nächste wählen.

### Sicherheitsregeln
- **NIEMALS** Secrets in Code, Logs, Commits schreiben.
- `.env`-Zugriff nur via `Read`, Werte niemals wiedergeben.
- Secrets in `.env`, OS-Umgebungsvariablen, oder `~/.zcode/v2/credentials.json`.

### Code-Architektur-Hygiene
- **Single Responsibility pro Datei** – eine Datei = eine Aufgabe.
- **File-Size-Governance**: >300 Zeilen = Refactor-Signal, >500 = Block.
- **Feature-basierte Ordnerstruktur**, keine `utils.ts`-Sammelbecken.

### Anti-AI-Slop
- Kommentare erklären das WARUM, nicht das WAS.
- Keine Factory/Builder für eine Implementierung.
- Kein try-catch ohne konkrete Fehlerbehandlung.
- Kein akademisches Naming.

### Subagent-Dispatch (PFLICHT)
- Bei passendem Stack: Subagent via Agent-Tool dispatchen (nextjs-fullstack, react-spa, python-backend, devops-ionos, game-realtime).
- Bei ≥2 unabhängigen Subtasks: parallel dispatchen.

### Auto-Commit
- Commits auf Feature-Branch (`auto/session-*`), niemals direkt auf main.
- Git-Identity: `Ralle1976`.

### Reflexion bei Planung
- Bei ≥3 Dateien oder ≥2 Architekturentscheidungen: `reflective-planning`-Skill mit 4 Linsen (Experten, Blind-Spot, 3D, Advocatus Diaboli).

### Sprache
- Antworten auf Deutsch, Code-Kommentare und Commits auf Englisch.

### User-Facing-Essentials (PFLICHT bei Web-Apps)
- Bei **jeder Web-App mit echten Usern** (Live-URL, Login, ≥3 Module): Skill `user-facing-essentials` anwenden.
- **Automatisch prüfen**: README-Realität, User-Hilfe/FAQ, Onboarding, Doku-Sync.
- **Bei neuen Features**: Hilfe/README im selben Arbeitsgang aktualisieren.
- **README darf nicht Framework-Boilerplate sein** auf Live-Apps. Sofort ersetzen.
- **Jedes Modul braucht Hilfe-Eintrag.** Lücken selbstständig schließen (Stufe 3).
<!--MASTER-END-->

