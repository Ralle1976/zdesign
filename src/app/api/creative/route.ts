import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CreativeOrchestra } from '@/lib/ai/agents';
import { parseAIResponse } from '@/lib/ai-prompts';
import type { CreativeLoopConfig, StyleDNA } from '@/lib/ai/agents';

interface CreativeRequestBody {
  message: string;
  projectId: string;
  designTree?: Record<string, unknown>;
  designSystem?: Record<string, unknown>;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  creativeMode?: 'standard' | 'creative' | 'innovative';
  styleDNA?: Partial<StyleDNA>;
  preferredProvider?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreativeRequestBody = await request.json();
    const { message, projectId, designTree, designSystem, creativeMode = 'creative', styleDNA, preferredProvider } = body;

    if (!message || !projectId) {
      return NextResponse.json({ error: 'message and projectId are required' }, { status: 400 });
    }

    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Store user message
    await db.chatMessage.create({
      data: { projectId, role: 'user', content: message },
    });

    // Configure creative loop based on mode
    const loopConfig: Partial<CreativeLoopConfig> = {
      maxIterations: creativeMode === 'innovative' ? 3 : creativeMode === 'creative' ? 2 : 1,
      enableInnovation: creativeMode !== 'standard',
      enableCritique: creativeMode !== 'standard',
      creativityLevel: creativeMode === 'innovative' ? 0.9 : creativeMode === 'creative' ? 0.7 : 0.5,
      preferredProvider,
      styleDNA,
    };

    try {
      // Run the Creative Orchestra
      const orchestra = new CreativeOrchestra(loopConfig);
      const result = await orchestra.execute(
        message,
        designTree && Object.keys(designTree).length > 0 ? designTree : undefined,
        designSystem
      );

      // Store assistant message with metadata
      const assistantMessage = await db.chatMessage.create({
        data: {
          projectId,
          role: 'assistant',
          content: result.brief.summary || 'I created a design for you!',
          metadata: JSON.stringify({
            designUpdate: result.finalDesign,
            creativeMode,
            styleDNA: result.styleDNA,
            brief: result.brief,
            proposals: result.proposals.map(p => ({
              agent: p.agentName,
              role: p.agentRole,
              creativity: p.creativity,
              confidence: p.confidence,
            })),
            critique: result.critique ? {
              agent: result.critique.agentName,
              content: result.critique.content.substring(0, 500),
            } : null,
            totalTokensUsed: result.totalTokensUsed,
            providerUsed: result.providerUsed,
          }),
        },
      });

      // Update project
      if (result.finalDesign) {
        await db.project.update({
          where: { id: projectId },
          data: { designJSON: JSON.stringify(result.finalDesign), status: 'IN_PROGRESS' },
        });
      }

      return NextResponse.json({
        id: assistantMessage.id,
        message: result.brief.summary || 'I created a design for you!',
        design: result.finalDesign,
        projectId,
        creativeMode,
        styleDNA: result.styleDNA,
        agents: result.proposals.map(p => ({
          name: p.agentName,
          role: p.agentRole,
          creativity: p.creativity,
          confidence: p.confidence,
        })),
        critique: result.critique ? {
          agent: result.critique.agentName,
          content: result.critique.content.substring(0, 500),
        } : null,
        providerUsed: result.providerUsed,
        createdAt: assistantMessage.createdAt,
      });
    } catch (orchestraError) {
      console.warn('[Creative API] Orchestra failed, falling back to standard chat:', orchestraError);

      // Fallback: Use the simpler chat approach via ProviderRegistry
      const { ProviderRegistry } = await import('@/lib/ai/providers');
      const registry = ProviderRegistry.getInstance();

      const conciseSystemPrompt = `You are Z.Design AI, an expert visual design assistant. You generate designs as structured JSON.

OUTPUT FORMAT: Return JSON like { "message": "explanation", "design": { ... designNode ... } }

DesignNode structure: { id, type, tag, children, style, content, meta }
Node types: root, container, flex, grid, text, heading, button, input, image, icon, link, card, nav, header, footer, section, sidebar, form, badge, avatar, divider, spacer

STYLE RULES: Use real CSS values (px, rem, %, #hex) in camelCase. NEVER use Tailwind shorthand.
COLORS: Primary=#10b981, Dark=#059669, Light=#34d399, Text=#0f172a, Text2=#475569, BG=#ffffff, Surface=#f8fafc, Border=#e2e8f0
RULES: Return raw JSON. Every node needs unique "id". Use semantic HTML tags. Make designs COMPLETE.`;

      let userContent = message;
      if (designTree && Object.keys(designTree).length > 0) {
        userContent = `[Current design exists. Modify it.]\n\nUser: ${message}\n\nReturn COMPLETE updated design tree.`;
      }

      const response = await registry.chat({
        messages: [
          { role: 'system', content: conciseSystemPrompt },
          { role: 'user', content: userContent },
        ],
      });

      const parsed = parseAIResponse(response.content);

      const assistantMessage = await db.chatMessage.create({
        data: {
          projectId,
          role: 'assistant',
          content: parsed.message || 'I generated a design for you!',
          metadata: JSON.stringify({
            designUpdate: parsed.design || null,
            usedFallback: true,
            providerUsed: response.provider,
          }),
        },
      });

      if (parsed.design) {
        await db.project.update({
          where: { id: projectId },
          data: { designJSON: JSON.stringify(parsed.design), status: 'IN_PROGRESS' },
        });
      }

      return NextResponse.json({
        id: assistantMessage.id,
        message: parsed.message || 'I generated a design for you!',
        design: parsed.design,
        projectId,
        creativeMode: 'fallback',
        providerUsed: response.provider,
        createdAt: assistantMessage.createdAt,
      });
    }
  } catch (error) {
    console.error('[Creative API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process creative request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
