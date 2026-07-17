/**
 * Sichtbare Multi-Pass Design-Tests für Z.Design.
 * Speichert HTML + Trace + Report unter showcase/test-runs/<timestamp>/
 *
 * Run: node scripts/run-visible-design-tests.mjs
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.ZDESIGN_URL || 'http://localhost:3020';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const RUN_ID = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const OUT_DIR = join(ROOT, 'showcase', 'test-runs', RUN_ID);

const TESTS = [
  {
    id: 'thai-food',
    name: 'Thai Street Food Imbiss',
    prompt:
      'Designe eine Premium-Mini-App für „Siam Soul Kitchen" — authentischer Thai-Street-Food-Imbiss in Berlin-Kreuzberg. App-Shell mit Views: Start, Speisekarte, Geschichte, Kontakt. Keine Scroll-Landingpage. Warme Neon-Akzente, dampfende Pad-Thai-Fotos, editorial asymmetrisch.',
  },
  {
    id: 'architektur-studio',
    name: 'Architektur-Atelier',
    prompt:
      'Mini-App für „Atelier Lichteck" — Boutique-Architekturbüro für nachhaltigen Holzbau in den Alpen. Views: Projekte, Prozess, Team, Anfrage. Brutalist-editorial, Beton-Texturen, großformatige Architekturfotos, ruhige Typografie. App-Navigation, nicht eine lange Seite.',
  },
  {
    id: 'saas-analytics',
    name: 'SaaS Analytics',
    prompt:
      'Mini-App für „PulseMetrics" — B2B Analytics-Dashboard für E-Commerce. Views: Produkt, Features, Pricing, Demo. Dark-Mode, Glassmorphism, Datenvisualisierung als Hero, klare SaaS-Hierarchie. Multi-View App-Shell.',
  },
];

function slug(s) {
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${text.slice(0, 300)}`);
  return json;
}

async function createProject(name) {
  const { project } = await api('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ name, type: 'LANDING_PAGE', description: `Visible test ${RUN_ID}` }),
  });
  return project.id;
}

async function consumeSSE(projectId, message, testId) {
  const trace = [];
  const started = Date.now();
  let complete = null;
  let error = null;

  const res = await fetch(`${BASE}/api/design/agent/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      message,
      projectId,
      skipVision: true,
      maxTheaterRounds: 1,
      creativeMode: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`stream ${res.status}: ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const block of parts) {
      for (const line of block.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        try {
          const frame = JSON.parse(payload);
          if (frame.step && frame.step !== 'complete' && frame.step !== 'error') {
            trace.push({
              step: frame.step,
              label: frame.label,
              detail: frame.detail,
              composite: frame.composite,
            });
            process.stdout.write(
              `  [${testId}] ${frame.step}: ${frame.label}${frame.detail ? ` — ${String(frame.detail).slice(0, 60)}` : ''}\n`,
            );
          }
          if (frame.step === 'complete') complete = frame;
          if (frame.step === 'error') error = frame.message || frame.label;
        } catch {
          /* partial */
        }
      }
    }
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  if (error) throw new Error(error);
  if (!complete?.html) throw new Error('Kein complete-Frame mit HTML');

  return { complete, trace, elapsed };
}

function buildIndex(results) {
  const cards = results
    .map((r) => {
      const status = r.ok ? '✓' : '✗';
      const score = r.composite != null ? r.composite.toFixed(1) : '—';
      const steps = r.multiPass
        ? r.trace.filter((t) => /ia-|images-first|view-|assemble|multi-pass/.test(t.step)).length
        : 0;
      return `
      <article class="card ${r.ok ? 'ok' : 'fail'}">
        <h2>${status} ${r.name}</h2>
        <p class="meta">${r.elapsed}s · Score ${score}/10 · ${(r.htmlSize / 1024).toFixed(1)} KB · Multi-Pass-Schritte: ${steps}</p>
        <p class="prompt">${r.prompt}</p>
        ${r.ok ? `<iframe src="${r.id}.html" title="${r.name}"></iframe>` : `<pre class="err">${r.error}</pre>`}
        <details><summary>Agent-Trace (${r.trace.length} Schritte)</summary><pre>${JSON.stringify(r.trace, null, 2)}</pre></details>
      </article>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Z.Design Multi-Pass Tests — ${RUN_ID}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; background: #0f1115; color: #e8eaed; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .sub { color: #9aa0a6; margin-bottom: 2rem; }
    .grid { display: grid; gap: 2rem; }
    .card { background: #1a1d24; border: 1px solid #2d323c; border-radius: 12px; padding: 1.25rem; }
    .card.fail { border-color: #8b3a3a; }
    .card.ok { border-color: #2d5a3d; }
    .meta { font-size: 0.85rem; color: #9aa0a6; }
    .prompt { font-size: 0.9rem; line-height: 1.5; color: #c4c7cc; }
    iframe { width: 100%; height: 520px; border: 1px solid #333; border-radius: 8px; margin-top: 1rem; background: #fff; }
    pre { font-size: 0.75rem; overflow: auto; max-height: 240px; background: #0a0c10; padding: 0.75rem; border-radius: 6px; }
    .err { color: #f28b82; }
    details { margin-top: 0.75rem; }
  </style>
</head>
<body>
  <h1>Z.Design — Sichtbare Multi-Pass Tests</h1>
  <p class="sub">Run ${RUN_ID} · <a href="http://localhost:3020" style="color:#8ab4f8">App öffnen</a></p>
  <div class="grid">${cards}</div>
</body>
</html>`;
}

async function main() {
  console.log(`\n=== Z.Design Visible Tests ===`);
  console.log(`Server: ${BASE}`);
  console.log(`Output: ${OUT_DIR}\n`);

  mkdirSync(OUT_DIR, { recursive: true });

  // Smoke APIs
  const learning = await api('/api/design/learning');
  writeFileSync(join(OUT_DIR, 'learning-snapshot.json'), JSON.stringify(learning, null, 2));
  console.log(`Learning API: ${learning.recipes?.total ?? 0} Rezepte, LESSONS ${learning.lessons?.lineCount ?? 0} Zeilen\n`);

  const results = [];

  for (const test of TESTS) {
    console.log(`\n▶ Test: ${test.name}`);
    const result = {
      id: test.id,
      name: test.name,
      prompt: test.prompt,
      ok: false,
      trace: [],
      elapsed: '0',
      htmlSize: 0,
      composite: null,
      multiPass: false,
      error: null,
    };

    try {
      const projectId = await createProject(`Test ${test.name} ${RUN_ID}`);
      console.log(`  Projekt: ${projectId}`);
      const { complete, trace, elapsed } = await consumeSSE(projectId, test.prompt, test.id);
      result.ok = true;
      result.trace = trace;
      result.elapsed = elapsed;
      result.htmlSize = complete.html.length;
      result.composite = complete.scores?.composite ?? null;
      result.multiPass = trace.some((t) =>
        ['ia-done', 'multi-pass-done', 'assemble'].includes(t.step),
      );

      writeFileSync(join(OUT_DIR, `${test.id}.html`), complete.html, 'utf8');
      writeFileSync(join(OUT_DIR, `${test.id}-trace.json`), JSON.stringify(trace, null, 2), 'utf8');
      writeFileSync(
        join(OUT_DIR, `${test.id}-meta.json`),
        JSON.stringify(
          {
            projectId,
            composite: result.composite,
            multiPass: result.multiPass,
            elapsed,
            htmlSize: result.htmlSize,
          },
          null,
          2,
        ),
        'utf8',
      );
      console.log(`  ✓ Fertig in ${elapsed}s · ${(complete.html.length / 1024).toFixed(1)} KB · Score ${result.composite ?? '—'}`);
    } catch (e) {
      result.error = e instanceof Error ? e.message : String(e);
      console.error(`  ✗ Fehler: ${result.error}`);
    }

    results.push(result);
  }

  const indexHtml = buildIndex(results);
  writeFileSync(join(OUT_DIR, 'index.html'), indexHtml, 'utf8');

  const report = {
    runId: RUN_ID,
    base: BASE,
    outDir: OUT_DIR,
    results: results.map((r) => ({
      id: r.id,
      name: r.name,
      ok: r.ok,
      elapsed: r.elapsed,
      composite: r.composite,
      multiPass: r.multiPass,
      htmlSize: r.htmlSize,
      error: r.error,
      keySteps: r.trace
        .filter((t) => /ia-|images-first|view-|assemble|multi-pass|generate/.test(t.step))
        .map((t) => t.step),
    })),
  };
  writeFileSync(join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf8');

  console.log(`\n=== FERTIG ===`);
  console.log(`Galerie: file:///${OUT_DIR.replace(/\\/g, '/')}/index.html`);
  console.log(`Report:  ${join(OUT_DIR, 'report.json')}`);
  const ok = results.filter((r) => r.ok).length;
  console.log(`Ergebnis: ${ok}/${results.length} erfolgreich\n`);

  process.exit(ok === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});