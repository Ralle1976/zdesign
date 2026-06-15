// Z.Design - Export API Route
// Converts design JSON to exportable formats (HTML, PDF, ZIP)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generatePDF, validatePDFEnvironment, estimatePDFGenerationTime } from '@/lib/export/pdf-generator';
import { generateZIP } from '@/lib/export/zip-generator';

interface DesignNode {
  id: string;
  type: string;
  tag?: string;
  content?: string;
  children?: DesignNode[];
  style?: Record<string, unknown>;
  props?: Record<string, unknown>;
  meta?: { name?: string; [key: string]: unknown };
}

interface ExportRequestBody {
  projectId: string;
  format: 'html' | 'pdf' | 'zip';
}

/**
 * Converts a DesignNode tree to an HTML string
 */
function designNodeToHTML(node: DesignNode, indent: number = 0): string {
  const spaces = '  '.repeat(indent);
  const tag = node.tag || 'div';
  const children = node.children || [];

  // Build inline style string
  let styleStr = '';
  if (node.style && Object.keys(node.style).length > 0) {
    const styleEntries = Object.entries(node.style)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([key, value]) => {
        // Convert camelCase to kebab-case
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${cssKey}: ${value}`;
      });
    styleStr = ` style="${styleEntries.join('; ')}"`;
  }

  // Self-closing tags
  const selfClosingTags = ['img', 'br', 'hr', 'input'];
  if (selfClosingTags.includes(tag) && !children.length && !node.content) {
    return `${spaces}<${tag}${styleStr} />`;
  }

  // Text content nodes
  if (node.type === 'text' || node.type === 'heading') {
    const textContent = node.content || '';
    if (!children.length) {
      return `${spaces}<${tag}${styleStr}>${textContent}</${tag}>`;
    }
  }

  // Button with content
  if (node.type === 'button' && node.content && !children.length) {
    return `${spaces}<${tag}${styleStr}>${node.content}</${tag}>`;
  }

  // Build children HTML
  let innerHTML = '';
  if (node.content && children.length === 0) {
    innerHTML = node.content;
  } else if (children.length > 0) {
    innerHTML = '\n' + children.map(child => designNodeToHTML(child, indent + 1)).join('\n') + `\n${spaces}`;
  }

  return `${spaces}<${tag}${styleStr}>${innerHTML}</${tag}>`;
}

/**
 * Generates a complete standalone HTML document from a design tree
 */
function generateFullHTML(designJSON: string, projectName: string): string {
  let designTree: DesignNode;
  try {
    designTree = JSON.parse(designJSON);
  } catch {
    designTree = { id: 'root', type: 'root', tag: 'div', children: [] };
  }

  const bodyContent = designNodeToHTML(designTree, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectName} - Z.Design Export</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    body {
      min-height: 100vh;
      color: #0f172a;
      background-color: #ffffff;
    }

    img {
      max-width: 100%;
      height: auto;
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    button {
      cursor: pointer;
      font-family: inherit;
    }

    input, textarea, select {
      font-family: inherit;
    }

    /* Smooth scrolling */
    html {
      scroll-behavior: smooth;
    }

    /* Focus styles for accessibility */
    :focus-visible {
      outline: 2px solid #6366f1;
      outline-offset: 2px;
    }
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExportRequestBody = await request.json();
    const { projectId, format } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    if (!format || !['html', 'pdf', 'zip'].includes(format)) {
      return NextResponse.json(
        { error: 'format must be one of: html, pdf, zip' },
        { status: 400 }
      );
    }

    // Fetch the project
    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const htmlContent = generateFullHTML(project.designJSON, project.name);

    switch (format) {
      case 'html': {
        return new NextResponse(htmlContent, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Disposition': `attachment; filename="${project.name.replace(/\s+/g, '-').toLowerCase()}.html"`,
          },
        });
      }

      case 'pdf': {
        console.log('[Export API] Generating real PDF with Puppeteer...');

        // Estimate generation time
        const estimatedTime = estimatePDFGenerationTime(project.designJSON);
        console.log(`[Export API] Estimated generation time: ${estimatedTime}ms`);

        // Generate PDF using Puppeteer
        const pdfResult = await generatePDF(project.designJSON, project.name, {
          format: 'A4',
          orientation: 'portrait',
          margin: {
            top: '20px',
            right: '20px',
            bottom: '20px',
            left: '20px',
          },
          scale: 1,
        });

        if (!pdfResult.success || !pdfResult.pdfBuffer) {
          console.error('[Export API] PDF generation failed:', pdfResult.error);

          // Fall back to HTML if PDF generation fails
          return new NextResponse(htmlContent, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Content-Disposition': `attachment; filename="${project.name.replace(/\s+/g, '-').toLowerCase()}.html"`,
              'X-PDF-Error': pdfResult.error || 'PDF generation failed',
              'X-Fallback': 'HTML',
            },
          });
        }

        console.log('[Export API] PDF generated successfully:', pdfResult.metadata);

        // Return the real PDF
        return new NextResponse(pdfResult.pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${project.name.replace(/\s+/g, '-').toLowerCase()}.pdf"`,
            'Content-Length': pdfResult.pdfBuffer.length.toString(),
            'X-Export-Format': 'pdf',
            'X-Export-Version': '2.0.0',
            'X-PDF-Pages': pdfResult.metadata?.pages.toString() || '0',
            'X-PDF-Size': pdfResult.metadata?.size.toString() || '0',
            'X-PDF-Generated-At': pdfResult.metadata?.generatedAt || new Date().toISOString(),
          },
        });
      }

      case 'zip': {
        console.log('[Export API] Generating real ZIP archive with jszip...');

        const zipResult = await generateZIP(project.designJSON, project.name, {
          includeAssets: true,
          includeREADME: true,
          includeDesignJSON: true,
        });

        if (!zipResult.success || !zipResult.zipBuffer) {
          console.error('[Export API] ZIP generation failed:', zipResult.error);
          return NextResponse.json(
            {
              error: 'ZIP generation failed',
              details: zipResult.error || 'Unknown error',
            },
            { status: 500 }
          );
        }

        console.log('[Export API] ZIP generated successfully:', zipResult.metadata);

        const zipBytes = new Uint8Array(zipResult.zipBuffer);
        return new NextResponse(zipBytes, {
          status: 200,
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${project.name.replace(/\s+/g, '-').toLowerCase()}.zip"`,
            'Content-Length': zipBytes.length.toString(),
            'X-Export-Format': 'zip',
            'X-Export-Version': '1.0.0',
            'X-ZIP-Files': (zipResult.metadata?.fileCount ?? 0).toString(),
            'X-ZIP-Size': (zipResult.metadata?.size ?? 0).toString(),
            'X-ZIP-Generated-At': zipResult.metadata?.generatedAt || new Date().toISOString(),
          },
        });
      }

      default:
        return NextResponse.json(
          { error: 'Unsupported export format' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Export API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to export design', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
