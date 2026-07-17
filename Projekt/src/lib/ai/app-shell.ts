/**
 * app-shell.ts — Multi-view SPA structure (navigation between content areas).
 *
 * Replaces the default "one long scroll landing page" with discrete views
 * switched via nav buttons — closer to a real app than a one-shot HTML dump.
 */

import type { ExperienceMode } from './pipeline-intent';
import { EXPERIENCE_STACK_PROMPT } from './experience-stack';

export const APP_SHELL_PROMPT = `
═══ APP-SHELL (BINDEND — KEINE durchscrollbare Landingpage!) ═══

Du baust eine MINI-APP in EINER HTML-Datei — NICHT eine lange Scroll-Seite von oben nach unten.

ARCHITEKTUR (exakt so):
  <body>
    <nav id="app-nav" class="app-nav"> … Buttons mit data-nav="view-xxx" … </nav>
    <main id="app-main">
      <section id="view-home" class="app-view is-active" data-od-id="view-home"> … vollständiger Inhalt … </section>
      <section id="view-…" class="app-view" hidden data-od-id="view-…"> … </section>
      (mindestens 4 Views, maximal 6)
    </main>
  </body>

PFLICHT-VIEWS (passe Namen an Brief an):
  1. view-home — Intro/Willkommen (1 Hero, kein 5-Sektionen-Block)
  2. view-catalog — Produkte/Leistungen/Rituale (eigenes Layout, nicht Kopie von home)
  3. view-story — Geschichte/Prozess/Atelier (editorial, anderes Layout als catalog)
  4. view-contact — Kontakt/Termin/CTA

NAVIGATION:
  - Feste Nav-Leiste (top oder side) mit klaren Buttons/Tabs
  - Klick wechselt View: nur EINE .app-view hat .is-active, alle anderen hidden
  - URL-Hash optional: location.hash = '#view-xxx'
  - Aktiver Tab visuell hervorgehoben (Unterstreichung, Akzentfarbe)

VERBOTEN:
  - KEINE 8+ Sektionen untereinander zum Durchscrollen
  - KEIN "alles auf einer Seite" — jeder Bereich ist eine eigene View
  - KEIN identisches 3-Spalten-Grid in jeder View

CODE-STRUKTUR (modular, kein One-Shot-Wirrwarr):
  Kommentar-Blöcke im <style>: /* === TOKENS === */ /* === NAV === */ /* === VIEWS === */ /* === COMPONENTS === */
  Eigenes <script> am Ende: View-Router + Micro-Interaktionen

Jede View: eigenes Layout, eigene Bildkomposition — nicht copy-paste.
`;

const SHELL_MARKER = '__zd_app_shell__';

const POST_PROCESS_SHELL = `
<!-- Z.Design App-Shell Runtime -->
<style id="${SHELL_MARKER}-css">
  .app-view { display: none; min-height: calc(100vh - var(--nav-h, 64px)); animation: viewIn .45s cubic-bezier(0.22,1,0.36,1); }
  .app-view.is-active { display: block; }
  @keyframes viewIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .app-nav [data-nav].is-active { color: var(--accent, var(--primary)); }
  @media (prefers-reduced-motion: reduce) { .app-view { animation: none; } }
</style>
<script id="${SHELL_MARKER}">
(function(){
  var nav = document.getElementById('app-nav') || document.querySelector('.app-nav, nav[data-app-nav]');
  var views = document.querySelectorAll('.app-view, [id^="view-"][data-od-id], section[id^="view-"]');
  if (!views.length) return;
  function show(id){
    views.forEach(function(v){
      var on = v.id === id;
      v.classList.toggle('is-active', on);
      v.hidden = !on;
    });
    if (nav) nav.querySelectorAll('[data-nav]').forEach(function(b){
      b.classList.toggle('is-active', b.getAttribute('data-nav') === id);
    });
    try { history.replaceState(null, '', '#' + id); } catch(e){}
    window.scrollTo(0, 0);
  }
  if (nav) nav.addEventListener('click', function(e){
    var btn = e.target.closest('[data-nav]');
    if (!btn) return;
    e.preventDefault();
    show(btn.getAttribute('data-nav'));
  });
  var hash = (location.hash || '').replace('#','');
  if (hash && document.getElementById(hash)) show(hash);
  else if (views[0]) show(views[0].id);
})();
</script>
`;

const DEFAULT_VIEWS = [
  { id: 'view-home', label: 'Start' },
  { id: 'view-catalog', label: 'Katalog' },
  { id: 'view-story', label: 'Story' },
  { id: 'view-contact', label: 'Kontakt' },
];

/** Inject minimal app shell when the model produced a scroll page instead. */
function scaffoldAppShell(html: string): string {
  if (/class="app-view"|id="view-home"/i.test(html)) return html;

  const sections = [...html.matchAll(/<section([^>]*)>([\s\S]*?)<\/section>/gi)];
  if (sections.length < 2) return html;

  const navButtons = DEFAULT_VIEWS.slice(0, Math.min(sections.length, 6))
    .map((v, i) => `<button type="button" data-nav="${v.id}" class="${i === 0 ? 'is-active' : ''}">${v.label}</button>`)
    .join('\n    ');

  const viewSections = sections.slice(0, 6).map((m, i) => {
    const vid = DEFAULT_VIEWS[i]?.id ?? `view-${i + 1}`;
    const attrs = m[1].replace(/\s*hidden\s*/gi, ' ');
    const active = i === 0 ? ' is-active' : '';
    const hidden = i === 0 ? '' : ' hidden';
    return `<section id="${vid}" class="app-view${active}" data-od-id="${vid}"${attrs}${hidden}>${m[2]}</section>`;
  });

  const nav = `<nav id="app-nav" class="app-nav" data-app-nav style="display:flex;gap:1rem;padding:1rem 2rem;position:sticky;top:0;z-index:100;background:var(--surface,var(--bg));border-bottom:1px solid var(--border,color-mix(in oklch,currentColor 12%,transparent))">\n    ${navButtons}\n  </nav>`;

  if (/<main[^>]*>/i.test(html)) {
    return html.replace(/<main[^>]*>[\s\S]*<\/main>/i, `<main id="app-main">\n${viewSections.join('\n')}\n</main>`);
  }
  return html.replace(/<body([^>]*)>/i, `<body$1>\n${nav}\n<main id="app-main">\n${viewSections.join('\n')}\n</main>`);
}

export function getExperiencePrompt(mode: ExperienceMode): string {
  return mode === 'app-shell' ? APP_SHELL_PROMPT : EXPERIENCE_STACK_PROMPT;
}

export function ensureAppShell(html: string, mode: ExperienceMode): string {
  if (mode !== 'app-shell') return html;
  if (html.includes(SHELL_MARKER)) return html;
  let result = scaffoldAppShell(html);
  if (/<\/body>/i.test(result)) {
    return result.replace(/<\/body>/i, `${POST_PROCESS_SHELL}\n</body>`);
  }
  return result + POST_PROCESS_SHELL;
}