/**
 * experience-stack.ts — CDN stack + post-process runtime for living HTML experiences.
 *
 * Generated designs felt "dead" because (a) the canvas iframe blocked scripts and
 * (b) prompts forbade frameworks. This module defines the allowed CDN stack,
 * model-facing experience duties, and a deterministic JS runtime injected after
 * generation so scroll-reveals and micro-interactions work even when the LLM
 * forgets to wire them up.
 */

/** Model-facing block: experiential requirements (German). */
export const EXPERIENCE_STACK_PROMPT = `
═══ ERLEBNIS-STACK (BINDEND — interaktives Erlebnis, KEINE tote Template-Seite) ═══

Du baust ein SCROLL-ERLEBNIS wie eine Awwwards-Site — nicht eine statische One-Page mit 3 Karten.

CDN-LIBRARIES (via <script src> im <head> oder vor </body> — kein npm, kein Build):
  GSAP 3 + ScrollTrigger (empfohlen für Choreografie):
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>
  ODER natives CSS scroll-driven (@supports animation-timeline: view()) + vanilla JS.

PFLICHT — mindestens 5 dieser Interaktionen umsetzen:
  1. SCROLL-REVEAL: jede Sektion erscheint beim Scrollen (opacity 0→1, translateY 32→0)
  2. HERO-BEWEGUNG: mindestens 1 animiertes Element (floating product, gradient drift, text mask reveal)
  3. HOVER-LEBEN: Bilder scale(1.03-1.06), Cards bekommen Glow/Schatten bei hover
  4. STICKY-CHOREOGRAFIE: mindestens 1 sticky-panel (Bild bleibt, Text scrollt) ODER horizontal-scroll-moment
  5. CTA-MICRO: Buttons mit background-shift, underline-grow oder magnetic hover
  6. SCROLL-PROGRESS: dünne Fortschrittslinie oben (scaleX via scroll listener) oder Section-Dots
  7. PARALLAX-TIEFE: mindestens 1 Element mit langsamerer Scroll-Geschwindigkeit

NARRATIVE STRUKTUR (NICHT Template!):
  KEINE generische "Hero → 3 Features → Pricing → Footer" Kette.
  Stattdessen 5-7 SZENEN wie ein Film:
    scene-intro · scene-discovery · scene-ritual · scene-material · scene-voice · scene-invitation
  Jede <section> MUSS data-od-id="scene-..." tragen (für Verfeinerung im Canvas).
  Mindestens 1 WOW-Szene: full-bleed Bild, oversized Typo, oder unerwartetes asymmetrisches Layout.

GSAP-SNIPPET (wenn GSAP geladen — nutze dieses Muster):
  gsap.registerPlugin(ScrollTrigger);
  gsap.utils.toArray('[data-reveal]').forEach(el => {
    gsap.from(el, { y: 48, opacity: 0, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' }
    });
  });

CSS-FALLBACK (wenn kein GSAP):
  .reveal { opacity:0; transform:translateY(40px); transition: opacity .9s cubic-bezier(.22,1,.36,1), transform .9s cubic-bezier(.22,1,.36,1); }
  .reveal.is-visible { opacity:1; transform:translateY(0); }

prefers-reduced-motion: @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
`;

const RUNTIME_MARKER = '__zd_experience_runtime__';

const POST_PROCESS_EXPERIENCE = `
<!-- Z.Design Experience Runtime (deterministic interactivity floor) -->
<style id="${RUNTIME_MARKER}-css">
  [data-reveal]:not(.is-visible) { opacity: 0; transform: translateY(40px); }
  [data-reveal].is-visible { opacity: 1; transform: translateY(0); transition: opacity 0.9s cubic-bezier(0.22,1,0.36,1), transform 0.9s cubic-bezier(0.22,1,0.36,1); }
  #zd-scroll-progress { position: fixed; top: 0; left: 0; height: 2px; width: 100%; transform-origin: left; transform: scaleX(0); background: var(--accent, var(--primary, #c9a962)); z-index: 10000; pointer-events: none; }
  @media (prefers-reduced-motion: reduce) {
    [data-reveal] { opacity: 1 !important; transform: none !important; transition: none !important; }
    #zd-scroll-progress { display: none; }
  }
</style>
<div id="zd-scroll-progress" aria-hidden="true"></div>
<script id="${RUNTIME_MARKER}">
(function(){
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var bar = document.getElementById('zd-scroll-progress');
  function onScroll(){
    var h = document.documentElement;
    var p = h.scrollHeight - h.clientHeight;
    if (bar && p > 0) bar.style.transform = 'scaleX(' + (h.scrollTop / p) + ')';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  var els = document.querySelectorAll('[data-reveal], section:not([data-reveal])');
  els.forEach(function(el, i){
    if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', '');
    if (window.gsap && window.ScrollTrigger) return;
    if (!('IntersectionObserver' in window)) { el.classList.add('is-visible'); return; }
    var obs = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add('is-visible'); obs.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    obs.observe(el);
  });
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.utils.toArray('[data-reveal]').forEach(function(el){
      gsap.from(el, { y: 48, opacity: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' }
      });
    });
  }
})();
</script>
`;

const SCENE_IDS = ['scene-intro', 'scene-discovery', 'scene-ritual', 'scene-material', 'scene-voice', 'scene-invitation', 'scene-cta'];

/** Tag sections with data-od-id when the model forgot. */
export function ensureSectionIds(html: string): string {
  let idx = 0;
  return html.replace(/<section([^>]*)>/gi, (match, attrs: string) => {
    if (/data-od-id\s*=/i.test(attrs)) return match;
    const id = SCENE_IDS[idx] ?? `scene-${idx + 1}`;
    idx++;
    return `<section data-od-id="${id}"${attrs}>`;
  });
}

/** Mark major blocks for scroll-reveal when absent. */
export function ensureRevealMarkers(html: string): string {
  let out = html;
  if (!out.includes('data-reveal')) {
    out = out.replace(/<section([^>]*)>/gi, (m, attrs: string) => {
      if (/data-reveal/i.test(attrs)) return m;
      return `<section data-reveal${attrs}>`;
    });
  }
  return out;
}

/**
 * Inject experience runtime (scroll progress, reveal observer, GSAP hook).
 * Idempotent — skips if already present.
 */
export function ensureExperienceRuntime(html: string): string {
  if (html.includes(RUNTIME_MARKER)) return html;
  let result = ensureSectionIds(html);
  result = ensureRevealMarkers(result);
  if (/<\/body>/i.test(result)) {
    return result.replace(/<\/body>/i, `${POST_PROCESS_EXPERIENCE}\n</body>`);
  }
  if (/<\/html>/i.test(result)) {
    return result.replace(/<\/html>/i, `${POST_PROCESS_EXPERIENCE}\n</html>`);
  }
  return result + POST_PROCESS_EXPERIENCE;
}