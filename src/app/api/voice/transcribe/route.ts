import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audioBase64, format } = body as {
      audioBase64: string;
      format?: string;
    };

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return NextResponse.json(
        { error: 'Audio data (base64) is required' },
        { status: 400 }
      );
    }

    // Use z-ai-web-dev-sdk for ASR
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const result = await zai.asr.transcribe({
      audio: audioBase64,
      format: format || 'webm',
    });

    const transcript =
      result.text || result.transcript || '';

    return NextResponse.json({
      transcript,
      format: format || 'webm',
    });
  } catch (error: unknown) {
    console.error('[Voice Transcription API] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Transcription failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
