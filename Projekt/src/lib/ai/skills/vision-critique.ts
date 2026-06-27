/**
 * vision-critique.ts — the EYES of the generation loop.
 *
 * The critique theater critiques the HTML *text* — it is blind (cannot see
 * layout, harmony, whitespace, "leben"). This module closes that gap:
 *
 *   renderHtmlToPng(html)   → Puppeteer renders the live HTML to a PNG
 *   critiqueRendered(png)   → GLM-5v-Turbo (callZaiVision) scores what it SEES
 *
 * Wired into the agent route, this turns the loop from "blind text critique"
 * into "a creative director looking at the rendered page" — the lever that
 * lifts quality from ~6 to 8+ (verified 4 → 6.5 → 7.8 in manual A/B).
 *
 * Pure-ish: Puppeteer + callZaiVision. No FS, no DB. Never throws at render
 * time (render failures → null → caller skips that critique round).
 */
import puppeteer, { type Browser } from 'puppeteer';
import { callZaiVision, ZAI_MODELS, type ZaiCallOptions } from '@/lib/ai/zai-direct';
import { callGeminiMultimodal } from '@/lib/ai/gemini-direct';

export interface RenderOpts {
  width?: number;
  /** Full-page screenshot (default true). When false, captures the viewport only. */
  fullPage?: boolean;
  /** ms to wait after load for fonts/first-frame animations to settle. */
  settleMs?: number;
  /** optional cap on full-page height (px) to avoid enormous screenshots. */
  maxHeight?: number;
}

/**
 * Render a complete HTML document to a PNG Buffer via headless Chrome.
 * Uses no-sandbox (WSL/CI) and waits for network idle + a short settle so
 * Google Fonts and CSS animations are present in the frame.
 */
export async function renderHtmlToPng(html: string, opts: RenderOpts = {}): Promise<Buffer | null> {
  const width = opts.width ?? 1280;
  const fullPage = opts.fullPage ?? true;
  const settleMs = opts.settleMs ?? 1200;
  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        `--window-size=${width},900`,
      ],
    });
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    // setContent with dom-loaded then a manual settle (networkidle0 can hang on
    // third-party fonts/cursors that keep a connection open).
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, settleMs));
    let png = (await page.screenshot({ fullPage, type: 'png' })) as Buffer;
    // Optional height cap: re-capture as a viewport-only frame if the doc is
    // excessively tall (keeps the vision payload reasonable).
    if (opts.maxHeight && png.length > opts.maxHeight * width * 0.4) {
      png = (await page.screenshot({ fullPage: false, type: 'png' })) as Buffer;
    }
    return png;
  } catch (e) {
    console.warn('[vision-critique] render failed:', e instanceof Error ? e.message : e);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

export interface VisionCritique {
  overall: number;
  dimensions: Record<string, number>;
  problems: string[];
  fixes: string[];
  agencyLevel: boolean;
}

const CRITIQUE_PROMPT = `You are a senior art director evaluating a RENDERED landing page. Judge ONLY what you SEE visually — not the code. Be rigorous and honest, like a top agency creative director.

Score each dimension 1-10 (10 = world-class agency work, 8 = solid agency, 6 = competent but generic, 4 = clearly flawed):
- harmony (cohesive palette, rhythm, nothing clashes)
- life (depth, atmosphere, motion-feel — NOT flat/sterile)
- typography (scale, contrast, breathing room)
- imagery (photo quality, cropping, on-theme, integration)
- layout (originality — custom vs generic template)
- professionalism (WOW — would a paying client be impressed, is it agency-level?)

Return STRICT JSON only:
{"overall": <1-10>, "dimensions": {"harmony":N,"life":N,"typography":N,"imagery":N,"layout":N,"professionalism":N}, "problems": ["<3-5 concrete visual problems>"], "fixes": ["<3-5 specific actionable fixes>"], "agencyLevel": <true if overall>=8>}`;

/**
 * Ask GLM-5v-Turbo to visually critique a rendered design screenshot.
 * Returns a parsed critique, or null if the call/parse failed.
 */
export async function critiqueRendered(
  png: Buffer,
  opts: ZaiCallOptions = {}
): Promise<VisionCritique | null> {
  const b64 = png.toString('base64');
  const callOpts: ZaiCallOptions = {
    // glm-5v-turbo is NOT on the funded plan (HTTP 429); glm-4.6v is and
    // works well for rendered-design critique. Override via opts.model if needed.
    model: opts.model || ZAI_MODELS.visionAlt, // glm-4.6v
    responseFormat: 'json_object',
    maxTokens: 1500,
    temperature: 0.3,
    timeoutMs: 120_000,
    ...opts,
  };
  try {
    const raw = await callZaiVision(CRITIQUE_PROMPT, b64, callOpts);
    const parsed = JSON.parse(raw);
    return {
      overall: clamp(parsed.overall),
      dimensions: {
        harmony: clamp(parsed.dimensions?.harmony),
        life: clamp(parsed.dimensions?.life),
        typography: clamp(parsed.dimensions?.typography),
        imagery: clamp(parsed.dimensions?.imagery),
        layout: clamp(parsed.dimensions?.layout),
        professionalism: clamp(parsed.dimensions?.professionalism),
      },
      problems: Array.isArray(parsed.problems) ? parsed.problems.slice(0, 6) : [],
      fixes: Array.isArray(parsed.fixes) ? parsed.fixes.slice(0, 6) : [],
      agencyLevel: parsed.overall >= 8,
    };
  } catch (e) {
    console.warn('[vision-critique] critique failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * GEMINI vision critique — the stricter cream judge (GLM-4.6v was too lenient:
 * it rated bad/off images 8/10). Gemini sees the rendered design and returns the
 * same VisionCritique shape. Falls back to null on failure (caller skips round).
 */
export async function critiqueRenderedGemini(png: Buffer): Promise<VisionCritique | null> {
  const b64 = png.toString('base64');
  try {
    const raw = await callGeminiMultimodal(CRITIQUE_PROMPT, b64, {
      maxTokens: 3000,
      temperature: 0.3,
      timeoutMs: 120_000,
    });
    // Gemini may wrap JSON in markdown fences or preamble — extract the {...}.
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return {
      overall: clamp(parsed.overall),
      dimensions: {
        harmony: clamp(parsed.dimensions?.harmony),
        life: clamp(parsed.dimensions?.life),
        typography: clamp(parsed.dimensions?.typography),
        imagery: clamp(parsed.dimensions?.imagery),
        layout: clamp(parsed.dimensions?.layout),
        professionalism: clamp(parsed.dimensions?.professionalism),
      },
      problems: Array.isArray(parsed.problems) ? parsed.problems.slice(0, 6) : [],
      fixes: Array.isArray(parsed.fixes) ? parsed.fixes.slice(0, 6) : [],
      agencyLevel: parsed.overall >= 8,
    };
  } catch (e) {
    console.warn('[vision-critique] gemini critique failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

function clamp(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, n));
}

/** One-shot convenience: render + critique. Returns null if render failed. */
export async function renderAndCritique(
  html: string,
  renderOpts?: RenderOpts
): Promise<{ png: Buffer; critique: VisionCritique | null } | null> {
  const png = await renderHtmlToPng(html, renderOpts);
  if (!png) return null;
  const critique = await critiqueRendered(png);
  return { png, critique };
}
