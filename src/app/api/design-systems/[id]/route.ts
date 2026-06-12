// Z.Design - Single Design System API Route
// GET: Get design system by ID | PATCH: Update design system | DELETE: Delete design system

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/design-systems/[id] - Get design system by ID
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const designSystem = await db.designSystem.findUnique({
      where: { id },
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            thumbnail: true,
          },
        },
      },
    });

    if (!designSystem) {
      return NextResponse.json(
        { error: 'Design system not found' },
        { status: 404 }
      );
    }

    // Parse JSON string fields for client consumption
    const parsed = {
      ...designSystem,
      tokens: JSON.parse(designSystem.tokens),
      components: JSON.parse(designSystem.components),
      styles: JSON.parse(designSystem.styles),
    };

    return NextResponse.json({ designSystem: parsed });
  } catch (error) {
    console.error('[Design System API] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch design system' },
      { status: 500 }
    );
  }
}

// PATCH /api/design-systems/[id] - Update design system
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, tokens, components, styles, isDefault } = body;

    // Verify design system exists
    const existing = await db.designSystem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Design system not found' },
        { status: 404 }
      );
    }

    // Build update data - stringify JSON fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (tokens !== undefined) {
      updateData.tokens = typeof tokens === 'string' ? tokens : JSON.stringify(tokens);
    }
    if (components !== undefined) {
      updateData.components = typeof components === 'string' ? components : JSON.stringify(components);
    }
    if (styles !== undefined) {
      updateData.styles = typeof styles === 'string' ? styles : JSON.stringify(styles);
    }
    if (isDefault !== undefined) updateData.isDefault = isDefault;

    const designSystem = await db.designSystem.update({
      where: { id },
      data: updateData,
    });

    // Parse JSON for response
    const parsed = {
      ...designSystem,
      tokens: JSON.parse(designSystem.tokens),
      components: JSON.parse(designSystem.components),
      styles: JSON.parse(designSystem.styles),
    };

    return NextResponse.json({ designSystem: parsed });
  } catch (error) {
    console.error('[Design System API] PATCH Error:', error);
    return NextResponse.json(
      { error: 'Failed to update design system' },
      { status: 500 }
    );
  }
}

// DELETE /api/design-systems/[id] - Delete design system
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify design system exists
    const existing = await db.designSystem.findUnique({
      where: { id },
      include: { _count: { select: { projects: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Design system not found' },
        { status: 404 }
      );
    }

    // Check if any projects are using this design system
    if (existing._count.projects > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete design system. It is currently used by ${existing._count.projects} project(s). Please reassign those projects first.`,
          projectCount: existing._count.projects,
        },
        { status: 409 }
      );
    }

    await db.designSystem.delete({ where: { id } });

    return NextResponse.json({ message: 'Design system deleted successfully' });
  } catch (error) {
    console.error('[Design System API] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete design system' },
      { status: 500 }
    );
  }
}
