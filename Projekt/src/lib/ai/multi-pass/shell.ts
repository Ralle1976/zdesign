// Z.Design — Multi-Pass Pipeline: shell assembly (Pass 3)
//
// App-shell runtime (view switching) + final document assembly from
// per-view sections and global CSS.

import { applyImageHarmonyCss } from '@/lib/ai/image-harmony';
import type { DesignIA, MultiPassInput } from './types';

const SHELL_RUNTIME = `
<style id="__zd_app_shell__-css">
  .app-view { display: none; min-height: calc(100vh - var(--nav-h, 64px)); animation: viewIn .45s cubic-bezier(0.22,1,0.36,1); }
  .app-view.is-active { display: block; }
  @keyframes viewIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .app-nav [data-nav].is-active { color: var(--accent, var(--primary)); }
  @media (prefers-reduced-motion: reduce) { .app-view { animation: none; } }
</style>
<script id="__zd_app_shell__">
(function(){
  var nav = document.getElementById('app-nav');
  var views = document.querySelectorAll('.app-view');
  if (!views.length) return;
  function show(id){
    views.forEach(function(v){ var on = v.id === id; v.classList.toggle('is-active', on); v.hidden = !on; });
    if (nav) nav.querySelectorAll('[data-nav]').forEach(function(b){ b.classList.toggle('is-active', b.getAttribute('data-nav') === id); });
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
</script>`;

export function assembleDocument(
  ia: DesignIA,
  viewHtml: string[],
  globalCss: string,
  input: MultiPassInput,
): string {
  const b = input.brief;
  const mode = b.experienceMode ?? 'app-shell';
  const fontsHref = b.concept?.fonts?.googleFontsHref || b.system.googleFontsHref;
  const fontLink = fontsHref
    ? `<link rel="stylesheet" href="${fontsHref}">`
    : '';

  const navButtons = ia.nav
    .map(
      (n, i) =>
        `<button type="button" data-nav="${n.id}" class="${i === 0 ? 'is-active' : ''}">${n.label}</button>`,
    )
    .join('\n    ');

  const isAppShell = mode === 'app-shell';
  const nav = isAppShell
    ? `<nav id="app-nav" class="app-nav" data-app-nav style="display:flex;gap:1rem;padding:1rem 2rem;position:sticky;top:0;z-index:100;background:var(--surface,var(--bg));border-bottom:1px solid var(--border,color-mix(in oklch,currentColor 12%,transparent))">\n    ${navButtons}\n  </nav>`
    : '';

  const mainContent = viewHtml.join('\n');
  const runtime = isAppShell ? SHELL_RUNTIME : '';

  const doc = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${ia.title}</title>
  ${fontLink}
  <style>
${globalCss}
  </style>
</head>
<body>
  ${nav}
  <main id="app-main">
${mainContent}
  </main>
${runtime}
</body>
</html>`;

  return applyImageHarmonyCss(doc, b.palette);
}
