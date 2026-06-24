// Z.Design - Single Project API Route
// GET: Get project by ID | PATCH: Update project | DELETE: Delete project

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/projects/[id] - Get project by ID
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = await db.project.findUnique({
      where: { id },
      include: {
        designSystem: true,
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            user: {
              select: { id: true, name: true, avatar: true },
            },
          },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true, email: true },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('[Project API] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id] - Update project
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, designJSON, designHTML, designMode, status, thumbnail, isPublic, designSystemId } = body;

    // Verify project exists
    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (designJSON !== undefined) {
      // If designJSON is an object, stringify it; if already a string, use as-is
      updateData.designJSON = typeof designJSON === 'string'
        ? designJSON
        : JSON.stringify(designJSON);
    }
    if (designHTML !== undefined) updateData.designHTML = designHTML;
    if (designMode !== undefined) {
      const validModes = ['NODE_TREE', 'HTML_ARTIFACT'];
      if (!validModes.includes(designMode)) {
        return NextResponse.json(
          { error: `Invalid designMode. Must be one of: ${validModes.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.designMode = designMode;
    }
    if (status !== undefined) {
      const validStatuses = ['DRAFT', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'ARCHIVED'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.status = status;
    }
    if (thumbnail !== undefined) updateData.thumbnail = thumbnail;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (designSystemId !== undefined) updateData.designSystemId = designSystemId;

    const project = await db.project.update({
      where: { id },
      data: updateData,
      include: {
        designSystem: {
          select: { id: true, name: true },
        },
      },
    });

    // If designJSON was updated, also create a version snapshot
    if (designJSON !== undefined) {
      await db.version.create({
        data: {
          projectId: id,
          label: `Auto-save - ${new Date().toLocaleString()}`,
          designJSON: updateData.designJSON as string,
          changeSummary: 'Design updated via API',
        },
      });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('[Project API] PATCH Error:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Delete project
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify project exists
    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Delete project (cascading deletes will handle versions, comments, members)
    await db.project.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('[Project API] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
