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
import { generateImagesMinimax, buildImagePrompts, buildThaiFoodPrompts, isMinimaxImageConfigured } from '@/lib/ai/image-minimax';
import { callGemini } from '@/lib/ai/gemini-direct';
import { renderHtmlToPng, critiqueRenderedGemini } from '@/lib/ai/skills/vision-critique';
import { cleanHtml } from '@/lib/ai/fusion/fusion-client';

const GEN_MODEL = 'gemini-3.5-flash';
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

    // bespoke MiniMax photos (kept; Gemini writes the markup around them)
    let imageBlock = '';
    if (isMinimaxImageConfigured()) {
      try {
        const hay = `${message} ${brief.imagery || ''}`.toLowerCase();
        const isThai = /thai|pad thai|imbiss|kurry|curry|basil|nudel|noodle/.test(hay);
        const imgPrompts = isThai ? buildThaiFoodPrompts(message, brief.imagery) : buildImagePrompts(message, brief.imagery);
        const imgs = await generateImagesMinimax(imgPrompts, {}, 3);
        const urls = imgs.map((i) => i.url).filter(Boolean);
        if (urls.length > 0) {
          imageBlock =
            '\nBILDER (ECHTE FOTOS — VERWENDE NUR DIESE URLs 1:1):\n' +
            urls.map((u, i) => `  Bild ${i + 1}: <img src="${u}" alt="" style="width:100%;height:auto;object-fit:cover">`).join('\n') +
            '\n';
        }
      } catch (e) {
        console.warn('[design/cream] image gen failed:', e instanceof Error ? e.message : e);
      }
    }

    // negative memory (avoid past failures)
    const memory = await recallAntiPatterns({ domain: brief.domain, maxTokens: 600 });
    const memoryBlock = memory.items.length > 0
      ? `AUS DEM GEDÄCHTNIS — UNBEDINGT VERMEIDEN:\n${memory.items.map((i) => `- ${i.text}`).join('\n')}\n`
      : '';

    const prompt = memoryBlock + imageBlock + generateHtmlPrompt(brief, message);
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
      const c = await critiqueRenderedGemini(png);
      if (!c) { trace.push({ round, score, problems: ['critique failed'] }); break; }
      score = c.overall;
      trace.push({ round, score, problems: c.problems.slice(0, 4) });
      if (score >= target) break;
      if (round === maxRounds) break;

      const refinePrompt = `Du bist Art Director UND Senior-Frontend-Engineer. Überarbeite dieses HTML. Ziel: ${target}/10 Agentur-Cream. Eine visuelle Experten-Analyse (${score}/10) ergab konkrete Probleme.

PROBLEME (behebe JEDEN):
${c.problems.map((p, i) => `${i + 1}. ${p}`).join('\n')}

FIXES:
${c.fixes.map((f, i) => `${i + 1}. ${f}`).join('\n')}

REGELN: BEHALTE alle <img src="..."> URLs EXAKT (keine neuen Bilder, keine Unsplash). Kompaktes CSS, vollständige Datei mit </html>, letzter Token </html>. Mobile-first responsive, prefers-reduced-motion, semantisch.

Aktueller Entwurf:
${html}

Gib NUR die vollständige HTML-Datei zurück (<!doctype html> ... </html>).`;
      const refined = cleanHtml(await callGemini(refinePrompt, { model, maxTokens: GEN_MAX_TOKENS, temperature: 0.4, timeoutMs: 300_000 }));
      if (refined && /<html/i.test(refined)) html = refined;
    }

    return NextResponse.json({ html, score, rounds: trace.length, trace, projectId, model: GEN_MODEL });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'cream route failed';
    console.error('[design/cream] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
