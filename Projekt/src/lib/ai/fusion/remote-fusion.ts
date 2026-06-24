// Z.Design - Remote Fusion client
//
// Calls the EXTERNAL Fusion HTTP service (e.g. http://127.0.0.1:3111) DIRECTLY,
// with NO in-app LLM before it. The Fusion service runs the multi-model
// panel -> judge -> synthesis pipeline using ITS OWN provider keys, so the
// Z.Design instance (and its end users) need no provider keys at all.
//
// This is the "direct to Fusion" path. It is OPTIONAL: only active when
// FUSION_SERVICE_URL is set. On any failure it throws so /api/chat falls back
// to the legacy single-provider chat path.

import { parseAIResponse, repairLLMJson } from '../../ai-prompts';
import { parseDesignNode } from './schemas';
import {
  deriveDesignDirection,
  directiveToPromptBlock,
  directiveLabel,
  type DesignDirective,
} from './design-direction';

export interface RemoteFusionInput {
  message: string;
  designTree?: Record<string, unknown>;
  designSystem?: Record<string, unknown>;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Optional pre-derived direction (route derives once, single source of truth). */
  directive?: DesignDirective;
}

export interface RemoteFusionResult {
  message: string;
  design: Record<string, unknown>;
  contributingProviders?: string[];
  strategy?: string;
  direction?: string; // human label of the derived design direction
  usedFallbackDesign: boolean;
  remote: true;
}

export class RemoteFusionError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'RemoteFusionError';
  }
}

// Per-attempt timeout for ONE Fusion call (panel + judge + synthesis). With
// MAX_ATTEMPTS=2 in callRemoteFusion the overall budget is ~2× this. A single
// synthesis of a 16K-token tree typically takes 60-150s on the coding-plan
// proxies; 220s gives headroom for one slow attempt without an unbounded wait.
const FUSION_TIMEOUT_MS = 220_000;
const MAX_HISTORY_CHARS = 1200;

/** Build the design-focused prompt Fusion should synthesize into a DesignNode tree. */
function buildDesignPrompt(input: RemoteFusionInput): string {
  const { message, designTree, designSystem, history } = input;
  // Deterministic, topic-appropriate direction (no LLM). Replaces the old
  // hardcoded emerald palette that made every design look identical.
  const directive = input.directive ?? deriveDesignDirection(message);

  let prompt = `You are generating a design for the Z.Design platform. Return ONLY a single DesignNode JSON tree (raw JSON, no markdown, no prose).\n\n`;
  prompt += `${directiveToPromptBlock(directive)}\n\n`;
  prompt += `DesignNode shape: { "id": string, "type": string, "tag"?: string, "content"?: string, "style"?: {cssInCamelCase}, "children"?: DesignNode[], "meta"?: {} }\n`;
  prompt += `Node types: root, container, flex, grid, text, heading, button, input, image, icon, link, card, nav, header, footer, section, sidebar, form, badge, avatar, divider, spacer.\n`;
  prompt += `RULES: every node needs a unique "id"; use real CSS values (px, rem, %, #hex) in camelCase; NO Tailwind shorthand; semantic HTML tags; return a COMPLETE, polished, self-contained tree; use ONLY the palette/fonts from the DESIGN-DIRECTION block above.\n`;
  prompt += `CONCISENESS (CRITICAL — large verbose trees get truncated mid-JSON and fail to parse): keep the tree complete but LEAN. Set SHARED styles (fontFamily, color, backgroundColor, lineHeight, maxWidth) ONCE at the root node and OMIT them on children — only specify NODE-SPECIFIC styles. Do NOT repeat fontFamily/color/background on every node. Prefer fewer meaningful nodes over deep verbose nesting.\n`;
  prompt += `STRUCTURE CAP (HARD LIMIT — a tree that is too large cannot be emitted validly): at most 6 top-level sections (nav, hero, services, about/testimonials, contact, footer), at most ~35 nodes total, maximum nesting depth 4. Close every object and array you open. A small COMPLETE tree is far better than a large incomplete one.\n`;
  prompt += `IMAGES: for nodes of type "image", do NOT output a URL — set "content" to an empty string, and set meta.imagePrompt (a vivid text-to-image prompt: subject, mood, composition, lighting), meta.alt (alt text), and meta.imageStatus: "pending". The platform generates the real image asynchronously. NEVER use placeholder URLs.\n`;
  prompt += `USER REQUEST: ${message}\n`;

  if (designTree && Object.keys(designTree).length > 0) {
    prompt += `\nEXISTING DESIGN TO MODIFY (return the COMPLETE updated tree):\n${JSON.stringify(designTree).slice(0, 2500)}\n`;
  }
  if (designSystem && Object.keys(designSystem).length > 0) {
    prompt += `\nDESIGN SYSTEM (use its tokens):\n${JSON.stringify(designSystem).slice(0, 800)}\n`;
  }
  if (history && history.length > 1) {
    prompt += `\nRECENT CONVERSATION:\n${history
      .slice(-4)
      .map((m) => `${m.role}: ${m.content.slice(0, 300)}`)
      .join('\n')
      .slice(0, MAX_HISTORY_CHARS)}\n`;
  }
  prompt += `\nReturn ONLY the raw DesignNode JSON now.`;
  return prompt;
}

/** Extract the synthesized text from the Fusion service response (OpenAI-shaped). */
function extractSynthesisText(data: unknown): string {
  const r = data as {
    result?: { response?: { choices?: Array<{ message?: { content?: unknown } }> } };
    response?: { choices?: Array<{ message?: { content?: unknown } }> };
  };
  const choices = r.result?.response?.choices ?? r.response?.choices ?? [];
  const content = choices[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (b && typeof b === 'object' && 'text' in b ? String((b as { text: unknown }).text) : ''))
      .join('');
  }
  return '';
}

/**
 * Call the remote Fusion service and return a validated DesignNode.
 * Throws RemoteFusionError on any failure (caller falls back).
 */
export async function callRemoteFusion(
  input: RemoteFusionInput,
  fusionBaseUrl: string,
): Promise<RemoteFusionResult> {
  const base = fusionBaseUrl.replace(/\/+$/, '');
  const url = `${base}/api/v1/fusion`;
  // Derive the topic-appropriate direction ONCE (cheap, deterministic). Passed
  // into the prompt as enforced tokens; surfaced in the result for the UI/log.
  const directive = input.directive ?? deriveDesignDirection(input.message);
  // Synthesis occasionally emits malformed JSON on large nested trees even at
  // low temperature. Each Fusion call is an independent sample, so a single
  // retry on parse failure makes end-to-end success reliable.
  const MAX_ATTEMPTS = 2;
  let design: Record<string, unknown> | null = null;
  let raw = '';
  let data: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FUSION_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: buildDesignPrompt({ ...input, directive }),
          // 20K leaves room to CLOSE a complete tree. At 16K a verbose tree
          // gets cut mid-generation leaving many unclosed braces → unparseable.
          maxTokens: 20480,
          // Low temperature: the creative direction is supplied deterministically
          // by the directive, so valid-JSON faithfulness matters more than token
          // randomness. Higher temps produced surplus/mismatched braces → fallback.
          temperature: 0.35,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new RemoteFusionError(`Fusion service returned ${res.status}: ${body.slice(0, 200)}`, res.status);
      }
      data = await res.json();
    } catch (e) {
      if (e instanceof RemoteFusionError) throw e;
      throw new RemoteFusionError(
        `Fusion service unreachable: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      clearTimeout(timer);
    }

    raw = extractSynthesisText(data);
    if (!raw) {
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`[Fusion] empty synthesis (attempt ${attempt}/${MAX_ATTEMPTS}), retrying`);
        continue;
      }
      throw new RemoteFusionError('Fusion service returned no synthesized content');
    }

    // Parse + validate into a DesignNode. Multiple rescue layers (never silent):
    // parseDesignNode (direct → fenced → jsonrepair) → parseAIResponse extract →
    // repairLLMJson regex → parseDesignNode.
    const direct = parseDesignNode(raw);
    if (direct.ok) design = direct.data as unknown as Record<string, unknown>;

    if (!design) {
      const parsed = parseAIResponse(raw); // handles {design:...} wrapper, markdown
      if (parsed.design) {
        const v = parseDesignNode(JSON.stringify(parsed.design));
        if (v.ok) design = v.data as unknown as Record<string, unknown>;
      }
    }
    if (!design) {
      const repaired = repairLLMJson(raw);
      if (repaired) {
        const v = parseDesignNode(repaired);
        if (v.ok) design = v.data as unknown as Record<string, unknown>;
      }
    }

    if (design) break;
    if (attempt < MAX_ATTEMPTS) {
      console.warn(`[Fusion] synthesis JSON unparseable after repair (attempt ${attempt}/${MAX_ATTEMPTS}), retrying`);
    }
  }

  const meta = data as { result?: { strategy?: string; contributingProviders?: string[] } };
  const label = directiveLabel(directive);
  const llmMessage = (parseAIResponse(raw).message || '').slice(0, 160);
  const message = llmMessage
    ? `${llmMessage} (Richtung: ${label})`
    : `Design via Fusion · Richtung: ${label}`;

  if (!design) {
    // Synthesis ran but produced no usable tree across retries — surface a
    // clear error so the caller can fall back rather than render a blank canvas.
    throw new RemoteFusionError('Fusion synthesis could not be parsed into a design tree after retries');
  }

  return {
    message,
    design,
    direction: label,
    strategy: meta.result?.strategy,
    contributingProviders: meta.result?.contributingProviders,
    usedFallbackDesign: false,
    remote: true,
  };
}
