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

// Generation model: Z.ai GLM-5.2 (funded Anthropic endpoint — proven reliable
// for ~27KB / ~110s design prompts). Gemini was removed (no API access).
const GEN_MODEL = ZAI_MODELS.text; // 'glm-5.2'
const GEN_MAX_TOKENS = 16384; // GLM-5.2 output cap — covers a full HTML page.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, projectId } = body as { message: string; projectId: string };
    const target = Number(body.target) > 0 ? Number(body.target) : 8;
    const maxRounds = Number(body.maxRounds) > 0 ? Number(body.maxRounds) : 3;
    const model = typeof body.model === 'string' && body.model ? body.model : GEN_MODEL;
    if (!message || !projectId) {
      return NextResponse.json({ error: 'message and projectId are required' }, { status: 400 });
    }

    // ── 1) v1 GENERATE via Gemini ──────────────────────────────────────────
    const brief = buildArtBrief(message);

    // BILDER: keine MiniMax-Generierung mehr (unzuverlässig, oft falscher Content).
    // Stattdessen liefert brief.imagery (imageryGuidance) domain-spezifische
    // Unsplash-URLs direkt im Prompt → Gemini nutzt echte, kuratierte Fotos.
    let imageBlock = '';

    // negative memory (avoid past failures)
    const memory = await recallAntiPatterns({ domain: brief.domain, maxTokens: 600 });
    const memoryBlock = memory.items.length > 0
      ? `AUS DEM GEDÄCHTNIS — UNBEDINGT VERMEIDEN:\n${memory.items.map((i) => `- ${i.text}`).join('\n')}\n`
      : '';
    // User preferences — inject so the cream pipeline respects them too.
    const userMemoryBlock = userMemoryToPromptBlock(await loadUserMemory());

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
    const generatePrompt = template && refHtml
      ? buildAdaptPrompt(template, refHtml, message, brief.creative)
      : generateHtmlPrompt(brief, message);
    console.log(`[cream] generate-from-reference: ${template ? template.id : 'none (from-zero)'}`);
    const prompt = lessonsToPromptBlock() + userMemoryBlock + memoryBlock + imageBlock + generatePrompt;
    let html = cleanHtml(await callZai(prompt, { model, maxTokens: GEN_MAX_TOKENS, temperature: 0.6, timeoutMs: 300_000 }));
    if (!html || !/<html/i.test(html)) {
      return NextResponse.json({ error: 'Z.ai generate returned no valid HTML' }, { status: 502 });
    }

    // ── 2) Z.AI vision-critique refine loop ───────────────────────────────
    const trace: { round: number; score: number; problems: string[] }[] = [];
    let score = 0;
    for (let round = 1; round <= maxRounds; round++) {
      const png = await renderHtmlToPng(html, { fullPage: true });
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
      const refinePrompt = `Du bist Art Director UND Senior-Frontend-Engineer. Überarbeite dieses HTML. Ziel: ${target}/10 Agentur-Cream. Eine visuelle Experten-Analyse (${score}/10, contentCorrectness ${cc}/10) ergab konkrete Probleme.

PROBLEME (behebe JEDEN):
${c.problems.map((p, i) => `${i + 1}. ${p}`).join('\n')}

FIXES:
${c.fixes.map((f, i) => `${i + 1}. ${f}`).join('\n')}
${contentWarning}

REGELN: Du darfst <img src> URLs durch thematisch PASSendere ersetzen, wenn die Kritik falsche Bilder bemängelt (verwende https://images.unsplash.com/<photo-id>). Kompaktes CSS, vollständige Datei mit </html>, letzter Token </html>. Mobile-first responsive, prefers-reduced-motion, semantisch.

Aktueller Entwurf:
${html}

Gib NUR die vollständige HTML-Datei zurück (<!doctype html> ... </html>).`;
      const refined = cleanHtml(await callZai(refinePrompt, { model, maxTokens: GEN_MAX_TOKENS, temperature: 0.4, timeoutMs: 300_000 }));
      if (refined && /<html/i.test(refined)) html = refined;
    }

    // ── LEARNING FEEDBACK: record the outcome to DesignHistory so the brain-memory
    //    learns from this generation (success → reinforcePositives; failure →
    //    recallAntiPatterns next time). This makes the agent core self-improving.
    try {
      const { recordDesign } = await import('@/lib/ai/memory/history');
      await recordDesign({
        projectId,
        prompt: message,
        domain: brief.domain,
        composite: score,
        feedback: score >= 8 ? '' : trace[trace.length - 1]?.problems?.join('; ')?.slice(0, 200),
        // Capture the vision-critique's concrete problems as rootCause so
        // recallAntiPatterns can learn from them on future runs.
        rootCause: score >= 8 ? null : trace[trace.length - 1]?.problems?.join(' | ') ?? null,
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
          : trace[trace.length - 1]?.problems?.[0] ?? 'low quality',
      });
      maybeReflect();
    } catch {
      // Non-fatal.
    }

    return NextResponse.json({ html, score, rounds: trace.length, trace, projectId, model: GEN_MODEL });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'cream route failed';
    console.error('[design/cream] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
