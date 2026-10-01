# Z.Design — AGENTS.md

> ⚠️ **ARCHIV-KOPIE — Projekt umgezogen nach `C:\dev\z.design` (2026-09-26).**
> Keine Builds/Dev-Server/`npm install` mehr auf G: (Google-Drive/FAT32 — crashiert den Mount, siehe Memory `zdesign-g-drive-blocker`).
> Diese Datei dient nur noch als Referenz; verbindliche AGENTS.md ist `C:\dev\z.design\AGENTS.md`.

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

---

---

---

<!--MASTER-START-->
## GLOBALE REGELN (Auto-synced v6)

> Dieser Block wird automatisch aus `~/.zcode/masters/AGENTS-MASTER.md` synchronisiert.
> Projekt-spezifische Regeln stehen außerhalb der MASTER-Marker und bleiben erhalten.

### TOKEN-NOTBREMSE → PILOT-MODUS (ab v7 — User-Freigabe 2026-09-26: „Freigabe erteilt, go!")
- **PILOT-LISTE (volle Rechte: Ziel-First-Zyklus, max 15 Tool-Calls pro Lauf)**:
  - **"zcode"** (Workspace `C:\Users\tango\OneDrive\Desktop\ZCode`): PROZESS-PILOT (DoD → PM-Puls-Task-Generator → Executor → Verifikation → Register → Prozess-Learning). Ziel: Prozess zur Reife bringen, bis er sich selbst verbessert (Kriterien im zcode-Register: done_criteria "Pilot-Kriterien").
  - **"thai-spa-platform"** (Workspace `G:\Andere Computer\Mein Computer\Desktop\thai-spa-platform`): WIRKUNGSTEST am echten Produkt — DoD-führende Läufe mit Beweisen (Tests/Lint; Build-Verifikation nur CI, da Windows-Pfadblockade laut Projekt-Register). User-Freigabe 2026-09-26.
- **ALLE anderen Projekt-Executoren bleiben GEBREMST**: KEINE Projekt-Arbeit, max 3 Tool-Calls, ein Einzeiler-Status im eigenen Register. Keine Ausnahmen.
- **Ausweitung auf alle Projekte erst nach Pilot-Erfolg + erneuter User-Freigabe.**

### ZIEL-FIRST: Produkt-DoD vor Kosmetik (ab v5 — User-Vorgabe 2026-09-26)
- **Jedes Projekt hat ein "fertiges Produkt"-Bild**: Register-Felder `goal` + `done_criteria` = verbindliche Definition of Done (DoD). Fehlt sie: zuerst aus Projekt-AGENTS.md/README ableiten und eintragen — KEINE Feature-Arbeit ohne DoD.
- **Nur ziel-führende Aufgaben**: Jede next_action muss einen konkreten done_criteria-Punkt erfüllen (Referenz angeben). KEINE Kosmetik, kein Polish, kein Feature-Candy solange DoD offen. Keine neuen Features außerhalb des DoD (YAGNI).
- **Task-Generator = PM-Puls**: erzeugt und validiert next_actions ausschließlich aus dem DoD. Sind alle done_criteria belegbar erfüllt → status=completed, KEINE neuen Tasks (nur Wartung/Reparatur/Bugs).
- **Executoren erfinden KEINE Aufgaben**: oberste DoD-führende next_action abarbeiten; gefundene Probleme NUR als next_action notieren; Tasks dürfen geschärft, aber nicht durch eigene ersetzt werden.
- **Token-Budget**: max 15 Tool-Calls pro Executor-Lauf (engt die 30 des Lauf-Prompts ein). Bei Budgetende: sauber beenden, Status notieren.

### Autonomie-Stufe 3 (Default)
- **Handle selbstständig** bei Code-Edits, Refactors, Configs, Commits auf Feature-Branches.
- **Frage NUR bei**: Production-Deployments, Secret-Rotation, Datenbank-Löschungen, Force-Pushes, Kosten >$5.
- **Keine reflexartige Rückversicherung** bei trivialen Aktionen.
- **Initiative-Pflicht**: nach Abschluss einer Aufgabe automatisch die nächste **des eigenen Projekts** wählen.

### Projekt-Isolation (HART — User-Entscheidung 2026-09-25)
- **Jeder Chat arbeitet NUR am Projekt seines eigenen Workspaces** — keine Register-Tasks, Work-Queue-Items, Issues oder Dateien anderer Projekte anfassen.
- **Keine Cross-Project-Automationen**: kein Executor/Cron darf Projekte aus einem globalen Register auswählen (Mechanismus 2026-09-25 komplett entfernt).
- **Fremdprojekt-Befunde** gehören als Notiz ins jeweilige Register — nicht selbst umsetzen.

### Firmen-Modus (PFLICHT — Orchestrator = Unternehmen)
- **KEINE "Soll ich…?"-Turn-Enden**: Analyse + Entscheidung + Handlung in EINEM Turn ("Ich beginne mit X, weil Y"). Der Autonomy-Guard-Hook weist Rückfragen beim Stop zurück.
- **Gemischte Maßnahmen sofort entzerren**: alle autonomen Teile JETZT ausführen (Fixes auf Feature-Branch, Passiv-Maßnahmen, Tests, Doku); nur echte Ausnahmen (Prod-Deploy, Secrets, Datenverlust, Kosten, irreversible Brüche) als EINE gebündelte Frage.
- **Analysen sind keine Deliverables** — ohne begonnene Umsetzung der klaren Sofortmaßnahmen ist der Turn unvollständig.
- **Weiterarbeiten bis fertig**: nächste next_action automatisch wählen (autonomous-workflow Phase 11, nur eigene Projekt-Actions). "Fertig" = Roadmap-Stufe abgearbeitet oder echter Ausnahmen-Blocker.

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

