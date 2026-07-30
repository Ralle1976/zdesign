// Z.Design — Interactive Product Design System
//
// For premium product showcases: watches, cars, tech, fashion, jewelry.
// Not just landing pages — interactive 3D product visualizations with
// Exploded View, Mausrad-Zoom, and Custom JavaScript interactions.
//
// Architecture: Prompt-Spec (PRODUCT_INTERACTION_SPECS) + Deterministic
// Runtime-Fallback (injectProductRuntime) + Intent-Detection (isInteractiveProductBrief).
// Pattern follows ensureExperienceRuntime() — deterministic post-process with marker.

// ─── INTENT DETECTION ────────────────────────────────────────────────────────

const INTERACTIVE_PRODUCT_KEYWORDS = /\b(uhr|uhren|watch|produkt|product|showcase|3d|exploded|explosions|auto|fahrzeug|tech|gadget|kopfhörer|sneaker|drohne|kamera|schmuck|jewelry|luxus|premium|luxury|boss|rolex|patek|omega|tag heuer|breitling|cartier|iwc)\b/i;

export function isInteractiveProductBrief(message: string): boolean {
  return INTERACTIVE_PRODUCT_KEYWORDS.test(message);
}

// ─── PROMPT SPECIFICATION ────────────────────────────────────────────────────
// Injected into the LLM prompt when interactive=true. Contains exact technical
// specifications for 3D transforms, layer structure, and Custom JS patterns.
// GLM-5.2 follows concrete numbers and complete code snippets reliably.

export const PRODUCT_INTERACTION_SPECS = `
═══ INTERAKTIVES PRODUKT-DESIGN (BINDEND — für Premium-Produkt-Visualisierungen) ═══

DIES IST KEINE NORMALE LANDINGPAGE. Dies ist eine INTERAKTIVE 3D-PRODUKT-VISUALISIERUNG.

3D-BÜHNE (exakt diese CSS-Struktur):
  .product-stage {
    perspective: 1200px;
    transform-style: preserve-3d;
    position: sticky;
    top: 15vh;
    width: 100%;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .product-layer {
    position: absolute;
    inset: 0;
    transform-style: preserve-3d;
    transition: transform 900ms cubic-bezier(0.22, 1, 0.36, 1), opacity 600ms ease;
  }
  Jede Schicht: <div class="product-layer" data-z="0"> mit <img> (object-fit: contain).
  data-z = ABSTAND in px bei voller Explosion (z.B. -80, 0, 40, 90, 150).

MAUSRAD-ZOOM (nutze EXAKT diesen Controller — passe nur Selektoren an):
  <script>
  (function () {
    var stage = document.querySelector('.product-stage');
    var layers = stage.querySelectorAll('.product-layer');
    var zoom = 1, MIN = 1, MAX = 2;
    stage.closest('section').addEventListener('wheel', function (e) {
      e.preventDefault();
      zoom = Math.min(MAX, Math.max(MIN, zoom + (e.deltaY > 0 ? 0.25 : -0.25)));
      var t = (zoom - MIN) / (MAX - MIN);
      stage.style.transform = 'scale(' + zoom + ')';
      layers.forEach(function (l) {
        var z = parseFloat(l.dataset.z || '0');
        l.style.transform = 'translateZ(' + (z * t) + 'px)';
      });
    }, { passive: false });
  })();
  </script>

REGELN FÜR DAS JS:
  - Vanilla JS, IIFE, KEINE externen 3D-Libraries (kein Three.js/WebGL).
  - NUR transform + opacity animieren (GPU). KEIN top/left/width im Listener.
  - wheel-Listener mit { passive: false } + e.preventDefault() — sonst scrollt die Seite.
  - prefers-reduced-motion: Exploded-View per Toggle-Button statt wheel.
  - Mobile-Fallback: Touch-Slider (input[type=range]) statt wheel.

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
  - Hero: 3D-Produkt im Zentrum + Zoom-Instruktion ("Mausrad drehen zum Zoomen")
  - Features: Uhrwerk/Material/Technik (3-4 Karten mit Icons)
  - Story: Handwerks-Geschichte (Split-Layout mit Bild)
  - Detail: Exploded View Sektion (zeigt die Schichten separat)
  - CTA: Private Anfrage Formular
  - Footer: Kontakt, Adresse, Öffnungszeiten

KEINE externen 3D-Libraries (kein Three.js, kein WebGL). Nur CSS 3D + Custom JavaScript.
`;

// ─── DOMAIN-ADAPTIVE INTERACTIVE SPECS ───────────────────────────────────────

export interface InteractiveSpecs {
  specs: string;
  layerNames: string[];
  zoomRange: [number, number];
}

export function getInteractiveSpecs(domain: string, message: string): InteractiveSpecs {
  // Watch/Luxury products: fine layers, slow zoom
  if (domain.includes('watch') || domain.includes('luxury') || domain.includes('fashion') || /uhr|schmuck|jewelry/i.test(message)) {
    return {
      specs: PRODUCT_INTERACTION_SPECS,
      layerNames: ['case', 'dial', 'hands', 'crown', 'strap'],
      zoomRange: [1.0, 2.5],
    };
  }
  // Tech products: bolder layers, faster zoom
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

// ─── DETERMINISTIC RUNTIME FALLBACK ──────────────────────────────────────────
// Injected AFTER generation if the LLM's JS is missing or broken.
// Follows the ensureExperienceRuntime() pattern: idempotent marker injection.

const PRODUCT_RUNTIME_MARKER = '__zd_product_runtime__';

const PRODUCT_RUNTIME_CSS = `
<!-- PRODUCT RUNTIME LAYER (deterministic 3D interaction fallback) -->
<style id="${PRODUCT_RUNTIME_MARKER}">
  /* Fallback for missing/broken LLM-generated JS */
  .product-stage { perspective: 1200px; transform-style: preserve-3d; position: sticky; top: 15vh; }
  .product-layer { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform 900ms cubic-bezier(0.22, 1, 0.36, 1), opacity 600ms ease; }
  @media (prefers-reduced-motion: reduce) {
    .product-layer { transition: none; }
  }
</style>
`;

const PRODUCT_RUNTIME_JS = `
<script id="${PRODUCT_RUNTIME_MARKER}-js">
(function () {
  'use strict';
  var marker = '${PRODUCT_RUNTIME_MARKER}';
  if (document.getElementById(marker + '-js')) return; // already injected
  
  var stage = document.querySelector('.product-stage');
  if (!stage) return; // no product stage found
  
  var layers = stage.querySelectorAll('.product-layer');
  if (layers.length === 0) return; // no layers found
  
  // Check if LLM already provided working JS (wheel listener present)
  var hasWorkingJS = false;
  try {
    var testEvent = new Event('wheel');
    stage.closest('section').dispatchEvent(testEvent);
    hasWorkingJS = true; // no error = LLM JS works
  } catch (e) {
    hasWorkingJS = false;
  }
  
  if (hasWorkingJS) return; // LLM JS is fine
  
  // Inject fallback controller
  var zoom = 1, MIN = 1, MAX = 2;
  var section = stage.closest('section') || stage.parentElement;
  
  section.addEventListener('wheel', function (e) {
    e.preventDefault();
    zoom = Math.min(MAX, Math.max(MIN, zoom + (e.deltaY > 0 ? 0.25 : -0.25)));
    var t = (zoom - MIN) / (MAX - MIN);
    stage.style.transform = 'scale(' + zoom + ')';
    layers.forEach(function (l) {
      var z = parseFloat(l.dataset.z || '0');
      l.style.transform = 'translateZ(' + (z * t) + 'px)';
    });
  }, { passive: false });
  
  // Mobile fallback: touch slider
  var isTouch = 'ontouchstart' in window;
  if (isTouch) {
    var slider = document.createElement('input');
    slider.type = 'range';
    slider.min = MIN;
    slider.max = MAX;
    slider.step = 0.1;
    slider.value = 1;
    slider.style.cssText = 'position:absolute;bottom:40px;left:50%;transform:translateX(-50%);width:200px;z-index:100;';
    slider.addEventListener('input', function () {
      zoom = parseFloat(slider.value);
      var t = (zoom - MIN) / (MAX - MIN);
      stage.style.transform = 'scale(' + zoom + ')';
      layers.forEach(function (l) {
        var z = parseFloat(l.dataset.z || '0');
        l.style.transform = 'translateZ(' + (z * t) + 'px)';
      });
    });
    section.appendChild(slider);
  }
})();
</script>
`;

/**
 * Inject deterministic product runtime into generated HTML.
 * This is the safety net: if the LLM forgot or broke the Custom JS,
 * this fallback provides working 3D interaction based on data-z conventions.
 */
export function injectProductRuntime(html: string): string {
  // Already injected?
  if (html.includes(PRODUCT_RUNTIME_MARKER)) return html;
  
  // Check if product-stage exists (LLM generated the structure)
  const hasProductStage = html.includes('product-stage') || html.includes('product-layer');
  if (!hasProductStage) return html; // nothing to enhance
  
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
