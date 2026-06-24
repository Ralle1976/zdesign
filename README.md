# Z.Design

### Autonomous, self-improving AI design agent that ships agency-level web design from a single sentence.

Z.Design is a local-first, BYOK design platform. Describe a brand in plain language — *"a Thai street-food imbiss, fiery and raw"* — and a Creative-Director agent drafts a concept, a panel of six critics converges on a weighted verdict, an anti-slop linter enforces a deterministic quality floor, and a five-domain audit loop auto-fixes Accessibility, SEO, Performance, Design-Rhythm and Content before anything ships. Every run teaches the agent: skills are learned, patched, and reloaded at runtime (Hermes-style), so the hundredth design is sharper than the first.

Inspired by Claude Design, OpenDesign and the Hermes Agent. Built for makers who want art direction, not templates.

![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue)
![Bun](https://img.shields.io/badge/runtime-Bun-fbf0df?logo=bun)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Z.ai](https://img.shields.io/badge/LLM-GLM--5.2%20(Z.ai)-7c3aed)

> Screenshot: see [`examples/`](./examples) for live generated designs (street-fire, temple-dark, tropical-pop).

---

## Features

- **Creative-Director** — concept-first generation. The agent decides an art direction (palette, type system, motion language, mood) before a single component is drawn, so output reads as intentional rather than generic.
- **6-Panelist Critique Theater** — six specialist critics (brand, type, color, layout, motion, content) each score a design with weighted, convergent votes. A composite verdict must clear a convergence threshold before the design is accepted.
- **Self-Improving Skill Memory** — skills are first-class, versioned documents the agent writes at runtime. Learn → Correlate → Patch → Apply, then hot-reload. The agent gets measurably better the more you use it.
- **Anti-Slop Linter + Design Token Discipline** — a deterministic quality floor that rejects lazy output: no default emerald+Inter lookalikes, no flat 4px-radius buttons, no orphan tokens. Enforced before the LLM is ever asked to "fix it."
- **5-Audit Loop** — Accessibility (WCAG), SEO, Performance (Core Web Vitals targets), Design-Rhythm (spacing/alignment grid), and Content audits, each with auto-fix proposals the agent can apply in-loop.
- **Direct Z.ai Integration** — talks straight to GLM-5.2 on Z.ai. No Fusion middleman, no extra hops, no rate-limit surprises hidden behind a proxy.
- **MCP Server** — expose the full agent (generate, critique, refine, skill-edit, audit) as Model Context Protocol tools, so any MCP-aware client can drive Z.Design.
- **Batch Generation + Gallery** — fan a brief out into N divergent directions, browse them side-by-side in a gallery, and pick the winner to refine.
- **Post-Gen Sliders + Surgical Refine** — adjust density, warmth, contrast, motion and more via sliders, or request surgical edits ("tighten the hero, kill the gradients") without regenerating the whole tree.
- **Voice Input** — dictate briefs and edits hands-free via GLM-ASR-2512.
- **Observability** — token usage, rate-limit budget, and error tracking are surfaced in-app, so you always know what a run cost and why it failed.
- **Memory System** — User-Memory (your preferences persist), Design-History (every run is replayable), Context-Manager (long briefs stay coherent), and Progressive-Disclosure (the UI stays calm even when the agent is deep in a tree).

## Architecture

```
                         ┌─────────────────────────────────────────────┐
                         │                    UI                       │
                         │   Canvas  ·  Gallery  ·  Sliders  ·  Voice  │
                         └───────────────────┬─────────────────────────┘
                                             │
                ┌────────────────────────────┴───────────────────────────┐
                │                      Agent Core                        │
                │  Creative-Director  →  Concept + Design Tokens         │
                │         ↓                                              │
                │  6-Panelist Critique Theater  (weighted convergence)   │
                │         ↓                                              │
                │  Anti-Slop Linter  +  Design Token Discipline          │
                │         ↓                                              │
                │  5-Audit Loop  (A11y · SEO · Perf · Rhythm · Content)  │
                │         ↓                                              │
                │  Surgical Refine  /  Batch  /  Sliders                 │
                └──────────┬───────────────────────┬────────────────────┘
                           │                        │
              ┌────────────▼───────────┐  ┌─────────▼──────────┐
              │  Self-Improving Layer  │  │      Memory        │
              │  Learn → Correlate →   │  │  User · History ·  │
              │  Patch → Apply → Reload│  │  Context · Disclo. │
              └────────────┬───────────┘  └────────────────────┘
                           │
              ┌────────────▼───────────┐  ┌─────────────────────┐
              │      Z.ai (GLM-5.2)    │  │     MCP Server      │
              │   direct, no middleman │  │  (agent-controllable)│
              └────────────────────────┘  └─────────────────────┘
```

## Quick Start

> Requires [Bun](https://bun.sh) and a [Z.ai](https://z.ai) API key (BYOK).

```bash
# 1. Install dependencies
cd Projekt && bun install

# 2. Add your key
cp .env.example .env.local   # then edit .env.local and set ZAI_APIKEY=...

# 3. Run
bun run dev                  # → http://localhost:3000
```

That's it. No accounts, no cloud, no telemetry.

## How It Works

```
Brief ──► Creative-Director ──► Concept (art direction + tokens)
                                       │
                                       ▼
                            ┌──── Critique Theater ────┐
                            │  6 panelists, weighted    │
                            │  composite + convergence  │
                            └─────────────┬─────────────┘
                                  pass?   │   no ──► refine ──┐
                                 yes      ▼                   │
                            ┌─── Anti-Slop Linter ───┐        │
                            │   + Token Discipline    │        │
                            └─────────────┬───────────┘        │
                                         ▼                    │
                            ┌────── 5-Audit Loop ──────┐       │
                            │ A11y · SEO · Perf ·      │       │
                            │ Rhythm · Content + fix   │◀──────┘
                            └─────────────┬────────────┘
                                          ▼
                                Shipped Design
                                          │
                          ┌───────────────┴───────────────┐
                          ▼                               ▼
                  Skill Memory                    Memory System
            (learn → patch → reload)        (user · history · ctx)
```

## Contributing

Z.Design is open under the PolyForm Noncommercial license. See **[CONTRIBUTING.md](./CONTRIBUTING.md)** for how to add skills, design systems, panelists, audits and MCP tools.

## License

Copyright (c) Ralle1976. Licensed under the **[PolyForm Noncommercial License 1.0.0](./LICENSE)**.

Source-available for personal, research, educational and noncommercial use. Commercial use requires a separate commercial license. See `LICENSE` for the full terms.
