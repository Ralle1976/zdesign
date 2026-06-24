// Z.Design - Single Version API Route
// GET: Get a specific version | PATCH: Update version label/summary

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/projects/[id]/versions/[versionId] - Get a specific version
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id, versionId } = await params;

    const version = await db.version.findFirst({
      where: { id: versionId, projectId: id },
    });

    if (!version) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ version });
  } catch (error) {
    console.error('[Version API] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch version' },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id]/versions/[versionId] - Update version label/summary
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id, versionId } = await params;
    const body = await request.json();
    const { label, changeSummary } = body;

    // Verify version exists
    const existing = await db.version.findFirst({
      where: { id: versionId, projectId: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (label !== undefined) updateData.label = label;
    if (changeSummary !== undefined) updateData.changeSummary = changeSummary;

    const version = await db.version.update({
      where: { id: versionId },
      data: updateData,
    });

    return NextResponse.json({ version });
  } catch (error) {
    console.error('[Version API] PATCH Error:', error);
    return NextResponse.json(
      { error: 'Failed to update version' },
      { status: 500 }
    );
  }
}
