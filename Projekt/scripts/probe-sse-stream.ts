/**
 * Phase-0 probe for feature-003 (LLM Streaming).
 *
 * The Z.ai SDK documents SSE streaming only for TTS, NOT for chat. The SDK
 * source (node_modules/z-ai-web-dev-sdk/dist/index.js ~L91-111) branches on
 * `stream:true` + content-type `text/event-stream`|`text/plain` and returns the
 * raw `response.body`. This probe confirms the actual chunk shape empirically
 * before we build the streaming transport.
 *
 * Run: bun run scripts/probe-sse-stream.ts
 */
import ZAI from 'z-ai-web-dev-sdk';

const SYSTEM =
  'You are a JSON-only design generator. Respond with a single valid JSON object. No prose, no markdown fences.';
const USER =
  'Create a minimal design: one text heading and one button. Respond ONLY with JSON of shape {"message": string, "design": {"id":"root","type":"root","tag":"div","children":[...]}}.';

async function main() {
  console.log('=== Phase-0 SSE Probe (feature-003) ===');
  console.log('Creating ZAI instance (no API key — SDK handles auth)...');
  const zai = await ZAI.create();
  console.log('ZAI ready. Issuing STREAMING chat.completions.create({stream:true})...\n');

  const result: unknown = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: USER },
    ],
    stream: true,
    thinking: { type: 'disabled' },
  });

  // ---- 1. What did we actually get back? ----
  console.log('--- Result type inspection ---');
  console.log('typeof result             :', typeof result);
  console.log('constructor.name          :', (result as any)?.constructor?.name);
  const isStream =
    typeof ReadableStream !== 'undefined' && result instanceof ReadableStream;
  console.log('instanceof ReadableStream :', isStream);
  console.log('has .getReader            :', typeof (result as any)?.getReader === 'function');
  if (!isStream && result && typeof result === 'object') {
    console.log('object keys               :', Object.keys(result as object));
  }

  // ---- 2a. Streaming branch ----
  if (typeof (result as any)?.getReader === 'function') {
    console.log('\n--- Reading SSE stream ---');
    const reader = (result as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let chunkCount = 0;
    let dataLineCount = 0;
    const samplePayloads: string[] = [];
    const sampleParsed: unknown[] = [];
    let sawDoneMarker = false;
    let finishReason: string | null = null;
    let usageObj: unknown = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      buffer += text;
      chunkCount++;
      if (chunkCount <= 6) {
        console.log(`[raw chunk ${chunkCount}] ${JSON.stringify(text).slice(0, 280)}`);
      }

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          sawDoneMarker = true;
          continue;
        }
        dataLineCount++;
        if (samplePayloads.length < 6) samplePayloads.push(payload);
        try {
          const obj = JSON.parse(payload);
          if (sampleParsed.length < 3) sampleParsed.push(obj);
          // OpenAI-compatible path
          const choice = obj?.choices?.[0];
          const delta = choice?.delta?.content;
          if (typeof delta === 'string') fullContent += delta;
          if (choice?.finish_reason && !finishReason) finishReason = choice.finish_reason;
          if (obj?.usage && !usageObj) usageObj = obj.usage;
          // Log any non-standard top-level keys once
          if (dataLineCount === 1) {
            console.log('[first payload keys]:', Object.keys(obj));
          }
        } catch {
          // partial JSON spanning chunks — expected, ignore
        }
      }
    }
    // flush remainder
    buffer.split('\n').forEach((rawLine) => {
      const line = rawLine.trim();
      if (line.startsWith('data:') && line.slice(5).trim() === '[DONE]') sawDoneMarker = true;
    });

    console.log('\n--- Stream summary ---');
    console.log('raw byte-chunks           :', chunkCount);
    console.log('data: lines               :', dataLineCount);
    console.log('saw [DONE] marker         :', sawDoneMarker);
    console.log('finish_reason             :', finishReason);
    console.log('usage                     :', JSON.stringify(usageObj));
    console.log('\nsample raw data: payloads (first 6):');
    samplePayloads.forEach((p, i) => console.log(`  [${i}] ${p.slice(0, 220)}`));
    console.log('\nsample parsed objects (first 3, truncated):');
    sampleParsed.forEach((o, i) => console.log(`  [${i}] ${JSON.stringify(o).slice(0, 220)}`));
    console.log('\n--- Reconstructed content (choices[0].delta.content accumulator) ---');
    console.log(fullContent || '(EMPTY — delta.content path did not yield text; inspect raw payloads above)');
    console.log('\n=== PROBE COMPLETE (streaming branch) ===');
    return;
  }

  // ---- 2b. Non-streaming fallback ----
  console.log('\n--- Result is NOT a stream (streaming branch did NOT trigger) ---');
  console.log('The SDK returned a parsed object instead of response.body.');
  console.log(JSON.stringify(result, null, 2).slice(0, 2000));
  console.log('\n=== PROBE COMPLETE (non-streaming fallback) ===');
}

main().catch((err) => {
  console.error('PROBE FAILED:', err);
  process.exit(1);
});
