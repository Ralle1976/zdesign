/**
 * Deterministic Google Fonts injection for agentic HTML output.
 * LLMs often set font-family in CSS but omit the <link> tag.
 */

const GOOGLE_FONT_URLS: Record<string, string> = {
  Fraunces:
    'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&display=swap',
  'Cormorant Garamond':
    'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap',
  'Source Serif Pro':
    'https://fonts.googleapis.com/css2?family=Source+Serif+Pro:wght@400;600;700&display=swap',
  Poppins:
    'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap',
  'Space Grotesk':
    'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap',
  Inter:
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  'Playfair Display':
    'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800&display=swap',
  'DM Serif Display': 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap',
  Lora: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap',
  'Bricolage Grotesque':
    'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700&display=swap',
};

export function ensureGoogleFonts(html: string, displayFont: string, bodyFont: string): string {
  const fontNames = new Set<string>();
  for (const raw of [displayFont, bodyFont]) {
    if (!raw) continue;
    const first = raw.split(',')[0].trim().replace(/['"]/g, '');
    fontNames.add(first);
  }

  const fontsToLoad: string[] = [];
  for (const name of fontNames) {
    const url = GOOGLE_FONT_URLS[name];
    if (url && !html.includes(encodeURIComponent(name).split('%20')[0])) {
      fontsToLoad.push(url);
    }
  }

  const declaredFonts = [...html.matchAll(/font-family:\s*['"]?([^'"`,;]+)/gi)];
  for (const m of declaredFonts) {
    const name = m[1].trim();
    const url = GOOGLE_FONT_URLS[name];
    if (url && !fontsToLoad.includes(url) && !html.includes('fonts.googleapis.com')) {
      fontsToLoad.push(url);
    }
  }

  if (fontsToLoad.length === 0) return html;

  if (html.includes('fonts.googleapis.com')) {
    const existingLinks = [...html.matchAll(/href="(https:\/\/fonts\.googleapis\.com[^"]+)"/gi)];
    const existingFonts = existingLinks.map((m) => m[1]).join('');
    const missing = fontsToLoad.filter((url) => !existingFonts.includes(url));
    if (missing.length === 0) return html;
    // FIX: emit one <link> per font URL. Joining full URLs with '&' produces
    // invalid URLs like "...family=Fraunces:...&https://fonts...Inter:..."
    // which causes the browser to load only the first font.
    const fontLinks = missing.map((u) => `    <link href="${u}" rel="stylesheet">`).join('\n');
    return html.replace(
      /(<head[^>]*>)/i,
      `$1\n    <link rel="preconnect" href="https://fonts.googleapis.com">\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n${fontLinks}`,
    );
  }

  // FIX: emit one <link> per font URL (see comment above).
  const fontLinks = fontsToLoad.map((u) => `    <link href="${u}" rel="stylesheet">`).join('\n');
  const injection = `\n    <link rel="preconnect" href="https://fonts.googleapis.com">\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n${fontLinks}`;

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/(<head[^>]*>)/i, `$1${injection}`);
  }
  if (/<style/i.test(html)) {
    return html.replace(/(<style)/i, `${injection}\n    $1`);
  }
  return html;
}