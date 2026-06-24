// Z.Design - Creative Agent Orchestra
// Orchestrates multiple specialized agents in a creative loop to produce
// high-quality, varied designs through collaboration and critique

import { ProviderRegistry } from '../providers/registry';
import { parseAIResponse } from '../../ai-prompts';
import { getSkillPack } from './skill-packs';
import { generateStyleDNA, styleDNAToPrompt, getColorPalette } from './style-dna';
import type {
  CreativeLoopResult,
  CreativeLoopConfig,
  DesignBrief,
  StyleDNA,
  AgentProposal,
  AgentRole,
} from './types';

// ============ Default Configuration ============

const DEFAULT_CONFIG: CreativeLoopConfig = {
  maxIterations: 2,
  enableInnovation: true,
  enableCritique: true,
  creativityLevel: 0.7,
};

// ============ Typed error (no more silent '{}' failures) ============

/**
 * Thrown by callAgent when an agent call fails. Previously callAgent returned a
 * fake `{ content: '{}' }` that silently corrupted downstream parsing; now it
 * fails loud so callers (e.g. /api/creative's try/catch) can detect the failure
 * and degrade to a working path instead of synthesizing from empty proposals.
 */
export class AgentCallError extends Error {
  constructor(
    message: string,
    public readonly role: AgentRole,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AgentCallError';
  }
}

// ============ Creative Agent Orchestra ============

export class CreativeOrchestra {
  private registry: ProviderRegistry;
  private config: CreativeLoopConfig;

  constructor(config?: Partial<CreativeLoopConfig>) {
    this.registry = ProviderRegistry.getInstance();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============ Main Creative Loop ============

  async execute(
    userMessage: string,
    existingDesign?: Record<string, unknown>,
    designSystem?: Record<string, unknown>
  ): Promise<CreativeLoopResult> {
    let totalTokens = 0;
    const proposals: AgentProposal[] = [];
    let providerUsed = 'zai';

    // ============ STEP 1: Creative Director → Design Brief ============
    console.log('[Orchestra] Step 1: Creative Director creating brief...');

    const briefPrompt = this.buildBriefPrompt(userMessage, existingDesign, designSystem);
    const briefResponse = await this.callAgent('creative-director', briefPrompt);
    totalTokens += briefResponse.tokens || 0;
    providerUsed = briefResponse.provider;

    let brief: DesignBrief;
    try {
      const parsed = JSON.parse(briefResponse.content);
      brief = {
        summary: parsed.summary || userMessage,
        projectType: parsed.projectType || 'PROTOTYPE',
        targetAudience: parsed.targetAudience || 'General users',
        styleDirection: parsed.styleDirection || 'mixed-creative',
        keyRequirements: Array.isArray(parsed.keyRequirements) ? parsed.keyRequirements : [],
        constraints: Array.isArray(parsed.constraints) ? parsed.constraints : [],
        inspirationKeywords: Array.isArray(parsed.inspirationKeywords) ? parsed.inspirationKeywords : [],
      };
    } catch {
      brief = {
        summary: userMessage,
        projectType: 'PROTOTYPE',
        targetAudience: 'General users',
        styleDirection: 'mixed-creative',
        keyRequirements: [userMessage],
        constraints: [],
        inspirationKeywords: [],
      };
    }

    // ============ STEP 2: Generate Style DNA ============
    console.log('[Orchestra] Step 2: Generating Style DNA...');
    const styleDNA = generateStyleDNA(
      brief.styleDirection as StyleDNA['direction'],
      this.config.styleDNA
    );
    const stylePrompt = styleDNAToPrompt(styleDNA);

    // ============ STEP 3: Parallel Agent Proposals ============
    console.log('[Orchestra] Step 3: Collecting agent proposals...');

    // UX Architect proposal
    const uxPrompt = this.buildAgentPrompt('ux-architect', brief, stylePrompt, existingDesign);
    const uxResponse = await this.callAgent('ux-architect', uxPrompt);
    totalTokens += uxResponse.tokens || 0;
    proposals.push(this.parseProposal('ux-architect', uxResponse));

    // Visual Designer proposal
    const visualPrompt = this.buildAgentPrompt('visual-designer', brief, stylePrompt, existingDesign);
    const visualResponse = await this.callAgent('visual-designer', visualPrompt);
    totalTokens += visualResponse.tokens || 0;
    proposals.push(this.parseProposal('visual-designer', visualResponse));

    // Innovation Agent (optional, based on config)
    if (this.config.enableInnovation) {
      const innovationPrompt = this.buildAgentPrompt('innovation-agent', brief, stylePrompt, existingDesign);
      const innovationResponse = await this.callAgent('innovation-agent', innovationPrompt);
      totalTokens += innovationResponse.tokens || 0;
      proposals.push(this.parseProposal('innovation-agent', innovationResponse));
    }

    // ============ STEP 4: Critique ============
    let critique: AgentProposal | null = null;
    if (this.config.enableCritique && proposals.length > 0) {
      console.log('[Orchestra] Step 4: Critique Agent evaluating...');
      const critiquePrompt = this.buildCritiquePrompt(brief, stylePrompt, proposals);
      const critiqueResponse = await this.callAgent('critique-agent', critiquePrompt);
      totalTokens += critiqueResponse.tokens || 0;
      critique = this.parseProposal('critique-agent', critiqueResponse);
    }

    // ============ STEP 5: Synthesis ============
    console.log('[Orchestra] Step 5: Synthesis Agent creating final design...');
    const synthPrompt = this.buildSynthesisPrompt(brief, stylePrompt, proposals, critique, existingDesign);
    const synthResponse = await this.callAgent('synthesis-agent', synthPrompt);
    totalTokens += synthResponse.tokens || 0;

    const parsedSynth = parseAIResponse(synthResponse.content);
    const finalDesign = parsedSynth.design || this.createFallbackDesign(brief, styleDNA);

    return {
      brief,
      styleDNA,
      proposals,
      critique: critique || {
        agentRole: 'critique-agent',
        agentName: 'Vera',
        content: 'Critique was skipped',
        reasoning: 'Critique disabled in config',
        creativity: 0,
        confidence: 0,
      },
      finalDesign: finalDesign as Record<string, unknown>,
      iterations: 1,
      totalTokensUsed: totalTokens,
      providerUsed,
    };
  }

  // ============ Helper Methods ============

  private async callAgent(role: AgentRole, prompt: string): Promise<{
    content: string;
    tokens: number;
    provider: string;
  }> {
    const skill = getSkillPack(role);
    if (!skill) {
      throw new Error(`No skill pack found for role: ${role}`);
    }

    try {
      const response = await this.registry.chat({
        messages: [
          { role: 'system', content: skill.systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: role === 'innovation-agent' ? 0.9 : role === 'critique-agent' ? 0.3 : 0.7,
      }, this.config.preferredProvider);

      return {
        content: response.content,
        tokens: response.usage?.totalTokens || 0,
        provider: response.provider,
      };
    } catch (error) {
      // Fail loud: previously this returned `{ content: '{}' }`, which silently
      // produced empty proposals that corrupted the synthesis stage. Throwing
      // lets the caller detect the failure and fall back to a working path.
      console.warn(`[Orchestra] Agent ${role} failed:`, error);
      throw new AgentCallError(`Agent "${role}" call failed`, role, error);
    }
  }

  private buildBriefPrompt(
    userMessage: string,
    existingDesign?: Record<string, unknown>,
    designSystem?: Record<string, unknown>
  ): string {
    let prompt = `Create a design brief for this request: "${userMessage}"`;
    if (existingDesign && Object.keys(existingDesign).length > 0) {
      prompt += `\n\nThe user has an existing design they want to modify. The brief should focus on the MODIFICATION direction.`;
    }
    if (designSystem && Object.keys(designSystem).length > 0) {
      prompt += `\n\nDesign System context: ${JSON.stringify(designSystem).substring(0, 500)}`;
    }
    return prompt;
  }

  private buildAgentPrompt(
    role: AgentRole,
    brief: DesignBrief,
    stylePrompt: string,
    existingDesign?: Record<string, unknown>
  ): string {
    let prompt = `## DESIGN BRIEF\n${JSON.stringify(brief, null, 2)}\n\n${stylePrompt}`;

    if (existingDesign && Object.keys(existingDesign).length > 0) {
      prompt += `\n\n## EXISTING DESIGN (modify this)\n${JSON.stringify(existingDesign).substring(0, 2000)}`;
    }

    if (role === 'innovation-agent') {
      prompt += `\n\nREMEMBER: Be BOLD and SURPRISING. Propose something nobody else would think of. Creativity level: ${Math.round(this.config.creativityLevel * 100)}%`;
    }

    return prompt;
  }

  private buildCritiquePrompt(
    brief: DesignBrief,
    stylePrompt: string,
    proposals: AgentProposal[]
  ): string {
    let prompt = `## DESIGN BRIEF\n${JSON.stringify(brief, null, 2)}\n\n${stylePrompt}\n\n## PROPOSALS TO EVALUATE\n`;
    proposals.forEach((p, i) => {
      prompt += `\n### Proposal ${i + 1}: ${p.agentName} (${p.agentRole})\n${p.content}\n`;
      if (p.designSuggestion) {
        prompt += `Design: ${JSON.stringify(p.designSuggestion).substring(0, 1500)}\n`;
      }
    });
    return prompt;
  }

  private buildSynthesisPrompt(
    brief: DesignBrief,
    stylePrompt: string,
    proposals: AgentProposal[],
    critique: AgentProposal | null,
    existingDesign?: Record<string, unknown>
  ): string {
    let prompt = `## DESIGN BRIEF\n${JSON.stringify(brief, null, 2)}\n\n${stylePrompt}\n\n## AGENT PROPOSALS\n`;

    proposals.forEach((p, i) => {
      prompt += `\n### ${p.agentName} (${p.agentRole})\nApproach: ${p.content}\n`;
      if (p.designSuggestion) {
        prompt += `Design suggestion: ${JSON.stringify(p.designSuggestion).substring(0, 2000)}\n`;
      }
    });

    if (critique) {
      prompt += `\n## CRITIQUE FEEDBACK\n${critique.content}\n`;
    }

    if (existingDesign && Object.keys(existingDesign).length > 0) {
      prompt += `\n## EXISTING DESIGN TO MODIFY\n${JSON.stringify(existingDesign).substring(0, 2000)}`;
    }

    prompt += `\n\nNow create the FINAL SYNTHESIZED design. Take the best structure from UX Architect, apply the visual language from Visual Designer, weave in ONE key innovative element from Innovation Agent, and address all critical issues from the Critique. Return the complete DesignNode tree.`;

    return prompt;
  }

  private parseProposal(role: AgentRole, response: { content: string; tokens: number; provider: string }): AgentProposal {
    const skill = getSkillPack(role);
    try {
      const parsed = JSON.parse(response.content);
      return {
        agentRole: role,
        agentName: skill?.name || role,
        content: parsed.content || parsed.reasoning || response.content.substring(0, 500),
        designSuggestion: parsed.designSuggestion || parsed.design || null,
        reasoning: parsed.reasoning || '',
        creativity: typeof parsed.creativity === 'number' ? parsed.creativity : (role === 'innovation-agent' ? 0.9 : 0.5),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
      };
    } catch {
      return {
        agentRole: role,
        agentName: skill?.name || role,
        content: response.content.substring(0, 500),
        designSuggestion: null,
        reasoning: '',
        creativity: role === 'innovation-agent' ? 0.9 : 0.5,
        confidence: 0.3,
      };
    }
  }

  private createFallbackDesign(brief: DesignBrief, styleDNA: StyleDNA): Record<string, unknown> {
    const colors = getColorPalette(styleDNA.colorMood);
    return {
      id: 'root',
      type: 'root',
      tag: 'div',
      style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif' },
      meta: { name: brief.summary },
      children: [
        {
          id: 'header-1', type: 'header', tag: 'header',
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', backgroundColor: colors.bg, borderBottom: `1px solid ${colors.border}` },
          children: [
            { id: 'logo-1', type: 'text', tag: 'span', content: 'Z.Design', style: { fontSize: '20px', fontWeight: '700', color: colors.primary } },
            { id: 'cta-1', type: 'button', tag: 'button', content: 'Get Started', style: { padding: '8px 20px', backgroundColor: colors.primary, color: colors.bg, borderRadius: '8px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer' } },
          ],
        },
        {
          id: 'hero-1', type: 'section', tag: 'section',
          style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: '1', padding: '80px 32px', textAlign: 'center', backgroundColor: colors.surface },
          children: [
            { id: 'h1-1', type: 'heading', tag: 'h1', content: brief.summary, style: { fontSize: '48px', fontWeight: '800', color: colors.text, maxWidth: '700px', marginBottom: '20px' } },
            { id: 'p-1', type: 'text', tag: 'p', content: `Designed with ${brief.styleDirection.replace('-', ' ')} style. Tell me what to change!`, style: { fontSize: '18px', color: colors.textSecondary, maxWidth: '500px', lineHeight: '1.6' } },
          ],
        },
      ],
    };
  }
}
