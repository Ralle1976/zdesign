import { describe, expect, test } from 'bun:test';
import {
  isInteractiveProductBrief,
  buildExplodedSequencePrompts,
  injectProductRuntime,
  PRODUCT_INTERACTION_SPECS,
} from './interactive-product';

describe('isInteractiveProductBrief', () => {
  test('detects product/showcase briefs', () => {
    expect(isInteractiveProductBrief('Erstelle eine Premium Seite für den Uhren Hersteller Boss und zeige 3D Uhr')).toBe(true);
    expect(isInteractiveProductBrief('Luxury watch exploded view showcase')).toBe(true);
    expect(isInteractiveProductBrief('Premium-Kopfhörer Produktseite')).toBe(true);
    expect(isInteractiveProductBrief('Sneaker Showcase mit 3D')).toBe(true);
  });

  test('ignores non-product briefs', () => {
    expect(isInteractiveProductBrief('Erstelle eine Landingpage für ein italienisches Restaurant')).toBe(false);
    expect(isInteractiveProductBrief('Anwaltskanzlei Website mit Team-Seite')).toBe(false);
  });
});

describe('buildExplodedSequencePrompts', () => {
  test('returns 3 states in order for a watch brief', () => {
    const seq = buildExplodedSequencePrompts('Premium Seite für Boss Uhren mit 3D Uhr');
    expect(seq.map((s) => s.state)).toEqual(['assembled', 'half', 'exploded']);
    expect(seq[0].prompt).toContain('wristwatch');
    expect(seq[1].prompt.toLowerCase()).toContain('partially exploded');
    expect(seq[2].prompt.toLowerCase()).toContain('fully exploded');
  });

  test('falls back to brief words for unknown domains', () => {
    const seq = buildExplodedSequencePrompts('Interaktive Produktseite für meinen 3D-Drucker');
    expect(seq).toHaveLength(3);
    expect(seq[0].prompt).not.toContain('undefined');
  });
});

describe('PRODUCT_INTERACTION_SPECS', () => {
  test('prescribes explosion, not zoom', () => {
    expect(PRODUCT_INTERACTION_SPECS).toContain('data-sequence');
    expect(PRODUCT_INTERACTION_SPECS).toContain('data-state');
    expect(PRODUCT_INTERACTION_SPECS.toLowerCase()).toContain('kein zoom');
    // The old broken scale-zoom must be gone.
    expect(PRODUCT_INTERACTION_SPECS).not.toContain("stage.style.transform = 'scale'");
  });
});

describe('injectProductRuntime', () => {
  test('no-op when no product stage exists', () => {
    const html = '<html><head></head><body><h1>Hallo</h1></body></html>';
    expect(injectProductRuntime(html)).toBe(html);
  });

  test('injects sequence controller for data-state images', () => {
    const html =
      '<html><head></head><body><div class="product-stage" data-sequence>' +
      '<img class="product-state" data-state="assembled" src="a.png">' +
      '<img class="product-state" data-state="half" src="b.png">' +
      '<img class="product-state" data-state="exploded" src="c.png">' +
      '</div></body></html>';
    const out = injectProductRuntime(html);
    expect(out).toContain('__zd_product_runtime__');
    expect(out).toContain('addEventListener');
  });

  test('is idempotent', () => {
    const html =
      '<html><head></head><body><div class="product-stage" data-sequence>' +
      '<img class="product-state" data-state="assembled" src="a.png">' +
      '</div></body></html>';
    const once = injectProductRuntime(html);
    const twice = injectProductRuntime(once);
    expect(twice).toBe(once);
  });

  test('injects layer mode for data-z layers', () => {
    const html =
      '<html><head></head><body><div class="product-stage">' +
      '<div class="product-layer" data-z="40"><img src="l1.png"></div>' +
      '</div></body></html>';
    const out = injectProductRuntime(html);
    expect(out).toContain('translateZ');
  });
});
