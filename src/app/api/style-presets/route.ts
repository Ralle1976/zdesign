import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateStyleDNA, styleDNAToPrompt } from '@/lib/ai/agents';

// GET - List all style presets
export async function GET() {
  try {
    const presets = await db.stylePreset.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Add built-in presets
    const builtIn = [
      { id: 'builtin-minimal', name: 'Minimal Clean', direction: 'minimal-clean', colorMood: 'monochrome', typography: 'geometric-sans', density: 'spacious', corners: 'rounded', shadows: 'subtle', texture: 'flat' },
      { id: 'builtin-bold', name: 'Bold Dramatic', direction: 'bold-dramatic', colorMood: 'vibrant', typography: 'display-bold', density: 'balanced', corners: 'sharp', shadows: 'dramatic', texture: 'gradient' },
      { id: 'builtin-playful', name: 'Playful Vibrant', direction: 'playful-vibrant', colorMood: 'vibrant', typography: 'humanist-sans', density: 'balanced', corners: 'pill', shadows: 'subtle', texture: 'flat' },
      { id: 'builtin-corporate', name: 'Corporate Pro', direction: 'corporate-professional', colorMood: 'ocean-blues', typography: 'humanist-sans', density: 'balanced', corners: 'rounded', shadows: 'subtle', texture: 'flat' },
      { id: 'builtin-organic', name: 'Organic Natural', direction: 'organic-natural', colorMood: 'earth-tones', typography: 'serif-modern', density: 'spacious', corners: 'rounded', shadows: 'subtle', texture: 'textured' },
      { id: 'builtin-futuristic', name: 'Futuristic Tech', direction: 'futuristic-tech', colorMood: 'neon', typography: 'mono-technical', density: 'compact', corners: 'sharp', shadows: 'neon', texture: 'glass' },
      { id: 'builtin-retro', name: 'Retro Vintage', direction: 'retro-vintage', colorMood: 'sunset-warm', typography: 'serif-classic', density: 'balanced', corners: 'rounded', shadows: 'none', texture: 'textured' },
      { id: 'builtin-brutalist', name: 'Brutalist Raw', direction: 'brutalist-raw', colorMood: 'monochrome', typography: 'mono-technical', density: 'compact', corners: 'sharp', shadows: 'none', texture: 'flat' },
      { id: 'builtin-glass', name: 'Glassmorphism', direction: 'glassmorphism', colorMood: 'pastel', typography: 'geometric-sans', density: 'spacious', corners: 'rounded', shadows: 'subtle', texture: 'glass' },
      { id: 'builtin-neo', name: 'Neomorphism', direction: 'neomorphism', colorMood: 'pastel', typography: 'geometric-sans', density: 'balanced', corners: 'rounded', shadows: 'subtle', texture: 'flat' },
    ];

    return NextResponse.json({ presets: [...builtIn, ...presets.map(p => ({ id: p.id, name: p.name, direction: p.direction, colorMood: p.colorMood, typography: p.typography, density: p.density, corners: p.corners, shadows: p.shadows, texture: p.texture }))] });
  } catch (error) {
    console.error('[Style Presets API] GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch style presets' }, { status: 500 });
  }
}

// POST - Generate style DNA from a preset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { direction, overrides } = body;

    const dna = generateStyleDNA(direction, overrides);
    const prompt = styleDNAToPrompt(dna);

    return NextResponse.json({ styleDNA: dna, prompt });
  } catch (error) {
    console.error('[Style Presets API] POST Error:', error);
    return NextResponse.json({ error: 'Failed to generate style DNA' }, { status: 500 });
  }
}
