// Z.Design — Generic hardened Fusion HTTP client.
//
// callRemoteFusion is DesignNode-specific (builds a node prompt, parses to a
// DesignNode). The agentic HTML loop needs to call the SAME Fusion service with
// arbitrary prompts (generate HTML, critique JSON, refine HTML) and get raw text
// back. This is that primitive: it reuses the same service URL, timeout budget,
// and retry-on-failure hardening added this session, minus the DesignNode coupling.

const FUSION_TIMEOUT_MS = 220_000; // per attempt (matches remote-fusion)
const MAX_ATTEMPTS = 2;

function extractText(data: unknown): string {
  const r = data as {
    result?: { response?: { choices?: Array<{ message?: { content?: unknown }; finish_reason?: string }> } };
    response?: { choices?: Array<{ message?: { content?: unknown } }> };
  };
  const choices = r.result?.response?.choices ?? r.response?.choices ?? [];
  const content = choices[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (b && typeof b === 'object' && 'text' in b ? String((b as { text: unknown }).text) : ''))
      .join('');
  }
  return '';
}

export interface CallFusionOpts {
  maxTokens?: number;
  temperature?: number;
  /** Bias the service to specific providers/models (e.g. GLM-5.2). Optional. */
  panelProviderIds?: string[];
  synthesisProviderId?: string;
}

/**
 * Call the Fusion service with an arbitrary prompt and return the synthesized
 * text. Retries once on empty/unreachable. Throws on hard failure.
 */
export async function callFusionText(prompt: string, opts: CallFusionOpts = {}): Promise<string> {
  const base = (process.env.FUSION_SERVICE_URL ?? '').replace(/\/+$/, '');
  if (!base) throw new Error('FUSION_SERVICE_URL is not set');

  const url = `${base}/api/v1/fusion`;
  const body = {
    prompt,
    maxTokens: opts.maxTokens ?? 8000,
    temperature: opts.temperature ?? 0.4,
    ...(opts.panelProviderIds ? { panelProviderIds: opts.panelProviderIds } : {}),
    ...(opts.synthesisProviderId ? { synthesisProviderId: opts.synthesisProviderId } : {}),
  };

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FUSION_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`Fusion ${res.status}: ${t.slice(0, 160)}`);
      }
      const data = await res.json();
      const text = extractText(data);
      if (text && text.trim().length > 0) return text;
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`[fusion-client] empty synthesis (attempt ${attempt}/${MAX_ATTEMPTS}), retrying`);
        continue;
      }
      throw new Error('Fusion returned no synthesized content');
    } catch (e) {
      lastErr = e;
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`[fusion-client] attempt ${attempt} failed (${e instanceof Error ? e.message : e}), retrying`);
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Fusion call failed');
}

/**
 * Strip markdown fences / leading prose so the model's output is a clean HTML
 * document starting at <!doctype html>.
 */
export function cleanHtml(raw: string): string {
  let s = raw.trim();
  const fence = s.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const doctype = s.toLowerCase().indexOf('<!doctype');
  const htmlTag = s.indexOf('<html');
  const start = doctype >= 0 ? doctype : htmlTag >= 0 ? htmlTag : 0;
  if (start > 0) s = s.slice(start);
  return s;
}
