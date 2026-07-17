/** Retry einzelner Tests — nutzt bestehenden OUT_DIR aus argv oder env */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.argv[2] || join(__dirname, '..', '..', 'showcase', 'test-runs', '2026-07-15-10-54-35');
const BASE = 'http://localhost:3020';

const RETRY = [
  {
    id: 'thai-food',
    name: 'Thai Street Food Imbiss',
    prompt:
      'Designe eine Premium-Mini-App für „Siam Soul Kitchen" — authentischer Thai-Street-Food-Imbiss in Berlin-Kreuzberg. App-Shell mit Views: Start, Speisekarte, Geschichte, Kontakt. Keine Scroll-Landingpage. Warme Neon-Akzente, dampfende Pad-Thai-Fotos, editorial asymmetrisch.',
  },
  {
    id: 'saas-analytics',
    name: 'SaaS Analytics',
    prompt:
      'Mini-App für „PulseMetrics" — B2B Analytics-Dashboard für E-Commerce. Views: Produkt, Features, Pricing, Demo. Dark-Mode, Glassmorphism, Datenvisualisierung als Hero, klare SaaS-Hierarchie. Multi-View App-Shell.',
  },
];

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

async function runTest(test) {
  const trace = [];
  const { project } = await api('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ name: `Retry ${test.name}`, type: 'LANDING_PAGE' }),
  });
  const started = Date.now();
  const res = await fetch(`${BASE}/api/design/agent/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: test.prompt,
      projectId: project.id,
      skipVision: true,
      maxTheaterRounds: 1,
      creativeMode: true,
    }),
  });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let complete = null;
  let error = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    for (const block of buf.split('\n\n')) {
      if (!block.includes('data:')) continue;
      for (const line of block.split('\n')) {
        if (!line.startsWith('data:')) continue;
        try {
          const f = JSON.parse(line.slice(5).trim());
          if (f.step && f.step !== 'complete') {
            trace.push({ step: f.step, label: f.label, detail: f.detail });
            console.log(`[${test.id}] ${f.step}: ${f.label}`);
          }
          if (f.step === 'complete') complete = f;
          if (f.step === 'error') error = f.message;
        } catch {}
      }
    }
    buf = buf.split('\n\n').pop() || '';
  }
  if (error) throw new Error(error);
  if (!complete?.html) throw new Error('no html');
  return {
    ok: true,
    trace,
    elapsed: ((Date.now() - started) / 1000).toFixed(1),
    html: complete.html,
    composite: complete.scores?.composite ?? null,
    multiPass: trace.some((t) => t.step === 'multi-pass-done'),
  };
}

// rebuild index from report + files
function rebuildIndex(results) {
  const cards = results
    .map((r) => {
      const iframe = r.ok
        ? `<iframe src="${r.id}.html" title="${r.name}"></iframe>`
        : `<pre class="err">${r.error}</pre>`;
      return `<article class="card ${r.ok ? 'ok' : 'fail'}"><h2>${r.ok ? '✓' : '✗'} ${r.name}</h2>
<p class="meta">${r.elapsed}s · Score ${r.composite ?? '—'} · ${(r.htmlSize / 1024).toFixed(1)} KB</p>
<p class="prompt">${r.prompt}</p>${iframe}
<details><summary>Trace</summary><pre>${JSON.stringify(r.trace || [], null, 2)}</pre></details></article>`;
    })
    .join('');
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Z.Design Tests</title>
<style>body{font-family:system-ui;background:#0f1115;color:#eee;padding:2rem}.card{background:#1a1d24;border:1px solid #333;border-radius:12px;padding:1rem;margin-bottom:1.5rem}
iframe{width:100%;height:480px;border:0;border-radius:8px;margin-top:1rem;background:#fff}pre{font-size:11px;overflow:auto;max-height:200px}</style></head>
<body><h1>Z.Design — Test-Galerie (aktualisiert)</h1><div>${cards}</div></body></html>`;
}

const reportPath = join(OUT_DIR, 'report.json');
const report = JSON.parse(readFileSync(reportPath, 'utf8'));

for (const test of RETRY) {
  console.log(`\nRetry: ${test.name}`);
  try {
    const r = await runTest(test);
    writeFileSync(join(OUT_DIR, `${test.id}.html`), r.html);
    writeFileSync(join(OUT_DIR, `${test.id}-trace.json`), JSON.stringify(r.trace, null, 2));
    const idx = report.results.findIndex((x) => x.id === test.id);
    const entry = {
      id: test.id,
      name: test.name,
      ok: true,
      elapsed: r.elapsed,
      composite: r.composite,
      multiPass: r.multiPass,
      htmlSize: r.html.length,
      error: null,
      prompt: test.prompt,
      trace: r.trace,
    };
    if (idx >= 0) report.results[idx] = entry;
    else report.results.push(entry);
    console.log(`✓ ${r.elapsed}s composite ${r.composite}`);
  } catch (e) {
    console.error('✗', e.message);
    const idx = report.results.findIndex((x) => x.id === test.id);
    if (idx >= 0) {
      report.results[idx].error = e.message;
      report.results[idx].ok = false;
    }
  }
}

// merge architektur prompt for index
for (const r of report.results) {
  if (!r.prompt) {
    if (r.id === 'architektur-studio') {
      r.prompt = 'Atelier Lichteck Architektur Mini-App';
      if (existsSync(join(OUT_DIR, 'architektur-studio-trace.json')))
        r.trace = JSON.parse(readFileSync(join(OUT_DIR, 'architektur-studio-trace.json'), 'utf8'));
    }
  }
}

writeFileSync(reportPath, JSON.stringify(report, null, 2));
writeFileSync(join(OUT_DIR, 'index.html'), rebuildIndex(report.results));
console.log(`\nGalerie: file:///${OUT_DIR.replace(/\\/g, '/')}/index.html`);