// Z.Design - Design Generation API Route
// Generates complete DesignNode trees from text prompts using AI

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { DESIGN_GENERATION_SYSTEM_PROMPT } from '@/lib/ai-prompts';

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

    // Call Z.ai LLM to generate the design
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: DESIGN_GENERATION_SYSTEM_PROMPT },
        { role: 'user', content: enhancedPrompt },
      ],
      thinking: { type: 'disabled' },
    });

    const rawResponse = completion.choices[0]?.message?.content || '';

    // Parse the AI response to extract the design JSON
    let design = null;
    let name = `${projectType.replace('_', ' ')} Design`;
    let description = prompt;

    try {
      // Try direct JSON parse
      const parsed = JSON.parse(rawResponse);
      if (parsed.design) {
        design = parsed.design;
        name = parsed.name || name;
        description = parsed.description || description;
      } else if (parsed.id || parsed.type) {
        design = parsed;
      }
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = rawResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        try {
          const extracted = JSON.parse(jsonMatch[1]);
          if (extracted.design) {
            design = extracted.design;
            name = extracted.name || name;
            description = extracted.description || description;
          } else if (extracted.id || extracted.type) {
            design = extracted;
          }
        } catch {
          // Continue to next extraction attempt
        }
      }

      // Try to find any JSON object with an id field
      if (!design) {
        const objectMatch = rawResponse.match(/\{[\s\S]*"id"[\s\S]*\}/);
        if (objectMatch) {
          try {
            design = JSON.parse(objectMatch[0]);
          } catch {
            // Give up on parsing
          }
        }
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
