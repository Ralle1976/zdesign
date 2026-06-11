// Z.Design - Image Analysis API Route
// Uses VLM (Vision Language Model) to analyze design images and extract tokens

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { IMAGE_ANALYSIS_SYSTEM_PROMPT } from '@/lib/ai-prompts';

interface AnalyzeRequestBody {
  imageBase64?: string;
  imageUrl?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequestBody = await request.json();
    const { imageBase64, imageUrl } = body;

    if (!imageBase64 && !imageUrl) {
      return NextResponse.json(
        { error: 'Either imageBase64 or imageUrl is required' },
        { status: 400 }
      );
    }

    // Prepare the image URL for VLM
    let vlmImageUrl: string;
    if (imageBase64) {
      // Ensure proper base64 data URI format
      if (imageBase64.startsWith('data:')) {
        vlmImageUrl = imageBase64;
      } else {
        vlmImageUrl = `data:image/png;base64,${imageBase64}`;
      }
    } else {
      vlmImageUrl = imageUrl!;
    }

    // Call Z.ai VLM to analyze the image
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.createVision({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: IMAGE_ANALYSIS_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this design image and extract all design tokens (colors, typography, spacing, border radius, shadows), layout patterns, UI components, and provide improvement suggestions. Return the analysis as structured JSON.',
            },
            {
              type: 'image_url',
              image_url: { url: vlmImageUrl },
            },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    });

    const rawResponse = completion.choices[0]?.message?.content || '';

    // Parse the VLM response
    let analysis = null;
    try {
      analysis = JSON.parse(rawResponse);
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = rawResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        try {
          analysis = JSON.parse(jsonMatch[1]);
        } catch {
          // Return raw response as fallback
        }
      }
    }

    if (!analysis) {
      // Return a structured response with raw text
      return NextResponse.json({
        tokens: {
          colors: [],
          typography: [],
          spacing: [],
          borderRadius: [],
          shadows: [],
        },
        layoutPattern: '',
        components: [],
        style: '',
        suggestions: [],
        rawAnalysis: rawResponse,
      });
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('[Design Analyze API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze image', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
