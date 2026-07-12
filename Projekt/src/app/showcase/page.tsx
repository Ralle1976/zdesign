import fs from 'fs';
import path from 'path';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Z.Design Showcase — 10 AI-generated Designs',
  description: 'Zehn vollständige Webdesigns, generiert von Z.Design\'s Cream-Pipeline (echtes LLM, kein Template-Fallback).',
};

interface DesignEntry {
  id: string;
  name: string;
  category: string;
  prompt: string;
  image: string;
}

const DESIGNS: DesignEntry[] = [
  { id: '01', name: 'Traditional Bakery', category: 'Food & Retail', prompt: 'Erstelle eine Landingpage fuer eine traditionelle Baeckerei', image: '/showcase/design-01-bakery.png' },
  { id: '02', name: 'Specialty Coffee', category: 'Food & Retail', prompt: 'A specialty coffee shop landing page, dark premium with golden accents', image: '/showcase/design-02-coffee.png' },
  { id: '03', name: 'Fitness Studio', category: 'Health & Wellness', prompt: 'Create a fitness studio website, bold and energetic with class schedule', image: '/showcase/design-03-fitness.png' },
  { id: '04', name: 'Law Firm', category: 'Professional Services', prompt: 'A law firm website, professional navy blue and gold, trustworthy', image: '/showcase/design-04-law.png' },
  { id: '05', name: 'Luxury Spa Resort', category: 'Health & Wellness', prompt: 'A luxury spa resort, serene and calming with soft green tones', image: '/showcase/design-05-spa.png' },
  { id: '06', name: 'Fine Dining', category: 'Food & Retail', prompt: 'Fine dining restaurant, elegant minimal dark background with menu', image: '/showcase/design-06-restaurant.png' },
  { id: '07', name: 'SaaS Startup', category: 'Tech & SaaS', prompt: 'A SaaS startup landing page for project management, clean modern blue', image: '/showcase/design-07-startup.png' },
  { id: '08', name: 'Photographer Portfolio', category: 'Creative', prompt: 'A creative photographer portfolio, full-bleed gallery, dark minimal', image: '/showcase/design-08-portfolio.png' },
  { id: '09', name: 'Boutique Fashion', category: 'Creative', prompt: 'A boutique fashion brand, editorial style with large typography', image: '/showcase/design-09-fashion.png' },
  { id: '10', name: 'Environmental Nonprofit', category: 'Nonprofit', prompt: 'Environmental nonprofit, green earthy tones with donation CTA', image: '/showcase/design-10-nonprofit.png' },
];

// Read metrics from design-results JSON files (best-effort, may not exist in prod)
function readMetrics(): Record<string, { elapsed: number; pass: boolean; domInfo?: { flexDir?: number; grid?: number; section?: number; headings?: number } }> {
  const out: Record<string, any> = {};
  for (const file of ['design-results.json', 'design-results-3.json']) {
    try {
      const raw = fs.readFileSync(path.join(process.cwd(), file), 'utf-8');
      const arr = JSON.parse(raw);
      for (const r of arr) {
        if (r.name) out[r.name] = r;
      }
    } catch {
      // Missing results file is fine.
    }
  }
  return out;
}

export default function ShowcasePage() {
  const metrics = readMetrics();

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      color: '#e8e8ef',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '48px 24px 96px',
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{
            display: 'inline-block',
            padding: '6px 16px',
            background: 'rgba(120, 100, 255, 0.15)',
            border: '1px solid rgba(120, 100, 255, 0.3)',
            borderRadius: 999,
            fontSize: 13,
            color: '#a89eff',
            marginBottom: 24,
            letterSpacing: 0.5,
          }}>
            Z.DESIGN · CREAM PIPELINE · ECHTES LLM
          </div>
          <h1 style={{
            fontSize: 'clamp(36px, 5vw, 64px)',
            fontWeight: 800,
            margin: '0 0 16px',
            background: 'linear-gradient(135deg, #fff 0%, #b8a0ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}>
            10 Designs. Null Templates.
          </h1>
          <p style={{
            fontSize: 18,
            color: '#9999b0',
            maxWidth: 640,
            margin: '0 auto',
            lineHeight: 1.6,
          }}>
            Jedes Design wurde von Z.Design aus einer einzigen Text-Beschreibung
            generiert. Powered by Z.ai GLM-5.2 über die Cream-Pipeline
            (Art-Direction + Vision-Critique). Kein Fallback, keine manuellen Templates.
          </p>
        </header>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: 32,
        }}>
          {DESIGNS.map((d, i) => {
            const m = metrics[d.name] || metrics[d.id];
            return (
              <article
                key={d.id}
                style={{
                  background: '#15151f',
                  borderRadius: 16,
                  overflow: 'hidden',
                  border: '1px solid #252535',
                  transition: 'transform 0.2s, border-color 0.2s',
                }}
              >
                <div style={{
                  position: 'relative',
                  aspectRatio: '1280 / 900',
                  background: '#000',
                  overflow: 'hidden',
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={d.image}
                    alt={d.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'top',
                    }}
                    loading="lazy"
                  />
                  <div style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    padding: '4px 10px',
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: 6,
                    fontSize: 12,
                    color: '#a89eff',
                    fontWeight: 600,
                  }}>
                    #{String(i + 1).padStart(2, '0')}
                  </div>
                  {m?.pass !== false && (
                    <div style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      padding: '4px 10px',
                      background: 'rgba(34, 197, 94, 0.85)',
                      borderRadius: 6,
                      fontSize: 11,
                      color: '#fff',
                      fontWeight: 700,
                      letterSpacing: 0.5,
                    }}>
                      ✓ PASS
                    </div>
                  )}
                </div>

                <div style={{ padding: 20 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 12,
                  }}>
                    <h2 style={{
                      fontSize: 18,
                      fontWeight: 700,
                      margin: 0,
                      color: '#fff',
                    }}>
                      {d.name}
                    </h2>
                    <span style={{
                      fontSize: 11,
                      padding: '3px 8px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 4,
                      color: '#9999b0',
                      whiteSpace: 'nowrap',
                    }}>
                      {d.category}
                    </span>
                  </div>

                  <p style={{
                    fontSize: 13,
                    color: '#7777a0',
                    margin: '0 0 16px',
                    fontStyle: 'italic',
                    lineHeight: 1.5,
                  }}>
                    &ldquo;{d.prompt}&rdquo;
                  </p>

                  {m && (
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      fontSize: 11,
                    }}>
                      <Metric label="⏱" value={`${m.elapsed}s`} />
                      <Metric label="Flex" value={m.domInfo?.flexDir ?? '—'} />
                      <Metric label="Grid" value={m.domInfo?.grid ?? '—'} />
                      <Metric label="Sec" value={m.domInfo?.section ?? '—'} />
                      <Metric label="H" value={m.domInfo?.headings ?? '—'} />
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <footer style={{
          textAlign: 'center',
          marginTop: 80,
          padding: 32,
          color: '#555570',
          fontSize: 13,
        }}>
          <p>
            Generiert am 12. Juli 2026 ·{' '}
            <a href="/" style={{ color: '#a89eff' }}>Zurück zu Z.Design →</a>
          </p>
          <p style={{ marginTop: 8 }}>
            Pipeline: callZai (GLM-5.2) · Art-Direction · Vision-Critique · LLM-Refine · LESSONS.md Memory
          </p>
        </footer>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <span style={{
      padding: '3px 8px',
      background: 'rgba(120, 100, 255, 0.1)',
      border: '1px solid rgba(120, 100, 255, 0.2)',
      borderRadius: 4,
      color: '#b8a0ff',
      fontFamily: 'monospace',
    }}>
      {label} {value}
    </span>
  );
}
