// Z.Design - Projects API Route
// GET: List all projects | POST: Create new project

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getDefaultDesignForType } from '@/lib/ai-prompts';

// GET /api/projects - List all projects
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [projects, total] = await Promise.all([
      db.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          designSystem: {
            select: { id: true, name: true },
          },
          _count: {
            select: { versions: true, comments: true, members: true },
          },
        },
      }),
      db.project.count({ where }),
    ]);

    return NextResponse.json({
      projects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Projects API] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create new project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, description, designSystemId } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const validTypes = [
      'PROTOTYPE', 'SLIDE_DECK', 'LANDING_PAGE', 'DASHBOARD',
      'WEB_APP', 'MOBILE_APP', 'MARKETING', 'CUSTOM',
    ];

    const projectType = type || 'PROTOTYPE';
    if (!validTypes.includes(projectType)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Generate default design JSON based on project type
    const defaultDesign = getDefaultDesignForType(projectType);

    const project = await db.project.create({
      data: {
        name,
        type: projectType,
        description: description || null,
        designJSON: JSON.stringify(defaultDesign),
        designSystemId: designSystemId || null,
        status: 'DRAFT',
      },
      include: {
        designSystem: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('[Projects API] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
