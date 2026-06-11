// Z.Design - Export API Route
// Converts design JSON to exportable formats (HTML, PDF, ZIP)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
        // Return HTML with PDF-suggesting headers
        // In a production environment, this would use a headless browser to render PDF
        return new NextResponse(htmlContent, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Disposition': `attachment; filename="${project.name.replace(/\s+/g, '-').toLowerCase()}.pdf"`,
            'X-Export-Format': 'pdf',
            'X-Export-Note': 'HTML rendered for PDF conversion. Use a headless browser for actual PDF generation.',
          },
        });
      }

      case 'zip': {
        // Return the design JSON and HTML for frontend to package
        return NextResponse.json({
          projectName: project.name,
          files: [
            {
              name: 'index.html',
              content: htmlContent,
              type: 'text/html',
            },
            {
              name: 'design.json',
              content: project.designJSON,
              type: 'application/json',
            },
          ],
          metadata: {
            exportedAt: new Date().toISOString(),
            projectType: project.type,
            version: '1.0.0',
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
