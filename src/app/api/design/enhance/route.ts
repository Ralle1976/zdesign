// Z.Design - Design Enhancement API
// Takes a design and tries to improve it using the LLM or built-in rules

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// ============ ZAI Singleton ============

let zaiInstance: ZAI | null = null;

async function getZAI(): Promise<ZAI> {
  if (!zaiInstance) zaiInstance = await ZAI.create();
  return zaiInstance;
}

// ============ System Prompt ============

const ENHANCE_SYSTEM_PROMPT = `You are Z.Design AI's quality enhancer. You receive a design JSON and must improve it to achieve maximum quality.

RULES:
1. Return ONLY the improved design JSON (no message field needed)
2. Keep the same structure but improve:
   - Add missing sections (nav, footer, CTA)
   - Fix any incomplete sections
   - Improve spacing and visual hierarchy
   - Ensure consistent colors from the palette
   - Add subtle shadows and transitions
   - Make text content more professional
3. Do NOT change the overall intent of the design
4. Use real CSS values (px, rem, %, #hex)
5. Make the design look production-ready

COLOR PALETTE:
- Primary: #10b981, Primary Dark: #059669, Primary Light: #34d399
- Text: #0f172a, Text Secondary: #475569, Muted: #94a3b8
- Background: #ffffff, Surface: #f8fafc, Border: #e2e8f0

DesignNode structure: { id, type, tag, children, style, content, meta }
Node types: root, container, flex, grid, text, heading, button, input, image, icon, link, card, nav, header, footer, section, sidebar, form, badge, avatar, divider, spacer

STYLE RULES: Use real CSS values (px, rem, %, #hex) in camelCase. NEVER use Tailwind shorthand.`;

// ============ Rule-Based Enhancement ============

function applyRuleBasedEnhancements(tree: Record<string, unknown>, report: Record<string, unknown> | null): Record<string, unknown> {
  const design = JSON.parse(JSON.stringify(tree)); // Deep clone

  // Add fontFamily to root if missing
  if (design.style && !design.style.fontFamily) {
    design.style = { ...design.style, fontFamily: 'Inter, system-ui, sans-serif' };
  }

  // Add minHeight to root if missing
  if (design.style && !design.style.minHeight) {
    design.style = { ...design.style, minHeight: '100vh' };
  }

  // Ensure root has width
  if (design.style && !design.style.width) {
    design.style = { ...design.style, width: '100%' };
  }

  // Ensure root has display flex
  if (design.style && !design.style.display) {
    design.style = { ...design.style, display: 'flex', flexDirection: 'column' };
  }

  // Add meta.name to sections that are missing it
  if (Array.isArray(design.children)) {
    let sectionCounter = 1;
    for (const child of design.children as Record<string, unknown>[]) {
      if ((child.type === 'section' || child.type === 'nav' || child.type === 'header' || child.type === 'footer') && !(child.meta as Record<string, unknown> | undefined)?.name) {
        if (!child.meta) child.meta = {};
        (child.meta as Record<string, unknown>).name = `Section ${sectionCounter}`;
      }
      if (child.type === 'section' || child.type === 'nav' || child.type === 'header' || child.type === 'footer') {
        sectionCounter++;
      }
    }

    // Add missing nav if the quality report suggests it
    if (report && (report as { completeness?: number }).completeness !== undefined && (report as { completeness: number }).completeness < 70) {
      const hasNav = (design.children as Record<string, unknown>[]).some(
        (c) => c.type === 'nav' || c.tag === 'nav' || c.type === 'header'
      );
      if (!hasNav) {
        // Prepend a simple nav
        const navNode = {
          id: 'enhanced-nav',
          type: 'nav',
          tag: 'nav',
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 32px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
          },
          meta: { name: 'Navigation' },
          children: [
            { id: 'enhanced-logo', type: 'text', tag: 'span', content: 'Z.Design', style: { fontSize: '20px', fontWeight: '700', color: '#10b981' } },
            { id: 'enhanced-nav-btn', type: 'button', tag: 'button', content: 'Get Started', style: { padding: '8px 20px', backgroundColor: '#10b981', color: '#ffffff', borderRadius: '8px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer' } },
          ],
        };
        design.children.unshift(navNode);
      }

      // Add missing footer
      const hasFooter = (design.children as Record<string, unknown>[]).some(
        (c) => c.type === 'footer' || c.tag === 'footer'
      );
      if (!hasFooter) {
        const footerNode = {
          id: 'enhanced-footer',
          type: 'footer',
          tag: 'footer',
          style: {
            display: 'flex',
            justifyContent: 'center',
            padding: '32px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
          },
          meta: { name: 'Footer' },
          children: [
            { id: 'enhanced-footer-text', type: 'text', tag: 'p', content: '© 2026 Z.Design — AI-Powered Visual Design Platform', style: { color: '#94a3b8', fontSize: '14px' } },
          ],
        };
        design.children.push(footerNode);
      }
    }
  }

  // Fix invalid CSS values (Tailwind shorthand → real CSS)
  function fixCSSValues(node: Record<string, unknown>): void {
    if (node.style && typeof node.style === 'object') {
      const style = node.style as Record<string, string>;
      const tailwindMap: Record<string, string> = {
        'xs': '12px', 'sm': '14px', 'md': '16px', 'lg': '18px',
        'xl': '20px', '2xl': '24px', '3xl': '30px', '4xl': '36px',
        '5xl': '48px', '6xl': '60px', '7xl': '72px', '8xl': '96px',
        '9xl': '128px', 'full': '100%', 'max': 'max-content',
        'min': 'min-content', 'fit': 'fit-content',
      };

      for (const [key, value] of Object.entries(style)) {
        if (typeof value === 'string' && tailwindMap[value]) {
          // For font-size related properties, apply mapping
          if (key.toLowerCase().includes('size') || key.toLowerCase().includes('radius') || key.toLowerCase().includes('width') || key.toLowerCase().includes('height') || key.toLowerCase().includes('spacing') || key.toLowerCase().includes('padding') || key.toLowerCase().includes('margin') || key.toLowerCase().includes('gap')) {
            style[key] = tailwindMap[value];
          }
        }
        // Remove empty/undefined/null values
        if (value === '' || value === 'undefined' || value === 'null') {
          delete style[key];
        }
      }
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children as Record<string, unknown>[]) {
        fixCSSValues(child);
      }
    }
  }

  fixCSSValues(design);

  return design;
}

// ============ POST Handler ============

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { designTree, qualityReport } = body;

    if (!designTree) {
      return NextResponse.json({ error: 'designTree is required' }, { status: 400 });
    }

    // Build enhancement prompt with quality feedback
    let userPrompt = `Improve this design JSON to achieve higher quality:\n\n${JSON.stringify(designTree)}`;

    if (qualityReport) {
      userPrompt += `\n\nQUALITY ISSUES TO FIX (current score: ${qualityReport.overallScore}/100):`;
      if (qualityReport.issues?.length > 0) {
        const criticalIssues = qualityReport.issues.filter((i: { severity: string }) => i.severity === 'critical');
        const warningIssues = qualityReport.issues.filter((i: { severity: string }) => i.severity === 'warning');
        if (criticalIssues.length > 0) {
          userPrompt += `\nCRITICAL: ${criticalIssues.map((i: { message: string }) => i.message).join('; ')}`;
        }
        if (warningIssues.length > 0) {
          userPrompt += `\nWARNINGS: ${warningIssues.slice(0, 5).map((i: { message: string }) => i.message).join('; ')}`;
        }
      }
      if (qualityReport.suggestions?.length > 0) {
        userPrompt += `\nSUGGESTIONS: ${qualityReport.suggestions.join('; ')}`;
      }
    }

    // Try LLM enhancement
    try {
      const zai = await getZAI();
      const completion = await Promise.race([
        zai.chat.completions.create({
          messages: [
            { role: 'system', content: ENHANCE_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          thinking: { type: 'disabled' },
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Enhance timeout')), 120000)),
      ]);

      const rawResponse = completion.choices[0]?.message?.content;
      if (rawResponse) {
        // Try to parse the enhanced design
        try {
          // Try direct JSON parse
          let parsed = JSON.parse(rawResponse);
          // If it has a design field, extract it
          if (parsed.design) parsed = parsed.design;
          return NextResponse.json({ enhancedDesign: parsed, method: 'llm' });
        } catch {
          // Try extracting from code blocks
          const jsonMatch = rawResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
          if (jsonMatch) {
            try {
              let parsed = JSON.parse(jsonMatch[1]);
              if (parsed.design) parsed = parsed.design;
              return NextResponse.json({ enhancedDesign: parsed, method: 'llm' });
            } catch {
              // Fall through to rule-based
            }
          }
        }
      }
    } catch (error) {
      console.warn('[Enhance API] LLM failed, using rule-based enhancement:', error instanceof Error ? error.message : error);
    }

    // Rule-based enhancement fallback
    const enhanced = applyRuleBasedEnhancements(designTree, qualityReport);
    return NextResponse.json({ enhancedDesign: enhanced, method: 'rules' });
  } catch (error) {
    console.error('[Enhance API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to enhance design', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
