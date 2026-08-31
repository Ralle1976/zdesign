// Z.Design — Interactive Product Design System
//
// For premium product showcases: watches, cars, tech, fashion, jewelry.
// Not just landing pages — interactive 3D product visualizations with
// Exploded View, wheel-driven disassembly, and Custom JavaScript interactions.
//
// Architecture:
//   - Intent-Detection (isInteractiveProductBrief)
//   - Exploded-Sequence Image Prompts (buildExplodedSequencePrompts) —
//     3 state images: assembled → half → exploded, generated via Minimax.
//     The sequence crossfades as the user scrolls: parts come APART on
//     wheel-down and go back TOGETHER on wheel-up. NO camera zoom.
//   - Prompt-Spec (PRODUCT_INTERACTION_SPECS) — the LLM builds only the
//     STRUCTURE (product-stage + data-state images), the interaction
//     controller is injected deterministically.
//   - Deterministic Runtime-Fallback (injectProductRuntime) — wheel/buttons/
//     touch controller, idempotent marker injection.

// ─── INTENT DETECTION ────────────────────────────────────────────────────────

const INTERACTIVE_PRODUCT_KEYWORDS = /\b(uhr|uhren|watch|produkt|product|showcase|3d|exploded|explosions|auto|fahrzeug|tech|gadget|kopfhörer|sneaker|drohne|kamera|schmuck|jewelry|luxus|premium|luxury|boss|rolex|patek|omega|tag heuer|breitling|cartier|iwc|handy|smartphone|laptop|parfum)\b/i;

export function isInteractiveProductBrief(message: string): boolean {
  return INTERACTIVE_PRODUCT_KEYWORDS.test(message);
}

// ─── EXPLODED SEQUENCE IMAGE PROMPTS ────────────────────────────────────────
// 3 state images of the SAME subject. Subject consistency comes from repeating
// the full product descriptor in every prompt — image-01 has no seed API, so
// we anchor via identical wording of subject + materials + light.

export interface ExplodedStateImage {
  state: 'assembled' | 'half' | 'exploded';
  prompt: string;
}

// Canonical subject per product family (better render fidelity than raw brief).
const SUBJECT_MAP: Array<[RegExp, string]> = [
  [/\b(uhr|armbanduhr|watch|chronograph)\b/i, 'luxury mechanical wristwatch with steel case and leather strap'],
  [/\b(kopfhörer|headphone|earbud)\b/i, 'premium over-ear headphones'],
  [/\b(drohne|drone)\b/i, 'professional camera drone'],
  [/\b(kamera|camera|objektiv)\b/i, 'professional mirrorless camera'],
  [/\b(sneaker|schuh|shoe)\b/i, 'premium designer sneaker'],
  [/\b(parf|duft|fragrance)\b/i, 'luxury perfume bottle'],
  [/\b(handy|smartphone|iphone)\b/i, 'flagship smartphone'],
  [/\b(laptop|notebook)\b/i, 'premium ultrabook laptop'],
  [/\b(auto|sportwagen|car|fahrzeug)\b/i, 'luxury sports car'],
  [/\b(motorrad|bike)\b/i, 'premium motorcycle'],
];

function extractProductSubject(message: string): string {
  for (const [pattern, subject] of SUBJECT_MAP) {
    if (pattern.test(message)) return subject;
  }
  // Generic fallback: first words of the brief, cleaned of instruction verbs.
  return message
    .replace(/\b(erstell|erstelle|baue|generiere|mache|design|kreiere|gestalte|eine|einen|ein|für|den|die|das)\b\s*/gi, '')
    .split(/\s+/)
    .slice(0, 6)
    .join(' ')
    .trim() || 'premium product';
}

const SEQUENCE_STYLE =
  'dark premium studio backdrop, dramatic single-source rim lighting, photorealistic product photography, ultra-detailed materials and reflections, consistent colorway and perspective in every view';

export function buildExplodedSequencePrompts(message: string): ExplodedStateImage[] {
  const subject = extractProductSubject(message);
  const anchor = `The product: ${subject}.`;
  return [
    {
      state: 'assembled',
      prompt: `${anchor} Fully assembled, complete and intact, pristine hero showcase view, ${SEQUENCE_STYLE}.`,
    },
    {
      state: 'half',
      prompt: `${anchor} Partially exploded view: outer casing opened, internal components beginning to separate and float outward in controlled alignment, ${SEQUENCE_STYLE}.`,
    },
    {
      state: 'exploded',
      prompt: `${anchor} Fully exploded technical view: every single component separated and floating apart in perfect linear alignment, gears, screws and internal mechanisms individually visible, ${SEQUENCE_STYLE}.`,
    },
  ];
}

// ─── PROMPT SPECIFICATION ────────────────────────────────────────────────────
// Injected into the LLM prompt when interactive=true. The LLM builds ONLY the
// structure; the interaction controller is injected deterministically (see
// injectProductRuntime). This is what makes the capability reliable: GLM-5.2
// often breaks hand-written JS, but follows exact CSS conventions well.

export const PRODUCT_INTERACTION_SPECS = `
═══ INTERAKTIVES PRODUKT-DESIGN (BINDEND — für Premium-Produkt-Visualisierungen) ═══

DIES IST KEINE NORMALE LANDINGPAGE. Dies ist eine INTERAKTIVE PRODUKT-VISUALISIERUNG mit EXPLODED VIEW.

EXPLODED VIEW (das Kern-Feature):
  - Mausrad runter (wheel down): Einzelteile fahren AUSEINANDER — das Innenleben wird sichtbar.
  - Mausrad hoch (wheel up): Einzelteile fahren wieder ZUSAMMEN — das komplette Produkt entsteht neu.
  - KEIN Zoom, KEINE Kamera-Bewegung: die TEILE bewegen sich, nicht der Betrachter.

PRODUKT-STAGE (nutze EXAKT diese Struktur — 3 Zustandsbilder):
  <div class="product-stage" data-sequence>
    <img class="product-state" data-state="assembled" src="..." alt="Produkt montiert">
    <img class="product-state" data-state="half" src="..." alt="Produkt halb zerlegt">
    <img class="product-state" data-state="exploded" src="..." alt="Produkt explodiert — alle Einzelteile">
  </div>

  CSS (exakt diese Basis):
    .product-stage { position: relative; min-height: 88vh; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .product-state { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; opacity: 0; transition: opacity 650ms cubic-bezier(0.22, 1, 0.36, 1); pointer-events: none; }
    .product-state.is-active { opacity: 1; }

  3 Steuer-Buttons (unter der Stage):
    <button class="explode-btn" data-target-state="assembled">Montiert</button>
    <button class="explode-btn" data-target-state="half">Halbe Explosion</button>
    <button class="explode-btn" data-target-state="exploded">Voll explodiert</button>

  WICHTIG: Schreibe KEIN eigenes JavaScript für die Explosion. Der Interaktions-
  Controller (wheel, Buttons, Touch-Slider) wird automatisch injiziert und
  arbeitet auf deinen data-state-Konventionen.

  OPTIONAL (nur wenn du zusätzlich einzelne Teile als separate Bilder hast):
    <div class="product-layer" data-z="90"><img src="..."></div>
    data-z = Abstand in px bei voller Explosion (z.B. -80, 0, 40, 90, 150).

PREMIUM-LOOK (für Luxus-Produkte):
  - Deep onyx background (#08070a bis #0f0d12)
  - EIN dramatisches Licht (gold, champagne, warm amber)
  - Ambient glow hinter dem Produkt: radial-gradient(circle, rgba(gold,0.12) 0%, transparent 60%)
  - Product schwebt sanft (float animation 6s ease-in-out infinite)
  - Langsam rotierender Ring um das Produkt (border-top-color animation)
  - Cormorant Garamond für Headlines (font-weight 300, dünn)
  - JetBrains Mono für technische Details (Preise, Referenznummern)

SEKTIONEN (für Produkt-Showcase):
  - Header: Brand-Logo, Nav, CTA (Private Anfrage)
  - Hero: Produkt-Stage im Zentrum + Instruktion ("Mausrad drehen — Einzelteile entdecken")
  - Features: Uhrwerk/Material/Technik (3-4 Karten mit Icons)
  - Story: Handwerks-Geschichte (Split-Layout mit Bild)
  - Detail: Exploded View Sektion (zeigt die Schichten separat)
  - CTA: Private Anfrage Formular
  - Footer: Kontakt, Adresse, Öffnungszeiten

KEINE externen 3D-Libraries (kein Three.js, kein WebGL). Nur CSS + die injizierte Controller-Logik.
`;

// ─── DOMAIN-ADAPTIVE INTERACTIVE SPECS ───────────────────────────────────────

export interface InteractiveSpecs {
  specs: string;
  layerNames: string[];
  zoomRange: [number, number];
}

export function getInteractiveSpecs(domain: string, message: string): InteractiveSpecs {
  // Watch/Luxury products: fine layers, slow explosion
  if (domain.includes('watch') || domain.includes('luxury') || domain.includes('fashion') || /uhr|schmuck|jewelry/i.test(message)) {
    return {
      specs: PRODUCT_INTERACTION_SPECS,
      layerNames: ['case', 'dial', 'hands', 'crown', 'strap'],
      zoomRange: [1.0, 2.5],
    };
  }
  // Tech products: bolder layers, faster explosion
  if (domain.includes('tech') || domain.includes('crypto') || /gadget|kopfhörer|drohne|kamera/i.test(message)) {
    return {
      specs: PRODUCT_INTERACTION_SPECS,
      layerNames: ['shell', 'screen', 'components', 'ports', 'stand'],
      zoomRange: [1.0, 3.0],
    };
  }
  // Default: standard product layers
  return {
    specs: PRODUCT_INTERACTION_SPECS,
    layerNames: ['base', 'middle', 'detail', 'top', 'accessory'],
    zoomRange: [1.0, 2.0],
  };
}

// ─── DETERMINISTIC RUNTIME ───────────────────────────────────────────────────
// Injected AFTER generation. THE controller — the LLM is instructed to build
// only the structure, so there is no "fallback only if LLM JS broken" guesswork:
// this runtime IS the interaction layer. Idempotent via marker.

const PRODUCT_RUNTIME_MARKER = '__zd_product_runtime__';

// State order drives wheel progress mapping (assembled → half → exploded).
const STATE_ORDER = ['assembled', 'half', 'exploded'];

const PRODUCT_RUNTIME_CSS = `
<style id="${PRODUCT_RUNTIME_MARKER}">
  .product-stage { position: relative; overflow: hidden; }
  .product-state { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; opacity: 0; transition: opacity 650ms cubic-bezier(0.22, 1, 0.36, 1); pointer-events: none; }
  .product-state.is-active { opacity: 1; }
  .product-layer { position: absolute; inset: 0; transition: transform 900ms cubic-bezier(0.22, 1, 0.36, 1); }
  .explode-btn { cursor: pointer; }
  .explode-btn.is-active { outline: 1px solid currentColor; }
  @media (prefers-reduced-motion: reduce) {
    .product-state, .product-layer { transition: none; }
  }
</style>
`;

// Sequence mode: crossfade the 3 state images by wheel progress.
// Layer mode: translateZ explosion when separate layer assets exist.
const PRODUCT_RUNTIME_JS = `
<script id="${PRODUCT_RUNTIME_MARKER}-js">
(function () {
  'use strict';
  if (document.getElementById('${PRODUCT_RUNTIME_MARKER}-js')) return; // idempotent
  var stage = document.querySelector('.product-stage');
  if (!stage) return;
  var section = stage.closest('section') || stage.parentElement;
  var isTouch = 'ontouchstart' in window;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var states = Array.prototype.slice.call(stage.querySelectorAll('.product-state[data-state]'));
  // Sort by canonical state order — the LLM's DOM order is not guaranteed.
  var ORDER = ['assembled', 'half', 'exploded'];
  states.sort(function (a, b) {
    return ORDER.indexOf(a.getAttribute('data-state')) - ORDER.indexOf(b.getAttribute('data-state'));
  });
  var layers = stage.querySelectorAll('.product-layer[data-z]');

  // ── SEQUENCE MODE (primary): 3 Zustandsbilder crossfaden ──
  if (states.length >= 2) {
    var progress = 0; // 0 = assembled, 1 = exploded
    var MAX = 1;
    var lastIdx = -1;

    function applySequence() {
      var idx = Math.min(states.length - 1, Math.max(0, Math.round(progress * (states.length - 1))));
      if (idx === lastIdx) return;
      lastIdx = idx;
      states.forEach(function (img, i) { img.classList.toggle('is-active', i === idx); });
      var btns = section.querySelectorAll('.explode-btn[data-target-state]');
      btns.forEach(function (b) {
        var order = ORDER.indexOf(b.getAttribute('data-target-state'));
        b.classList.toggle('is-active', order === idx);
      });
    }

    function step(delta) {
      progress = Math.min(MAX, Math.max(0, progress + delta));
      applySequence();
    }

    if (!reduced) {
      section.addEventListener('wheel', function (e) {
        if (stage.getBoundingClientRect().top > window.innerHeight || stage.getBoundingClientRect().bottom < 0) return;
        e.preventDefault();
        step(e.deltaY > 0 ? 0.5 : -0.5);
      }, { passive: false });
    }

    var btns = section.querySelectorAll('.explode-btn[data-target-state]');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var order = ORDER.indexOf(b.getAttribute('data-target-state'));
        if (order < 0) return;
        progress = order / (states.length - 1);
        applySequence();
      });
    });

    if (isTouch) {
      var slider = document.createElement('input');
      slider.type = 'range';
      slider.min = 0; slider.max = 1; slider.step = 0.01; slider.value = 0;
      slider.style.cssText = 'position:absolute;bottom:24px;left:50%;transform:translateX(-50%);width:220px;z-index:100;';
      slider.addEventListener('input', function () { progress = parseFloat(slider.value); applySequence(); });
      section.appendChild(slider);
    }

    applySequence();
    return;
  }

  // ── LAYER MODE (secondary): translateZ explosion, KEIN Zoom ──
  if (layers.length > 0) {
    var explosion = 0; // 0 = zusammen, 1 = vollständig explodiert
    function updateExplosion() {
      layers.forEach(function (l) {
        var baseZ = parseFloat(l.getAttribute('data-z') || '0');
        l.style.transform = 'translateZ(' + (baseZ * explosion) + 'px)';
      });
    }
    if (!reduced) {
      section.addEventListener('wheel', function (e) {
        if (stage.getBoundingClientRect().top > window.innerHeight || stage.getBoundingClientRect().bottom < 0) return;
        e.preventDefault();
        explosion = Math.min(1, Math.max(0, explosion + (e.deltaY > 0 ? 0.15 : -0.15)));
        updateExplosion();
      }, { passive: false });
    }
    var lBtns = section.querySelectorAll('.explode-btn[data-target-state]');
    lBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var target = b.getAttribute('data-target-state');
        explosion = target === 'assembled' ? 0 : target === 'half' ? 0.5 : 1;
        updateExplosion();
      });
    });
    if (isTouch) {
      var lSlider = document.createElement('input');
      lSlider.type = 'range';
      lSlider.min = 0; lSlider.max = 1; lSlider.step = 0.05; lSlider.value = 0;
      lSlider.style.cssText = 'position:absolute;bottom:24px;left:50%;transform:translateX(-50%);width:220px;z-index:100;';
      lSlider.addEventListener('input', function () { explosion = parseFloat(lSlider.value); updateExplosion(); });
      section.appendChild(lSlider);
    }
  }
})();
</script>
`;

/**
 * Inject the deterministic product interaction runtime into generated HTML.
 * Handles both conventions the LLM may produce:
 *   - 3 state images (data-state) → wheel/button crossfade sequence
 *   - separate layers (data-z) → translateZ explosion (no zoom)
 */
export function injectProductRuntime(html: string): string {
  // Already injected?
  if (html.includes(PRODUCT_RUNTIME_MARKER)) return html;

  // Check if the LLM generated a product structure to enhance.
  const hasProductStage =
    html.includes('product-stage') ||
    html.includes('product-state') ||
    html.includes('product-layer');
  if (!hasProductStage) return html;

  // Inject CSS before </head> or at start
  let result = html;
  if (/<\/head>/i.test(result)) {
    result = result.replace(/<\/head>/i, `${PRODUCT_RUNTIME_CSS}\n</head>`);
  } else if (/<style/i.test(result)) {
    result = result.replace(/(<style)/i, `${PRODUCT_RUNTIME_CSS}\n$1`);
  }

  // Inject JS before </body> or at end
  if (/<\/body>/i.test(result)) {
    result = result.replace(/<\/body>/i, `${PRODUCT_RUNTIME_JS}\n</body>`);
  } else {
    result = result + PRODUCT_RUNTIME_JS;
  }

  return result;
}
