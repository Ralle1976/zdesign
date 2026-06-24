import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, projectId } = body as {
      query: string;
      projectId: string;
    };

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Enhance the query to focus on design inspiration
    const designQuery = `design inspiration ${query.trim()}`;

    // Use z-ai-web-dev-sdk for web search
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const results = await zai.functions.invoke('web_search', {
      query: designQuery,
      num: 8,
    });

    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json({
        success: true,
        query: query.trim(),
        results: [],
        message: 'No results found for your search. Try different keywords.',
      });
    }

    // Parse and structure the results as inspiration data
    const inspiration = results.map(
      (item: {
        url: string;
        name: string;
        snippet: string;
        host_name: string;
        rank: number;
        date?: string;
        favicon?: string;
      }) => ({
        title: item.name,
        url: item.url,
        description: item.snippet,
        domain: item.host_name,
        rank: item.rank,
        date: item.date || null,
        favicon: item.favicon || null,
      })
    );

    return NextResponse.json({
      success: true,
      query: query.trim(),
      totalResults: inspiration.length,
      results: inspiration,
    });
  } catch (error: unknown) {
    console.error('[Design Research API] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Design research failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
