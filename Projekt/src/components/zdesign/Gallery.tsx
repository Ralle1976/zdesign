'use client';

// Z.Design — Gallery (S3).
//
// Fetches all projects (GET /api/projects) and renders them as a thumbnail
// grid. Each card shows the project name plus a small live iframe thumbnail of
// its designHTML when available; projects without HTML fall back to a palette
// swatch derived from their (JSON) design. Clicking a card opens the project
// in the canvas via setProject (+ loadDesignHTML when in HTML_ARTIFACT mode).
//
// Renders whenever designMode supports multiple projects — mounted by the
// canvas shell. Uses native fetch + manual reload (no react-query needed) to
// keep it self-contained.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useZDesignStore } from '@/stores/zdesign-store';

interface GalleryProject {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  status: string;
  designMode?: 'NODE_TREE' | 'HTML_ARTIFACT';
  designHTML?: string | null;
  designJSON?: string;
  thumbnail?: string | null;
  updatedAt?: string;
}

interface ProjectsResponse {
  projects: GalleryProject[];
  pagination?: { total: number; page: number; limit: number; totalPages: number };
}

/** Try to extract a couple of brand colors from a NODE_TREE designJSON so the
 *  swatch fallback is at least on-brand. Returns up to 4 hex/rgb strings. */
function extractSwatches(designJSON?: string): string[] {
  if (!designJSON) return ['#0ea5e9', '#0f172a'];
  try {
    const colors = new Set<string>();
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      const n = node as Record<string, unknown>;
      const style = n.style as Record<string, unknown> | undefined;
      if (style) {
        for (const k of ['backgroundColor', 'color', 'background', 'borderColor']) {
          const v = style[k];
          if (typeof v === 'string' && /^(#|rgb|hsl)/.test(v)) colors.add(v);
        }
      }
      const children = n.children;
      if (Array.isArray(children)) children.forEach(walk);
    };
    walk(JSON.parse(designJSON));
    const out = Array.from(colors).slice(0, 4);
    return out.length > 0 ? out : ['#0ea5e9', '#0f172a'];
  } catch {
    return ['#0ea5e9', '#0f172a'];
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-emerald-500/15 text-emerald-300';
    case 'IN_PROGRESS':
      return 'bg-sky-500/15 text-sky-300';
    case 'REVIEW':
      return 'bg-amber-500/15 text-amber-300';
    case 'ARCHIVED':
      return 'bg-zinc-500/15 text-zinc-400';
    default:
      return 'bg-zinc-700/40 text-zinc-300';
  }
}

/** A single thumbnail card. The iframe is sandboxed + pointer-events-none so it
 *  can't navigate or capture clicks meant for the card. */
function GalleryCard({
  project,
  onOpen,
}: {
  project: GalleryProject;
  onOpen: (p: GalleryProject) => void;
}) {
  const swatches = useMemo(
    () => (project.designHTML ? [] : extractSwatches(project.designJSON)),
    [project.designHTML, project.designJSON],
  );

  return (
    <button
      type="button"
      onClick={() => onOpen(project)}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-zinc-700/60 bg-zinc-900/60 text-left transition hover:border-sky-500/60 hover:bg-zinc-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-zinc-950">
        {project.designHTML ? (
          <iframe
            title={`preview-${project.id}`}
            srcDoc={project.designHTML}
            className="pointer-events-none h-full w-full origin-top-left"
            style={{ width: '1280px', height: '720px', transform: 'scale(0.234)' }}
            sandbox="allow-same-origin"
            loading="lazy"
            scrolling="no"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center gap-1 p-2">
            {swatches.map((c, i) => (
              <div
                key={i}
                className="h-10 w-10 rounded-md ring-1 ring-white/10"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-zinc-100">{project.name}</span>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusBadgeClass(project.status)}`}
          >
            {project.status}
          </span>
        </div>
        {project.description ? (
          <span className="line-clamp-2 text-xs text-zinc-400">{project.description}</span>
        ) : null}
        <div className="mt-auto flex items-center justify-between pt-1 text-[10px] text-zinc-500">
          <span>{project.type}</span>
          <span>{project.designMode === 'HTML_ARTIFACT' ? 'HTML' : 'Nodes'}</span>
        </div>
      </div>
    </button>
  );
}

export function Gallery() {
  const [projects, setProjects] = useState<GalleryProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setProject = useZDesignStore((s) => s.setProject);
  const loadDesignHTML = useZDesignStore((s) => s.loadDesignHTML);
  const loadDesignTree = useZDesignStore((s) => s.loadDesignTree);
  const setDesignMode = useZDesignStore((s) => s.setDesignMode);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/projects?limit=50');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ProjectsResponse;
      setProjects(data.projects ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleOpen = useCallback(
    (p: GalleryProject) => {
      // Wire the active project into the store, then load whichever design
      // payload the project carries.
      setProject(p.id, p.name, p.type as 'LANDING_PAGE');
      if (p.designMode === 'HTML_ARTIFACT' && p.designHTML) {
        setDesignMode('HTML_ARTIFACT');
        loadDesignHTML(p.designHTML);
      } else if (p.designJSON) {
        try {
          setDesignMode('NODE_TREE');
          loadDesignTree(JSON.parse(p.designJSON));
        } catch {
          // ignore malformed tree — store stays on whatever it had
        }
      }
    },
    [setProject, setDesignMode, loadDesignHTML, loadDesignTree],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-zinc-400">
        Lade Galerie…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="text-sm text-red-400">{error}</span>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-zinc-600 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-zinc-400">
        Noch keine Projekte. Generiere ein Design, um die Galerie zu füllen.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">Galerie</h2>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          Aktualisieren
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 overflow-y-auto pb-4 sm:grid-cols-3 lg:grid-cols-4">
        {projects.map((p) => (
          <GalleryCard key={p.id} project={p} onOpen={handleOpen} />
        ))}
      </div>
    </div>
  );
}

export default Gallery;
