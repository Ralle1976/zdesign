// Z.Design - Project Versions API Route
// GET: List versions for a project | POST: Create a new version

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/projects/[id]/versions - List versions for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Verify project exists
    const project = await db.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const where: Record<string, unknown> = { projectId: id };
    if (branch) {
      where.branch = branch;
    }

    const [versions, total] = await Promise.all([
      db.version.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.version.count({ where }),
    ]);

    return NextResponse.json({
      versions,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Versions API] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch versions' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/versions - Create a new version
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { label, changeSummary, branch, parentVersionId } = body;

    if (!label || typeof label !== 'string' || label.trim() === '') {
      return NextResponse.json(
        { error: 'Label is required' },
        { status: 400 }
      );
    }

    // Verify project exists and get current designJSON
    const project = await db.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const version = await db.version.create({
      data: {
        projectId: id,
        label: label.trim(),
        designJSON: project.designJSON,
        changeSummary: changeSummary || undefined,
        branch: branch || 'main',
        parentVersionId: parentVersionId || undefined,
        thumbnail: project.thumbnail || undefined,
      },
    });

    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    console.error('[Versions API] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to create version' },
      { status: 500 }
    );
  }
}
