// Z.Design - Templates API Route
// GET: List templates with optional category filter | POST: Create template

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/templates - List templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const isPublic = searchParams.get('isPublic');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    // By default, only show public templates unless explicitly filtered
    if (isPublic !== null && isPublic !== undefined) {
      where.isPublic = isPublic === 'true';
    } else {
      where.isPublic = true;
    }

    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    // Validate sort field
    const validSortFields = ['createdAt', 'updatedAt', 'downloads', 'rating', 'name'];
    const validSortOrders = ['asc', 'desc'];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderByDirection = validSortOrders.includes(sortOrder) ? sortOrder : 'desc';

    const [templates, total] = await Promise.all([
      db.template.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderByField]: orderByDirection },
      }),
      db.template.count({ where }),
    ]);

    // Parse JSON string fields
    const parsedTemplates = templates.map((t) => ({
      ...t,
      tags: JSON.parse(t.tags),
    }));

    // Get unique categories for filtering
    const categories = await db.template.findMany({
      where: { isPublic: true },
      select: { category: true },
      distinct: ['category'],
    });

    return NextResponse.json({
      templates: parsedTemplates,
      categories: categories.map((c) => c.category),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Templates API] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// POST /api/templates - Create template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      category,
      designJSON,
      thumbnail,
      authorId,
      tags,
      isPublic,
    } = body;

    if (!name || !description || !category || !designJSON) {
      return NextResponse.json(
        { error: 'name, description, category, and designJSON are required' },
        { status: 400 }
      );
    }

    const template = await db.template.create({
      data: {
        name,
        description,
        category,
        designJSON: typeof designJSON === 'string' ? designJSON : JSON.stringify(designJSON),
        thumbnail: thumbnail || null,
        authorId: authorId || null,
        tags: JSON.stringify(tags || []),
        isPublic: isPublic !== undefined ? isPublic : true,
      },
    });

    // Parse JSON for response
    const parsed = {
      ...template,
      tags: JSON.parse(template.tags),
    };

    return NextResponse.json({ template: parsed }, { status: 201 });
  } catch (error) {
    console.error('[Templates API] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
