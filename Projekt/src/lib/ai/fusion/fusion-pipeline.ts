// Z.Design - Fusion Pipeline (Panel -> Judge -> Synthesis)
//
// A multi-model orchestration engine that runs several DIFFERENT models
// concurrently as a panel, has an independent judge produce a ranked fusion
// directive, and a synthesis model assemble the final DesignNode tree from it.
//
// Reliability contract:
//   * Never hangs   — every LLM call is wrapped in withTimeout().
//   * Never silent  — every output is Zod-validated; invalid -> 1 retry with
//                     the error fed back -> repair -> fallback design.
//   * Always degrades — persona routing falls back to Z.ai; any unrecoverable
//                     failure throws FusionUnavailableError so the API route can
//                     fall back to the legacy chat path.

import { ProviderRegistry } from '../providers/registry';
import { getSkillPack } from '../agents/skill-packs';
import { generateStyleDNA, styleDNAToPrompt, getColorPalette } from '../agents/style-dna';
import { parseAIResponse, repairLLMJson } from '../../ai-prompts';
import {
  ProposalSchema,
  FusionDirectiveSchema,
  parseDesignNode,
  type DesignNodeLike,
  type Proposal,
  type FusionDirective,
} from './schemas';
import { resolvePersonaProvider, personaPreferredModel, describeRouting, type PersonaRole } from './persona-routing';
import { directiveToPromptBlock, directiveLabel, type DesignDirective } from './design-direction';
import type { LLMChatRequest, LLMChatResponse } from '../providers/types';
import type { AgentRole } from '../agents/types';

// ============ Public Types ============

export interface FusionRunInput {
  message: string;
  designTree?: Record<string, unknown>;
  designSystem?: Record<string, unknown>;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  preferredProvider?: string;
  /** Pre-derived topic-appropriate direction (enforced tokens for panel + synthesis). */
  directive?: DesignDirective;
}

export interface FusionStageInfo {
  brief: boolean;
  panelSuccessCount: number;
  panelTotal: number;
  judge: boolean;
  judgeRetried: boolean;
  synthesis: boolean;
  synthesisRetried: boolean;
  usedFallbackDesign: boolean;
}

export interface FusionResult {
  message: string;
  design: Record<string, unknown>;
  styleDNA: Record<string, unknown>;
  routing: Array<{ role: string; providerId: string; providerName: string; model?: string; isPreferred: boolean }>;
  stages: FusionStageInfo;
  providerUsed: string;
  direction?: string; // human label of the derived design direction
  fusion: true;
}

export class FusionUnavailableError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'FusionUnavailableError';
  }
}

// ============ Tuning Constants ============

const TIMEOUT_PANEL = 30_000;
const TIMEOUT_JUDGE = 25_000;
const TIMEOUT_SYNTH = 40_000;
const TIMEOUT_BRIEF = 25_000;
const MAX_HISTORY_CHARS = 1200;

const PANEL_ROLES: PersonaRole[] = ['ux-architect', 'visual-designer', 'innovation-agent'];

const TEMP: Record<PersonaRole, number> = {
  'creative-director': 0.6,
  'ux-architect': 0.7,
  'visual-designer': 0.8,
  'innovation-agent': 0.95,
  'critique-agent': 0.3,
  'synthesis-agent': 0.4,
};

// ============ Helpers ============

/** Race a promise against a timer; rejects on timeout so callers can settle. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Fusion stage timed out after ${ms}ms: ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function safeJsonParse(text: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// ============ Fusion Pipeline ============

export class FusionPipeline {
  private registry: ProviderRegistry;

  constructor(registry?: ProviderRegistry) {
    this.registry = registry ?? ProviderRegistry.getInstance();
  }

  // ---------- Entry point ----------

  async run(input: FusionRunInput): Promise<FusionResult> {
    const { message, designTree, designSystem, history } = input;
    const configs = this.registry.getAllConfigs();
    // Topic-appropriate direction as enforced tokens (deterministic). Threaded
    // into panel + synthesis so palette/typography are coherent & topic-fitted.
    const dirBlock = input.directive ? `\n${directiveToPromptBlock(input.directive)}\n` : '';
    const stages: FusionStageInfo = {
      brief: false,
      panelSuccessCount: 0,
      panelTotal: PANEL_ROLES.length,
      judge: false,
      judgeRetried: false,
      synthesis: false,
      synthesisRetried: false,
      usedFallbackDesign: false,
    };
    const routing: FusionResult['routing'] = [];

    // ---------- STAGE 1: Brief (creative-director) ----------
    const brief = await this.runBrief(message, designTree, designSystem, history, stages);

    // ---------- Style DNA ----------
    const styleDNA = generateStyleDNA(brief.styleDirection as never);
    const stylePrompt = styleDNAToPrompt(styleDNA);

    // ---------- STAGE 2: Panel (concurrent fan-out) ----------
    const proposals = await this.runPanel(brief, stylePrompt, dirBlock, designTree, configs, routing, stages);
    if (proposals.length === 0) {
      throw new FusionUnavailableError('All panel agents failed or timed out');
    }

    // ---------- STAGE 3: Judge -> Fusion Directive ----------
    const directive = await this.runJudge(brief, stylePrompt, proposals, configs, routing, stages);

    // ---------- STAGE 4: Synthesis -> validated DesignNode ----------
    const design = await this.runSynthesis(
      brief,
      stylePrompt,
      dirBlock,
      proposals,
      directive,
      designTree,
      configs,
      routing,
      stages,
    );

    return {
      message: brief.summary || 'I generated a design via the Fusion pipeline.',
      design,
      styleDNA: styleDNA as unknown as Record<string, unknown>,
      routing,
      stages,
      providerUsed: routing.find((r) => r.role === 'synthesis-agent')?.providerName ?? 'zai',
      direction: input.directive ? directiveLabel(input.directive) : undefined,
      fusion: true,
    };
  }

  // ---------- Stage implementations ----------

  private async runBrief(
    message: string,
    designTree: Record<string, unknown> | undefined,
    designSystem: Record<string, unknown> | undefined,
    history: Array<{ role: 'user' | 'assistant'; content: string }> | undefined,
    stages: FusionStageInfo,
  ) {
    let historyHint = '';
    if (history && history.length > 1) {
      historyHint =
        '\n\n## RECENT CONVERSATION\n' +
        history
          .slice(-4)
          .map((m) => `${m.role}: ${m.content.slice(0, 300)}`)
          .join('\n')
          .slice(0, MAX_HISTORY_CHARS);
    }
    const modifyHint =
      designTree && Object.keys(designTree).length > 0
        ? '\n\nThe user has an EXISTING design they want to MODIFY. Focus the brief on the modification direction.'
        : '';
    const dsHint =
      designSystem && Object.keys(designSystem).length > 0
        ? `\n\nDesign System context: ${JSON.stringify(designSystem).slice(0, 500)}`
        : '';

    const prompt = `Create a design brief for this request:\n"${message}"${historyHint}${modifyHint}${dsHint}`;

    try {
      const res = await withTimeout(
        this.callPersona('creative-director', prompt),
        TIMEOUT_BRIEF,
        'brief',
      );
      const parsed = safeJsonParse(res.content);
      if (parsed) {
        stages.brief = true;
        return {
          summary: (parsed.summary as string) || message,
          projectType: (parsed.projectType as string) || 'PROTOTYPE',
          targetAudience: (parsed.targetAudience as string) || 'General users',
          styleDirection: (parsed.styleDirection as string) || 'mixed-creative',
          keyRequirements: Array.isArray(parsed.keyRequirements) ? (parsed.keyRequirements as string[]) : [],
          constraints: Array.isArray(parsed.constraints) ? (parsed.constraints as string[]) : [],
          inspirationKeywords: Array.isArray(parsed.inspirationKeywords) ? (parsed.inspirationKeywords as string[]) : [],
        };
      }
    } catch (e) {
      console.warn('[Fusion] Brief stage failed, using default brief:', e instanceof Error ? e.message : e);
    }
    // Fallback brief — never fatal
    return {
      summary: message,
      projectType: 'PROTOTYPE',
      targetAudience: 'General users',
      styleDirection: 'mixed-creative',
      keyRequirements: [message],
      constraints: [],
      inspirationKeywords: [],
    };
  }

  private async runPanel(
    brief: { summary: string; projectType: string; targetAudience: string; styleDirection: string; keyRequirements: string[]; constraints: string[]; inspirationKeywords: string[] },
    stylePrompt: string,
    dirBlock: string,
    designTree: Record<string, unknown> | undefined,
    configs: ReturnType<ProviderRegistry['getAllConfigs']>,
    routing: FusionResult['routing'],
    stages: FusionStageInfo,
  ): Promise<Array<Proposal & { role: PersonaRole }>> {
    const modifyHint =
      designTree && Object.keys(designTree).length > 0
        ? `\n\n## EXISTING DESIGN (modify this)\n${JSON.stringify(designTree).slice(0, 1800)}`
        : '';

    const settled = await Promise.allSettled(
      PANEL_ROLES.map(async (role) => {
        const prompt =
          `## DESIGN BRIEF\n${JSON.stringify(brief, null, 2)}\n\n${stylePrompt}${dirBlock}${modifyHint}` +
          (role === 'innovation-agent'
            ? `\n\nREMEMBER: Be BOLD and SURPRISING. Propose an unconventional angle nobody else would.`
            : '');
        const res = await withTimeout(this.callPersona(role, prompt), TIMEOUT_PANEL, `panel:${role}`);
        const parsed = safeJsonParse(res.content) ?? {};
        const validation = ProposalSchema.safeParse({ ...parsed, _raw: res.content });
        if (validation.success) {
          return { ...validation.data, role } as Proposal & { role: PersonaRole };
        }
        // Lenient accept: if JSON.parse failed entirely, treat raw text as the proposal content.
        return {
          content: typeof res.content === 'string' ? res.content.slice(0, 800) : '',
          creativity: role === 'innovation-agent' ? 0.9 : 0.5,
          confidence: 0.4,
          role,
        } as Proposal & { role: PersonaRole };
      }),
    );

    // Record routing for the first successful call per role (best-effort snapshot)
    for (const role of PANEL_ROLES) {
      const providerId = resolvePersonaProvider(role, configs);
      routing.push(describeRouting(role, providerId, configs));
    }

    const proposals: Array<Proposal & { role: PersonaRole }> = [];
    settled.forEach((s, i) => {
      if (s.status === 'fulfilled' && s.value && (s.value.content || s.value.designSuggestion || s.value.design)) {
        proposals.push(s.value);
      } else if (s.status === 'rejected') {
        console.warn(`[Fusion] Panel agent ${PANEL_ROLES[i]} rejected:`, s.reason instanceof Error ? s.reason.message : s.reason);
      }
    });
    stages.panelSuccessCount = proposals.length;
    return proposals;
  }

  private async runJudge(
    brief: { summary: string; styleDirection: string },
    stylePrompt: string,
    proposals: Array<Proposal & { role: PersonaRole }>,
    configs: ReturnType<ProviderRegistry['getAllConfigs']>,
    routing: FusionResult['routing'],
    stages: FusionStageInfo,
  ): Promise<FusionDirective> {
    const providerId = resolvePersonaProvider('critique-agent', configs);
    routing.push(describeRouting('critique-agent', providerId, configs));

    const proposalsText = proposals
      .map(
        (p, i) =>
          `### Proposal ${i + 1}: ${p.role}\nApproach: ${p.content || '(no text)'}\nConfidence: ${p.confidence ?? 0.5}`,
      )
      .join('\n\n');

    const basePrompt =
      `## DESIGN BRIEF\n${JSON.stringify({ summary: brief.summary, styleDirection: brief.styleDirection })}\n\n${stylePrompt}\n\n` +
      `## PROPOSALS TO EVALUATE\n${proposalsText}\n\n` +
      `You are the JUDGE of a multi-model design panel. Do NOT create the final design. ` +
      `Return ONLY JSON:\n` +
      `{\n  "critique": "short critique of the set",\n` +
      `  "fusion_directive": "precise, structural instruction: WHICH elements from WHICH proposal to merge (e.g. 'use proposal 1's layout grid, proposal 2's color/typography system, weave in proposal 3's hero concept')",\n` +
      `  "strengths": ["..."],\n  "issues": ["..."],\n` +
      `  "ranking": [{ "role": "ux-architect", "rank": 1, "reason": "..." }]\n}`;

    const call = (extra: string) => this.callPersona('critique-agent', `${basePrompt}${extra}`, providerId);

    // Attempt 1
    let res: LLMChatResponse | undefined;
    try {
      res = await withTimeout(call(''), TIMEOUT_JUDGE, 'judge');
    } catch (e) {
      console.warn('[Fusion] Judge stage failed:', e instanceof Error ? e.message : e);
    }

    let directive = this.parseDirective(res?.content);

    // Retry once with the validation error fed back
    if (!directive && res?.content) {
      stages.judgeRetried = true;
      try {
        const retry = await withTimeout(
          call('\n\nYour previous output was not valid JSON matching the schema. Return ONLY the JSON object now.'),
          TIMEOUT_JUDGE,
          'judge-retry',
        );
        directive = this.parseDirective(retry.content);
      } catch (e) {
        console.warn('[Fusion] Judge retry failed:', e instanceof Error ? e.message : e);
      }
    }

    if (directive) {
      stages.judge = true;
      return directive;
    }

    // Ultimate fallback directive: use the highest-confidence proposal as-is
    const best = [...proposals].sort((a, b) => (b.confidence ?? 0.5) - (a.confidence ?? 0.5))[0];
    return {
      critique: 'Judge unavailable; defaulting to highest-confidence proposal.',
      fusion_directive: `Build the final design primarily from the ${best?.role ?? 'first'} proposal.`,
    };
  }

  private async runSynthesis(
    brief: { summary: string; projectType: string },
    stylePrompt: string,
    dirBlock: string,
    proposals: Array<Proposal & { role: PersonaRole }>,
    directive: FusionDirective,
    designTree: Record<string, unknown> | undefined,
    configs: ReturnType<ProviderRegistry['getAllConfigs']>,
    routing: FusionResult['routing'],
    stages: FusionStageInfo,
  ): Promise<Record<string, unknown>> {
    const providerId = resolvePersonaProvider('synthesis-agent', configs);
    routing.push(describeRouting('synthesis-agent', providerId, configs));

    const proposalsText = proposals
      .map((p) => `### ${p.role}\n${p.content || '(no text)'}\n${p.designSuggestion ? `Design hint: ${JSON.stringify(p.designSuggestion).slice(0, 800)}` : ''}`)
      .join('\n\n');

    const modifyHint =
      designTree && Object.keys(designTree).length > 0
        ? `\n\n## EXISTING DESIGN TO MODIFY\n${JSON.stringify(designTree).slice(0, 1800)}`
        : '';

    const basePrompt =
      `## DESIGN BRIEF\n${JSON.stringify({ summary: brief.summary, projectType: brief.projectType })}\n\n${stylePrompt}${dirBlock}\n\n` +
      `## AGENT PROPOSALS\n${proposalsText}\n\n` +
      `## FUSION DIRECTIVE (from the judge — follow this)\n${directive.fusion_directive || directive.directive || '(none)'}\n` +
      `${directive.critique ? `\nJudge critique: ${directive.critique}` : ''}${modifyHint}\n\n` +
      `Now build the FINAL design as a single DesignNode JSON tree. Use ONLY the palette/fonts from the DESIGN-DIRECTION block.\n` +
      `DesignNode: { "id": string, "type": string, "tag"?: string, "content"?: string, "style"?: {cssInCamelCase}, "children"?: DesignNode[], "meta"?: {} }\n` +
      `Node types: root, container, flex, grid, text, heading, button, input, image, icon, link, card, nav, header, footer, section, sidebar, form, badge, avatar, divider, spacer.\n` +
      `RULES: Return ONLY raw JSON (no markdown, no prose). Every node needs a unique "id". Use real CSS values (px, rem, %, #hex) in camelCase. Return a COMPLETE, self-contained tree.`;

    const call = (extra: string) => this.callPersona('synthesis-agent', `${basePrompt}${extra}`, providerId);

    // Attempt 1
    let raw: string | undefined;
    try {
      raw = (await withTimeout(call(''), TIMEOUT_SYNTH, 'synthesis')).content;
    } catch (e) {
      console.warn('[Fusion] Synthesis stage failed:', e instanceof Error ? e.message : e);
    }

    let node = raw ? this.validateDesign(raw) : undefined;

    // Retry once with the Zod error fed back
    if (!node && raw) {
      stages.synthesisRetried = true;
      const err = parseDesignNode(raw).error ?? 'invalid JSON';
      try {
        const retry = await withTimeout(
          call(`\n\nYour previous output was invalid: ${err}. Return ONLY a valid DesignNode JSON tree now.`),
          TIMEOUT_SYNTH,
          'synthesis-retry',
        );
        node = this.validateDesign(retry.content);
      } catch (e) {
        console.warn('[Fusion] Synthesis retry failed:', e instanceof Error ? e.message : e);
      }
    }

    // Repair pass
    if (!node && raw) {
      const repaired = repairLLMJson(raw);
      if (repaired) {
        node = this.validateDesign(repaired);
        if (!node) {
          const extracted = parseAIResponse(raw);
          if (extracted.design) node = this.validateDesign(JSON.stringify(extracted.design));
        }
      }
    }

    if (node) {
      stages.synthesis = true;
      return node as unknown as Record<string, unknown>;
    }

    // Final fallback: minimal valid design so the canvas is never blank
    stages.usedFallbackDesign = true;
    return minimalFallbackDesign(brief.summary, brief.projectType);
  }

  // ---------- Low-level helpers ----------

  /** Call a persona via the registry's persona-aware router. */
  private async callPersona(role: PersonaRole, userPrompt: string, preferredProvider?: string): Promise<LLMChatResponse> {
    const skill = getSkillPack(role as AgentRole);
    const request: LLMChatRequest = {
      messages: [
        { role: 'system', content: skill?.systemPrompt ?? FALLBACK_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: TEMP[role],
      model: personaPreferredModel(role),
    };
    // routedChat resolves the persona's provider (degrading to Z.ai); preferredProvider overrides only when set.
    return this.registry.routedChat(role, request, preferredProvider);
  }

  private parseDirective(content: string | undefined): FusionDirective | null {
    if (!content) return null;
    const parsed = safeJsonParse(content);
    if (!parsed) return null;
    const result = FusionDirectiveSchema.safeParse(parsed);
    return result.success ? result.data : null;
  }

  private validateDesign(raw: string): DesignNodeLike | undefined {
    const result = parseDesignNode(raw);
    return result.ok ? result.data : undefined;
  }
}

// ============ Fallbacks ============

const FALLBACK_SYSTEM_PROMPT =
  'You are an expert visual design agent inside the Z.Design Fusion pipeline. ' +
  'Return ONLY valid JSON as instructed, with no markdown and no prose.';

/** Minimal but valid design tree so the canvas is never blank after a synthesis failure. */
function minimalFallbackDesign(summary: string, projectType: string): Record<string, unknown> {
  const colors = getColorPalette('ocean-blues');
  return {
    id: 'root',
    type: 'root',
    tag: 'div',
    style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif' },
    meta: { name: `${projectType} — ${summary}`.slice(0, 80) },
    children: [
      {
        id: 'fb-hero',
        type: 'section',
        tag: 'section',
        style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: '1', padding: '80px 32px', textAlign: 'center', backgroundColor: colors.surface },
        children: [
          { id: 'fb-h1', type: 'heading', tag: 'h1', content: summary.slice(0, 80) || 'Your design', style: { fontSize: '40px', fontWeight: '800', color: colors.text, maxWidth: '640px' } },
          { id: 'fb-p', type: 'text', tag: 'p', content: 'Generated via Fusion fallback. Tell me what to change!', style: { fontSize: '16px', color: colors.textSecondary, maxWidth: '440px', marginTop: '12px' } },
        ],
      },
    ],
  };
}
