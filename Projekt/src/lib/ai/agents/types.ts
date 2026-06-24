// Z.Design - Agent types and interfaces for the Creative Orchestra
// Defines the type system for the multi-agent creative design system

export type AgentRole =
  | 'creative-director'
  | 'ux-architect'
  | 'visual-designer'
  | 'content-strategist'
  | 'innovation-agent'
  | 'critique-agent'
  | 'synthesis-agent';

export interface AgentSkillPack {
  role: AgentRole;
  name: string;
  description: string;
  systemPrompt: string;
  expertise: string[];
  scoringCriteria: ScoringCriterion[];
  referencePatterns: string[];
}

export interface ScoringCriterion {
  name: string;
  description: string;
  weight: number; // 0-1
}

export interface AgentProposal {
  agentRole: AgentRole;
  agentName: string;
  content: string;
  designSuggestion?: Record<string, unknown> | null; // Partial design JSON
  score?: number;
  reasoning: string;
  creativity: number; // 0-1, how unconventional
  confidence: number; // 0-1, how confident
}

export interface DesignBrief {
  summary: string;
  projectType: string;
  targetAudience: string;
  styleDirection: StyleDirection;
  keyRequirements: string[];
  constraints: string[];
  inspirationKeywords: string[];
}

export type StyleDirection =
  | 'minimal-clean'
  | 'bold-dramatic'
  | 'playful-vibrant'
  | 'corporate-professional'
  | 'organic-natural'
  | 'futuristic-tech'
  | 'retro-vintage'
  | 'brutalist-raw'
  | 'glassmorphism'
  | 'neomorphism'
  | 'mixed-creative';

export interface StyleDNA {
  direction: StyleDirection;
  colorMood: ColorMood;
  typographyStyle: TypographyStyle;
  layoutDensity: 'spacious' | 'balanced' | 'compact';
  cornerStyle: 'sharp' | 'rounded' | 'pill';
  shadowStyle: 'none' | 'subtle' | 'dramatic' | 'neon';
  animationIntensity: 'static' | 'subtle' | 'moderate' | 'dynamic';
  textureStyle: 'flat' | 'gradient' | 'textured' | 'glass';
}

export type ColorMood =
  | 'monochrome'
  | 'pastel'
  | 'vibrant'
  | 'earth-tones'
  | 'neon'
  | 'dark-luxury'
  | 'ocean-blues'
  | 'sunset-warm'
  | 'forest-greens'
  | 'custom';

export type TypographyStyle =
  | 'geometric-sans'
  | 'humanist-sans'
  | 'serif-classic'
  | 'serif-modern'
  | 'mono-technical'
  | 'display-bold'
  | 'handwritten'
  | 'mixed';

export interface CreativeLoopResult {
  brief: DesignBrief;
  styleDNA: StyleDNA;
  proposals: AgentProposal[];
  critique: AgentProposal;
  finalDesign: Record<string, unknown>;
  iterations: number;
  totalTokensUsed: number;
  providerUsed: string;
}

export interface CreativeLoopConfig {
  maxIterations: number;  // default: 2
  enableInnovation: boolean;  // default: true
  enableCritique: boolean;  // default: true
  creativityLevel: number;  // 0-1, default: 0.7
  preferredProvider?: string;
  styleDNA?: Partial<StyleDNA>;
}
