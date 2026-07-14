// Z.Design - Chat API Route
// Uses Z.ai LLM for intelligent design generation with conversation context

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DESIGN_REFINEMENT_SYSTEM_PROMPT } from '@/lib/ai-prompts';
import { FusionPipeline, FusionUnavailableError, callRemoteFusion, RemoteFusionError, deriveDesignDirection, directiveToPromptBlock } from '@/lib/ai/fusion';
// T5 (2026-07-04): fallback templates + ZAI singleton + LLM/parse/repair pipeline
// extracted to lib/chat/*. The route now only orchestrates request handling.
import { generateDesign } from '@/lib/chat/generate';

// ============ Types ============

interface ChatRequestBody {
  message: string;
  projectId: string;
  designTree?: Record<string, unknown>;
  designSystem?: Record<string, unknown>;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  creativeMode?: boolean;
  /** When true, route through the multi-model Fusion pipeline (panel -> judge -> synthesis). */
  fusion?: boolean;
  /** Optional provider id hint passed through to the Fusion pipeline. */
  preferredProvider?: string;
}

// ============ POST Handler ============

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequestBody = await request.json();
    const { message, projectId, designTree, designSystem, history, creativeMode, fusion, preferredProvider } = body;

    if (!message || !projectId) {
      return NextResponse.json({ error: 'message and projectId are required' }, { status: 400 });
    }

    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Derive the topic-appropriate design direction ONCE (deterministic, no LLM).
    // Fed into ALL paths: remote-fusion, in-app pipeline, and legacy chat â€” so the
    // aesthetic is coherent and topic-fitted instead of a hardcoded emerald default.
    const designDirective = deriveDesignDirection(message);

    // Store user message
    await db.chatMessage.create({
      data: { projectId, role: 'user', content: message },
    });

    // ============ Fusion Pipeline (opt-in via feature flag) ============
    // Two strategies, both optional and both non-breaking:
    //   1) REMOTE Fusion (preferred): if FUSION_SERVICE_URL is set, send the
    //      request DIRECTLY to the external Fusion HTTP service â€” no in-app LLM.
    //      The Fusion service runs panel->judge->synthesis with ITS OWN keys, so
    //      end users need no provider keys at all.
    //   2) IN-APP pipeline (fallback): otherwise run the built-in multi-provider
    //      FusionPipeline (needs app-side provider keys).
    // On ANY failure either path falls through to the standard Z.ai chat below.
    if (fusion) {
      const fusionServiceUrl = process.env.FUSION_SERVICE_URL;
      try {
        if (fusionServiceUrl) {
          // --- REMOTE Fusion (direct, server-side keys) ---
          const result = await callRemoteFusion(
            {
              message,
              designTree: designTree && Object.keys(designTree).length > 0 ? designTree : undefined,
              designSystem,
              history,
              directive: designDirective,
            },
            fusionServiceUrl,
          );

          const assistantMessage = await db.chatMessage.create({
            data: {
              projectId,
              role: 'assistant',
              content: result.message,
              metadata: JSON.stringify({
                designUpdate: result.design,
                fusion: true,
                remote: true,
                strategy: result.strategy,
                contributingProviders: result.contributingProviders,
              }),
            },
          });

          if (result.design) {
            await db.project.update({
              where: { id: projectId },
              data: { designJSON: JSON.stringify(result.design), status: 'IN_PROGRESS' },
            });
          }

          return NextResponse.json({
            id: assistantMessage.id,
            message: result.message,
            design: result.design,
            projectId,
            usedFallback: false,
            templateUsed: false,
            fusion: true,
            remote: true,
            createdAt: assistantMessage.createdAt,
          });
        }

        // --- IN-APP Fusion pipeline (app-side provider keys) ---
        const result = await new FusionPipeline().run({
          message,
          designTree: designTree && Object.keys(designTree).length > 0 ? designTree : undefined,
          designSystem,
          history,
          preferredProvider,
          directive: designDirective,
        });

        const assistantMessage = await db.chatMessage.create({
          data: {
            projectId,
            role: 'assistant',
            content: result.message,
            metadata: JSON.stringify({
              designUpdate: result.design,
              fusion: true,
              usedFallbackDesign: result.stages.usedFallbackDesign,
              styleDNA: result.styleDNA,
              routing: result.routing,
              stages: result.stages,
              providerUsed: result.providerUsed,
            }),
          },
        });

        if (result.design) {
          await db.project.update({
            where: { id: projectId },
            data: { designJSON: JSON.stringify(result.design), status: 'IN_PROGRESS' },
          });
        }

        return NextResponse.json({
          id: assistantMessage.id,
          message: result.message,
          design: result.design,
          projectId,
          usedFallback: result.stages.usedFallbackDesign,
          templateUsed: false,
          fusion: true,
          createdAt: assistantMessage.createdAt,
        });
      } catch (fusionError) {
        // Fusion unavailable (service down, all providers failed, timeout, etc.)
        // -> degrade gracefully to the standard chat path below.
        const reason =
          fusionError instanceof FusionUnavailableError || fusionError instanceof RemoteFusionError
            ? 'unavailable'
            : 'error';
        console.warn(`[Chat API] Fusion ${reason}, falling back to standard chat:`, fusionError instanceof Error ? fusionError.message : fusionError);
      }
    }

    // Build a concise system prompt for chat (full prompt is too large for this environment)
    const conciseSystemPrompt = `You are Z.Design AI, an expert visual design assistant. You generate designs as structured JSON.

CRITICAL JSON FORMAT RULES:
1. ALL property names MUST be in double quotes: "id", "type", "style", "content"
2. EVERY property name MUST have a colon after the closing quote: "id": "nav-1" (NOT "id": or "id=)
3. The "content" field MUST be INSIDE the node object, NOT after it
4. ALL style values MUST be quoted strings: "boxShadow": "0 4px 6px rgba(0,0,0,0.1)"
5. Use rgba without spaces in commas: "rgba(0,0,0,0.1)" NOT "rgba(0, 0, 0, 0.1)"
6. Return raw JSON only - no markdown code blocks

CORRECT EXAMPLE:
{"message": "Created a landing page", "design": {"id": "root", "type": "root", "tag": "div", "style": {"minHeight": "100vh", "fontFamily": "Inter, system-ui, sans-serif", "backgroundColor": "#ffffff"}, "children": [{"id": "nav-1", "type": "nav", "tag": "nav", "style": {"display": "flex", "justifyContent": "space-between", "padding": "16px 32px", "backgroundColor": "#ffffff", "borderBottom": "1px solid #e2e8f0"}, "children": [{"id": "logo", "type": "text", "tag": "span", "content": "BrandName", "style": {"fontSize": "20px", "fontWeight": "700", "color": "#10b981"}}, {"id": "nav-btn", "type": "button", "tag": "button", "content": "Get Started", "style": {"padding": "10px 24px", "backgroundColor": "#10b981", "color": "#ffffff", "borderRadius": "8px", "border": "none", "fontWeight": "600", "cursor": "pointer"}}]}, {"id": "hero", "type": "section", "tag": "section", "style": {"display": "flex", "flexDirection": "column", "alignItems": "center", "padding": "80px 32px", "textAlign": "center", "backgroundColor": "#f8fafc", "backgroundImage": "radial-gradient(circle at 30% 50%, rgba(16,185,129,0.08) 0%, transparent 50%)"}, "children": [{"id": "hero-h1", "type": "heading", "tag": "h1", "content": "Welcome to Our Platform", "style": {"fontSize": "clamp(32px, 5vw, 48px)", "fontWeight": "800", "color": "#0f172a", "marginBottom": "16px"}}, {"id": "hero-p", "type": "text", "tag": "p", "content": "Build amazing things with AI", "style": {"fontSize": "18px", "color": "#475569", "maxWidth": "540px", "lineHeight": "1.7"}}]}]}}

NOTICE HOW:
- "content": "BrandName" is INSIDE each node object
- Every property name has quotes AND a colon: "fontSize": "20px"
- CSS values are all quoted strings
- No spaces in rgba() values
- No trailing commas
- backgroundImage uses gradient for modern look
- fontSize uses clamp() for responsive typography

COLORS: DO NOT use hardcoded defaults. The DESIGN-DIRECTION block below (injected after this prompt) defines the VERBINDLICH palette and fonts for this topic. Use ONLY those colors. Never fall back to emerald/violet/cyan defaults — they are generic AI tells.
NEUTRAL TOKENS (always safe): Text #0f172a, TextSecondary #475569, Muted #94a3b8, BG #ffffff, Surface #f8fafc, Border #e2e8f0 — these neutrals are fine, but the ACCENT/PRIMARY colors MUST come from the DESIGN-DIRECTION block.
LAYOUT: Nav→Hero→Features→CTA→Footer (landing pages), Sidebar→Header→Stats→Charts (dashboards)

DESIGN PRINCIPLES: Modern, clean, generous whitespace, rounded corners (borderRadius 10-16px), responsive flexbox/grid layouts, proper heading hierarchy, complete sections with real content.

MODERN PATTERNS TO USE:
- Gradient backgrounds: "backgroundImage": "radial-gradient(circle at 30% 50%, rgba(16,185,129,0.08) 0%, transparent 50%)"
- Soft layered shadows: "boxShadow": "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)"
- Glassmorphism nav: "backgroundColor": "rgba(255,255,255,0.8)", "backdropFilter": "blur(12px)"
- Gradient buttons: "background": "linear-gradient(135deg, var(--accent), var(--accent-dark))" — use the topic palette tokens, not hardcoded hex
- Responsive grids: "gridTemplateColumns": "repeat(auto-fit, minmax(280px, 1fr))"
- Fluid typography: "fontSize": "clamp(28px, 4vw, 48px)"
- maxWidth containers: "maxWidth": "1200px", "margin": "0 auto"

NEGATIVE CONSTRAINTS:
- NEVER use Tailwind shorthand - always use real CSS values: "32px" not "4xl"
- NEVER use fixed pixel widths on containers - use maxWidth + margin:"0 auto"
- NEVER use lorem ipsum - always use meaningful, contextual content
- NEVER leave style objects empty

RULES:
1. Every node needs unique "id" (e.g., "hero-section", "nav-logo")
2. Use semantic HTML tags (header, nav, main, section, footer)
3. Make designs COMPLETE and POLISHED
4. type:"image" nodes: leave "content" empty (NO placeholder URLs); set meta.imagePrompt (vivid generation prompt: subject, mood, lighting), meta.alt, and meta.imageStatus: "pending". Real images are generated asynchronously.
   CRITICAL for image nodes — set BOTH width and a sensible aspect ratio:
   - Hero images: "width": "100%", "aspectRatio": "16/10" or "4/3" (LANDSCAPE, not portrait!)
   - Feature/card images: "width": "100%", "aspectRatio": "4/3" or "16/9"
   - NEVER set only height without width — the container will collapse to 0px wide.
   - Prefer aspectRatio over fixed height. If you must use height, ALWAYS also set width: "100%".
5. For landing pages: Nav â†’ Hero â†’ Features â†’ CTA â†’ Footer
6. For dashboards: Sidebar â†’ Header â†’ Stats â†’ Charts
7. Double-check your JSON is valid before returning`;

    // Detect if this is a refinement request (user modifying an existing design)
    const isRefinementRequest = designTree && (designTree as { children?: unknown[] }).children?.length as number > 0;
    const refinementKeywords = ['change', 'make', 'update', 'modify', 'replace', 'remove', 'add', 'move', 'resize', 'recolor', 'recolor', 'turn', 'switch', 'swap', 'hide', 'show', 'align', 'center', 'bold', 'italic', 'color', 'font', 'size', 'width', 'height', 'padding', 'margin', 'background', 'border'];
    const isLikelyRefinement = isRefinementRequest && refinementKeywords.some(kw => message.toLowerCase().includes(kw));

    let systemPrompt: string;
    if (isLikelyRefinement) {
      // Use the refinement system prompt for targeted modifications
      systemPrompt = DESIGN_REFINEMENT_SYSTEM_PROMPT;
    } else {
      systemPrompt = conciseSystemPrompt;
    }

    // Inject the derived topic-appropriate design direction as ENFORCED tokens.
    // Only for fresh generation â€” refinement preserves the existing aesthetic.
    // If an explicit design system is provided below, that takes final precedence.
    if (!isLikelyRefinement) {
      systemPrompt += `\n\n${directiveToPromptBlock(designDirective)}\nWenn unten KEIN explizites Design-System genannt ist, sind Palette und Fonts aus dem DESIGN-DIRECTION-Block VERBINDLICH und ersetzen jede Default-Palette in diesem Prompt.`;
    }

    // Inject design system context with proper enforcement instructions
    if (designSystem && Object.keys(designSystem).length > 0) {
      const dsName = (designSystem as Record<string, unknown>).name || 'Custom';
      systemPrompt += `\n\n=== DESIGN SYSTEM ENFORCEMENT ===\nYou MUST use the "${dsName}" design system provided below. Use ONLY its colors, fonts, and spacing tokens. Do NOT invent hex values or font families not in this system. If the user's request conflicts with the design system, follow the user but note the deviation.\n\nUSER'S DESIGN SYSTEM: ${JSON.stringify(designSystem)}`;
    }

    // Add Creative Mode to system prompt
    if (creativeMode) {
      systemPrompt += `\n\nCREATIVE MODE: Be bold and experimental! Try unique layouts, unconventional color combinations, creative typography, asymmetric layouts, and innovative design patterns. Push boundaries while maintaining usability. Generate at least 2-3 different section variations within the design. Consider bento grids, gradient meshes, glassmorphism, and neobrutalism.`;
    }

    // Build the user message content, adding context about existing design if present
    let userContent = message;
    if (isLikelyRefinement && designTree) {
      const childrenCount = (designTree as { children: unknown[] }).children.length;
      const sectionNames = (designTree as { children: Array<{ meta?: { name?: string }; id?: string }> }).children
        .map((c, i) => c.meta?.name || c.id || `section-${i}`)
        .join(', ');
      userContent = `[CURRENT DESIGN CONTEXT: ${childrenCount} top-level sections: ${sectionNames}]\n\nDesign tree: ${JSON.stringify(designTree).substring(0, 3000)}${JSON.stringify(designTree).length > 3000 ? '...[truncated]' : ''}\n\nUser request: ${message}\n\nReturn ONLY the modified subtree using the refinement format (action, targetId, node). Do NOT return the entire design tree.`;
    } else if (isRefinementRequest) {
      const childrenCount = (designTree as { children: unknown[] }).children.length;
      userContent = `[Current design exists with ${childrenCount} top-level sections. The user wants to modify it.]\n\nUser request: ${message}\n\nReturn the COMPLETE updated design tree (not just the changes).`;
    }

    // Build conversation messages from history (up to 4 most recent to save tokens)
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    if (history && history.length > 0) {
      const recentHistory = history.slice(-4);
      for (const msg of recentHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: 'user', content: userContent });

    // Call the shared generation pipeline (LLM call + retry + parse + repair +
    // fallback). Extracted to lib/chat/generate.ts (T5/O3) so the SSE endpoint
    // can reuse the exact same logic and emit progress events to the client.
    const generated = await generateDesign({
      message,
      systemPrompt,
      userContent,
      history,
      creativeMode,
    });

    // Store assistant message
    const assistantMessage = await db.chatMessage.create({
      data: {
        projectId,
        role: 'assistant',
        content: generated.message,
        metadata: JSON.stringify({
          designUpdate: generated.design || null,
          tokensUsed: generated.tokensUsed,
          usedFallback: generated.usedFallback,
          creativeMode: creativeMode || false,
        }),
      },
    });

    // Update project if design was generated
    if (generated.design) {
      await db.project.update({
        where: { id: projectId },
        data: { designJSON: JSON.stringify(generated.design), status: 'IN_PROGRESS' },
      });
    }

    return NextResponse.json({
      id: assistantMessage.id,
      message: generated.message,
      design: generated.design,
      projectId,
      createdAt: assistantMessage.createdAt,
      usedFallback: generated.usedFallback,
      templateUsed: generated.templateUsed,
      parseFailed: !generated.design,
    });
  } catch (error) {
    console.error('[Chat API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============ GET Handler ============

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    const messages = await db.chatMessage.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
    return NextResponse.json({ messages });
  } catch (error) {
    console.error('[Chat API] GET Error:', error);
    return NextResponse.json({ error: 'Failed to retrieve chat history' }, { status: 500 });
  }
}
