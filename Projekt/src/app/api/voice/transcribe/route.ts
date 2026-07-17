import { NextRequest, NextResponse } from 'next/server';

import { transcribeViaOpenRouter, isSttConfigured } from '@/lib/ai/stt-openrouter';
import { transcribeViaZai, isZaiSttConfigured } from '@/lib/ai/stt-zai';
import { readConfig } from '@/lib/ai/provider-config';

// Server-side Speech-to-Text fallback (used when the browser has no native
// SpeechRecognition, e.g. Firefox, or for consistent quality on deployment).
// Web Speech API remains the primary path (browser-native, free, no key).
//
// Uses sttProviderId from data/provider-config.json (Provider-UI → Tab Audio).
// Falls back to the other STT provider on error if configured.
//
// Accepts the audio payload from useVoiceInput in two shapes:
//   - JSON: { audioBase64, format?, language? }      (current hook default)
//   - multipart/form-data: field 'audio' (Blob)       (forward-compatible)

const OPENROUTER_STT_MODEL = process.env.OPENROUTER_STT_MODEL || 'openai/whisper-1';

export async function POST(request: NextRequest) {
  try {
    const zaiOk = isZaiSttConfigured();
    const openRouterOk = isSttConfigured();

    if (!zaiOk && !openRouterOk) {
      // Friendly 503 — the browser Web Speech API still works without this,
      // and the UI can surface "STT nicht konfiguriert".
      return NextResponse.json(
        {
          error:
            'Server-side transcription not configured (ZAI_API_KEY and OPENROUTER_API_KEY both missing). ' +
            'Use the browser voice input or set at least one of the keys.',
        },
        { status: 503 },
      );
    }

    let audioBuffer: Buffer;
    let format = 'webm';
    let language: string | undefined;

    const contentType = request.headers.get('content-type') || '';

    if (contentType.startsWith('multipart/form-data')) {
      // Multipart path: expect a file under the 'audio' field.
      const form = await request.formData();
      const file = form.get('audio');
      if (!(file instanceof Blob)) {
        return NextResponse.json(
          { error: "Audio file is required (multipart field 'audio')" },
          { status: 400 },
        );
      }
      audioBuffer = Buffer.from(await file.arrayBuffer());
      format = (form.get('format') as string) || 'webm';
      language = (form.get('language') as string) || undefined;
    } else {
      // JSON path: { audioBase64, format?, language? } — matches useVoiceInput.
      const body = await request.json();
      const { audioBase64, format: bodyFormat, language: bodyLang } = body as {
        audioBase64?: string;
        format?: string;
        language?: string;
      };

      if (!audioBase64 || typeof audioBase64 !== 'string') {
        return NextResponse.json(
          { error: 'Audio data (base64) is required' },
          { status: 400 },
        );
      }

      audioBuffer = Buffer.from(audioBase64, 'base64');
      format = bodyFormat || 'webm';
      language = bodyLang;
    }

    const config = await readConfig();
    const openRouterModel =
      config.overrides?.openrouter?.model || OPENROUTER_STT_MODEL;
    const primary = config.sttProviderId;
    const fallback = primary === 'zai' ? 'openrouter' : 'zai';

    const tryProvider = async (id: string): Promise<string | undefined> => {
      if (id === 'zai' && zaiOk) {
        return transcribeViaZai(audioBuffer, { language });
      }
      if (id === 'openrouter' && openRouterOk) {
        return transcribeViaOpenRouter(audioBuffer, {
          language,
          model: openRouterModel,
        });
      }
      return undefined;
    };

    let transcript: string | undefined;
    let lastError: unknown = null;

    try {
      transcript = await tryProvider(primary);
    } catch (e) {
      lastError = e;
      console.error(`[Voice Transcription API] ${primary} STT failed, falling back:`, e);
    }

    if (!transcript) {
      try {
        transcript = await tryProvider(fallback);
      } catch (e) {
        lastError = e;
        console.error(`[Voice Transcription API] ${fallback} STT failed:`, e);
      }
    }

    if (!transcript) {
      const message =
        lastError instanceof Error
          ? lastError.message
          : 'Transcription failed (all providers errored)';
      const status = /_API_KEY/i.test(message) ? 503 : 502;
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ transcript, format });
  } catch (error: unknown) {
    console.error('[Voice Transcription API] Error:', error);
    const message = error instanceof Error ? error.message : 'Transcription failed';
    const status = /(_API_KEY|not configured)/i.test(message) ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
