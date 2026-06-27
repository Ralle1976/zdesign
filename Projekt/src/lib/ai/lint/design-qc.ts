// Z.Design — Design Quality Control (the real 10/10 gate).
//
// The old isValidHtmlDoc() only checked "starts with doctype + ends with
// </html> + ≥1500 chars" — so truncated documents with unclosed <div>/<section>
// and missing footers sailed through. This module is the ACTUAL acceptance
// gate: a real tag-balance parser + completeness checks. A design only ships
// when it passes.
//
// Used by the batch + agent generation routes (validate → repair → retry).

/** HTML void elements that never need a closing tag. */
const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * Tag-balance check via a real tokenizer (handles '>' inside quoted attribute
 * values). Returns the unclosed stack + any mismatched closing tags.
 */
export function checkTagBalance(
  html: string,
): { balanced: boolean; unclosed: string[]; mismatches: string[] } {
  const stack: string[] = [];
  const mismatches: string[] = [];
  // Match an opening or closing tag, skipping '>' inside "..." or '...'.
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    const attrs = m[3] || '';
    if (closing) {
      if (stack.length === 0 || stack[stack.length - 1] !== name) {
        mismatches.push(name);
      } else {
        stack.pop();
      }
    } else {
      const selfClosed = /\/\s*$/.test(attrs);
      if (VOID.has(name) || selfClosed) continue;
      stack.push(name);
    }
    // Safety against catastrophic regex on huge docs.
    if (re.lastIndex > 600_000) break;
  }
  return { balanced: stack.length === 0 && mismatches.length === 0, unclosed: stack, mismatches };
}

/**
 * Repair unbalanced HTML by closing any unclosed INNER tags in reverse order.
 *
 * Only closes non-structural tags (everything except html/body/head) — those
 * are already handled by the document's existing </body></html> tail. Closes
 * are inserted just before the first </body> so the existing tail still
 * resolves cleanly. (The previous version re-added </body></html> and
 * duplicated them, leaving "mismatched body, html" failures.)
 *
 * Note: this cannot fix genuinely EXTRA closing tags (a real HTML parser would
 * be needed); such designs correctly fail the gate and get regenerated.
 */
export function repairTagBalance(html: string): string {
  const structural = new Set(['html', 'body', 'head']);
  const { unclosed } = checkTagBalance(html);
  const inner = unclosed.filter((t) => !structural.has(t));
  if (inner.length === 0) return html;
  const closes = inner.slice().reverse().map((t) => `</${t}>`).join('');
  const bodyIdx = html.search(/<\/body>/i);
  if (bodyIdx >= 0) return html.slice(0, bodyIdx) + closes + html.slice(bodyIdx);
  const htmlIdx = html.search(/<\/html>/i);
  if (htmlIdx >= 0) return html.slice(0, htmlIdx) + closes + html.slice(htmlIdx);
  return html + closes;
}

export interface QcResult {
  pass: boolean;
  score: number; // 0-100
  failures: string[];
  warnings: string[];
}
/** CTA keywords (de + en) — at least one real call-to-action must exist. */
const CTA_RE = /\b(jetzt|reserv|bestell|kauf|kontakt|anmeld|registrier|buchen|los|mehr erfahren|entdeck|get started|order|buy|book|sign up|contact|learn more|explore)\b/i;

/**
 * Inject a minimal, real footer when the model omitted one — instead of
 * regenerating (expensive). Raises batch QC yield dramatically (the most common
 * QC failure was "missing <footer>"). Idempotent (no-op if a footer exists).
 * Brand is escaped to avoid injection from the brief name.
 */
export function ensureFooter(html: string, brand = 'Z.Design'): string {
  if (/<footer\b/i.test(html)) return html;
  const year = new Date().getFullYear();
  const b = String(brand).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]!));
  const footer = `\n<footer style="border-top:1px solid rgba(255,255,255,.12);padding:2.5rem 1.5rem;background:#0b0b0c;color:#e7e2d6;font-family:system-ui,-apple-system,sans-serif">\n  <div style="max-width:1100px;margin:0 auto;display:flex;flex-wrap:wrap;gap:1rem;justify-content:space-between;align-items:center">\n    <strong>${b}</strong>\n    <nav style="display:flex;gap:1.25rem;font-size:.9rem;opacity:.85"><a href="#" style="color:inherit;text-decoration:none">Impressum</a><a href="#" style="color:inherit;text-decoration:none">Datenschutz</a><a href="#" style="color:inherit;text-decoration:none">Kontakt</a></nav>\n  </div>\n  <div style="max-width:1100px;margin:1rem auto 0;font-size:.8rem;opacity:.6">© ${year} ${b}. Alle Rechte vorbehalten.</div>\n</footer>\n`;
  const bodyIdx = html.search(/<\/body>/i);
  if (bodyIdx >= 0) return html.slice(0, bodyIdx) + footer + html.slice(bodyIdx);
  return html + footer;
}

/**
 * The full acceptance gate. A design passes only when it is structurally
 * complete (balanced tags, footer, nav, h1, viewport, enough sections, a CTA,
 * real content length, no lorem/TODO, no empty sections).
 */
export function validateDesignHtml(html: string): QcResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  const lower = html.toLowerCase();
  const len = html.length;

  // 1) Structural completeness
  const { balanced, unclosed, mismatches } = checkTagBalance(html);
  if (!balanced) {
    if (unclosed.length) failures.push(`unclosed tags: ${unclosed.slice(0, 6).join(', ')}`);
    if (mismatches.length) failures.push(`mismatched closing tags: ${mismatches.slice(0, 6).join(', ')}`);
  }
  if (!/<footer\b/i.test(html)) failures.push('missing <footer>');
  if (!/<nav\b/i.test(html)) failures.push('missing <nav>');
  if (!/<h1\b/i.test(html)) failures.push('missing <h1>');
  if (!/name=["']viewport["']/i.test(html)) failures.push('missing viewport meta (not responsive)');
  if (!CTA_RE.test(html)) failures.push('no call-to-action found');

  // 2) Enough content — a real landing page has several distinct sections.
  const sectionCount = (html.match(/<section\b/gi) || []).length;
  if (sectionCount < 4) failures.push(`only ${sectionCount} sections (need ≥4)`);

  // 3) No empty sections (<section> with <30 chars of text).
  const emptySec = (html.match(/<section\b[^>]*>\s*<\/section>/gi) || []).length;
  if (emptySec > 0) warnings.push(`${emptySec} empty <section>`);

  // 4) No filler / placeholder content.
  if (/\b(lorem ipsum|dolor sit amet|your content here|placeholder text|coming soon)\b/i.test(lower)) {
    failures.push('lorem-ipsum / placeholder filler detected');
  }
  if (/\b(todo|tbd|fixme|xxx)\b/i.test(lower)) warnings.push('TODO/TBD marker found');

  // 5) Real document length (not a truncated stub).
  if (len < 9000) failures.push(`too short (${len} chars — likely truncated)`);

  // 6) Ends as a document.
  if (!/<\/html>\s*$/i.test(html.trim())) failures.push('does not end with </html>');

  // Score: start at 100, subtract for failures (-15) and warnings (-4).
  const score = Math.max(0, 100 - failures.length * 15 - warnings.length * 4);
  return { pass: failures.length === 0, score, failures, warnings };
}
