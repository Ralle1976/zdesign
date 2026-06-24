# Workflow — Step by Step

## 1. Start Z.Design

```bash
cd Projekt && bun run dev
```
Open `http://localhost:3000` in your browser.

## 2. Enable Agent Mode

Click the **Bot icon** (amber when active) in the chat composer. This enables the full agentic design loop.

Optional toggles:
- **Wand2** (violet): Fusion pipeline (legacy, not needed with direct Z.ai)
- **HelpCircle** (amber): AI Assistant/Wizard (explains UI, executes actions)
- **Mic**: Voice input (GLM-ASR-2512)

## 3. Type Your Prompt

Example: *"Erstelle eine moderne, asiatisch angehauchte Landing Page für ein Thai-Massage Studio"*

## 4. Choose a Concept

The **Creative-Director** generates 3 distinct concepts as clickable cards:
- Each shows: **Name** + **Big Idea** + **Palette dots**
- Click one to select it → generation begins
- Or click **"Skip"** for concept-less generation

## 5. Wait for Generation (~5 min)

The agent runs the full pipeline (visible as trace steps in the chat):
```
Art Direction → Design-Rationale (thinking) → Generate v1 →
Anti-Slop-Lint → Theater Round 1 (6 panelists) → Refine →
Theater Round 2 → Audit Loop (5 audits + auto-fix) →
Self-Improve (learn recipe) → Ship
```

## 6. Explore the Result

The design renders live in the **canvas** (sandboxed iframe).

### Post-Gen Sliders (instant, no regeneration)
- **Hue**: Rotate the entire color spectrum (0-360°)
- **Spacing**: Scale all padding/margin (0.5× - 2×)
- **Font Scale**: Resize all text (0.8× - 1.4×)
- **Radius**: Global border-radius (0-32px toggle)

### Surgical Refine
- Click any major section (marked with `data-od-id`)
- A popover appears → type what to change
- Only that section gets refined

## 7. Iterate

Type follow-up messages to refine:
- *"Mach es dunkler"*
- *"Füge ein Kontaktformular hinzu"*
- *"Ändere die Schriftart"*

Each message runs the full agent loop with the current design as context.

## 8. Export

The design is saved automatically (5s debounce) as `designHTML` in the database.

For manual export: use the Export menu in the toolbar (HTML format).

## MCP Control (for external agents)

```bash
# Start the MCP server (optional, for agent control)
bun run src/mcp/server.ts

# Claude Code can now drive Z.Design:
# → zdesign_generate({message: "Thai Imbiss"})
# → zdesign_concepts({message: "Thai Imbiss"})
# → zdesign_batch({briefs: [...]})
# → zdesign_list_projects()
```

## Observability

The **StatsBar** at the bottom shows real-time metrics:
- Designs today
- Token consumption
- Error count
- Average composite score

`GET /api/stats` for programmatic access.
