/**
 * OpenRouter Whisper Speech-to-Text client.
 *
 * Posts multipart/form-data to OpenRouter's unified transcription endpoint
 * (OpenAI Whisper-family models). Returns the transcribed text.
 *
 * Docs: https://openrouter.ai/docs/guides/overview/multimodal/stt
 */

const OPENROUTER_STT_URL = 'https://openrouter.ai/api/v1/audio/transcriptions';
const DEFAULT_MODEL = 'openai/whisper-1';

export interface TranscribeOptions {
  /** ISO-639-1 language hint (e.g. "de", "en"); omit for auto-detect. */
  language?: string;
  /** OpenRouter model id; defaults to 'openai/whisper-1'. */
  model?: string;
}

/**
 * Returns true when OPENROUTER_API_KEY is present in the environment.
 * Use this to gate UI affordances ("STT nicht konfiguriert").
 */
export function isSttConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/**
 * Transcribe audio via OpenRouter's Whisper endpoint.
 *
 * Accepts a Blob (runtime-agnostic) or a Node Buffer (server-side).
 * Sends multipart/form-data with field 'file' (filename 'audio.webm').
 *
 * @returns the transcribed text.
 * @throws Error if OPENROUTER_API_KEY is missing or the request fails.
 */
export async function transcribeViaOpenRouter(
  audio: Blob | Buffer,
  opts: TranscribeOptions = {},
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not configured. Set it to enable server-side Whisper STT.',
    );
  }

  const model = opts.model || DEFAULT_MODEL;
  const filename = 'audio.webm';

  // Build multipart/form-data in a runtime-portable way.
  // - Blob branch works in both browser and modern Node (undici FormData/Blob).
  // - Buffer branch is for raw Node server runtimes without Blob-of-Buffer.
  let fileBody: Blob | Buffer;
  let contentType: string;

  if (typeof Blob !== 'undefined' && audio instanceof Blob) {
    fileBody = audio;
    contentType = audio.type || 'audio/webm';
  } else if (Buffer.isBuffer(audio)) {
    fileBody = audio;
    contentType = 'audio/webm';
  } else {
    throw new Error('transcribeViaOpenRouter: audio must be a Blob or Buffer');
  }

  let form: FormData;
  if (typeof Blob !== 'undefined' && fileBody instanceof Blob) {
    form = new FormData();
    form.append('file', fileBody, filename);
  } else {
    // Buffer path — use Blob-of-Buffer when available, else fall back to manual
    // multipart construction for older Node runtimes.
    if (typeof Blob !== 'undefined') {
      const blob = new Blob([fileBody as BlobPart], { type: contentType });
      form = new FormData();
      form.append('file', blob, filename);
    } else {
      return transcribeViaManualMultipart(fileBody as Buffer, contentType, filename, model, opts.language, apiKey);
    }
  }

  form.append('model', model);
  if (opts.language) {
    // 'de-DE' -> 'de' (ISO-639-1); Whisper expects the short code.
    form.append('language', opts.language.split('-')[0]);
  }

  const res = await fetch(OPENROUTER_STT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  const data = (await res.json().catch(() => null)) as
    | { text?: string; error?: { message?: string } | string }
    | null;

  if (!res.ok || !data?.text) {
    const msg =
      (data?.error && (typeof data.error === 'string' ? data.error : data.error.message)) ||
      `OpenRouter STT request failed (status ${res.status})`;
    throw new Error(msg);
  }

  return data.text;
}

/**
 * Fallback multipart builder for Node runtimes without a global FormData/Blob
 * that accepts Blob-of-Buffer. Constructs the body manually with a boundary.
 */
async function transcribeViaManualMultipart(
  buffer: Buffer,
  contentType: string,
  filename: string,
  model: string,
  language: string | undefined,
  apiKey: string,
): Promise<string> {
  const boundary = `----OpenRouterSTT${Math.random().toString(16).slice(2)}`;

  const parts: Buffer[] = [];
  const encoder = new TextEncoder();

  const field = (name: string, value: string) => {
    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="${name}"\r\n\r\n`));
    parts.push(Buffer.from(`${value}\r\n`));
  };

  // File part
  parts.push(Buffer.from(`--${boundary}\r\n`));
  parts.push(
    Buffer.from(
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`,
    ),
  );
  parts.push(buffer);
  parts.push(Buffer.from('\r\n'));

  field('model', model);
  if (language) field('language', language.split('-')[0]);

  parts.push(Buffer.from(`--${boundary}--\r\n`));
  void encoder; // TextEncoder kept for future use; harmless if unused.

  const body = Buffer.concat(parts);

  const res = await fetch(OPENROUTER_STT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  const data = (await res.json().catch(() => null)) as
    | { text?: string; error?: { message?: string } | string }
    | null;

  if (!res.ok || !data?.text) {
    const msg =
      (data?.error && (typeof data.error === 'string' ? data.error : data.error.message)) ||
      `OpenRouter STT request failed (status ${res.status})`;
    throw new Error(msg);
  }

  return data.text;
}
