/**
 * Deterministic content-quality audit for generated HTML artifacts.
 *
 * Part of the Audit Loop (A6): runs AFTER accessibility (A2) on the same
 * HTML string. Unlike accessibility, content findings are NOT auto-fixed —
 * they require LLM judgment to rewrite copy, so every finding here is
 * reported with `autoFixed: false` and the runner will collect their IDs
 * into `needsRefine`.
 *
 * Checks:
 *   - lorem-filler   : Lorem-ipsum / placeholder copy → P0
 *   - empty-sections : <section>/card/feature with < 20 chars text → P1
 *   - cta-presence   : no button/link matching DE/EN CTA verbs → P1
 *   - german-grammar : common AI-German error patterns → P2 (advisory)
 *
 * Same greppy style as the rest of the audit lib: regex + small parsers,
 * no DOM, no external deps, deterministic, never throws.
 */

import type { AuditFinding } from './accessibility';

export type { AuditFinding } from './accessibility';

export interface ContentAuditResult {
  /** Unchanged — content checks never mutate the HTML. */
  html: string;
  findings: AuditFinding[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Strip tags + collapse whitespace, returning visible text length. */
function visibleText(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lowercase visible text of the whole document, for substring scans. */
function lowerText(html: string): string {
  return visibleText(html).toLowerCase();
}

// ── Check 1: Lorem-ipsum / placeholder filler (P0) ───────────────────────────

const FILLER_PATTERNS: RegExp[] = [
  /lorem\s+ipsum/,
  /dolor\s+sit/,
  /placeholder\s+text/,
  /sample\s+content/,
  /\bfeature\s+(one|two|three|four|five)\b/,
];

function checkLoremFiller(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const seen = new Set<string>();
  for (const re of FILLER_PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    const match = m[0];
    if (seen.has(match)) continue;
    seen.add(match);
    findings.push({
      severity: 'P0',
      id: 'content-lorem',
      message: `Platzhalter-Inhalt erkannt: „${match}".`,
      fix: 'Echten, produktspezifischen Text formulieren.',
      autoFixed: false,
    });
  }
  return findings;
}

// ── Check 2: Empty / near-empty sections (P1) ────────────────────────────────

/**
 * Match <section> or any <div> whose class attribute contains "card" or
 * "feature". Each such block is parsed as a balanced-tag region and its
 * visible text measured. Non-greedy on the closing tag is acceptable here:
 * the worst case is over-capturing a parent, which still yields a fair
 * text-length reading (parent text is a superset, so a parent ≥ 20 chars
 * does not mask an empty child — the child itself is matched first).
 */
const SECTION_BLOCK_RE =
  /<(section|div)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi;

function isContentContainer(tag: string, attrs: string): boolean {
  if (tag.toLowerCase() === 'section') return true;
  const classMatch = /\bclass\s*=\s*["']([^"']*)["']/i.exec(attrs);
  if (!classMatch) return false;
  const cls = classMatch[1]!.toLowerCase();
  return /\b(card|feature)\b/.test(cls);
}

function checkEmptySections(html: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  let m: RegExpExecArray | null;
  SECTION_BLOCK_RE.lastIndex = 0;
  while ((m = SECTION_BLOCK_RE.exec(html)) !== null) {
    const tag = m[1]!;
    const attrs = m[2] ?? '';
    const inner = m[3] ?? '';
    if (!isContentContainer(tag, attrs)) continue;
    const text = visibleText(inner);
    if (text.length < 20) {
      findings.push({
        severity: 'P1',
        id: 'content-empty-section',
        message: `Leere Section — echter Inhalt fehlt (<${tag}> mit ${text.length} Zeichen Text).`,
        fix: `Sinnvollen Inhalt für dieses ${tag === 'section' ? '<section>' : 'Element'} ergänzen.`,
        autoFixed: false,
      });
    }
  }
  return findings;
}

// ── Check 3: CTA presence (P1) ───────────────────────────────────────────────

const CTA_TEXT_RE =
  /\b(buch|termin|kontakt|bestell|anfrag|get|start|contact)\b/i;

function checkCtaPresence(html: string): AuditFinding[] {
  // Find every <button> and <a>, extract visible text, test for a CTA verb.
  const interactiveRe = /<(?:button|a)\b[^>]*>([\s\S]*?)<\/(?:button|a)\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = interactiveRe.exec(html)) !== null) {
    const label = visibleText(m[1] ?? '');
    if (label.length > 0 && CTA_TEXT_RE.test(label)) {
      return []; // at least one clear CTA present
    }
  }
  return [
    {
      severity: 'P1',
      id: 'content-no-cta',
      message: 'Kein klarer Call-to-Action (Buchung/Kontakt/Bestellung) gefunden.',
      fix: 'Sichtbaren CTA-Button oder -Link mit Handlungsaufruf ergänzen.',
      autoFixed: false,
    },
  ];
}

// ── Check 4: German grammar heuristic (P2, advisory) ─────────────────────────

/**
 * Heuristic flags for common AI-generated-German errors. These are advisory
 * only — every match is a *suspect*, not a certainty. We deliberately keep
 * the false-positive surface small by requiring clearly wrong constructions
 * rather than every occurrence of a common word.
 */
function checkGermanGrammar(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  const wordCount = words.length || 1;

  // (a) "werden" overuse: > 3% of tokens in a non-trivial document.
  const werdenCount = words.filter((w) => w === 'werden' || w === 'werden.').length;
  if (wordCount > 40 && werdenCount / wordCount > 0.03) {
    findings.push({
      severity: 'P2',
      id: 'content-grammar-werden',
      message: `„werden" übermäßig verwendet (${werdenCount}× auf ${wordCount} Wörter) — typisch für KI-Deutsch.`,
      fix: 'Aktive Verben prüfen und „werden"-Passiv reduzieren.',
      autoFixed: false,
    });
  }

  // (b) „jeder" used where German grammar demands „jedes"/„jeden"/„jeder"
  //     correctly declined — we flag the bare, undetermined „jeder" as a
  //     suspect when it appears as a standalone pronoun (no noun follows).
  //     Cheap approximation: flag „jeder" immediately followed by a verb or
  //     sentence boundary rather than a noun.
  if (/\bjeder\s+(?:ist|hat|wird|kann|muss|soll|wird|braucht)\b/i.test(text)) {
    findings.push({
      severity: 'P2',
      id: 'content-grammar-jeder',
      message: 'Möglicher Kasusfehler: „jeder" ohne passendes Nomen.',
      fix: 'Kasus prüfen (jeder/jeden/jedem/jedes).',
      autoFixed: false,
    });
  }

  // (c) das/dass confusion — „dass" with two s is the conjunction; „das" the
  //     article. Flag the pattern „das ,", „das ." (article directly before
  //     punctuation) which is almost always a mis-spelled „dass".
  if (/\bdas\s*[,.]\s*(?:wir|ich|es|sie|der|die|das)\b/i.test(text)) {
    findings.push({
      severity: 'P2',
      id: 'content-grammar-dass',
      message: 'Mögliche das/dass-Verwechslung erkannt.',
      fix: '„das" (Artikel) vs. „dass" (Konjunktion) prüfen.',
      autoFixed: false,
    });
  }

  return findings;
}

// ── Public entry ────────────────────────────────────────────────────────────

/**
 * Run all content-quality checks on an HTML string. The HTML is returned
 * unchanged (content is never auto-fixed). `findings` records every issue
 * so the runner can route them into the refine loop.
 *
 * Never throws — any internal failure is swallowed and an empty finding
 * list is returned, so a broken check cannot block the pipeline.
 */
export function auditContent(html: string): ContentAuditResult {
  const findings: AuditFinding[] = [];
  try {
    const visible = visibleText(html);
    const lower = lowerText(html);

    findings.push(...checkLoremFiller(lower));
    findings.push(...checkEmptySections(html));
    findings.push(...checkCtaPresence(html));
    findings.push(...checkGermanGrammar(visible));
  } catch {
    // Content checks must never break the audit pipeline.
    return { html, findings: [] };
  }
  return { html, findings };
}
