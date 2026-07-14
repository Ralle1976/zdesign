// Consumes POST /api/design/agent/stream (SSE) and yields parsed frames.

export interface AgentStreamFrame {
  step: string;
  label?: string;
  detail?: string;
  composite?: number;
  message?: string;
  html?: string;
  trace?: Array<{ step: string; label: string; detail?: string }>;
  scores?: Record<string, unknown>;
  id?: string;
  projectId?: string;
  createdAt?: string;
}

export interface AgentStreamComplete extends AgentStreamFrame {
  step: 'complete';
  html: string;
  message: string;
}

function parseSseChunk(buffer: string): { frames: AgentStreamFrame[]; rest: string } {
  const frames: AgentStreamFrame[] = [];
  const parts = buffer.split('\n');
  const rest = parts.pop() ?? '';
  for (const line of parts) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const json = trimmed.slice(5).trim();
    if (!json) continue;
    try {
      frames.push(JSON.parse(json) as AgentStreamFrame);
    } catch {
      // ignore malformed frames
    }
  }
  return { frames, rest };
}

export async function runAgentDesignStream(
  body: Record<string, unknown>,
  onFrame: (frame: AgentStreamFrame) => void,
  signal?: AbortSignal,
): Promise<AgentStreamComplete> {
  const res = await fetch('/api/design/agent/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof (err as { error?: string }).error === 'string'
        ? (err as { error: string }).error
        : `Agent stream failed (${res.status})`,
    );
  }

  if (!res.body) {
    throw new Error('Agent stream returned no body');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { frames, rest } = parseSseChunk(buffer);
    buffer = rest;
    for (const frame of frames) {
      onFrame(frame);
      if (frame.step === 'error') {
        throw new Error(frame.message ?? 'Agent design failed');
      }
      if (frame.step === 'complete' && frame.html) {
        return frame as AgentStreamComplete;
      }
    }
  }

  throw new Error('Agent stream ended without a complete frame');
}