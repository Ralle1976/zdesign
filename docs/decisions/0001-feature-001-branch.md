# ADR 0001 — feature/feature-001 Branch: behalten, nicht mergen

**Datum:** 2026-07-04
**Status:** Angenommen
**Entscheider:** Repo-Owner (Ralle1976) nach Empfehlung

## Kontext

Der Remote-Branch `feature/feature-001` (HEAD `f10cf2a`, 15.06.2026) divergiert von
`main` (`d7c1331`, 30.06.2026): anderes Verzeichnis-Layout (`src/...` vs.
`Projekt/src/...`), keine gemeinsamen Commits nach `899694fb`. PR #2 ("Export overhaul
PDF+ZIP + React error boundaries") wurde am 25.06.2026 **bewusst ohne Merge geschlossen**.

## Untersuchung (04.07.2026)

Die drei Haupt-Features des Branches sind in `main` bereits vorhanden:

| Feature | feature-001 | main (`d7c1331`) | Befund |
|---|---|---|---|
| PDF-Export (Puppeteer) | `src/lib/export/pdf-generator.ts` (11.251 B) | `Projekt/src/lib/export/pdf-generator.ts` (11.864 B) | vorhanden, weiterentwickelt |
| ZIP-Export (JSZip) | SHA `a9ef79b6` | SHA `a9ef79b6` (identisch) | byteidentisch übernommen |
| Error-Boundaries | `ErrorBoundary.tsx` | `Projekt/src/components/zdesign/ErrorBoundary.tsx` (+ verdrahtet) | vorhanden + in UI eingebunden |

Ein Merge würde nur Konflikte ohne Wertgewinn erzeugen.

## Entscheidung

**Branch wird nicht gelöscht und nicht gemergt.** Er bleibt als historischer,
geschlossener Feature-Branch (PR #2) erhalten.

## Begründung

1. **Stört nichts** — ein separater Branch berührt `main` nicht; produktiver Code
   bleibt unbeeinflusst.
2. **Kein Mehrwertverlust** — kein einmaliger Code mehr im Branch (alles in `main`).
3. **Löschen ist unwiederbringlich** — Behalten ist kostenlos; History (PR #2) bleibt
   zugänglich.
4. **Aufräumen optional** — falls das Repo später bereinigt werden soll, kann der
   Branch jederzeit nachträglich gelöscht werden.

## Konsequenzen

- Keine Code-Änderung an `main`.
- Der Branch taucht weiterhin in `git branch -a` auf; das ist beabsichtigt.
- Bei künftigen Aufräumaktionen kann dieser ADR als Freigabe-Grundlage dienen.
