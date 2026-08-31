// Z.Design — Refinement QC
//
// Deterministic quality gate for the quick refinement path (no vision loop).
// Guards the most-used workflow against silent quality loss: truncation,
// image loss and new anti-slop P0 regressions introduced by the LLM edit.

import { lintHtml } from '@/lib/ai/lint/anti-slop';
import { countVisibleImages } from '@/lib/ai/ensure-design-images';

export interface RefinementQcResult {
  ok: boolean;
  rejectReason?: string;
  warnings: string[];
}

const MIN_LENGTH_RATIO = 0.4; // refined must keep ≥40% of the original size
const MIN_IMAGE_RATIO = 0.5; // refined must keep ≥50% of the original images

export function runRefinementQc(
  existingHtml: string,
  refinedHtml: string,
): RefinementQcResult {
  const warnings: string[] = [];

  // 1) Truncation guard: a refinement that loses most of the document is a
  //    broken output, not a design decision.
  if (refinedHtml.length < existingHtml.length * MIN_LENGTH_RATIO) {
    return {
      ok: false,
      rejectReason:
        'Die Verfeinerung hat den Großteil des Designs entfernt (möglicherweise abgeschnittene Antwort). Änderung wurde verworfen — das bisherige Design bleibt erhalten.',
      warnings,
    };
  }

  // 2) Image-loss guard: removing most images silently downgrades the design.
  const oldImages = countVisibleImages(existingHtml);
  const newImages = countVisibleImages(refinedHtml);
  if (oldImages > 0 && newImages < oldImages * MIN_IMAGE_RATIO) {
    return {
      ok: false,
      rejectReason: `Die Verfeinerung würde ${oldImages - newImages} von ${oldImages} Bildern entfernen. Änderung wurde verworfen — das bisherige Design bleibt erhalten.`,
      warnings,
    };
  }
  if (newImages < oldImages) {
    warnings.push(
      `${oldImages - newImages} Bild(er) wurden entfernt (${oldImages} → ${newImages}).`,
    );
  }

  // 3) Anti-slop P0 regression: new cardinal sins that weren't in the original.
  try {
    const oldP0 = new Set(
      lintHtml(existingHtml)
        .filter((f) => f.severity === 'P0')
        .map((f) => f.id),
    );
    const newP0 = lintHtml(refinedHtml).filter((f) => f.severity === 'P0');
    const regressions = newP0.filter((f) => !oldP0.has(f.id));
    if (regressions.length > 0) {
      warnings.push(
        `Neue Anti-Slop-Probleme: ${regressions
          .slice(0, 3)
          .map((f) => f.message)
          .join(' · ')}`,
      );
    }
  } catch {
    // Lint is best-effort — never block the refinement on a linter failure.
  }

  return { ok: true, warnings };
}
