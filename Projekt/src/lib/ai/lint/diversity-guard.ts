/**
 * diversity-guard.ts — keeps a generated set DIVERSE (prevents "hundreds of
 * samey designs"). A design is fingerprinted by its dominant PALETTE (top hexes)
 * + DISPLAY font; a new design too similar to an already-accepted one is
 * flagged as a near-duplicate so the showcase doesn't collapse.
 *
 * Deterministic, no LLM, no deps. The fingerprint is the "looks-samey" signal:
 * two designs with the same top-3 palette + same display font read as identical
 * even if their copy/layout differ slightly.
 *
 * Usage in a batch: one DiversityTracker per run; after a design passes QC,
 * check() it — if tooSimilar, exclude (don't add to the published set).
 */
export interface DesignFingerprint {
  hexes: string[]; // top 4 palette colors (lowercased #rrggbb)
  displayFont: string; // most-used font-family
}

/** Acceptance thresholds (tunable). */
const PALETTE_JACCARD_STRONG = 0.5; // ≥ this palette overlap alone = duplicate
const PALETTE_JACCARD_WEAK = 0.25; // ≥ this AND same display font = duplicate

/** Extract a design fingerprint from an HTML doc: top palette hexes + display font. */
export function fingerprint(html: string): DesignFingerprint {
  const fp: DesignFingerprint = { hexes: [], displayFont: '' };
  if (!html) return fp;
  try {
    // palette: count #rrggbb / #rgb occurrences, take top 4
    const hexCounts = new Map<string, number>();
    for (const m of html.matchAll(/#(?:[0-9a-fA-F]{3}){1,2}\b/g)) {
      const h = m[0].toLowerCase();
      hexCounts.set(h, (hexCounts.get(h) ?? 0) + 1);
    }
    fp.hexes = [...hexCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([h]) => h);

    // display font: most-used font-family value
    const fontCounts = new Map<string, number>();
    for (const m of html.matchAll(/font-family\s*:\s*([^;}"']+)/gi)) {
      const f = m[1].trim().replace(/['"]/g, '').split(',')[0].trim().toLowerCase();
      if (f && f !== 'inherit' && f !== 'sans-serif' && f !== 'serif') {
        fontCounts.set(f, (fontCounts.get(f) ?? 0) + 1);
      }
    }
    fp.displayFont = [...fontCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  } catch {
    /* never throw on fingerprinting */
  }
  return fp;
}

/** Jaccard similarity of two hex sets (0..1). */
function paletteJaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const h of sa) if (sb.has(h)) inter++;
  const union = sa.size + sb.size - inter;
  return union > 0 ? inter / union : 0;
}

/** Is `candidate` too similar to any `existing` fingerprint? */
export function isTooSimilar(
  candidate: DesignFingerprint,
  existing: DesignFingerprint[],
): { tooSimilar: boolean; similarTo?: number } {
  for (let i = 0; i < existing.length; i++) {
    const other = existing[i];
    const jac = paletteJaccard(candidate.hexes, other.hexes);
    const sameFont = candidate.displayFont && candidate.displayFont === other.displayFont;
    if (jac >= PALETTE_JACCARD_STRONG) return { tooSimilar: true, similarTo: i };
    if (jac >= PALETTE_JACCARD_WEAK && sameFont) return { tooSimilar: true, similarTo: i };
  }
  return { tooSimilar: false };
}

/**
 * Per-batch diversity tracker. Call check() before accepting a design;
 * call accept() once it's persisted. Resets per batch run (module-level instance
 * is convenient for a single POST, or instantiate your own).
 */
export class DiversityTracker {
  private accepted: DesignFingerprint[] = [];
  private duplicates: number[] = []; // indices of accepted designs that were dupes

  get count(): number {
    return this.accepted.length;
  }
  get duplicateCount(): number {
    return this.duplicates.length;
  }

  /** Check a fingerprint against accepted ones. Does NOT accept it. */
  check(fp: DesignFingerprint): { tooSimilar: boolean; similarTo?: number } {
    return isTooSimilar(fp, this.accepted);
  }

  /** Record an accepted design's fingerprint. */
  accept(fp: DesignFingerprint): void {
    this.accepted.push(fp);
  }

  /** Reset for a fresh batch. */
  reset(): void {
    this.accepted = [];
    this.duplicates = [];
  }
}
