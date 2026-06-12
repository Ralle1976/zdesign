// Z.Design - Design Systems API Route
// GET: List all design systems | POST: Create design system

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Default design system tokens
const DEFAULT_TOKENS = {
  colors: [
    { name: 'primary', value: '#6366f1', category: 'primary', description: 'Main brand color' },
    { name: 'primary-dark', value: '#4f46e5', category: 'primary', description: 'Dark variant' },
    { name: 'primary-light', value: '#818cf8', category: 'primary', description: 'Light variant' },
    { name: 'secondary', value: '#8b5cf6', category: 'secondary', description: 'Secondary brand color' },
    { name: 'accent', value: '#06b6d4', category: 'accent', description: 'Accent color' },
    { name: 'success', value: '#10b981', category: 'semantic', description: 'Success state' },
    { name: 'warning', value: '#f59e0b', category: 'semantic', description: 'Warning state' },
    { name: 'error', value: '#ef4444', category: 'semantic', description: 'Error state' },
    { name: 'text-primary', value: '#0f172a', category: 'neutral', description: 'Primary text' },
    { name: 'text-secondary', value: '#475569', category: 'neutral', description: 'Secondary text' },
    { name: 'text-muted', value: '#94a3b8', category: 'neutral', description: 'Muted text' },
    { name: 'background', value: '#ffffff', category: 'neutral', description: 'Page background' },
    { name: 'surface', value: '#f8fafc', category: 'neutral', description: 'Surface background' },
    { name: 'border', value: '#e2e8f0', category: 'neutral', description: 'Border color' },
  ],
  typography: [
    { name: 'heading-xl', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '48px', fontWeight: '800', lineHeight: '1.1' },
    { name: 'heading-lg', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '36px', fontWeight: '700', lineHeight: '1.2' },
    { name: 'heading-md', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '24px', fontWeight: '700', lineHeight: '1.3' },
    { name: 'heading-sm', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '20px', fontWeight: '600', lineHeight: '1.4' },
    { name: 'body-lg', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '18px', fontWeight: '400', lineHeight: '1.6' },
    { name: 'body-md', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '16px', fontWeight: '400', lineHeight: '1.6' },
    { name: 'body-sm', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '14px', fontWeight: '400', lineHeight: '1.5' },
    { name: 'caption', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12px', fontWeight: '400', lineHeight: '1.4' },
  ],
  spacing: [
    { name: 'xs', value: '4px' },
    { name: 'sm', value: '8px' },
    { name: 'md', value: '16px' },
    { name: 'lg', value: '24px' },
    { name: 'xl', value: '32px' },
    { name: '2xl', value: '48px' },
    { name: '3xl', value: '64px' },
  ],
  borderRadius: [
    { name: 'none', value: '0px' },
    { name: 'sm', value: '4px' },
    { name: 'md', value: '8px' },
    { name: 'lg', value: '16px' },
    { name: 'xl', value: '24px' },
    { name: 'full', value: '9999px' },
  ],
  shadows: [
    { name: 'sm', value: '0 1px 2px rgba(0,0,0,0.05)' },
    { name: 'md', value: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)' },
    { name: 'lg', value: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)' },
    { name: 'xl', value: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)' },
  ],
};

const DEFAULT_STYLES = {
  presetStyles: [
    { name: 'Card', style: { backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }, description: 'Default card style' },
    { name: 'Button Primary', style: { backgroundColor: '#6366f1', color: '#ffffff', padding: '10px 24px', borderRadius: '8px', fontWeight: '600', border: 'none', cursor: 'pointer' }, description: 'Primary action button' },
    { name: 'Button Secondary', style: { backgroundColor: 'transparent', color: '#6366f1', padding: '10px 24px', borderRadius: '8px', fontWeight: '600', border: '2px solid #6366f1', cursor: 'pointer' }, description: 'Secondary action button' },
    { name: 'Input', style: { padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '16px', width: '100%', backgroundColor: '#ffffff' }, description: 'Text input field' },
  ],
  animationPresets: [
    { name: 'Fade In', keyframes: 'fadeIn', duration: '0.3s', easing: 'ease-out' },
    { name: 'Slide Up', keyframes: 'slideUp', duration: '0.4s', easing: 'ease-out' },
    { name: 'Scale In', keyframes: 'scaleIn', duration: '0.2s', easing: 'ease-out' },
  ],
};

// GET /api/design-systems - List all design systems
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isDefault = searchParams.get('isDefault');

    const where: Record<string, unknown> = {};
    if (isDefault !== null && isDefault !== undefined) {
      where.isDefault = isDefault === 'true';
    }

    const designSystems = await db.designSystem.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { projects: true },
        },
      },
    });

    // Parse JSON string fields for client consumption
    const parsedSystems = designSystems.map((ds) => ({
      ...ds,
      tokens: JSON.parse(ds.tokens),
      components: JSON.parse(ds.components),
      styles: JSON.parse(ds.styles),
    }));

    return NextResponse.json({ designSystems: parsedSystems });
  } catch (error) {
    console.error('[Design Systems API] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch design systems' },
      { status: 500 }
    );
  }
}

// POST /api/design-systems - Create design system
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, tokens, components, styles, isDefault } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const designSystem = await db.designSystem.create({
      data: {
        name,
        description: description || null,
        tokens: JSON.stringify(tokens || DEFAULT_TOKENS),
        components: JSON.stringify(components || {}),
        styles: JSON.stringify(styles || DEFAULT_STYLES),
        isDefault: isDefault || false,
      },
    });

    // Parse JSON for response
    const parsed = {
      ...designSystem,
      tokens: JSON.parse(designSystem.tokens),
      components: JSON.parse(designSystem.components),
      styles: JSON.parse(designSystem.styles),
    };

    return NextResponse.json({ designSystem: parsed }, { status: 201 });
  } catch (error) {
    console.error('[Design Systems API] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to create design system' },
      { status: 500 }
    );
  }
}
