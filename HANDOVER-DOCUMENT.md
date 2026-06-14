# Z.Design — Lastenheft & Projektübergabe

**Version:** 1.0 | **Datum:** 2025-07-14 | **Projekt:** Z.Design AI-Powered Visual Design Platform

---

## 1. PROJEKTVISION

Z.Design ist ein KI-gestütztes visuelles Design-Tool, das besser als Claude Design / v0.dev / Framer AI werden soll. Der Benutzer beschreibt ein Design in natürlicher Sprache, und die KI generiert ein vollständiges, visuell ansprechendes Design als JSON-Baumstruktur, das in Echtzeit gerendert und bearbeitet werden kann.

### Kernversprechen
- **Chat → Design**: Benutzer beschreibt, KI generiert professionelles Design
- **Direct Manipulation**: Elemente auswählen, verschieben, skalieren, bearbeiten
- **Multi-Provider**: Z.ai, OpenAI, Anthropic, Google AI (aktuell nur Z.ai aktiv)
- **Design-System-Management**: Tokens, Komponenten, Styles
- **Export**: HTML, PDF, PPTX, ZIP, Next.js, React, Figma
- **Kollaboration**: Echtzeit via Socket.IO
- **Mehrsprachig**: EN + DE

---

## 2. TECH-STACK

| Komponente | Technologie | Version |
|-----------|------------|---------|
| Framework | Next.js (App Router) | 16.1.1 |
| Sprache | TypeScript | 5.x |
| Styling | Tailwind CSS + shadcn/ui | v4 |
| State | Zustand | 5.0.6 |
| Datenbank | Prisma + SQLite | 6.11.1 |
| AI SDK | z-ai-web-dev-sdk | 0.0.18 |
| Echtzeit | Socket.IO | 4.8.3 |
| Animation | Framer Motion | 12.23.2 |
| Reverse Proxy | Caddy | Port 81 |
| Runtime | Bun | aktuell |

### Projektstruktur
```
src/
├── app/
│   ├── page.tsx              → Einzige Route (ZDesignApp)
│   ├── layout.tsx            → Root Layout
│   ├── globals.css           → Globale Styles
│   └── api/                  → 26 API-Routes
├── components/
│   ├── zdesign/              → 27 Hauptkomponenten
│   ├── zdesign/canvas/       → 8 Canvas-Komponenten
│   └── ui/                   → 45+ shadcn/ui Primitives
├── stores/
│   └── zdesign-store.ts      → Zustand Store (507 Zeilen)
├── hooks/                    → 4 Custom Hooks
├── i18n/                     → EN + DE Übersetzungen
├── lib/                      → Utilities, AI-Prompts (829 Zeilen)
├── types/
│   └── design.ts             → 374 Zeilen Typdefinitionen
mini-services/
└── collab-service/           → Socket.IO Server (Port 3003)
prisma/
└── schema.prisma             → 8 Models, 3 Enums
db/
└── custom.db                 → SQLite Datenbank
```

---

## 3. DATENBANK-SCHEMA

### Models
| Model | Schlüsselfelder |
|-------|----------------|
| **User** | id, name, email (unique), avatar, locale |
| **Project** | id, name, type (enum), designJSON, status (enum), isPublic |
| **Version** | id, projectId, parentVersionId, label, designJSON, branch |
| **DesignSystem** | id, name, tokens (JSON), components (JSON), styles (JSON) |
| **Comment** | id, projectId, elementId, x, y, content, isResolved |
| **ProjectMember** | id, projectId, userId, role (enum) |
| **Template** | id, name, category, designJSON, tags, rating |
| **ChatMessage** | id, projectId, role, content, metadata (JSON) |

### Enums
- `ProjectType`: PROTOTYPE | SLIDE_DECK | LANDING_PAGE | DASHBOARD | WEB_APP | MOBILE_APP | MARKETING | CUSTOM
- `ProjectStatus`: DRAFT | IN_PROGRESS | REVIEW | COMPLETED | ARCHIVED
- `Role`: VIEWER | COMMENTER | EDITOR | ADMIN

---

## 4. ARCHITEKTUR

### Design-Engine-Pipeline
```
User Input → ChatPanel → POST /api/chat → Z.ai LLM → JSON Response
    ↓
parseAIResponse() → repairLLMJson() → Fallback-Templates
    ↓
designJSON → Prisma DB + Zustand Store
    ↓
DesignRenderer → Recursive React Rendering
```

### Drei-Fallback-System
1. **Direkter Parse** — Versucht JSON direkt zu parsen
2. **JSON-Reparatur** — 12+ Reparatur-Schritte für fehlerhaftes LLM-JSON
3. **Kontextueller Fallback** — 8 thematische Templates (Fitness, Restaurant, Crypto, etc.)

### Kollaborations-Architektur
```
Client → Socket.IO → mini-services/collab-service (Port 3003)
    ↕ Caddy Proxy mit ?XTransformPort=3003
```

---

## 5. GELÖSTE PROBLEME (bereits implementiert)

### P0 — Kritische Bugfixes
| # | Problem | Lösung | Datei |
|---|---------|--------|-------|
| 1 | Designs beim Reload verloren | designJSON + Chat nach Page-Load aus DB laden | `ZDesignApp.tsx` |
| 2 | Chat-Historie beim Reload verloren | GET /api/chat?projectId=... → setChatMessages() | `ZDesignApp.tsx` |
| 3 | Kein Auto-Save | 5s debounce, PATCH /api/projects/[id] | `ZDesignApp.tsx` |
| 4 | PropsPanel nur Deko | 7 Editoren: Content, Layout, Spacing, Typography, Background, Border, Effects | `PropsPanel.tsx` |
| 5 | Kein Undo/Redo | 50-Level History, Ctrl+Z/Y, loadDesignTree() für initialen Load | `zdesign-store.ts` |

### P1 — Canvas-Interaktion
| # | Problem | Lösung | Datei |
|---|---------|--------|-------|
| 6 | SelectionOverlay fixed statt absolute | Position relativ zum Canvas-Container | `SelectionOverlay.tsx` |
| 7 | Kein Drag-to-Move | Drag auf Selection-Border, nudgeNode() | `SelectionOverlay.tsx` |
| 8 | Kein Drag-to-Resize | 8 funktionale Resize-Handles | `SelectionOverlay.tsx` |
| 9 | Keine Keyboard-Shortcuts | Del, Esc, Ctrl+Z/Y, Pfeiltasten | `DesignRenderer.tsx` |
| 10 | Kein Canvas-Panning | Space+Drag, transform: translate() | `DesignRenderer.tsx` |

### P1 — AI-Qualität
| # | Problem | Lösung | Datei |
|---|---------|--------|-------|
| 11 | AI-Prompts zu schwach | Few-Shot-Beispiele, Negative Constraints, Design-System-Enforcement | `ai-prompts.ts` |
| 12 | Fallback-Templates basic | Gradient-Hintergründe, clamp() Typografie, moderne Patterns | `chat/route.ts` |
| 13 | Kein Refinement-Prompt | DESIGN_REFINEMENT_SYSTEM_PROMPT für zielgerichtete Änderungen | `ai-prompts.ts` |

---

## 6. OFFENE PROBLEME (noch zu lösen)

### P1 — High Impact

| # | Problem | Auswirkung | Vorschlag |
|---|---------|-----------|-----------|
| O1 | **PDF-Export ist Fake** — HTML mit .pdf-Endung | Benutzer erwarten echtes PDF | Puppeteer/Playwright für serverseitiges PDF; oder jsPDF clientseitig |
| O2 | **ZIP-Export unvollständig** — Kein CSS, keine Assets | Nicht produktionsgeeignet | CSS extrahieren, Assets-Ordner, README hinzufügen |
| O3 | **Kein LLM-Streaming** — 60-90s Wartezeit ohne Feedback | UX-Killer | Streaming API implementieren, inkrementelles JSON-Parsing |
| O4 | **Chart-Node rendert leer** — Nur ein `<div>` | Charts sind visuell unsichtbar | Recharts oder Lightweight-Chart-Lib integrieren |
| O5 | **Keine Pseudo-States** (hover, focus, active) | Designs wirken starr, nicht interaktiv | `hoverStyle?`/`focusStyle?` zum DesignNode-Schema hinzufügen |
| O6 | **Keine responsiven Breakpoints** im Schema | Design ist nur für eine Viewport-Größe | `styleVariants?: { sm?, md?, lg? }` hinzufügen |
| O7 | **Kollaboration nicht im UI verdrahtet** | Server + Hook existieren, aber keine Verbindung | useCollaboration in ZDesignApp integrieren |

### P2 — Medium Impact

| # | Problem | Auswirkung | Vorschlag |
|---|---------|-----------|-----------|
| O8 | **Kein Layers-Panel** — Keine Baumansicht der Hierarchie | Navigation in komplexen Designs schwierig | Verschachtelte TreeView-Komponente in PropsPanel |
| O9 | **Multi-Provider nur dekorativ** — OpenAI/Anthropic/Google `isAvailable: false` | Nur Z.ai funktioniert | API-Key-Verification + echte SDK-Integration |
| O10 | **Keine Icon-SVG-Renderung** — Icons sind nur Text | Icons erscheinen als Wörter statt Grafiken | Lucide-React SVGs basierend auf `content`-Feld rendern |
| O11 | **Keine Animationen** — AnimationPreset existiert im Schema, wird aber ignoriert | Designs sind statisch | CSS @keyframes aus AnimationPreset generieren |
| O12 | **Video/Audio/Tabs/Accordion/Dropdown** rendern als leere `<div>` | Diese Komponenten sind funktionslos | Interaktive Komponenten-Renderer bauen |
| O13 | **next-auth installiert aber nicht verdrahtet** | Keine Auth, keine Benutzerverwaltung | Login-UI + Session-Management implementieren |
| O14 | **Canvas Grid fehlt** — Toggle existiert, Rendering fehlt | Grid-Overlay ist nicht sichtbar | CSS Grid-Overlay rendern |
| O15 | **Voice Transcription ist Stub** — 40 Zeilen, nicht funktional | Voice-Input funktioniert nicht | Z.ai ASR Skill integrieren |

### P3 — Low Impact / Nice-to-Have

| # | Problem |
|---|---------|
| O16 | Kein Ruler/Measurements im Canvas |
| O17 | Kein Multi-Select (Shift+Click, Marquee) |
| O18 | Kein Copy/Paste von Nodes |
| O19 | Kein Drag-Reorder (nur absolute/relative Positionierung) |
| O20 | Kein Snap/Alignment-Guides |
| O21 | Kein Zoom-to-Fit |
| O22 | Keine Chat-Branching (verschiedene Design-Richtungen erkunden) |
| O23 | Kein Inline-Diff-Preview vor Design-Änderungen |
| O24 | Keine Slash-Commands (/enhance, /theme dark, /export react) |
| O25 | Template-Thumbnails sind nicht befüllt |
| O26 | Alle Templates nutzen gleiches Farbschema (emerald/teal) |
| O27 | Kein Dark-Mode bei Templates |
| O28 | Keine branchenspezifischen Templates (Gesundheit, Bildung, Finanzen) |

---

## 7. BEKANNTE TECHNISCHE SCHULDEN

| # | Schuld | Risikio | Empfehlung |
|---|--------|---------|------------|
| T1 | `typescript.ignoreBuildErrors: true` | Typfehler werden nicht erkannt | Abschaffen, Typfehler beheben |
| T2 | `reactStrictMode: false` | Doppelte Renders in Dev fehlen | Re-aktivieren nach Stabilisierung |
| T3 | SQLite skaliert nicht | Multi-User-Betrieb problematisch | PostgreSQL für Produktion |
| T4 | Kein Test-Setup (0 Tests) | Refactoring-Risiko extrem hoch | Mindestens Integrationstests |
| T5 | Chat API Route ist 1.205 Zeilen | Wartbarkeit, Cognitive Load | In Module aufteilen |
| T6 | PropsPanel ist 1.549 Zeilen | Wartbarkeit | In Unter-Komponenten aufteilen |
| T7 | Store ist 507 Zeilen, wird weiter wachsen | Single-Responsibility-Verletzung | In Slices aufteilen |
| T8 | Kein Error Boundary | Komponenten-Crash = weißer Bildschirm | React Error Boundaries hinzufügen |
| T9 | Kein Rate Limiting auf AI-Endpoints | API-Missbrauch möglich | Rate Limiter Middleware |
| T10 | Auto-Save erstellt bei jedem Save eine Version | Version-Tabelle wächst unkontrolliert | Nur signifikante Änderungen als Version speichern |

---

## 8. WICHTIGE CODE-PATTERNS & GOTCHAS

### DesignNode-Update-Muster
```typescript
// NIEMALS direkt mutieren! Immer updateNode() verwenden:
updateNode(selectedNodeId, { 
  style: { ...currentNode.style, fontSize: '16px' } 
})

// WICHTIG: updateNode macht shallow merge auf Node-Ebene!
// Style muss manuell gespreadet werden, sonst werden andere Style-Props gelöscht
```

### Persistence-Flows
```
Page Load:
  GET /api/projects → projectId
  GET /api/projects/[id] → designJSON → loadDesignTree()  (kein Undo-History!)
  GET /api/chat?projectId=... → chatMessages → setChatMessages()

Auto-Save (5s debounce):
  designTree + isDirty → PATCH /api/projects/[id] → { designJSON: JSON.stringify(tree) }

Chat → Design:
  POST /api/chat → Z.ai LLM → parsed.design → setDesignTree() (MIT Undo-History)
  → db.project.update({ designJSON }) → db.chatMessage.create()
```

### API-Port-Routing (Caddy)
```
ALLES geht über relative Pfade mit ?XTransformPort=
Bsp: fetch('/api/test?XTransformPort=3030')
VERBOTEN: fetch('http://localhost:3030/api/test')
```

### Socket.IO-Verbindung
```typescript
// IMMER mit XTransformPort:
io("/?XTransformPort=3003")
// NIEMALS: io("http://localhost:3003")
```

### Z.ai SDK (Backend Only!)
```typescript
// NUR in API-Routes verwenden:
import ZAI from 'z-ai-web-dev-sdk';
const zai = await ZAI.create();
const result = await zai.chat({ messages: [...] });
```

---

## 9. QUALITÄTSBEWERTUNG

### Aktueller Stand (Post-Fixes)

| Bereich | Score | Bewertung |
|---------|-------|-----------|
| Persistence | 9/10 | ✅ Design + Chat überleben Reload, Auto-Save funktioniert |
| Property-Editing | 7/10 | ✅ 7 Editoren, aber kein Layers-Panel |
| Canvas-Interaktion | 7/10 | ✅ Drag/Resize/Pan/Keyboard, aber kein Multi-Select |
| AI Prompt-Qualität | 7/10 | ✅ Few-Shot + Constraints, aber kein Streaming |
| Node-Rendering | 5/10 | ⚠️ Viele Node-Types sind leere Divs (chart, video, tabs...) |
| CSS-Unterstützung | 5/10 | ⚠️ Keine Pseudo-States, keine Breakpoints |
| Export-Qualität | 4/10 | ❌ PDF fake, ZIP unvollständig |
| Kollaboration | 4/10 | ❌ Server existiert, aber nicht im UI |
| Auth | 1/10 | ❌ next-auth installiert, nicht verdrahtet |
| **Gesamt** | **6.5/10** | **Verbesserung von 4.5 → 6.5** |

### Ziel: 8+/10
Dafür werden benötigt:
1. Funktionales PDF/ZIP-Export (O1, O2)
2. LLM-Streaming (O3)
3. Pseudo-States + Responsive Breakpoints (O5, O6)
4. Chart/Icon/Video-Rendering (O4, O10, O12)
5. Kollaboration im UI (O7)

---

## 10. IONOS DEPLOYMENT (vorbereitet, nicht umgesetzt)

### Control Tower Integration
Die Dateien in `/home/z/my-project/upload/` beschreiben ein professionelles Deployment-System:
- `agent-project-onboarding.md` — Multi-Agent-Betriebsmodell
- `mcp-deployment-control-tower.md` — FastAPI Control Tower + Node-Agent
- `README.md` — Gesamtarchitektur mit REST/MCP-Endpoints

### Was fehlt für IONOS-Deployment
1. **Dockerfile** — Multi-stage Build für Next.js Standalone + Collab Service
2. **docker-compose.yml** — Production-Konfiguration
3. **.env.example** — Umgebungsvariablen dokumentiert
4. **GitHub-Repo** — Source of Truth für Control Tower
5. **Domain** — Für NGINX/TLS
6. **Project Request Manifest** — Für Control Tower Onboarding

---

## 11. EMPFEHLUNG FÜR NÄCHSTE SCHRITTE

### Phase 1: Stabilisierung (1-2 Wochen)
1. PDF-Export reparieren (Puppeteer oder jsPDF)
2. ZIP-Export vervollständigen
3. Chat API Route aufteilen (1.205 → ~300 Zeilen pro Modul)
4. Error Boundaries hinzufügen
5. TypeScript strict mode aktivieren

### Phase 2: Kritische Features (2-3 Wochen)
1. LLM-Streaming implementieren
2. Hover/Focus/Pseudo-States im Schema + Renderer
3. Responsive Breakpoints im Schema
4. Chart-Rendering (Recharts)
5. Icon-SVG-Rendering (Lucide)

### Phase 3: Professionalisierung (2-3 Wochen)
1. Auth-System (next-auth)
2. Kollaboration im UI verdrahten
3. Multi-Provider SDK-Integration
4. Layers-Panel
5. Rate Limiting

### Phase 4: Deployment (1 Woche)
1. Dockerfile + docker-compose.yml
2. .env.example
3. IONOS Control Tower Onboarding
4. Domain + TLS
5. Go-Live Check

---

## 12. SCHNELLSTART FÜR NEUE LLM

### Was du zuerst lesen solltest:
1. `/src/types/design.ts` — Verstehe das DesignNode-Schema
2. `/src/stores/zdesign-store.ts` — Verstehe den State
3. `/src/app/api/chat/route.ts` — Verstehe die AI-Pipeline
4. `/src/components/zdesign/canvas/DesignRenderer.tsx` — Verstehe das Rendering
5. `/src/lib/ai-prompts.ts` — Verstehe die Prompt-Strategie

### Wichtige Regeln:
- **NIEMALS** DesignNode direkt mutieren — immer `updateNode()` verwenden
- **IMMER** Style-Objekte spreaden — `updateNode(id, { style: {...old, ...new} })`
- **NIEMALS** `z-ai-web-dev-sdk` im Client verwenden — nur in API-Routes
- **IMMER** `?XTransformPort=` für andere Ports verwenden — nie direkte URLs
- **IMMER** `loadDesignTree()` für initiales Laden — `setDesignTree()` erzeugt Undo-History
- **NIEMALS** `fetch('http://localhost:...')` — immer relative Pfade
- **LINT PRÜFEN** mit `bun run lint` vor jedem Commit

### Dev-Server:
```bash
bun run dev              # Startet auf Port 3000
bun run lint             # Code-Qualität prüfen
bun run db:push          # Schema-Änderungen anwenden
```
