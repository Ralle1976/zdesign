// Z.Design — CREAM route (GEMINI-driven): the autonomous cream pipeline, exposed
// for the zdesign_cream MCP tool.
//
// POST /api/design/cream { message, projectId, target?, maxRounds? }
//   1. v1 GENERATE via Gemini 2.5 Pro (Z.Design's workflow: art-direction +
//      creative-dna + memory + bespoke MiniMax images — but the heavy generation
//      routed through Gemini, the cream lever).
//   2. GEMINI VISION-CRITIQUE LOOP: Puppeteer renders the live HTML → Gemini
//      critiques what it SEES (stricter than the too-lenient GLM-4.6v) → if
//      score < target, refine via Gemini with the concrete fixes → repeat,
//      bounded. Ship when ≥ target.
//
// Returns { html, score, rounds, trace, model: "gemini-2.5-pro" }.

import { NextRequest, NextResponse } from 'next/server';
import { buildArtBrief, generateHtmlPrompt } from '@/lib/ai/skills/art-direction';
import { recallAntiPatterns } from '@/lib/ai/memory/negative-memory';
import { callGemini } from '@/lib/ai/gemini-direct';
import { renderHtmlToPng, critiqueRenderedGemini } from '@/lib/ai/skills/vision-critique';
import { cleanHtml } from '@/lib/ai/fusion/fusion-client';
import { pickTemplate } from '@/lib/ai/templates/registry';
import { loadReferenceHtml, buildAdaptPrompt } from '@/lib/ai/templates/generate-from-reference';

const GEN_MODEL = 'gemini-3.5-flash'; // fast + reliable (images come from Unsplash, not the model)
const GEN_MAX_TOKENS = 65536; // 2.5-pro max incl. thinking — covers a full HTML page.

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
    const prompt = memoryBlock + imageBlock + generatePrompt;
    let html = cleanHtml(await callGemini(prompt, { model, maxTokens: GEN_MAX_TOKENS, temperature: 0.6, timeoutMs: 300_000 }));
    if (!html || !/<html/i.test(html)) {
      return NextResponse.json({ error: 'Gemini generate returned no valid HTML' }, { status: 502 });
    }

    // ── 2) GEMINI vision-critique refine loop ───────────────────────────────
    const trace: { round: number; score: number; problems: string[] }[] = [];
    let score = 0;
    for (let round = 1; round <= maxRounds; round++) {
      const png = await renderHtmlToPng(html, { fullPage: true });
      if (!png) { trace.push({ round, score, problems: ['render failed'] }); break; }
      const c = await critiqueRenderedGemini(png, message);
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
      const refined = cleanHtml(await callGemini(refinePrompt, { model, maxTokens: GEN_MAX_TOKENS, temperature: 0.4, timeoutMs: 300_000 }));
      if (refined && /<html/i.test(refined)) html = refined;
    }

    // ── LEARNING FEEDBACK: record the outcome to DesignHistory so the brain-memory
    //    learns from this generation (success → reinforcePositives; failure →
    //    recallAntiPatterns next time). This makes the agent core self-improving.
    try {
      const { recordDesign } = await import('@/lib/ai/memory/history');
      await recordDesign({ projectId, prompt: message, domain: brief.domain, composite: score, feedback: score >= 8 ? '' : trace[trace.length - 1]?.problems?.join('; ')?.slice(0, 200) });
      console.log(`[cream] learning feedback recorded: ${brief.domain} score ${score} (${score >= 8 ? 'positive' : 'negative'})`);
    } catch (e) {
      console.warn('[cream] learning feedback failed (non-blocking):', e instanceof Error ? e.message : e);
    }

    return NextResponse.json({ html, score, rounds: trace.length, trace, projectId, model: GEN_MODEL });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'cream route failed';
    console.error('[design/cream] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
