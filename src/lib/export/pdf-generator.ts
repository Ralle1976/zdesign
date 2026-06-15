// Z.Design - Real PDF Export Generator
// Generates high-quality PDFs from design JSON using Puppeteer

import puppeteer from 'puppeteer';

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

interface PDFExportOptions {
  format?: 'A4' | 'Letter' | 'Legal' | 'Tabloid' | 'A3' | 'A5';
  orientation?: 'portrait' | 'landscape';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  scale?: number;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  preferCSSPageSize?: boolean;
}

interface PDFGenerationResult {
  success: boolean;
  pdfBuffer?: Buffer;
  error?: string;
  metadata?: {
    title: string;
    pages: number;
    size: number;
    generatedAt: string;
  };
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
 * Optimized for PDF rendering with proper print styles
 */
function generatePrintableHTML(designJSON: string, projectName: string, options: PDFExportOptions = {}): string {
  let designTree: DesignNode;
  try {
    designTree = JSON.parse(designJSON);
  } catch {
    designTree = { id: 'root', type: 'root', tag: 'div', children: [] };
  }

  const bodyContent = designNodeToHTML(designTree, 2);

  // Calculate dimensions based on format and orientation
  const format = options.format || 'A4';
  const orientation = options.orientation || 'portrait';

  // Page dimensions in mm
  const pageSizes = {
    A4: { width: orientation === 'portrait' ? '210mm' : '297mm', height: orientation === 'portrait' ? '297mm' : '210mm' },
    Letter: { width: orientation === 'portrait' ? '216mm' : '279mm', height: orientation === 'portrait' ? '279mm' : '216mm' },
    Legal: { width: orientation === 'portrait' ? '216mm' : '356mm', height: orientation === 'portrait' ? '356mm' : '216mm' },
    Tabloid: { width: orientation === 'portrait' ? '279mm' : '432mm', height: orientation === 'portrait' ? '432mm' : '279mm' },
    A3: { width: orientation === 'portrait' ? '297mm' : '420mm', height: orientation === 'portrait' ? '420mm' : '297mm' },
    A5: { width: orientation === 'portrait' ? '148mm' : '210mm', height: orientation === 'portrait' ? '210mm' : '148mm' },
  };

  const pageSize = pageSizes[format];

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
      display: block;
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

    /* Print-specific styles */
    @media print {
      body {
        margin: 0;
        padding: 0;
      }

      /* Page break handling */
      .page-break {
        page-break-after: always;
      }

      .avoid-page-break {
        page-break-inside: avoid;
      }

      /* Remove interactive elements in print */
      button {
        pointer-events: none;
      }

      input, textarea {
        border: 1px solid #ccc;
        background: white;
      }
    }

    /* Ensure colors print correctly */
    @media print and (color) {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }

    /* Focus styles for accessibility */
    :focus-visible {
      outline: 2px solid #6366f1;
      outline-offset: 2px;
    }

    /* Pagination for large content */
    .paginated-content {
      page-break-inside: avoid;
    }

    /* Smooth scrolling for screen viewing */
    @media screen {
      html {
        scroll-behavior: smooth;
      }
    }
  </style>
</head>
<body>
  <div class="paginated-content">
${bodyContent}
  </div>
</body>
</html>`;
}

/**
 * Generates a PDF from design JSON using Puppeteer
 */
export async function generatePDF(
  designJSON: string,
  projectName: string,
  options: PDFExportOptions = {}
): Promise<PDFGenerationResult> {
  let browser = null;

  try {
    // Launch Puppeteer with optimized settings
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
      executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined,
    });

    const page = await browser.newPage();

    // Generate HTML content
    const htmlContent = generatePrintableHTML(designJSON, projectName, options);

    // Set content and wait for it to load
    await page.setContent(htmlContent, {
      waitUntil: ['networkidle0', 'load', 'domcontentloaded'],
      timeout: 30000,
    });

    // Wait for fonts to load
    await page.evaluateHandle('document.fonts.ready');

    // Wait for images to load
    await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      return Promise.all(
        Array.from(images).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.addEventListener('load', resolve);
            img.addEventListener('error', resolve); // Continue even if image fails
            setTimeout(resolve, 3000); // Timeout after 3s
          });
        })
      );
    });

    // PDF generation options
    const pdfOptions: puppeteer.PDFOptions = {
      format: options.format || 'A4',
      orientation: options.orientation || 'portrait',
      margin: options.margin || {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
      scale: options.scale || 1,
      displayHeaderFooter: options.displayHeaderFooter || false,
      headerTemplate: options.headerTemplate || '',
      footerTemplate: options.footerTemplate || '',
      preferCSSPageSize: options.preferCSSPageSize || false,
      printBackground: true,
    };

    // Generate PDF
    const pdfBuffer = await page.pdf(pdfOptions);

    // Get page count
    const pageCount = await page.evaluate(() => {
      // Estimate page count based on content height
      const contentHeight = document.body.scrollHeight;
      const pageHeight = 1123; // A4 height in pixels (approximate)
      return Math.ceil(contentHeight / pageHeight);
    });

    await browser.close();

    return {
      success: true,
      pdfBuffer,
      metadata: {
        title: projectName,
        pages: pageCount,
        size: pdfBuffer.length,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('[PDF Generator] Error:', error);

    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('[PDF Generator] Error closing browser:', closeError);
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Validates PDF generation prerequisites
 */
export async function validatePDFEnvironment(): Promise<{ valid: boolean; error?: string }> {
  try {
    // Test Puppeteer launch
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    await browser.close();

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to launch headless browser',
    };
  }
}

/**
 * Generates multiple PDFs in batch for performance
 */
export async function generatePDFBatch(
  items: Array<{ designJSON: string; projectName: string; options?: PDFExportOptions }>
): Promise<PDFGenerationResult[]> {
  const results: PDFGenerationResult[] = [];

  for (const item of items) {
    const result = await generatePDF(item.designJSON, item.projectName, item.options);
    results.push(result);
  }

  return results;
}

/**
 * Estimates PDF generation time based on design complexity
 */
export function estimatePDFGenerationTime(designJSON: string): number {
  try {
    const design = JSON.parse(designJSON);
    const elementCount = countElements(design);

    // Base time: 2 seconds
    // Add 0.05 seconds per element
    // Cap at 10 seconds
    const estimatedTime = Math.min(2000 + (elementCount * 50), 10000);

    return estimatedTime;
  } catch {
    return 5000; // Default to 5 seconds if JSON parsing fails
  }
}

/**
 * Counts elements in a design tree
 */
function countElements(node: DesignNode): number {
  let count = 1;
  if (node.children) {
    for (const child of node.children) {
      count += countElements(child);
    }
  }
  return count;
}