import { describe, expect, test } from 'bun:test';
import { runRefinementQc } from './refinement-qc';

// Minimal valid documents for the QC gate — content is irrelevant, only
// length/image ratios and lint behavior matter here.
const original = [
  '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"></head><body>',
  '<h1>Original</h1>',
  '<img src="https://example.com/a.jpg" alt="A">',
  '<img src="https://example.com/b.jpg" alt="B">',
  '<p>' + 'x'.repeat(3000) + '</p>',
  '</body></html>',
].join('\n');

describe('runRefinementQc', () => {
  test('passes a healthy refinement', () => {
    const refined = original.replace('Original', 'Verfeinert');
    const result = runRefinementQc(original, refined);
    expect(result.ok).toBe(true);
  });

  test('rejects truncation (refinement lost most of the document)', () => {
    const truncated = '<!DOCTYPE html><html><body><h1>Kurz</h1></body></html>';
    const result = runRefinementQc(original, truncated);
    expect(result.ok).toBe(false);
    expect(result.rejectReason).toContain('entfernt');
  });

  test('rejects losing most images', () => {
    const noImages = original
      .replace('<img src="https://example.com/a.jpg" alt="A">', '')
      .replace('<img src="https://example.com/b.jpg" alt="B">', '');
    const result = runRefinementQc(original, noImages);
    expect(result.ok).toBe(false);
    expect(result.rejectReason).toContain('Bild');
  });

  test('warns (does not reject) on a single removed image', () => {
    const oneLess = original.replace('<img src="https://example.com/b.jpg" alt="B">', '');
    const result = runRefinementQc(original, oneLess);
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test('tolerates empty image counts', () => {
    const a = '<!DOCTYPE html><html><body><h1>Ohne Bilder</h1><p>abc</p></body></html>';
    const b = '<!DOCTYPE html><html><body><h1>Ohne Bilder</h1><p>abcd</p></body></html>';
    expect(runRefinementQc(a, b).ok).toBe(true);
  });
});
