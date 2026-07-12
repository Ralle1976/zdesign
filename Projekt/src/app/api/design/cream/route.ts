// Z.Design — CREAM route (Z.ai-driven): the autonomous cream pipeline, exposed
// for the zdesign_cream MCP tool.
//
// POST /api/design/cream { message, projectId, target?, maxRounds? }
//   1. v1 GENERATE via Z.ai GLM-5.2 (Z.Design's workflow: art-direction +
//      creative-dna + memory + Unsplash imagery — generation via the funded
//      Z.ai Anthropic endpoint, since Gemini is no longer available).
//   2. Z.AI VISION-CRITIQUE LOOP: Puppeteer renders the live HTML → GLM-5v
//      critiques what it SEES → if score < target, refine via Z.ai with the
//      concrete fixes → repeat, bounded. Ship when ≥ target.
//
// Returns { html, score, rounds, trace, model }.

import { NextRequest, NextResponse } from 'next/server';
import { buildArtBrief, generateHtmlPrompt } from '@/lib/ai/skills/art-direction';
import { recallAntiPatterns } from '@/lib/ai/memory/negative-memory';
import { loadUserMemory, userMemoryToPromptBlock } from '@/lib/ai/memory/user-memory';
import { lessonsToPromptBlock, saveResult, maybeReflect } from '@/lib/ai/memory/lessons';
import { callZai, ZAI_MODELS } from '@/lib/ai/zai-direct';
import { renderHtmlToPng, critiqueRendered } from '@/lib/ai/skills/vision-critique';
import { cleanHtml } from '@/lib/ai/fusion/fusion-client';
import { pickTemplate } from '@/lib/ai/templates/registry';
import { loadReferenceHtml, buildAdaptPrompt } from '@/lib/ai/templates/generate-from-reference';
import { lintHtml } from '@/lib/ai/lint/anti-slop';
import { db } from '@/lib/db';

// Generation model: Z.ai GLM-5.2 (funded Anthropic endpoint — proven reliable
// for ~27KB / ~110s design prompts). Gemini was removed (no API access).
const GEN_MODEL = ZAI_MODELS.text; // 'glm-5.2'
const GEN_MAX_TOKENS = 16384; // GLM-5.2 output cap — covers a full HTML page.

// ── Deterministic Google Fonts injection ─────────────────────────────────────
// Maps font-family declarations to Google Fonts <link> URLs. The LLM writes
// font-family in CSS but frequently forgets the <link> tag — we fix that here.
const GOOGLE_FONT_URLS: Record<string, string> = {
  'Fraunces': 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&display=swap',
  'Cormorant Garamond': 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap',
  'Source Serif Pro': 'https://fonts.googleapis.com/css2?family=Source+Serif+Pro:wght@400;600;700&display=swap',
  'Poppins': 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap',
  'Space Grotesk': 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap',
  'Inter': 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  'Playfair Display': 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800&display=swap',
  'DM Serif Display': 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap',
  'Lora': 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap',
  'Bricolage Grotesque': 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700&display=swap',
};

function ensureGoogleFonts(html: string, displayFont: string, bodyFont: string): string {
  // Collect unique font names from the brief (strip fallbacks like "Georgia, serif")
  const fontNames = new Set<string>();
  for (const raw of [displayFont, bodyFont]) {
    if (!raw) continue;
    const first = raw.split(',')[0].trim().replace(/['"]/g, '');
    fontNames.add(first);
  }

  // Build the combined <link> for fonts we know on Google Fonts
  const fontsToLoad: string[] = [];
  for (const name of fontNames) {
    const url = GOOGLE_FONT_URLS[name];
    if (url && !html.includes(encodeURIComponent(name).split('%20')[0])) {
      fontsToLoad.push(url);
    }
  }

  // Also scan the HTML for font-family declarations we haven't covered yet
  const declaredFonts = [...html.matchAll(/font-family:\s*['"]?([^'"`,;]+)/gi)];
  for (const m of declaredFonts) {
    const name = m[1].trim();
    const url = GOOGLE_FONT_URLS[name];
    if (url && !fontsToLoad.includes(url) && !html.includes('fonts.googleapis.com')) {
      fontsToLoad.push(url);
    }
  }

  if (fontsToLoad.length === 0) return html;

  // Check if a Google Fonts <link> is already present
  if (html.includes('fonts.googleapis.com')) {
    // Already has some Google Fonts link — check which fonts are missing
    const existingLinks = [...html.matchAll(/href="(https:\/\/fonts\.googleapis\.com[^"]+)"/gi)];
    const existingFonts = existingLinks.map(m => m[1]).join('');
    const missing = fontsToLoad.filter(url => !existingFonts.includes(url));
    if (missing.length === 0) return html;
    // Add missing fonts as a combined link
    const combinedHref = missing.join('&');
    return html.replace(/(<head[^>]*>)/i, `$1\n    <link rel="preconnect" href="https://fonts.googleapis.com">\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n    <link href="${combinedHref}" rel="stylesheet">`);
  }

  // No Google Fonts link at all — inject preconnect + combined link after <head>
  const combinedHref = fontsToLoad.join('&');
  const injection = `\n    <link rel="preconnect" href="https://fonts.googleapis.com">\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n    <link href="${combinedHref}" rel="stylesheet">`;

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/(<head[^>]*>)/i, `$1${injection}`);
  }
  // No <head> tag — inject before <style> or at the start
  if (/<style/i.test(html)) {
    return html.replace(/(<style)/i, `${injection}\n    $1`);
  }
  return html;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, projectId } = body as { message: string; projectId: string };
    // quick=true: skip vision-critique loop (1 LLM-call, ~25-60s vs 90-180s full)
    const quick = body.quick === true;
    // existingHtml + changeRequest: refinement path (modify existing design instead
    // of generating from scratch). generateHtmlPrompt already supports existingHtml.
    const existingHtml = typeof body.existingHtml === 'string' ? body.existingHtml : null;
    const changeRequest = typeof body.changeRequest === 'string' ? body.changeRequest : null;
    const target = Number(body.target) > 0 ? Number(body.target) : 8;
    // Fixed maxRounds trap: !== undefined check (was > 0 which caught 0 → default 3)
    const maxRounds = body.maxRounds !== undefined ? Math.max(0, Number(body.maxRounds)) : 3;
    const model = typeof body.model === 'string' && body.model ? body.model : GEN_MODEL;
    if ((!message || !projectId) && !existingHtml) {
      return NextResponse.json({ error: 'message and projectId are required (or existingHtml for refinement)' }, { status: 400 });
    }

    const isRefinement = !!existingHtml;
    // Refinement defaults to quick (no vision-loop needed for small changes)
    const skipVision = quick || isRefinement;

    // ── 1) v1 GENERATE via Z.ai GLM-5.2 ─────────────────────────────────────
    const brief = buildArtBrief(message || changeRequest || 'design refinement');

    // BILDER: keine MiniMax-Generierung mehr (unzuverlässig, oft falscher Content).
    // Stattdessen liefert brief.imagery (imageryGuidance) domain-spezifische
    // Unsplash-URLs direkt im Prompt → GLM-5.2 nutzt echte, kuratierte Fotos.
    let imageBlock = '';

    // negative memory (avoid past failures)
    const memory = await recallAntiPatterns({ domain: brief.domain, maxTokens: 600 });
    const memoryBlock = memory.items.length > 0
      ? `AUS DEM GEDÄCHTNIS — UNBEDINGT VERMEIDEN:\n${memory.items.map((i) => `- ${i.text}`).join('\n')}\n`
      : '';
    // User preferences — inject so the cream pipeline respects them too.
    const userMemoryBlock = userMemoryToPromptBlock(await loadUserMemory());

    // ── REFINEMENT PATH: existingHtml + changeRequest → targeted modification ─
    // For refinements we don't generate from scratch — we take the existing HTML
    // and ask GLM-5.2 to apply the change while preserving the design's structure
    // and aesthetic. This keeps quality high (no 4/10 reset) for small edits.
    let generatePrompt: string;
    if (isRefinement && existingHtml) {
      const instruction = changeRequest || message || 'Improve the design quality';
      generatePrompt = `Du bist Art Director UND Senior-Frontend-Engineer. Überarbeite dieses HTML-Design gemäß der Change-Request.

CHANGE-REQUEST DES NUTZERS:
${instruction}

REGELN:
- BEHALTE die visuelle Identität, Palette, Typografie und Atmosphäre bei
- Wende NUR die angeforderte Änderung präzise an
- Wenn die Änderung ein Bild betrifft: ersetze <img src> mit thematisch passender Unsplash-URL
- Kompaktes CSS, vollständige Datei mit </html>, letzter Token </html>
- Mobile-first responsive, prefers-reduced-motion, semantisch

AKTUELLES HTML:
${existingHtml.slice(0, 20000)}

Gib NUR die vollständige HTML-Datei zurück (<!doctype html> ... </html>).`;
      console.log(`[cream] refinement path: "${instruction.slice(0, 60)}..."`);
    } else {
      // GENERATE-FROM-REFERENCE: pick the best matching template + adapt it (high
      // floor ~7 vs from-zero ~4-5). Falls back to generateHtmlPrompt if no match.
      const template = pickTemplate(brief.domain);
      let refHtml = template ? loadReferenceHtml(template) : '';
      // CRITICAL: replace the reference's STALE bundled image paths with the NEW
      // MiniMax URLs — otherwise the adapted design inherits the old (wrong) images
      // from the reference template, ignoring the freshly generated ones.
      if (refHtml && imageBlock) {
        const newUrls = [...imageBlock.matchAll(/src="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]);
        const oldPaths = [...refHtml.matchAll(/src="(\.\.\/assets\/[^"]+)"/gi)].map((m) => m[1]);
        for (let i = 0; i < Math.min(newUrls.length, oldPaths.length); i++) {
          refHtml = refHtml.split(oldPaths[i]).join(newUrls[i]);
        }
      }
      generatePrompt = template && refHtml
        ? buildAdaptPrompt(template, refHtml, message, brief.creative)
        : generateHtmlPrompt(brief, message);
      console.log(`[cream] generate-from-reference: ${template ? template.id : 'none (from-zero)'}`);
    }
    const prompt = lessonsToPromptBlock() + userMemoryBlock + memoryBlock + imageBlock + generatePrompt;
    let html = cleanHtml(await callZai(prompt, { model, maxTokens: GEN_MAX_TOKENS, temperature: isRefinement ? 0.4 : 0.6, timeoutMs: 300_000 }));
    if (!html || !/<html/i.test(html)) {
      return NextResponse.json({ error: 'Z.ai generate returned no valid HTML' }, { status: 502 });
    }

    // ── 1a) DETERMINISTIC FONT INJECTION ────────────────────────────────────
    // The LLM frequently writes font-family:'Fraunces' in CSS but FORGETS to add
    // the <link> to Google Fonts → browser falls back to Arial → design looks
    // "stumpf" (bland) regardless of how good the copy/colors are. We don't trust
    // the model on this — we inject the <link> deterministically based on the
    // brief's declared fonts. Only injects if the font is not already linked.
    html = ensureGoogleFonts(html, brief.fonts.display, brief.fonts.body);

    // ── 1b) ANTI-SLOP LINT: deterministic P0 check (Indigo, Emoji, Filler) ────
    // The vision-critic is probabilistic; the linter catches cardinal sins the
    // model might miss. P0 findings get injected into the refine prompt below.
    let lintProblems: string[] = [];
    try {
      const lintFindings = lintHtml(html);
      // Extract only cardinal P0 sins (Indigo, Emoji, Filler) — P1/P2 are advisory.
      lintProblems = lintFindings.filter(f => f.severity === 'P0').map(f => f.message);
      if (lintProblems.length > 0) {
        console.warn(`[cream] anti-slop P0 findings: ${lintProblems.length} (${lintProblems.slice(0,3).join('; ')})`);
      }
    } catch (lintErr) {
      // Lint is best-effort — never block generation on a linter failure.
      console.warn('[cream] anti-slop lint failed:', lintErr instanceof Error ? lintErr.message : lintErr);
    }

    // ── 2) Z.AI vision-critique refine loop ───────────────────────────────
    // Skip entirely in quick-mode or refinement-mode (skipVision flag above).
    // Graceful degradation: if Puppeteer fails, break immediately and ship the
    // un-critiqued HTML — still better than JSON-Tree quality.
    const trace: { round: number; score: number; problems: string[] }[] = [];
    let score = skipVision ? 0 : 0;
    if (!skipVision && maxRounds > 0) {
      for (let round = 1; round <= maxRounds; round++) {
        let png: Buffer | null = null;
        try {
          png = await renderHtmlToPng(html, { fullPage: true });
        } catch (puppeteerErr) {
          // Graceful degradation: Puppeteer crash → skip vision-critique entirely,
          // ship the generated HTML. Common on production Docker without Chrome.
          console.warn('[cream] Puppeteer render failed, skipping vision-critique:', puppeteerErr instanceof Error ? puppeteerErr.message : puppeteerErr);
          trace.push({ round, score, problems: ['vision-critique skipped (puppeteer unavailable)'] });
          break;
        }
        if (!png) { trace.push({ round, score, problems: ['render failed'] }); break; }
        const c = await critiqueRendered(png, {}, message);
        if (!c) { trace.push({ round, score, problems: ['critique failed'] }); break; }
        score = c.overall;
        const cc = c.dimensions?.['contentCorrectness'] ?? 10;
        trace.push({ round, score, problems: c.problems.slice(0, 4) });
        // Convergence: overall >= target AND contentCorrectness >= 7 (don't ship wrong-topic content).
        if (score >= target && cc >= 7) break;
        if (round === maxRounds) break;

        const contentWarning = cc < 7 ? `\nWICHTIG: Die Inhalte oder Bilder passen NICHT zum Thema! Thematisch falsche Bilder MÜSSEN durch thematisch korrekte ersetzt werden (du darfst neue <img src> URLs durch thematisch passende ersetzen — verwende https://images.unsplash.com/<photo-id> oder themenrelevante Bildbeschreibungen).` : '';
        // Merge vision problems with deterministic anti-slop P0 findings.
        const allProblems = [...c.problems, ...lintProblems];
        const refinePrompt = `Du bist Art Director UND Senior-Frontend-Engineer. Überarbeite dieses HTML. Ziel: ${target}/10 Agentur-Cream. Eine visuelle Experten-Analyse (${score}/10, contentCorrectness ${cc}/10) ergab konkrete Probleme.

PROBLEME (behebe JEDEN):
${allProblems.map((p, i) => `${i + 1}. ${p}`).join('\n')}

FIXES:
${c.fixes.map((f, i) => `${i + 1}. ${f}`).join('\n')}
${contentWarning}

REGELN: Du darfst <img src> URLs durch thematisch PASSendere ersetzen, wenn die Kritik falsche Bilder bemängelt (verwende https://images.unsplash.com/<photo-id>). Kompaktes CSS, vollständige Datei mit </html>, letzter Token </html>. Mobile-first responsive, prefers-reduced-motion, semantisch.

Aktueller Entwurf:
${html}

Gib NUR die vollständige HTML-Datei zurück (<!doctype html> ... </html>).`;
        const refined = cleanHtml(await callZai(refinePrompt, { model, maxTokens: GEN_MAX_TOKENS, temperature: 0.4, timeoutMs: 300_000 }));
        if (refined && /<html/i.test(refined)) html = refined;
        // Lint problems are one-shot — clear after first refine to avoid repetition.
        lintProblems = [];
      }
    } else if (skipVision) {
      console.log(`[cream] quick/refinement mode — vision-critique skipped`);
      // In quick-mode, if the linter found P0 issues, log them for observability
      // but don't block (the caller explicitly asked for speed).
      if (lintProblems.length > 0) {
        console.warn(`[cream] quick-mode P0 issues (not auto-fixed): ${lintProblems.join('; ')}`);
      }
    }

    // ── LEARNING FEEDBACK: record the outcome to DesignHistory so the brain-memory
    //    learns from this generation (success → reinforcePositives; failure →
    //    recallAntiPatterns next time). This makes the agent core self-improving.
    try {
      const { recordDesign } = await import('@/lib/ai/memory/history');
      await recordDesign({
        projectId,
        prompt: message || changeRequest || 'refinement',
        domain: brief.domain,
        composite: score,
        feedback: score >= 8 ? '' : trace[trace.length - 1]?.problems?.join('; ')?.slice(0, 200),
        // Capture the vision-critique's concrete problems as rootCause so
        // recallAntiPatterns can learn from them on future runs.
        rootCause: score >= 8 ? null : trace[trace.length - 1]?.problems?.join(' | ') ?? (lintProblems.length > 0 ? lintProblems.join(' | ') : null),
        sourceAgentId: 'design/cream',
      });
      console.log(`[cream] learning feedback recorded: ${brief.domain} score ${score} (${score >= 8 ? 'positive' : 'negative'})`);
    } catch (e) {
      console.warn('[cream] learning feedback failed (non-blocking):', e instanceof Error ? e.message : e);
    }

    // Record outcome for the lessons reflect-loop (Graphify-style).
    try {
      await saveResult({
        domain: brief.domain,
        outcome: score >= 7 ? 'useful' : 'dead_end',
        composite: score,
        detail: score >= 7
          ? `${brief.archetype} + ${brief.mood}`
          : trace[trace.length - 1]?.problems?.[0] ?? (lintProblems[0] ?? 'low quality'),
      });
      maybeReflect();
    } catch {
      // Non-fatal.
    }

    // ── PERSISTENCE: write HTML to Project + create ChatMessage (like agent route).
    //    This makes Cream self-contained — the frontend doesn't need a separate
    //    persistence step, and the design loads correctly on page reload.
    let assistantMessageId: string | undefined;
    let createdAt: Date | undefined;
    try {
      await db.project.update({
        where: { id: projectId },
        data: { designMode: 'HTML_ARTIFACT', designHTML: html, status: 'IN_PROGRESS' },
      });

      const scoreText = skipVision ? 'Quick-Modus' : (score > 0 ? `Score ${score}/10` : 'ungeprüft');
      const roundsText = skipVision ? '' : ` · ${trace.length} Runde(n)`;
      const assistantContent = isRefinement
        ? `Design verfeinert (${scoreText}${roundsText}).`
        : `HTML-Design generiert (${scoreText}${roundsText}). ${brief.archetype}.`;

      const assistantMessage = await db.chatMessage.create({
        data: {
          projectId,
          role: 'assistant',
          content: assistantContent,
          metadata: JSON.stringify({
            cream: true,
            mode: 'HTML_ARTIFACT',
            score,
            rounds: trace.length,
            quick: skipVision,
            refinement: isRefinement,
            domain: brief.domain,
            trace: trace.map(t => ({ round: t.round, score: t.score, problems: t.problems })),
          }),
        },
      });
      assistantMessageId = assistantMessage.id;
      createdAt = assistantMessage.createdAt;
    } catch (persistErr) {
      // Persistence failure is non-fatal — the HTML is still returned to the caller.
      console.warn('[cream] persistence failed (non-blocking):', persistErr instanceof Error ? persistErr.message : persistErr);
    }

    return NextResponse.json({
      id: assistantMessageId,
      message: assistantMessageId ? 'HTML-Design generiert' : undefined,
      html,
      mode: 'HTML_ARTIFACT',
      designMode: 'HTML_ARTIFACT',
      score,
      rounds: trace.length,
      trace,
      quick: skipVision,
      refinement: isRefinement,
      projectId,
      model: GEN_MODEL,
      createdAt,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'cream route failed';
    console.error('[design/cream] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
