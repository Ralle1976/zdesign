// Z.Design - Client-side SSE consumer for chat streaming (O3)
//
// Consumes POST /api/chat/stream and surfaces progress events to the caller
// while the LLM runs, then resolves with the final design payload — the same
// shape the non-streaming /api/chat returns. Falls back to a plain /api/chat
// JSON request if the stream fails to open, so callers don't need two paths.

'use client';

export interface StreamChatInput {
  message: string;
  projectId: string;
  // `unknown` (not Record<string, unknown>): the design tree / system are
  // passed straight to the server as JSON; we don't inspect their shape here,
  // and using Record would reject typed callers (DesignNode has no index sig).
  designTree?: unknown;
  designSystem?: unknown;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  creativeMode?: boolean;
}

export interface StreamChatResult {
  id?: string;
  message: string;
  // `any` (not `unknown`): the design payload is consumed downstream exactly
  // like the legacy `await res.json()` result was — untyped. The server
  // guarantees a DesignNode shape; typing it strictly here would push
  // type-checking into every caller (setDesignTree, evaluateDesignQuality, …).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  design?: any;
  projectId?: string;
  createdAt?: string;
  usedFallback?: boolean;
  templateUsed?: boolean;
  parseFailed?: boolean;
}

export type StageEvent = {
  stage: string;
  label?: string;
  detail?: string | null;
};

/**
 * Stream a chat generation, calling onStage for each progress event.
 * Returns the final design payload on success. On stream-open failure,
 * transparently falls back to the non-streaming JSON endpoint.
 */
export async function streamChat(
  input: StreamChatInput,
  onStage: (event: StageEvent) => void,
  signal?: AbortSignal
): Promise<StreamChatResult> {
  let res: Response;
  try {
    res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(input),
      signal,
    });
  } catch (e) {
    // Network error before open → fall back to JSON.
    return jsonFallback(input, signal);
  }

  if (!res.ok || !res.body) {
    // Stream endpoint rejected (e.g. proxy stripped it) → fall back.
    return jsonFallback(input, signal);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: StreamChatResult | null = null;
  let errorMessage: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by a blank line; each carries a `data:` line.
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      const dataLines = rawEvent
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim());
      if (dataLines.length === 0) continue;

      try {
        const payload = JSON.parse(dataLines.join('\n'));
        if (payload.type === 'stage') {
          onStage({
            stage: payload.stage,
            label: payload.label,
            detail: payload.detail ?? null,
          });
        } else if (payload.type === 'done') {
          finalResult = {
            id: payload.id,
            message: payload.message ?? 'I processed your request.',
            design: payload.design,
            projectId: payload.projectId,
            createdAt: payload.createdAt,
            usedFallback: payload.usedFallback,
            templateUsed: payload.templateUsed,
            parseFailed: payload.parseFailed,
          };
        } else if (payload.type === 'error') {
          errorMessage = payload.message ?? 'Stream error';
        }
      } catch {
        // JSON.parse failed — this can happen when a large 'done' event (the
        // design JSON can be 6KB+) is split across multiple network frames and
        // the \n\n split landed inside the JSON. The partial data is already
        // consumed from the buffer, so we can't recover it here.
        //
        // FIX (2026-07-11): We now accumulate the raw event text BEFORE trying
        // to parse, and only parse once we have the complete event (signaled by
        // the \n\n separator). But if the server sends the 'done' event as a
        // single multi-line SSE message, dataLines.join('\n') should reconstruct
        // it correctly. The real issue was that SSE spec says each line inside
        // an event starts with 'data:' — our server sends the entire JSON on
        // ONE 'data:' line, which can be 6KB+. That's valid SSE but some HTTP
        // clients chunk it. The reader loop handles this correctly by buffering
        // until \n\n appears. If we get here, the event was malformed — log it.
        console.warn('[streamClient] Failed to parse SSE event, skipping. Length:', dataLines.join('\n').length);
      }
    }
  }

  if (errorMessage) {
    // Surface error via throw so the caller's existing catch handles it.
    throw new Error(errorMessage);
  }
  if (!finalResult) {
    // Stream closed without a done event → fall back to JSON to be safe.
    return jsonFallback(input, signal);
  }
  return finalResult;
}

async function jsonFallback(
  input: StreamChatInput,
  signal?: AbortSignal
): Promise<StreamChatResult> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, fusion: undefined }),
    signal,
  });
  if (!res.ok) {
    throw new Error(`Chat failed: status ${res.status}`);
  }
  return res.json();
}
