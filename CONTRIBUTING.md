# Contributing to Z.Design

Thanks for helping improve Z.Design. The whole point of the project is that the
agent gets measurably better over time — and that happens because the things
below (skills, design systems, panelists, audits, MCP tools) are plain, versioned
documents you can author, the agent can learn from, and anyone can review.

> **License note.** Z.Design is PolyForm Noncommercial. Contributions are accepted
> under the same license. By submitting, you agree your contribution is licensed
> under the PolyForm Noncommercial License 1.0.0.

## Project layout

```
Projekt/                 # the Next.js 16 + Bun app (the actual source)
  src/
    skills/              # SKILL.md files the agent can learn & reload
    design-systems/      # DESIGN.md design-system packs
    panelists/           # critic definitions for the Critique Theater
    audits/              # the 5-Audit Loop checkers + auto-fixers
    mcp/                 # MCP server tool definitions
examples/                # shipped example designs (gallery)
README.md · LICENSE · CONTRIBUTING.md
```

## Adding a Skill (SKILL.md)

A skill is a focused, learnable capability the agent can call upon and that the
self-improvement loop can patch at runtime. Create a Markdown file under
`Projekt/src/skills/`:

```markdown
---
name: hero-asymmetry
version: 1.0.0
triggers:
  - "asymmetric hero"
  - "off-balance above-the-fold"
weight: 0.8
applies_to: [hero, landing]
---

# Skill: Hero Asymmetry

Break the centered-hero default. Place the H1 + CTA on a 5/7 grid, let a full-
bleed image or product crop own the heavier side, and reserve a thin meta column
for trust signals.

## When to use
- Brief asks for "editorial", "premium", "magazine"
- Brand wants to read as confident, not safe

## Anti-patterns (do not produce)
- Centered H1 + stacked CTA over a flat gradient
- Equal three-column feature rows directly under the hero

## Tokens
- hero.gutter: 96px desktop / 24px mobile
- hero.image.ratio: 4/5
```

Rules:

- One skill per file. `name` must match the filename.
- Keep `triggers` to natural phrases a brief or critique would actually contain.
- `weight` (0–1) is how strongly the skill influences generation. Start at 0.6–0.8.
- The runtime hot-reloads skills — no rebuild needed. Watch the Observability
  panel to confirm the skill loaded.

The self-improvement layer will **learn** from runs that cite the skill,
**correlate** outcomes (did the audit loop fire less?), **patch** the skill file,
and **apply** it next time. Your PR is the seed; the agent iterates from there.

## Adding a Design System (DESIGN.md)

A design system is a curated token + component pack that fixes an art direction
so the agent can't drift into defaults. Put it under `Projekt/src/design-systems/`:

```markdown
---
name: street-fire
mood: raw, fiery, street-food
palette:
  ink: "#0E0B08"
  ember: "#FF4D12"
  ash: "#E8DDCC"
  paper: "#F7F1E6"
type:
  display: "Archivo Black"
  body: "Inter"
radius: 0px
motion: snappy, 180ms
---

# Street Fire

Reads like a hand-painted market stall sign, not a SaaS landing page.

## Forbidden
- Gradients
- Drop shadows on type
- Rounded cards (radius stays 0)
```

Include palette, type stack, radius, motion language, and an explicit **Forbidden**
list. The Anti-Slop Linter reads the forbidden list and fails the build if the
agent emits those patterns.

## Adding a Panelist

Panelists live in `Projekt/src/panelists/`. Each is a critic with a domain, a
scoring rubric, and a weight in the composite vote.

```typescript
// src/panelists/typography.ts
export const typographyPanelist = {
  name: 'typography',
  domain: 'type',
  weight: 0.18,                 // contributes 18% of the composite verdict
  rubric: ['scale-coherence', 'pairing-intent', 'line-length', 'vertical-rhythm'],
  score(design: Design): { score: number; notes: string } {
    // 0–1 score + free-text critique the agent reads on failure
  },
};
```

To register a new panelist, add the file and export it from the panelists index.
The Critique Theater picks it up automatically; adjust the weights so all weights
sum to 1.0.

## Adding an Audit

Audits live in `Projekt/src/audits/`. Each audit returns findings plus an optional
auto-fix the agent applies inside the 5-Audit Loop.

```typescript
// src/audits/accessibility.ts
export const accessibilityAudit = {
  domain: 'a11y',
  standard: 'WCAG 2.1 AA',
  run(design: Design): Finding[] {
    // return [] if clean, or findings with a `fix` the loop can apply
  },
};

type Finding = {
  severity: 'blocker' | 'major' | 'minor';
  message: string;
  fix?: (design: Design) => Design;   // optional auto-fix
};
```

Blockers fail the loop immediately. `major`/`minor` with a `fix` get auto-applied
and re-audited. Audit findings without a `fix` surface to the critique notes so a
panelist can react.

## Adding an MCP Tool

MCP tools are defined in `Projekt/src/mcp/`. A tool exposes one agent action to
any MCP-aware client (Claude, Cursor, your own scripts).

```typescript
// src/mcp/tools/refine.ts
export const refineTool = {
  name: 'zdesign.refine',
  description: 'Apply a surgical edit to an existing design without regenerating it.',
  inputSchema: {
    type: 'object',
    properties: {
      designId: { type: 'string' },
      instruction: { type: 'string' },  // e.g. "tighten the hero, kill the gradients"
    },
    required: ['designId', 'instruction'],
  },
  async run({ designId, instruction }) {
    // call into the same Surgical Refine path the UI uses
  },
};
```

Export it from the MCP tools index. Keep tool names under the `zdesign.` namespace
and give every tool a focused `inputSchema` — clients rely on it for autocomplete.

## Development workflow

```bash
cd Projekt
bun install
bun run dev        # http://localhost:3000
bun run lint
bun run build
```

Before opening a PR:

1. `bun run lint` passes.
2. `bun run build` passes.
3. If you added a skill/design-system/panelist/audit, run one generation that
   exercises it and confirm in the Observability panel that it loaded and the
   audit loop behaved as expected.
4. Keep files under 500 lines. Split large audits or tools.

## Commit style

Conventional commits, present tense:

```
feat(skills): add hero-asymmetry skill
fix(audits): correct WCAG contrast threshold for ember tokens
docs: expand street-fire design-system forbidden list
```

That's it — write skills the agent can learn from, fix the quality floor, and the
platform compounds. Welcome in.
