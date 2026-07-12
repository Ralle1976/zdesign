// Z.Design - Shared chat generation logic
//
// Extracted from the chat POST handler so both the classic JSON endpoint
// (POST /api/chat) and the SSE streaming endpoint (POST /api/chat/stream)
// share ONE implementation of: LLM call + retry + parse + repair + fallback.
//
// O3 (2026-07-04): the streaming endpoint emits progress/stage events while
// this shared logic runs, so the user gets feedback during the ~60-90s LLM
// call instead of staring at a spinner.

import ZAI from 'z-ai-web-dev-sdk';
import { parseAIResponse, repairLLMJson } from '@/lib/ai-prompts';
import { generateFallbackDesign, generateContextualFallback } from '@/lib/chat/fallback-templates';
import { recallAntiPatterns } from '@/lib/ai/memory/negative-memory';
import { loadApprovedRecipeForTopic } from '@/lib/ai/skills/skill-memory';
import { loadUserMemory, userMemoryToPromptBlock } from '@/lib/ai/memory/user-memory';
import { deriveDesignDirection } from '@/lib/ai/fusion/design-direction';
import { lessonsToPromptBlock, saveResult, maybeReflect } from '@/lib/ai/memory/lessons';

// ============ ZAI Singleton (shared across requests in a process) ============

let zaiInstance: ZAI | null = null;

export async function getZAI(): Promise<ZAI> {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// ============ Types ============

export interface GenerateInput {
  message: string;
  systemPrompt: string;
  userContent: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  creativeMode?: boolean;
}

export interface GenerateResult {
  /** Human-readable assistant message. */
  message: string;
  /** Parsed design tree, or null if none could be produced. */
  design: unknown | null;
  /** True if the LLM was unreachable and a hardcoded fallback design was used. */
  usedFallback: boolean;
  /** True if a topic-template fallback was used (LLM responded but JSON failed). */
  templateUsed: boolean;
  /** Raw token usage reported by the LLM (0 if unavailable / fallback). */
  tokensUsed: number;
}

/**
 * Optional progress callback. The streaming endpoint uses this to emit SSE
 * stage events ("calling-llm", "parsing", "repairing", "fallback") while the
 * (slow) LLM call is in flight. The non-streaming POST simply omits it.
 */
export type ProgressFn = (stage: string, detail?: string) => void;

// ============ Shared generation ============

export async function generateDesign(
  input: GenerateInput,
  onProgress?: ProgressFn
): Promise<GenerateResult> {
  const { message, systemPrompt, userContent, history, creativeMode } = input;

  // ── Memory injection (previously the chat route had ZERO memory) ──
  // The agent + cream routes already learn from past runs; the chat route
  // (the most common user path) was amnestic. We inject the same three memory
  // blocks here, bounded to ~600 tokens total to avoid prompt bloat.
  let memoryPrefix = '';
  // Inject the distilled LESSONS.md (verified patterns from past generations,
  // ~200-400 tokens) — the compact knowledge block from the reflect-loop.
  const lessonsBlock = lessonsToPromptBlock();
  if (lessonsBlock) memoryPrefix += lessonsBlock;
  try {
    const domain = deriveDesignDirection(message).domain;
    const antiPatterns = await recallAntiPatterns({ domain, maxTokens: 300 });
    if (antiPatterns.items.length > 0) {
      memoryPrefix += `\nAUS DEM GEDÄCHTNIS — UNBEDINGT VERMEIDEN:\n${antiPatterns.items.map((i) => `- ${i.text}`).join('\n')}\n`;
    }
    const recipe = await loadApprovedRecipeForTopic(domain);
    if (recipe) {
      memoryPrefix += `\nBEWÄHRTE BASIS (Ø${recipe.sourceComposite}): Palette ${recipe.palette?.accent ?? '?'} · Display "${recipe.fonts?.display ?? '?'}" · Gesten: ${(recipe.soulGestures ?? []).slice(0, 3).join(', ')}\n`;
    }
    const userMem = userMemoryToPromptBlock(await loadUserMemory());
    if (userMem) {
      memoryPrefix += `\n${userMem}\n`;
    }
  } catch {
    // Memory is best-effort; never break generation on a memory read failure.
  }

  // Build conversation messages (system + last 4 history + user)
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: memoryPrefix + systemPrompt },
  ];
  if (history && history.length > 0) {
    const recentHistory = history.slice(-4);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  messages.push({ role: 'user', content: userContent });

  // Call Z.ai LLM with timeout + retry (LLM takes ~60-90s for a full design)
  let rawResponse: string | null = null;
  let tokensUsed = 0;
  let usedFallback = false;

  const LLM_TIMEOUT_FIRST = 120000;
  const LLM_TIMEOUT_RETRY = 90000;
  const maxRetries = 2;

  onProgress?.('calling-llm');
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const zai = await getZAI();
      const timeoutMs = attempt === 0 ? LLM_TIMEOUT_FIRST : LLM_TIMEOUT_RETRY;

      const completionPromise = zai.chat.completions.create({
        messages,
        thinking: { type: 'disabled' },
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM timeout')), timeoutMs)
      );

      const completion = await Promise.race([completionPromise, timeoutPromise]);
      rawResponse = completion.choices[0]?.message?.content || null;
      tokensUsed = completion.usage?.total_tokens || 0;
      break;
    } catch (llmError) {
      console.warn(
        `[chat/generate] LLM attempt ${attempt + 1} failed:`,
        llmError instanceof Error ? llmError.message : llmError
      );
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        console.error('[chat/generate] LLM exhausted, using fallback');
        usedFallback = true;
      }
    }
  }

  // Parse response: LLM output → repair → smart contextual fallback → hardcoded fallback
  let parsed: { message: string; design: unknown | null };
  let templateUsed = false;

  if (rawResponse) {
    onProgress?.('parsing');
    parsed = parseAIResponse(rawResponse);
    if (!parsed.design) {
      console.warn(
        '[chat/generate] LLM parsed but no design. Raw len:',
        rawResponse.length,
        'First 200:',
        rawResponse.substring(0, 200)
      );
      onProgress?.('repairing');
      const repaired = repairLLMJson(rawResponse);
      if (repaired) {
        try {
          const repairedParsed = JSON.parse(repaired);
          if (repairedParsed && typeof repairedParsed === 'object') {
            const rp = repairedParsed as Record<string, unknown>;
            if (rp.design || rp.id || rp.type || rp.children) {
              parsed = {
                message: (rp.message as string) || parsed.message,
                design: rp.design || rp,
              };
              console.log('[chat/generate] Design recovered via repairLLMJson');
            }
          }
        } catch (repairError) {
          const errMsg = repairError instanceof Error ? repairError.message : String(repairError);
          console.warn('[chat/generate] repairLLMJson failed:', errMsg.substring(0, 100));
        }
      }

      // Smart contextual fallback
      if (!parsed.design && rawResponse) {
        onProgress?.('fallback', 'contextual');
        const messageMatch = rawResponse.match(/"message"\s*:\s*"([^"]+)"/);
        const llmMessage = messageMatch ? messageMatch[1] : '';
        const contextualFallback = generateContextualFallback(message, llmMessage, creativeMode);
        parsed = parseAIResponse(contextualFallback);
        templateUsed = true;
      }
    } else {
      // Completeness check: landing pages need >=3 top-level sections
      const designObj = parsed.design as Record<string, unknown> | null;
      const children = (designObj?.children as unknown[]) || [];
      const msg = message.toLowerCase();
      const isLandingOrPage =
        msg.includes('landing') ||
        msg.includes('page') ||
        msg.includes('website') ||
        msg.includes('saas') ||
        msg.includes('app');
      if (isLandingOrPage && children.length < 3) {
        console.warn(
          '[chat/generate] Design too incomplete (' + children.length + ' children), fallback'
        );
        onProgress?.('fallback', 'incomplete');
        const messageMatch = rawResponse?.match(/"message"\s*:\s*"([^"]+)"/);
        const llmMessage = messageMatch ? messageMatch[1] : '';
        const contextualFallback = generateContextualFallback(message, llmMessage, creativeMode);
        parsed = parseAIResponse(contextualFallback);
        templateUsed = true;
      }
    }
  } else {
    // LLM completely unavailable → hardcoded fallback
    onProgress?.('fallback', 'offline');
    const fallbackRaw = generateFallbackDesign(message, creativeMode);
    parsed = parseAIResponse(fallbackRaw);
    usedFallback = true;
  }

  onProgress?.('done');

  // Record the outcome for the lessons reflect-loop (Graphify-style).
  // Best-effort: a failure here must never break the generation result.
  try {
    const domain = deriveDesignDirection(message).domain;
    const isFallback = usedFallback || templateUsed;
    await saveResult({
      domain,
      outcome: isFallback ? 'dead_end' : 'useful',
      composite: isFallback ? 5 : 7,
      detail: isFallback ? 'fallback template used' : 'LLM generation succeeded',
    });
    maybeReflect();
  } catch {
    // Non-fatal.
  }

  return {
    message: parsed.message || 'I generated a design for you!',
    design: parsed.design,
    usedFallback,
    templateUsed,
    tokensUsed,
  };
}
