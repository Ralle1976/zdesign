// Z.Design - Single Project API Route
// GET: Get project by ID | PATCH: Update project | DELETE: Delete project

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Lightweight, deterministic content hash for designJSON de-duplication (T10).
// We compare structural content, not exact whitespace, by stripping spaces.
// Not cryptographic — only used to decide "did the design actually change?".
function simpleDesignHash(designJSON: string): string {
  const compact = designJSON.replace(/\s+/g, '');
  let h = 5381;
  for (let i = 0; i < compact.length; i++) {
    h = ((h << 5) + h + compact.charCodeAt(i)) | 0;
  }
  return `h${(h >>> 0).toString(16)}`;
}

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
    const { name, description, designJSON, designHTML, designMode, status, thumbnail, isPublic, designSystemId, createVersion } = body;

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

    // If designJSON was updated, conditionally create a version snapshot.
    //
    // T10 fix (2026-07-04): previously EVERY PATCH with designJSON created a new
    // Version row. Auto-save fires every 5s, so the Version table exploded.
    // New policy — create a Version only when ONE of these holds:
    //   1. The client explicitly opts in via `createVersion: true` (used by the
    //      explicit "Save snapshot / version" UI action, NOT by auto-save).
    //   2. The design actually changed AND enough time passed since the last
    //      auto-snapshot (coalescing safety net, in case a client forgets the
    //      flag). Default window: 10 minutes.
    // The default (auto-save, no flag) therefore never creates a Version.
    if (designJSON !== undefined && createVersion === true) {
      await db.version.create({
        data: {
          projectId: id,
          label: `Snapshot - ${new Date().toLocaleString()}`,
          designJSON: updateData.designJSON as string,
          changeSummary: 'Explicit version snapshot',
        },
      });
    } else if (designJSON !== undefined) {
      // Coalescing safety net: at most one auto-snapshot per project per 10 min,
      // and only if the design differs from the last snapshot. This keeps the
      // Version table bounded even for clients that don't send createVersion.
      const AUTO_SNAPSHOT_WINDOW_MS = 10 * 60 * 1000;
      const newHash = simpleDesignHash(updateData.designJSON as string);
      const lastSnapshot = await db.version.findFirst({
        where: { projectId: id, label: { startsWith: 'Auto-snapshot' } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, changeSummary: true },
      });
      const windowPassed =
        !lastSnapshot || Date.now() - lastSnapshot.createdAt.getTime() > AUTO_SNAPSHOT_WINDOW_MS;
      // changeSummary stores the hash for de-dup comparison (see below).
      const lastHash = lastSnapshot?.changeSummary ?? '';
      if (windowPassed && lastHash !== newHash) {
        await db.version.create({
          data: {
            projectId: id,
            label: `Auto-snapshot - ${new Date().toLocaleString()}`,
            designJSON: updateData.designJSON as string,
            changeSummary: newHash, // hash used for de-dup, not user-visible text
          },
        });
      }
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
