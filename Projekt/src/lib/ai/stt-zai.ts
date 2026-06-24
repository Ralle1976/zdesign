/**
 * Z.ai Speech-to-Text client (GLM-ASR).
 *
 * Posts multipart/form-data to the Z.ai paas/v4 audio-transcription endpoint
 * with model glm-asr-2512. Returns the transcribed text.
 *
 * Endpoint: https://api.z.ai/api/paas/v4/audio/transcriptions
 * Auth:     Bearer $ZAI_API_KEY
 *
 * This is the plan-native STT path (no extra OpenRouter cost). The voice route
 * prefers this client and falls back to OpenRouter Whisper when it fails.
 */

const ZAI_STT_URL =
  process.env.ZAI_STT_URL || 'https://api.z.ai/api/paas/v4/audio/transcriptions';
const DEFAULT_MODEL = 'glm-asr-2512';

export interface ZaiTranscribeOptions {
  /** ISO-639-1 language hint (e.g. "de", "en"); omit for auto-detect. */
  language?: string;
  /** Z.ai ASR model id; defaults to 'glm-asr-2512'. */
  model?: string;
  /** Optional filename for the multipart file field (default: audio.webm). */
  filename?: string;
  /** Per-request timeout in ms. Default 60_000. */
  timeoutMs?: number;
}

/**
 * Returns true when ZAI_API_KEY is present in the environment.
 * Use this to decide whether the Z.ai ASR path is available.
 */
export function isZaiSttConfigured(): boolean {
  return Boolean(process.env.ZAI_API_KEY);
}

/**
 * Transcribe audio via the Z.ai GLM-ASR endpoint.
 *
 * Accepts a Blob (runtime-agnostic) or a Node Buffer (server-side).
 * Sends multipart/form-data with field 'file'.
 *
 * @returns the transcribed text.
 * @throws Error if ZAI_API_KEY is missing or the request fails.
 */
export async function transcribeViaZai(
  audio: Blob | Buffer,
  opts: ZaiTranscribeOptions = {},
): Promise<string> {
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ZAI_API_KEY is not configured. Set it to enable Z.ai GLM-ASR speech-to-text.',
    );
  }

  const model = opts.model || DEFAULT_MODEL;
  const filename = opts.filename || 'audio.webm';
  const timeoutMs = opts.timeoutMs ?? 60_000;

  // Normalize the audio payload to a Blob for FormData. Both Node (undici) and
  // browser runtimes expose a global FormData/Blob that accepts a Buffer.
  let fileBlob: Blob;
  if (typeof Blob !== 'undefined' && audio instanceof Blob) {
    fileBlob = audio;
  } else if (Buffer.isBuffer(audio)) {
    fileBlob = new Blob([audio as BlobPart], { type: 'audio/webm' });
  } else {
    throw new Error('transcribeViaZai: audio must be a Blob or Buffer');
  }

  const form = new FormData();
  form.append('file', fileBlob, filename);
  form.append('model', model);
  if (opts.language) {
    // 'de-DE' -> 'de' (ISO-639-1)
    form.append('language', opts.language.split('-')[0]);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(ZAI_STT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const data = (await res.json().catch(() => null)) as
    | { text?: string; error?: { message?: string } | string }
    | null;

  if (!res.ok || !data?.text) {
    const msg =
      (data?.error &&
        (typeof data.error === 'string' ? data.error : data.error.message)) ||
      `Z.ai ASR request failed (status ${res.status})`;
    throw new Error(msg);
  }

  return data.text;
}
