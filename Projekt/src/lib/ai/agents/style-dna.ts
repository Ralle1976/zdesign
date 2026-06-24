// Z.Design - Style DNA Generator
// Generates unique Style DNA to ensure every design looks different
// Style DNA encodes the visual personality of a design as a structured configuration

import type { StyleDNA, StyleDirection, ColorMood, TypographyStyle } from './types';

// ============ Style Presets by Direction ============

const STYLE_PRESETS: Record<StyleDirection, Partial<StyleDNA>> = {
  'minimal-clean': {
    colorMood: 'monochrome',
    typographyStyle: 'geometric-sans',
    layoutDensity: 'spacious',
    cornerStyle: 'rounded',
    shadowStyle: 'subtle',
    animationIntensity: 'subtle',
    textureStyle: 'flat',
  },
  'bold-dramatic': {
    colorMood: 'vibrant',
    typographyStyle: 'display-bold',
    layoutDensity: 'balanced',
    cornerStyle: 'sharp',
    shadowStyle: 'dramatic',
    animationIntensity: 'dynamic',
    textureStyle: 'gradient',
  },
  'playful-vibrant': {
    colorMood: 'vibrant',
    typographyStyle: 'humanist-sans',
    layoutDensity: 'balanced',
    cornerStyle: 'pill',
    shadowStyle: 'subtle',
    animationIntensity: 'moderate',
    textureStyle: 'flat',
  },
  'corporate-professional': {
    colorMood: 'ocean-blues',
    typographyStyle: 'humanist-sans',
    layoutDensity: 'balanced',
    cornerStyle: 'rounded',
    shadowStyle: 'subtle',
    animationIntensity: 'subtle',
    textureStyle: 'flat',
  },
  'organic-natural': {
    colorMood: 'earth-tones',
    typographyStyle: 'serif-modern',
    layoutDensity: 'spacious',
    cornerStyle: 'rounded',
    shadowStyle: 'subtle',
    animationIntensity: 'subtle',
    textureStyle: 'textured',
  },
  'futuristic-tech': {
    colorMood: 'neon',
    typographyStyle: 'mono-technical',
    layoutDensity: 'compact',
    cornerStyle: 'sharp',
    shadowStyle: 'neon',
    animationIntensity: 'dynamic',
    textureStyle: 'glass',
  },
  'retro-vintage': {
    colorMood: 'sunset-warm',
    typographyStyle: 'serif-classic',
    layoutDensity: 'balanced',
    cornerStyle: 'rounded',
    shadowStyle: 'none',
    animationIntensity: 'static',
    textureStyle: 'textured',
  },
  'brutalist-raw': {
    colorMood: 'monochrome',
    typographyStyle: 'mono-technical',
    layoutDensity: 'compact',
    cornerStyle: 'sharp',
    shadowStyle: 'none',
    animationIntensity: 'static',
    textureStyle: 'flat',
  },
  'glassmorphism': {
    colorMood: 'pastel',
    typographyStyle: 'geometric-sans',
    layoutDensity: 'spacious',
    cornerStyle: 'rounded',
    shadowStyle: 'subtle',
    animationIntensity: 'moderate',
    textureStyle: 'glass',
  },
  'neomorphism': {
    colorMood: 'pastel',
    typographyStyle: 'geometric-sans',
    layoutDensity: 'balanced',
    cornerStyle: 'rounded',
    shadowStyle: 'subtle',
    animationIntensity: 'subtle',
    textureStyle: 'flat',
  },
  'mixed-creative': {
    colorMood: 'vibrant',
    typographyStyle: 'mixed',
    layoutDensity: 'balanced',
    cornerStyle: 'rounded',
    shadowStyle: 'dramatic',
    animationIntensity: 'moderate',
    textureStyle: 'gradient',
  },
};

// ============ Color Palettes ============

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
}

const COLOR_PALETTES: Record<ColorMood, ColorPalette> = {
  'monochrome': { primary: '#18181b', secondary: '#52525b', accent: '#f4f4f5', bg: '#ffffff', surface: '#fafafa', text: '#09090b', textSecondary: '#71717a', border: '#e4e4e7' },
  'pastel': { primary: '#c084fc', secondary: '#67e8f9', accent: '#fde68a', bg: '#fefce8', surface: '#faf5ff', text: '#1e1b4b', textSecondary: '#6b7280', border: '#e9d5ff' },
  'vibrant': { primary: '#f43f5e', secondary: '#8b5cf6', accent: '#06b6d4', bg: '#ffffff', surface: '#fff1f2', text: '#0f172a', textSecondary: '#64748b', border: '#fecdd3' },
  'earth-tones': { primary: '#92400e', secondary: '#065f46', accent: '#d97706', bg: '#fffbeb', surface: '#fef3c7', text: '#1c1917', textSecondary: '#78716c', border: '#fde68a' },
  'neon': { primary: '#22d3ee', secondary: '#a78bfa', accent: '#34d399', bg: '#030712', surface: '#111827', text: '#f9fafb', textSecondary: '#9ca3af', border: '#1f2937' },
  'dark-luxury': { primary: '#d4af37', secondary: '#c0c0c0', accent: '#1a1a2e', bg: '#0a0a0a', surface: '#161622', text: '#f5f5f5', textSecondary: '#a0a0b0', border: '#2a2a3a' },
  'ocean-blues': { primary: '#0369a1', secondary: '#0e7490', accent: '#06b6d4', bg: '#ffffff', surface: '#f0f9ff', text: '#0c4a6e', textSecondary: '#64748b', border: '#bae6fd' },
  'sunset-warm': { primary: '#ea580c', secondary: '#dc2626', accent: '#fbbf24', bg: '#fffbeb', surface: '#fef3c7', text: '#431407', textSecondary: '#9a3412', border: '#fed7aa' },
  'forest-greens': { primary: '#059669', secondary: '#0d9488', accent: '#84cc16', bg: '#ffffff', surface: '#f0fdf4', text: '#14532d', textSecondary: '#166534', border: '#bbf7d0' },
  'custom': { primary: '#10b981', secondary: '#8b5cf6', accent: '#06b6d4', bg: '#ffffff', surface: '#f8fafc', text: '#0f172a', textSecondary: '#475569', border: '#e2e8f0' },
};

// ============ Typography Presets ============

export interface TypographyPreset {
  fontFamily: string;
  headingWeight: string;
  bodyWeight: string;
}

const TYPOGRAPHY_PRESETS: Record<TypographyStyle, TypographyPreset> = {
  'geometric-sans': { fontFamily: 'Inter, system-ui, sans-serif', headingWeight: '700', bodyWeight: '400' },
  'humanist-sans': { fontFamily: 'Nunito, Segoe UI, sans-serif', headingWeight: '700', bodyWeight: '400' },
  'serif-classic': { fontFamily: 'Georgia, Cambria, serif', headingWeight: '700', bodyWeight: '400' },
  'serif-modern': { fontFamily: 'Playfair Display, Georgia, serif', headingWeight: '600', bodyWeight: '400' },
  'mono-technical': { fontFamily: 'JetBrains Mono, Fira Code, monospace', headingWeight: '600', bodyWeight: '400' },
  'display-bold': { fontFamily: 'Inter, system-ui, sans-serif', headingWeight: '900', bodyWeight: '400' },
  'handwritten': { fontFamily: 'Caveat, Comic Sans MS, cursive', headingWeight: '700', bodyWeight: '400' },
  'mixed': { fontFamily: 'Inter, system-ui, sans-serif', headingWeight: '800', bodyWeight: '400' },
};

// ============ Public API ============

export function generateStyleDNA(direction: StyleDirection, overrides?: Partial<StyleDNA>): StyleDNA {
  const preset = STYLE_PRESETS[direction] || STYLE_PRESETS['mixed-creative'];
  return {
    direction,
    colorMood: overrides?.colorMood || preset.colorMood || 'custom',
    typographyStyle: overrides?.typographyStyle || preset.typographyStyle || 'geometric-sans',
    layoutDensity: overrides?.layoutDensity || preset.layoutDensity || 'balanced',
    cornerStyle: overrides?.cornerStyle || preset.cornerStyle || 'rounded',
    shadowStyle: overrides?.shadowStyle || preset.shadowStyle || 'subtle',
    animationIntensity: overrides?.animationIntensity || preset.animationIntensity || 'subtle',
    textureStyle: overrides?.textureStyle || preset.textureStyle || 'flat',
  };
}

export function getColorPalette(mood: ColorMood): ColorPalette {
  return COLOR_PALETTES[mood] || COLOR_PALETTES['custom'];
}

export function getTypographyPreset(style: TypographyStyle): TypographyPreset {
  return TYPOGRAPHY_PRESETS[style] || TYPOGRAPHY_PRESETS['geometric-sans'];
}

// Convert StyleDNA to a prompt snippet that the agents can use
export function styleDNAToPrompt(dna: StyleDNA): string {
  const colors = getColorPalette(dna.colorMood);
  const typo = getTypographyPreset(dna.typographyStyle);

  const radiusMap: Record<string, string> = { sharp: '0px', rounded: '8px', pill: '24px' };
  const shadowMap: Record<string, string> = {
    none: 'none',
    subtle: '0 1px 3px rgba(0,0,0,0.1)',
    dramatic: '0 8px 30px rgba(0,0,0,0.15)',
    neon: '0 0 20px rgba(var(--glow),0.5)',
  };
  const densityMap: Record<string, { padding: string; gap: string; sectionGap: string }> = {
    spacious: { padding: '32px', gap: '24px', sectionGap: '80px' },
    balanced: { padding: '24px', gap: '16px', sectionGap: '64px' },
    compact: { padding: '16px', gap: '12px', sectionGap: '48px' },
  };

  const density = densityMap[dna.layoutDensity];
  const radius = radiusMap[dna.cornerStyle];
  const shadow = shadowMap[dna.shadowStyle];

  return `## STYLE DNA (MUST follow this visual direction)
- Direction: ${dna.direction}
- Color Mood: ${dna.colorMood}
- Colors: Primary=${colors.primary}, Secondary=${colors.secondary}, Accent=${colors.accent}, BG=${colors.bg}, Surface=${colors.surface}, Text=${colors.text}, TextSecondary=${colors.textSecondary}, Border=${colors.border}
- Typography: Font="${typo.fontFamily}", Heading Weight=${typo.headingWeight}, Body Weight=${typo.bodyWeight}
- Layout Density: ${dna.layoutDensity} (padding=${density.padding}, gap=${density.gap}, sectionGap=${density.sectionGap})
- Border Radius: ${radius}
- Shadow Style: ${shadow}
- Texture: ${dna.textureStyle}`;
}
