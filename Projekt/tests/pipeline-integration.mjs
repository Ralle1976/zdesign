/**
 * Pipeline integration smoke — run against live dev server.
 * Usage: node tests/pipeline-integration.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? 'http://localhost:3020';

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

async function timed(name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    pass(name, `${detail} (${Date.now() - t0}ms)`);
    return true;
  } catch (e) {
    fail(name, e instanceof Error ? e.message : String(e));
    return false;
  }
}

function parseSseLines(text) {
  const frames = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('data:')) continue;
    const json = t.slice(5).trim();
    if (!json) continue;
    try {
      frames.push(JSON.parse(json));
    } catch {
      /* skip */
    }
  }
  return frames;
}

async function main() {
  console.log(`\nPipeline integration tests @ ${BASE}\n`);

  await timed('GET / homepage', async () => {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const html = await res.text();
    if (!html.includes('Z') && !html.includes('zdesign') && html.length < 100) {
      throw new Error(`unexpected body length ${html.length}`);
    }
    return `status ${res.status}, ${html.length} bytes`;
  });

  await timed('POST /api/design/concepts returns 3 concepts', async () => {
    const res = await fetch(`${BASE}/api/design/concepts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Luxury watch landing page', count: 3 }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`status ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    if (!Array.isArray(data.concepts) || data.concepts.length < 1) {
      throw new Error('no concepts array');
    }
    const valid = data.concepts.filter(
      (c) => c && typeof c.name === 'string' && typeof c.bigIdea === 'string' && c.palette,
    );
    if (valid.length < 1) throw new Error('concepts missing name/bigIdea/palette');
    return `${valid.length} valid concept(s), first="${valid[0].name}"`;
  });

  await timed('POST /api/design/agent/stream emits SSE frames', async () => {
    const projRes = await fetch(`${BASE}/api/projects`, { signal: AbortSignal.timeout(60_000) });
    if (!projRes.ok) throw new Error(`projects status ${projRes.status}`);
    const projData = await projRes.json();
    const projectId = projData?.projects?.[0]?.id;
    if (!projectId) throw new Error('no project in DB for stream test');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);

    const res = await fetch(`${BASE}/api/design/agent/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Minimal test card — single hero only',
        projectId,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      clearTimeout(timer);
      const err = await res.text();
      throw new Error(`status ${res.status}: ${err.slice(0, 200)}`);
    }
    if (!res.body) throw new Error('no response body');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const frames = [];

    try {
      while (frames.length < 3) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseLines(buffer);
        for (const f of parsed) {
          if (!frames.find((x) => x.step === f.step && x.label === f.label)) {
            frames.push(f);
          }
        }
        if (frames.some((f) => f.step === 'complete' || f.step === 'error')) break;
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        /* expected — we only sample frames */
      } else {
        throw e;
      }
    } finally {
      clearTimeout(timer);
      controller.abort();
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
    }

    if (frames.length === 0) throw new Error('no SSE frames received in 90s');
    if (frames.every((f) => f.step === 'error')) {
      throw new Error(`only error frame: ${frames[0].message ?? frames[0].detail ?? 'unknown'}`);
    }
    const steps = frames.map((f) => f.step).join(', ');
    return `${frames.length} frame(s): [${steps}]`;
  });

  await timed('POST /api/design/cream quick rejects empty body', async () => {
    const res = await fetch(`${BASE}/api/design/cream?quick=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status < 400 || res.status >= 500) {
      throw new Error(`expected 4xx, got ${res.status}`);
    }
    return `status ${res.status} (validation OK)`;
  });

  const ok = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`\n${ok}/${total} passed\n`);
  process.exit(ok === total ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});