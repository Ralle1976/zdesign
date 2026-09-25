# Next Actions — Z.design (Stand 2026-09-26)

> Automatisch gepflegt (autonomous-workflow Phase 10). Offene Punkte nach der Migration-Session.

## 🔴 User-Entscheidung nötig

1. **Workspace-Umstellung**: ZCode/IDE-Workspace zeigt noch auf `G:\Andere Computer\Mein Computer\Desktop\Z.Design` (Archiv). Bitte auf `C:\dev\z.design` umstellen, damit künftige Sessions direkt im neuen Arbeitsort starten. Bis dahin schützt die ARCHIV-Warnung in der G:-AGENTS.md vor Fehlbedienung.

## 🟡 Nächste sinnvolle Aufgaben (Projekt)

2. **Server-Dauerbetrieb**: Der Dev-Server (`npx next dev -p 3100`) läuft aktuell als Hintergrundprozess der Session und stirbt mit ihr. Für Dauerbetrieb: PM2 / Windows Task Scheduler / `next build` + Production-Start (jetzt auf NTFS gefahrlos möglich). Achtung: MCP erwartet `http://127.0.0.1:3100/api/mcp`.
3. **DB-Aufräum-Kandidaten** (bewusst nicht gelöscht — historische Daten): 2 leere Failed-Test-Records aus 2026-07-15 in der Projekt-Datenbank:
   - `cmrlyyfkh000hl0ogz6kdl11j` "Test SaaS Analytics 2026-07-15-10-54-35" (0 KB)
   - `cmrlyqwmk0001l0ogvd4r0k85` "Test Thai Street Food Imbiss 2026-07-15-10-54-35" (0 KB)
   Löschen via `DELETE /api/projects/<id>`, wenn gewünscht.
4. **G: als Archiv finalisieren** (optional): Nach Workspace-Umstellung kann die G:-Kopie eingefroren oder entfernt werden. WICHTIG: niemals auf G: bauen/installieren (Google-Drive/FAT32-Mount-Crash, siehe Memory `zdesign-g-drive-blocker`).

## ✅ Erledigt in dieser Session (2026-09-26)

- Umzug G: → `C:\dev\z.design` (3318 Dateien / 224 MB, 0 Fehler)
- `npm install` + `prisma generate` auf NTFS
- Dev-Server auf :3100 (Turbopack, Ready 5.4s) + MCP-Verifikation (`zdesign_list_projects` liefert DB-Daten)
- **10/10 Designs generiert** (QC-valid, avg 20.4KB): Nordic Roast Batch2, Rooftop Nocturne, Fluentia, Maison Lumiere, Neon Harbor Festival, Iron Pulse Fitness, Petal & Dew, Studio Arche, Verde Atelier, Lumen Analytics
- AGENTS.md-Pfade aktualisiert (live + Archiv-Kopie), Memory aktualisiert
- Branch `auto/session-2026-09-26-cdev-migration` gepusht
