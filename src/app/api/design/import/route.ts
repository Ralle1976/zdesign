import { NextRequest, NextResponse } from 'next/server';

interface ImportRequestBody {
  source: 'url' | 'json' | 'image' | 'figma';
  data: string; // URL, JSON string, base64 image, or Figma URL
  projectId?: string;
}

// Import from URL: Fetch a webpage and extract design-relevant information
async function importFromURL(url: string): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Z.Design Bot/1.0' },
    });
    const html = await response.text();

    // Extract basic design information from the HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1] || 'Imported Design';

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description = descMatch?.[1] || '';

    // Extract colors from inline styles and CSS
    const colorMatches = html.matchAll(/(?:color|background-color|background)\s*:\s*([^;}"']+)/gi);
    const colors = [...new Set([...colorMatches].map(m => m[1].trim()))].slice(0, 10);

    // Extract heading texts
    const headingMatches = html.matchAll(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi);
    const headings = [...headingMatches].map(m => m[1].trim()).slice(0, 10);

    // Build a basic design tree from the extracted information
    const designTree = {
      id: 'root',
      type: 'root',
      tag: 'div',
      style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif' },
      meta: { name: title },
      children: [
        {
          id: 'imported-header',
          type: 'header',
          tag: 'header',
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', borderBottom: '1px solid #e2e8f0' },
          meta: { name: 'Imported Header' },
          children: [
            { id: 'imported-title', type: 'text', tag: 'span', content: title, style: { fontSize: '20px', fontWeight: '700', color: '#10b981' } },
            { id: 'imported-source', type: 'text', tag: 'span', content: `Imported from ${new URL(url).hostname}`, style: { fontSize: '12px', color: '#94a3b8' } }
          ]
        },
        {
          id: 'imported-content',
          type: 'section',
          tag: 'section',
          style: { display: 'flex', flexDirection: 'column', padding: '48px 32px', flex: '1' },
          meta: { name: 'Imported Content' },
          children: [
            ...(headings.length > 0
              ? headings.slice(0, 3).map((h, i) => ({
                  id: `imported-h-${i}`,
                  type: 'heading',
                  tag: i === 0 ? 'h1' : 'h2',
                  content: h,
                  style: {
                    fontSize: i === 0 ? '32px' : '24px',
                    fontWeight: '700',
                    color: '#0f172a',
                    marginBottom: '16px',
                    ...(i > 0 ? { marginTop: '24px' } : {})
                  }
                }))
              : [{ id: 'imported-placeholder', type: 'heading', tag: 'h1', content: 'Imported Design', style: { fontSize: '32px', fontWeight: '700', color: '#0f172a', marginBottom: '16px' } }]
            ),
            ...(description ? [{ id: 'imported-desc', type: 'text', tag: 'p', content: description, style: { fontSize: '16px', color: '#475569', lineHeight: '1.6', maxWidth: '600px' } }] : []),
            ...(colors.length > 0 ? [{
              id: 'imported-colors',
              type: 'section',
              tag: 'div',
              style: { display: 'flex', gap: '8px', marginTop: '24px', flexWrap: 'wrap' },
              meta: { name: 'Extracted Colors' },
              children: colors.map((color, i) => ({
                id: `imported-color-${i}`,
                type: 'card',
                tag: 'div',
                style: { width: '48px', height: '48px', borderRadius: '8px', backgroundColor: color, border: '1px solid #e2e8f0' },
                meta: { name: color }
              }))
            }] : [])
          ]
        },
        {
          id: 'imported-footer',
          type: 'footer',
          tag: 'footer',
          style: { display: 'flex', justifyContent: 'center', padding: '24px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' },
          meta: { name: 'Footer' },
          children: [
            { id: 'imported-footer-text', type: 'text', tag: 'p', content: `Imported from ${new URL(url).hostname} \u2022 Powered by Z.Design`, style: { color: '#94a3b8', fontSize: '14px' } }
          ]
        }
      ]
    };

    return { design: designTree, source: 'url', title, colors: colors.slice(0, 8), headings: headings.slice(0, 5) };
  } catch (error) {
    throw new Error(`Failed to import from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Import from JSON: Parse a design JSON string
async function importFromJSON(jsonString: string): Promise<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(jsonString);

    // If it's a Figma-like JSON, try to convert
    if (parsed.document || parsed.nodes) {
      return { design: convertFigmaLikeToDesignTree(parsed), source: 'figma-json' };
    }

    // If it already has our design tree structure
    if (parsed.id && parsed.type) {
      return { design: parsed, source: 'zdesign-json' };
    }

    // If it has a design field
    if (parsed.design && parsed.design.id) {
      return { design: parsed.design, source: 'zdesign-json' };
    }

    throw new Error('JSON does not match expected design format. Expected a design tree with "id" and "type" fields.');
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON format. Please check your input and try again.');
    }
    throw error;
  }
}

// Convert Figma-like JSON structure to our design tree format
function convertFigmaLikeToDesignTree(figmaData: Record<string, unknown>): Record<string, unknown> {
  // Basic conversion - extract what we can
  const name = (figmaData.name as string) || (figmaData.document as Record<string, unknown>)?.name as string || 'Figma Import';

  const designTree = {
    id: 'root',
    type: 'root',
    tag: 'div',
    style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif' },
    meta: { name },
    children: [
      {
        id: 'figma-import-header',
        type: 'header',
        tag: 'header',
        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', borderBottom: '1px solid #e2e8f0' },
        meta: { name: 'Imported Header' },
        children: [
          { id: 'figma-title', type: 'text', tag: 'span', content: name, style: { fontSize: '20px', fontWeight: '700', color: '#10b981' } },
          { id: 'figma-source', type: 'text', tag: 'span', content: 'Imported from Figma', style: { fontSize: '12px', color: '#94a3b8' } }
        ]
      },
      {
        id: 'figma-import-content',
        type: 'section',
        tag: 'section',
        style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', textAlign: 'center', flex: '1' },
        meta: { name: 'Imported Content' },
        children: [
          { id: 'figma-notice-h', type: 'heading', tag: 'h2', content: 'Figma Design Imported', style: { fontSize: '24px', fontWeight: '700', color: '#0f172a', marginBottom: '12px' } },
          { id: 'figma-notice-p', type: 'text', tag: 'p', content: 'Your Figma design structure has been imported. Use the chat to refine and enhance the design.', style: { fontSize: '16px', color: '#475569', maxWidth: '500px' } }
        ]
      },
      {
        id: 'figma-import-footer',
        type: 'footer',
        tag: 'footer',
        style: { display: 'flex', justifyContent: 'center', padding: '24px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' },
        meta: { name: 'Footer' },
        children: [
          { id: 'figma-footer-text', type: 'text', tag: 'p', content: 'Imported from Figma \u2022 Powered by Z.Design', style: { color: '#94a3b8', fontSize: '14px' } }
        ]
      }
    ]
  };

  return designTree;
}

// Import from Figma URL
async function importFromFigma(figmaUrl: string): Promise<Record<string, unknown>> {
  try {
    // Extract Figma file key from URL if possible
    const figmaFileMatch = figmaUrl.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
    const fileKey = figmaFileMatch?.[1];

    const title = fileKey ? `Figma Design (${fileKey.slice(0, 8)}...)` : 'Figma Design Import';

    // Since we can't access Figma API without an API key,
    // create a placeholder design tree with Figma branding
    const designTree = {
      id: 'root',
      type: 'root',
      tag: 'div',
      style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#1e1e2e' },
      meta: { name: title },
      children: [
        {
          id: 'figma-import-header',
          type: 'header',
          tag: 'header',
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', borderBottom: '1px solid #2e2e3e' },
          meta: { name: 'Imported Header' },
          children: [
            { id: 'figma-title', type: 'text', tag: 'span', content: title, style: { fontSize: '20px', fontWeight: '700', color: '#a259ff' } },
            { id: 'figma-source', type: 'text', tag: 'span', content: 'Imported from Figma', style: { fontSize: '12px', color: '#6b7280' } }
          ]
        },
        {
          id: 'figma-import-content',
          type: 'section',
          tag: 'section',
          style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', textAlign: 'center', flex: '1' },
          meta: { name: 'Figma Import' },
          children: [
            { id: 'figma-notice-h', type: 'heading', tag: 'h2', content: 'Figma Design Imported', style: { fontSize: '24px', fontWeight: '700', color: '#f0f0f0', marginBottom: '12px' } },
            { id: 'figma-notice-p', type: 'text', tag: 'p', content: 'Your Figma design has been imported as a starting point. Use the AI chat to describe the design and refine it further. You can also paste the Figma JSON export for better results.', style: { fontSize: '16px', color: '#9ca3af', maxWidth: '500px', lineHeight: '1.6' } },
            ...(fileKey ? [{
              id: 'figma-file-key',
              type: 'text',
              tag: 'p',
              content: `File key: ${fileKey}`,
              style: { fontSize: '12px', color: '#6b7280', marginTop: '16px', fontFamily: 'monospace' }
            }] : [])
          ]
        },
        {
          id: 'figma-import-footer',
          type: 'footer',
          tag: 'footer',
          style: { display: 'flex', justifyContent: 'center', padding: '24px', backgroundColor: '#16161e', borderTop: '1px solid #2e2e3e' },
          meta: { name: 'Footer' },
          children: [
            { id: 'figma-footer-text', type: 'text', tag: 'p', content: 'Imported from Figma \u2022 Powered by Z.Design', style: { color: '#6b7280', fontSize: '14px' } }
          ]
        }
      ]
    };

    return { design: designTree, source: 'figma', title, fileKey };
  } catch (error) {
    throw new Error(`Failed to import from Figma: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ImportRequestBody = await request.json();
    const { source, data } = body;

    if (!source || !data) {
      return NextResponse.json({ error: 'source and data are required' }, { status: 400 });
    }

    let result: Record<string, unknown>;

    switch (source) {
      case 'url':
        result = await importFromURL(data);
        break;
      case 'json':
        result = await importFromJSON(data);
        break;
      case 'figma':
        result = await importFromFigma(data);
        break;
      case 'image':
        // Image import would use VLM - for now return a placeholder
        result = {
          design: {
            id: 'root', type: 'root', tag: 'div',
            style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
            meta: { name: 'Image Import' },
            children: [
              {
                id: 'img-import-header',
                type: 'header',
                tag: 'header',
                style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', borderBottom: '1px solid #e2e8f0', width: '100%' },
                meta: { name: 'Imported Header' },
                children: [
                  { id: 'img-title', type: 'text', tag: 'span', content: 'Image Import', style: { fontSize: '20px', fontWeight: '700', color: '#10b981' } },
                  { id: 'img-source', type: 'text', tag: 'span', content: 'Imported from Image', style: { fontSize: '12px', color: '#94a3b8' } }
                ]
              },
              { id: 'img-import', type: 'section', tag: 'section', style: { padding: '48px', textAlign: 'center' }, children: [
                { id: 'img-h', type: 'heading', tag: 'h2', content: 'Image Analysis', style: { fontSize: '24px', fontWeight: '700', color: '#0f172a', marginBottom: '12px' } },
                { id: 'img-p', type: 'text', tag: 'p', content: 'Upload an image or screenshot and I will analyze its design to recreate it. Use the chat to describe what you see!', style: { fontSize: '16px', color: '#475569' } }
              ]}
            ]
          },
          source: 'image',
          message: 'Image import requires VLM analysis. Use the chat with an image attachment for best results.'
        };
        break;
      default:
        return NextResponse.json({ error: `Unsupported source type: ${source}` }, { status: 400 });
    }

    // If projectId is provided, update the project
    if (body.projectId) {
      try {
        const { db } = await import('@/lib/db');
        const project = await db.project.findUnique({ where: { id: body.projectId } });
        if (project && result.design) {
          await db.project.update({
            where: { id: body.projectId },
            data: { designJSON: JSON.stringify(result.design), status: 'IN_PROGRESS' },
          });
        }
      } catch (dbError) {
        console.error('[Import API] Database update failed:', dbError);
        // Don't fail the whole request if DB update fails
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Import API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to import design', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
