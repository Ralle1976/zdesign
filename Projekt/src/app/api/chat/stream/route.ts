// Z.Design - Chat Streaming API Route (SSE)
//
// O3 (2026-07-04): solves the "60-90s wait without feedback" UX killer.
// Emits Server-Sent Events with stage/progress payloads while the shared
// generation pipeline (lib/chat/generate.ts) runs, then a final `done` event
// with the complete design. The non-streaming POST /api/chat remains the
// canonical JSON endpoint for clients that prefer a single response.
//
// Event protocol (one SSE `data:` line per event):
//   {"type":"stage","stage":"calling-llm"}
//   {"type":"stage","stage":"parsing"}
//   {"type":"stage","stage":"repairing"}
//   {"type":"stage","stage":"fallback","detail":"contextual"}
//   {"type":"done","id":...,"message":...,"design":...,"usedFallback":...,"templateUsed":...}
//   {"type":"error","message":"..."}
//
// The client (ChatPanel) listens via EventSource/fetch-stream and updates the
// progress UI incrementally instead of showing a static spinner.

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { generateDesign } from '@/lib/chat/generate';
import { deriveDesignDirection, directiveToPromptBlock } from '@/lib/ai/fusion';

interface StreamRequestBody {
  message: string;
  projectId: string;
  designTree?: Record<string, unknown>;
  designSystem?: Record<string, unknown>;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  creativeMode?: boolean;
}

// Stage labels surfaced to the client (kept short for the progress UI).
const STAGE_LABELS: Record<string, string> = {
  'calling-llm': 'KI wird kontaktiert…',
  parsing: 'Antwort wird verarbeitet…',
  repairing: 'JSON wird repariert…',
  fallback: 'Fallback-Design wird gebaut…',
  done: 'Fertig',
};

function sseLine(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(request: NextRequest) {
  let body: StreamRequestBody;
  try {
    body = await request.json();
  } catch {
    return new Response(sseLine({ type: 'error', message: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  const { message, projectId, designTree, designSystem, history, creativeMode } = body;

  if (!message || !projectId) {
    return new Response(
      sseLine({ type: 'error', message: 'message and projectId are required' }),
      { status: 400, headers: { 'Content-Type': 'text/event-stream' } }
    );
  }

  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return new Response(sseLine({ type: 'error', message: 'Project not found' }), {
      status: 404,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(sseLine(payload)));
      };

      try {
        // Store the user message up-front so the conversation history is
        // consistent even if the client disconnects mid-stream.
        await db.chatMessage.create({
          data: { projectId, role: 'user', content: message },
        });

        // Build a concise system prompt (mirrors the canonical chat route's
        // strategy: topic-derived directive + optional design-system + creative).
        const designDirective = deriveDesignDirection(message);
        let systemPrompt = `You are Z.Design AI, an expert visual design assistant. Generate designs as structured JSON only (no markdown). Every property name in double quotes, every CSS value a quoted string, rgba without spaces, no trailing commas.`;

        const isRefinementRequest =
          !!designTree && (designTree.children as unknown[] | undefined)?.length;
        const refinementKeywords = [
          'change', 'make', 'update', 'modify', 'replace', 'remove', 'add', 'move',
          'resize', 'recolor', 'turn', 'switch', 'swap', 'color', 'font', 'size',
        ];
        const isLikelyRefinement =
          !!isRefinementRequest &&
          refinementKeywords.some((kw) => message.toLowerCase().includes(kw));

        if (isLikelyRefinement) {
          systemPrompt +=
            '\n\nThis is a refinement of an existing design. Return ONLY the modified subtree using the refinement format (action, targetId, node). Do NOT return the entire tree.';
        } else {
          systemPrompt += `\n\n${directiveToPromptBlock(designDirective)}`;
          if (designSystem && Object.keys(designSystem).length > 0) {
            const dsName = (designSystem as Record<string, unknown>).name || 'Custom';
            systemPrompt += `\n\n=== DESIGN SYSTEM ENFORCEMENT ===\nUse ONLY the "${dsName}" design system tokens: ${JSON.stringify(designSystem)}`;
          }
          if (creativeMode) {
            systemPrompt +=
              '\n\nCREATIVE MODE: be bold and experimental (bento grids, gradient meshes, glassmorphism, neobrutalism).';
          }
        }

        // Build user content
        let userContent = message;
        if (isLikelyRefinement && designTree) {
          const childrenCount = (designTree.children as unknown[]).length;
          userContent = `[CURRENT DESIGN: ${childrenCount} sections]\n\nDesign tree: ${JSON.stringify(designTree).substring(0, 3000)}\n\nUser request: ${message}`;
        }

        // Run the shared pipeline with a progress callback that emits SSE events.
        const generated = await generateDesign(
          { message, systemPrompt, userContent, history, creativeMode },
          (stage, detail) => {
            send({
              type: 'stage',
              stage,
              label: STAGE_LABELS[stage] ?? stage,
              detail: detail ?? null,
            });
          }
        );

        // Persist the assistant message + design (mirrors the canonical route).
        const assistantMessage = await db.chatMessage.create({
          data: {
            projectId,
            role: 'assistant',
            content: generated.message,
            metadata: JSON.stringify({
              designUpdate: generated.design || null,
              tokensUsed: generated.tokensUsed,
              usedFallback: generated.usedFallback,
              streamed: true,
            }),
          },
        });

        if (generated.design) {
          await db.project.update({
            where: { id: projectId },
            data: {
              designJSON: JSON.stringify(generated.design),
              status: 'IN_PROGRESS',
            },
          });
        }

        send({
          type: 'done',
          id: assistantMessage.id,
          message: generated.message,
          design: generated.design,
          projectId,
          createdAt: assistantMessage.createdAt,
          usedFallback: generated.usedFallback,
          templateUsed: generated.templateUsed,
          parseFailed: !generated.design,
        });
      } catch (error) {
        console.error('[Chat SSE] Error:', error);
        send({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Disable proxy buffering (Caddy/nginx) so events flush immediately.
      'X-Accel-Buffering': 'no',
    },
  });
}
