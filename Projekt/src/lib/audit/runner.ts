/**
 * AuditRunner — the orchestrator for the Audit Loop (A1-A2-A7).
 *
 * Runs all registered deterministic audit checks on an HTML string and
 * returns a single result the pipeline consumes:
 *   - findings:   every check's AuditFinding (auto-fixed + reported)
 *   - autoFixed:  count of checks that applied a fix
 *   - needsRefine: IDs that could NOT be auto-fixed and warrant a refine pass
 *
 * Today only the accessibility audit is wired in (A2). The runner is the
 * seam where future audits (structure, performance, brand) plug in without
 * the call site changing.
 */

import { auditAccessibility, type AuditFinding } from './accessibility';
import { auditPerformance } from './performance';
import { auditSEO } from './seo';
import { auditDesignRhythm } from './design-rhythm';
import { auditContent } from './content';

export type { AuditFinding, AuditSeverity } from './accessibility';

export interface AuditResult {
  /** The HTML after all auto-fixes have been applied. */
  html: string;
  /** Every finding from every check. */
  findings: AuditFinding[];
  /** How many checks applied an auto-fix. */
  autoFixed: number;
  /** Finding IDs that need a (probabilistic) refine pass — i.e. could not
   *  be auto-fixed deterministically. */
  needsRefine: string[];
}

/**
 * Run all audits on an HTML document.
 *
 * Each audit returns its own {html, findings}; we thread the (possibly
 * fixed) HTML through the next audit so fixes compose, then merge the
 * findings. A finding with `autoFixed !== true` is collected into
 * needsRefine so the caller can decide to feed it back into the refine loop.
 */
export function runAudits(inputHtml: string): AuditResult {
  const allFindings: AuditFinding[] = [];
  const needsRefine: string[] = [];
  let html = inputHtml;

  // ── A2: Accessibility ────────────────────────────────────────────────────
  const a11y = auditAccessibility(html);
  html = a11y.html;
  for (const f of a11y.findings) {
    allFindings.push(f);
    if (!f.autoFixed && f.severity !== 'P2') {
      needsRefine.push(f.id);
    }
  }

  // ── A4: Performance ──────────────────────────────────────────────────────
  const perf = auditPerformance(html);
  html = perf.html;
  for (const f of perf.findings) {
    allFindings.push(f);
    if (!f.autoFixed && f.severity !== 'P2') {
      needsRefine.push(f.id);
    }
  }

  // ── A3: SEO ───────────────────────────────────────────────────────────────
  const seo = auditSEO(html);
  html = seo.html;
  for (const f of seo.findings) {
    allFindings.push(f);
    if (!f.autoFixed && f.severity !== 'P2') {
      needsRefine.push(f.id);
    }
  }

  // ── A5: Design-Rhythm (flags only — no HTML mutation) ────────────────────
  // These checks never auto-fix; they flag grid/scale/line-height issues that
  // need design judgment. We thread the current HTML for symmetry and collect
  // their findings + needsRefine entries (P1 flags enter needsRefine).
  for (const f of auditDesignRhythm(html)) {
    allFindings.push(f);
    if (!f.autoFixed && f.severity !== 'P2') {
      needsRefine.push(f.id);
    }
  }

  // ── A6: Content quality (no auto-fix — needs LLM judgment) ───────────────
  const content = auditContent(html);
  html = content.html;
  for (const f of content.findings) {
    allFindings.push(f);
    if (!f.autoFixed && f.severity !== 'P2') {
      needsRefine.push(f.id);
    }
  }

  // ── Future audits (A1 structure, A7 brand, …) plug in here ───────────────

  const autoFixed = allFindings.filter((f) => f.autoFixed).length;

  return { html, findings: allFindings, autoFixed, needsRefine };
}
