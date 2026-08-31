// Z.Design — Streaming Agentic Art-Directed Design route (SSE / N4).
//
// POST /api/design/agent/stream { message, projectId, concept? }
//
// Thin SSE wrapper around the agent pipeline
// (src/lib/ai/agent-pipeline — prepare → generate → critique → ship).
// Each phase emits a frame:
//
//   data: {"step":"<name>","label":"<DE label>","detail?":"...","composite?":7.9}
//
// The final `complete` frame carries the same payload shape the synchronous
// route returns ({ id, message, html, mode, trace, scores, projectId }) so a
// client can swap the fetch target 1:1 and just consume events incrementally.

import { NextRequest } from 'next/server';
import { runAgentPipeline } from '@/lib/ai/agent-pipeline';

export function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  // Build the SSE stream. We hand the consumer a ReadableStream and push frames
  // into its controller as the pipeline progresses. The pipeline closes the
  // stream when done (or on error).
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        } catch {
          /* controller already closed — ignore */
        }
      };

      try {
        const body = await request.json();
        await runAgentPipeline({ ...body, send });
      } catch (error) {
        console.error('[design/agent/stream] Error:', error);
        send({
          step: 'error',
          message:
            error instanceof Error ? error.message : 'Agent design failed',
        });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Disable proxy buffering so events flush immediately (Caddy/Nginx/CF).
      'X-Accel-Buffering': 'no',
    },
  });
}
