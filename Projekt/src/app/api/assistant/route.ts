// Z.Design — In-app Assistant / Copilot route.
//
// POST /api/assistant { message, projectId, context }
//
// The chat is ALSO an AI wizard: it can (a) ANSWER questions about the Z.Design
// UI/workflow (how to export, what the Fusion toggle does, agent vs node mode…)
// and (b) on request PROPOSE actions the client will auto-execute (enable the
// Agent toggle, switch viewport, export the HTML…). Think Claude-Code-style
// copilot embedded inside the app.
//
// We call Fusion (the only working generation path in this environment) with a
// system prompt that makes it the app's copilot and constrains it to return
// strict JSON: { reply, actions?: [...] }. The action vocabulary is a FIXED set
// the client understands (see ASSISTANT_ACTIONS below). We parse the model JSON
// tolerantly (jsonrepair) and validate every action against the whitelist
// before returning — a bad/unknown action is dropped, never forwarded.
//
// Replies are concise + helpful, in German.

import { NextRequest, NextResponse } from 'next/server';
import { callZai } from '@/lib/ai/zai-direct';
// jsonrepair is a runtime dependency used across the codebase to salvage
// truncated/malformed model JSON. We import it dynamically so a missing module
// degrades to our own brace-stripping fallback instead of crashing the route.
type JsonRepairFn = (text: string) => string;

export const runtime = 'nodejs';

// ─── Action vocabulary (fixed, client-validated) ───────────────────────────
// The client (ChatPanel assistant mode) ONLY understands these types. Any
// payload-bearing type must carry the exact payload shape documented here;
// otherwise the action is rejected by normalizeAction below.

export type AssistantActionType =
  | 'enable_agent' // toggle the art-directed HTML Agent mode on
  | 'enable_fusion' // toggle the Fusion multi-model pipeline on
  | 'set_viewport' // payload: 'desktop' | 'tablet' | 'mobile'
  | 'set_canvas_mode' // payload: 'ai' | 'editor'
  | 'export' // payload: 'html' (only format the assistant auto-triggers)
  | 'open_chat' // ensure the chat panel has focus / is open
  | 'explain'; // marker: this turn is purely explanatory, no side effects

export interface AssistantAction {
  type: AssistantActionType;
  payload?: string;
}

interface AssistantResponse {
  reply: string;
  actions: AssistantAction[];
}

const VIEWPORT_VALUES = new Set(['desktop', 'tablet', 'mobile']);
const CANVAS_MODE_VALUES = new Set(['ai', 'editor']);
const EXPORT_VALUES = new Set(['html']);

/**
 * The full, human-readable vocabulary — injected into the system prompt so the
 * model can only ever emit actions the client knows how to run. Keep this in
 * sync with AssistantActionType above.
 */
const ACTION_VOCABULARY = `Du kannst AKTIONEN vorschlagen, die die App automatisch ausführt. Verwende NUR diese festen Aktionstypen (type) und exakt die erlaubten payloads:
- {"type":"enable_agent"}                    — schaltet den art-directed HTML-Agent-Modus ein (Bot-Toggle).
- {"type":"enable_fusion"}                   — schaltet die Fusion-Multi-Modell-Pipeline ein (Wand-Toggle).
- {"type":"set_viewport","payload":"desktop|tablet|mobile"} — wechselt die Canvas-Ansicht.
- {"type":"set_canvas_mode","payload":"ai|editor"} — wechselt den Canvas-Modus.
- {"type":"export","payload":"html"}         — exportiert das Design als HTML.
- {"type":"open_chat"}                       — öffnet/fokussiert das Chat-Panel.
- {"type":"explain"}                         — Markierung: Diese Antwort ist nur Erklärung, ohne Aktion.

Regeln:
- Wenn der Nutzer eine FRAGE stellt (z.B. "was macht der Fusion-Schalter?", "wie exportiere ich?"), antworte mit "actions":[{"type":"explain"}] und einer knappen, hilfreichen Erklärung im Feld "reply".
- Wenn der Nutzer etwas AUSFÜHREN will (z.B. "aktiviere den Agent", "schalte auf Handy-Ansicht", "exportier das HTML"), gib die passende(n) Aktion(en) UND einen kurzen reply.
- Niemals Aktionstypen erfinden, die nicht in der Liste stehen. Niemals payloads außerhalb der erlaubten Werte. Wenn etwas unklar ist, frage kurz nach statt zu raten.
- "reply" immer auf Deutsch, max. 2–3 Sätze, freundlich und konkret.`;

/**
 * System prompt — makes the model Z.Design's in-app copilot. It knows the real
 * features (Chat, Agent/Bot toggle, Fusion toggle, Canvas, viewport, Export,
 * node-tree vs HTML-artifact design modes, design-systems) and is told the
 * current UI context so its answers + action choices are grounded.
 */
function buildSystemPrompt(ctx: AssistantContext): string {
  const lines: string[] = [
    'Du bist der eingebaute KI-Assistent ("Copilot") von Z.Design, einer KI-Design-App. Du lebst IM Chat-Panel der App.',
    '',
    'Deine Aufgabe: Du beantwortest Fragen zur Bedienung/Workflows der App UND kannst auf Wunsch Aktionen ausführen, die der Nutzer sonst per Klick auslösen würde.',
    '',
    'Was du über Z.Design weißt:',
    '- Chat: Der Nutzer beschreibt ein Design, die KI generiert es. Das Chat-Panel (hier) ist die zentrale Steuerung.',
    '- Agent/Bot-Toggle (amber): Art-directed HTML-Design-Loop (Generate → Critique → Refine → live HTML). Alternative zum Standard-Node-Tree-Modus.',
    '- Fusion-Toggle (violett/Wand): Multi-Modell-Pipeline (Panel → Judge → Synthesis) für höhere Generationsqualität.',
    '- Canvas: Hier wird das Design gerendert. Modus "ai" (KI-Vorschau) oder "editor" (Bearbeitung). Viewport desktop/tablet/mobile.',
    '- Design-Modi: "node-tree" (Standard, bearbeitbare Nodes) vs "HTML-artifact" (Agent-Modus, art-directed HTML).',
    '- Export: Design kann als HTML exportiert werden (und weitere Formate).',
    '- Design-Systems: Tokens, Komponenten und Stile lassen sich verwalten.',
    '',
    'AKTUELLER UI-ZUSTAND des Nutzers (nutze das für kontextbezogene Antworten):',
  ];
  const summary: Record<string, unknown> = {
    canvasMode: ctx.canvasMode ?? 'unknown',
    viewport: ctx.viewport ?? 'unknown',
    designMode: ctx.designMode ?? 'unknown',
    hasDesign: ctx.hasDesign === true,
    ...(ctx.agentMode !== undefined ? { agentMode: ctx.agentMode } : {}),
    ...(ctx.fusionEnabled !== undefined ? { fusionEnabled: ctx.fusionEnabled } : {}),
  };
  lines.push(JSON.stringify(summary, null, 2));
  lines.push('');
  lines.push(ACTION_VOCABULARY);
  lines.push('');
  lines.push('Antworte AUSSCHLIESSLICH als JSON-Objekt mit genau dieser Form:');
  lines.push('{"reply":"<dein Text auf Deutsch>","actions":[<Aktionen aus dem Vokabular>]}');
  lines.push('Kein Markdown, kein Code-Fence, kein Kommentar — nur das JSON-Objekt.');
  return lines.join('\n');
}

interface AssistantContext {
  canvasMode?: string;
  viewport?: string;
  designMode?: string;
  hasDesign?: boolean;
  agentMode?: boolean;
  fusionEnabled?: boolean;
  [k: string]: unknown;
}

/**
 * Validate + coerce a raw action object (from the model) into a known, safe
 * AssistantAction. Returns null for anything not in the vocabulary or with a
 * disallowed payload — the caller drops those silently rather than forwarding
 * an action the client can't run.
 */
function normalizeAction(raw: unknown): AssistantAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const { type, payload } = raw as { type?: unknown; payload?: unknown };
  if (typeof type !== 'string') return null;

  switch (type) {
    case 'enable_agent':
    case 'enable_fusion':
    case 'open_chat':
    case 'explain':
      return { type };
    case 'set_viewport':
      return typeof payload === 'string' && VIEWPORT_VALUES.has(payload)
        ? { type, payload }
        : null;
    case 'set_canvas_mode':
      return typeof payload === 'string' && CANVAS_MODE_VALUES.has(payload)
        ? { type, payload }
        : null;
    case 'export':
      return typeof payload === 'string' && EXPORT_VALUES.has(payload)
        ? { type, payload }
        : null;
    default:
      return null;
  }
}

/**
 * Salvage a model JSON blob. Prefer jsonrepair (handles truncated/malformed
 * JSON across the codebase); fall back to a defensive brace/quote repair if
 * the module is unavailable, then to the raw text. Never throws.
 */
async function repairJson(raw: string): Promise<string> {
  const trimmed = raw.trim();
  try {
    const mod: unknown = await import('jsonrepair');
    // jsonrepair exports a function (ESM default) or a default export depending
    // on resolution — accept either shape.
    const repair: JsonRepairFn | undefined =
      typeof mod === 'function'
        ? (mod as JsonRepairFn)
        : mod && typeof (mod as { default?: unknown }).default === 'function'
          ? ((mod as { default: JsonRepairFn }).default)
          : undefined;
    if (repair) return repair(trimmed);
  } catch {
    // module missing — fall through to manual repair
  }

  // Manual fallback: strip code fences, then try as-is.
  let s = trimmed;
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  return s;
}

/** Extract the first balanced {...} block from arbitrary text. */
function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  if (start < 0) return text;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

function parseAssistantPayload(raw: string): AssistantResponse | null {
  let text = raw.trim();
  // Fast path: valid JSON already.
  const tryParse = (s: string): unknown => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  let parsed = tryParse(text);
  if (parsed == null) {
    text = extractJsonObject(text);
    parsed = tryParse(text);
  }
  // jsonrepair runs server-side (async) in the caller; here we only do the
  // synchronous salvage. If both fail, the caller will await jsonrepair and
  // retry this function.
  if (parsed == null) return null;

  const obj = parsed as { reply?: unknown; actions?: unknown };
  const reply = typeof obj.reply === 'string' ? obj.reply : '';
  const rawActions = Array.isArray(obj.actions) ? obj.actions : [];
  const actions = rawActions
    .map(normalizeAction)
    .filter((a): a is AssistantAction => a !== null);

  return { reply, actions };
}

export async function POST(request: NextRequest) {
  let body: {
    message?: unknown;
    projectId?: unknown;
    context?: AssistantContext;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  const projectId =
    typeof body.projectId === 'string' && body.projectId.length > 0
      ? body.projectId
      : undefined;

  const ctx: AssistantContext =
    body.context && typeof body.context === 'object' ? body.context : {};

  const systemPrompt = buildSystemPrompt(ctx);
  const userPrompt = `Nutzernachricht: """${message}"""\nProjekt-ID: ${projectId ?? '(keine)'}\nAntworte jetzt NUR mit dem JSON-Objekt gemäß Vorgabe.`;

  // Call Z.ai directly (funded anthropic endpoint — the reliable path).
  let raw = '';
  try {
    raw = await callZai(`${systemPrompt}\n\n---\n\n${userPrompt}`, {
      maxTokens: 1024,
      temperature: 0.2,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Assistant generation failed';
    console.error('[assistant] Z.ai call failed:', msg);
    // Degrade gracefully — still return a usable (explanatory) response so the
    // UI never breaks, but signal no actions were taken.
    return NextResponse.json({
      reply:
        'Ich konnte gerade keine Verbindung zur KI herstellen. Bitte versuch es gleich noch einmal.',
      actions: [{ type: 'explain' } as AssistantAction],
    });
  }

  // Tolerant parse: try direct → balanced-extract → jsonrepair.
  let parsed = parseAssistantPayload(raw);
  if (parsed == null) {
    try {
      const repaired = await repairJson(raw);
      parsed = parseAssistantPayload(repaired);
    } catch {
      parsed = null;
    }
  }

  if (parsed == null) {
    // Couldn't extract structured JSON — return the raw text as the reply so
    // the user still sees something, with an explain marker.
    const fallback = raw.trim().slice(0, 800) || 'Ich konnte die Antwort nicht verarbeiten.';
    return NextResponse.json({
      reply: fallback,
      actions: [{ type: 'explain' } as AssistantAction],
    });
  }

  // Guarantee a non-empty reply + at least one action marker.
  const reply = parsed.reply && parsed.reply.trim().length > 0
    ? parsed.reply.trim()
    : 'Wie kann ich dir weiterhelfen?';
  const actions =
    parsed.actions.length > 0
      ? parsed.actions
      : [{ type: 'explain' } as AssistantAction];

  const response: AssistantResponse = { reply, actions };

  // Sanity-check it round-trips through JSON before returning.
  try {
    JSON.parse(JSON.stringify(response));
  } catch {
    return NextResponse.json(
      { error: 'Internal serialization error' },
      { status: 500 }
    );
  }

  return NextResponse.json(response);
}
