// Z.Design - Design Generation API Route
// Generates complete DesignNode trees from text prompts using Z.ai LLM

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { DESIGN_GENERATION_SYSTEM_PROMPT, parseAIResponse } from '@/lib/ai-prompts';

// ============ ZAI Singleton ============

let zaiInstance: ZAI | null = null;

async function getZAI(): Promise<ZAI> {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// ============ Types ============

type ProjectType =
  | 'PROTOTYPE'
  | 'SLIDE_DECK'
  | 'LANDING_PAGE'
  | 'DASHBOARD'
  | 'WEB_APP'
  | 'MOBILE_APP'
  | 'MARKETING'
  | 'CUSTOM';

interface GenerateRequestBody {
  prompt: string;
  projectType?: ProjectType;
  designSystem?: Record<string, unknown>;
  viewport?: 'desktop' | 'tablet' | 'mobile';
}

// ============ Prompt Builder ============

function buildGenerationPrompt(
  prompt: string,
  projectType: ProjectType,
  viewport: string,
  designSystem?: Record<string, unknown>
): string {
  let enhancedPrompt = `Generate a ${projectType.replace('_', ' ').toLowerCase()} design with the following requirements:\n\n${prompt}`;

  // Add viewport-specific instructions
  if (viewport === 'mobile') {
    enhancedPrompt += '\n\nIMPORTANT: This is a MOBILE design. Use maxWidth: "430px", mobile-friendly touch targets (min 44px), bottom navigation patterns, and compact layouts.';
  } else if (viewport === 'tablet') {
    enhancedPrompt += '\n\nThis is a TABLET design. Use maxWidth: "768px", adaptive layouts that work well on medium screens.';
  }

  // Add project type specific guidance
  switch (projectType) {
    case 'LANDING_PAGE':
      enhancedPrompt += '\n\nInclude: Navigation bar with logo and links, Hero section with heading/subheading/CTA buttons, Features section with 3-4 feature cards in a grid, Social proof/testimonials section, Final CTA section, and Footer with multiple columns.';
      break;
    case 'DASHBOARD':
      enhancedPrompt += '\n\nInclude: Sidebar navigation with logo and menu items, Top header bar with search and user avatar, Stats cards row (4 cards), Main content area with chart/table, and action buttons.';
      break;
    case 'WEB_APP':
      enhancedPrompt += '\n\nInclude: Top navigation bar, Sidebar with navigation, Main content area with toolbar, Content sections with forms/tables, and status indicators.';
      break;
    case 'MOBILE_APP':
      enhancedPrompt += '\n\nInclude: App header bar, Scrollable content area, Card-based layouts, Bottom tab navigation with 4-5 tabs, and floating action buttons.';
      break;
    case 'SLIDE_DECK':
      enhancedPrompt += '\n\nCreate 5-6 slides, each as a section with minHeight: "100vh". Include: Title slide, Content slides, Data/stat slide, and Closing slide. Each slide should be visually distinct.';
      break;
    case 'MARKETING':
      enhancedPrompt += '\n\nInclude: Bold hero with large CTA, Benefits section with icons, Testimonial carousel, Pricing comparison table (3 tiers), FAQ section, and Urgency CTA.';
      break;
    case 'PROTOTYPE':
      enhancedPrompt += '\n\nCreate an interactive-looking prototype with realistic content, proper navigation, form elements, and interactive states.';
      break;
  }

  // Add design system context
  if (designSystem && Object.keys(designSystem).length > 0) {
    enhancedPrompt += `\n\nUse this design system:\n\`\`\`json\n${JSON.stringify(designSystem, null, 2)}\n\`\`\``;
  }

  return enhancedPrompt;
}

// ============ POST Handler ============

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequestBody = await request.json();
    const {
      prompt,
      projectType = 'PROTOTYPE',
      designSystem,
      viewport = 'desktop',
    } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: 'prompt is required' },
        { status: 400 }
      );
    }

    const validProjectTypes: ProjectType[] = [
      'PROTOTYPE', 'SLIDE_DECK', 'LANDING_PAGE', 'DASHBOARD',
      'WEB_APP', 'MOBILE_APP', 'MARKETING', 'CUSTOM',
    ];

    if (!validProjectTypes.includes(projectType)) {
      return NextResponse.json(
        { error: `Invalid projectType. Must be one of: ${validProjectTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Build the enhanced prompt
    const enhancedPrompt = buildGenerationPrompt(prompt, projectType, viewport, designSystem);

    // Call Z.ai LLM with retry logic and generous timeouts
    // LLM takes ~60-90s to generate a full design, so we need generous timeouts
    let rawResponse: string | null = null;
    let usedFallback = false;
    const maxRetries = 2;
    const LLM_TIMEOUT_FIRST = 120000; // 120s for first attempt
    const LLM_TIMEOUT_RETRY = 90000; // 90s for retries

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const zai = await getZAI();
        const timeoutMs = attempt === 0 ? LLM_TIMEOUT_FIRST : LLM_TIMEOUT_RETRY;

        const completionPromise = zai.chat.completions.create({
          messages: [
            { role: 'system', content: DESIGN_GENERATION_SYSTEM_PROMPT },
            { role: 'user', content: enhancedPrompt },
          ],
          thinking: { type: 'disabled' },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LLM timeout')), timeoutMs)
        );

        const completion = await Promise.race([completionPromise, timeoutPromise]);
        rawResponse = completion.choices[0]?.message?.content || null;
        break; // Success
      } catch (llmError) {
        console.warn(`[Design Generate API] Z.ai LLM attempt ${attempt + 1} failed:`, llmError instanceof Error ? llmError.message : llmError);
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          console.error('[Design Generate API] All Z.ai LLM attempts failed');
          usedFallback = true;
        }
      }
    }

    if (!rawResponse) {
      return NextResponse.json(
        { error: 'Failed to generate design. The AI service is unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    // Parse the AI response using the shared parser
    const parsed = parseAIResponse(rawResponse);

    let design = parsed.design;
    let name = `${projectType.replace('_', ' ')} Design`;
    let description = prompt;

    // If the parser extracted a design from a wrapper object, also try to get name/description
    if (design) {
      try {
        const fullParsed = JSON.parse(rawResponse);
        name = fullParsed.name || name;
        description = fullParsed.description || description;
      } catch {
        // Keep defaults
      }
    }

    if (!design) {
      return NextResponse.json(
        { error: 'Failed to generate design. The AI did not return valid design JSON.', rawResponse },
        { status: 422 }
      );
    }

    return NextResponse.json({
      design,
      name,
      description,
      projectType,
      viewport,
    });
  } catch (error) {
    console.error('[Design Generate API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate design', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
