'use client';

// Z.Design — HTML Artifact preview.
//
// Renders a complete, art-directed HTML document (produced by the agentic
// /api/design/agent loop) live inside the canvas via a sandboxed iframe. This is
// the "rich medium" that lets Harmonie/Leben/Ausstrahlung be expressed — full
// HTML/CSS/JS, real fonts, real imagery — as opposed to the constrained
// DesignNode tree painted by DesignRenderer.
//
// S2 — POST-GEN SLIDERS: hue / spacing / font-scale / radius tunables that
//   inject CSS into the live iframe instantly (no regeneration). Same-origin
//   srcDoc lets us write directly to contentDocument.
// S5 — SURGICAL REFINE: click any major section (marked data-od-id) to pop a
//   small "Refine this section?" box; the instruction is POSTed to
//   /api/design/agent scoped to just that section.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useZDesignStore } from '@/stores/zdesign-store';
import type { Concept } from '@/lib/ai/skills/creative-director';

interface HtmlArtifactPreviewProps {
  html: string;
  viewport?: 'desktop' | 'tablet' | 'mobile';
  /** Concept used to seed surgical-refine calls (optional; route works without). */
  concept?: Concept;
  /** Override project id (defaults to store's current project). */
  projectId?: string;
}

const VIEWPORT_WIDTH: Record<string, number> = {
  desktop: 0, // 0 = fill container
  tablet: 768,
  mobile: 390,
};

// --- S2: slider state + defaults -------------------------------------------

interface SliderState {
  hue: number; // 0-360 deg
  spacing: number; // 0.5-2.0
  fontScale: number; // 0.8-1.4
  radius: number | null; // null = off, else 0-32 px
}

const DEFAULT_SLIDERS: SliderState = {
  hue: 0,
  spacing: 1,
  fontScale: 1,
  radius: null,
};

// Marker id for the injected <style> so we can replace (not duplicate) on change.
const OD_STYLE_ID = '__od_postgen_style__';

/** Multiply the px values inside a CSS shorthand like "12px 8px" by `f`.
 *  Non-px tokens (%, em, rem, auto, 0) are passed through untouched. */
function scaleBox(shorthand: string, f: number): string {
  if (f === 1) return shorthand;
  return shorthand
    .split(/\s+/)
    .map((tok) => {
      const m = /^(-?\d*\.?\d+)px$/.exec(tok);
      if (!m) return tok;
      const scaled = parseFloat(m[1]) * f;
      return `${Math.round(scaled * 100) / 100}px`;
    })
    .join(' ');
}

function buildInjectCss(s: SliderState): string {
  const parts: string[] = [];
  // hue-rotate on the whole document
  if (s.hue !== 0) {
    parts.push(`html { filter: hue-rotate(${s.hue}deg) !important; }`);
  }
  // font scale: rem-based scaling (most layouts size in rem/em)
  if (s.fontScale !== 1) {
    parts.push(`html { font-size: calc(16px * ${s.fontScale}) !important; }`);
  }
  // global border radius (toggle)
  if (s.radius !== null) {
    parts.push(`* { border-radius: ${s.radius}px !important; }`);
  }
  return parts.join('\n');
}

// --- S5: popover state ------------------------------------------------------

interface RefinePopover {
  sectionId: string;
  x: number; // viewport-relative px (within the preview wrapper)
  y: number;
}

export function HtmlArtifactPreview({
  html,
  viewport = 'desktop',
  concept,
  projectId,
}: HtmlArtifactPreviewProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [sliders, setSliders] = useState<SliderState>(DEFAULT_SLIDERS);
  const [showControls, setShowControls] = useState(false);
  const [popover, setPopover] = useState<RefinePopover | null>(null);
  const [refineText, setRefineText] = useState('');
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);

  const storeProjectId = useZDesignStore((s) => s.projectId);
  const setDesignHTML = useZDesignStore((s) => s.setDesignHTML);
  const effectiveProjectId = projectId ?? storeProjectId;

  // Re-mount the iframe when the HTML changes so srcDoc reliably reloads.
  const srcDoc = useMemo(() => html, [html]);

  useEffect(() => {
    setLoaded(false);
  }, [srcDoc]);

  // --- S2: inject/refresh the post-gen <style> into the live iframe --------
  // CSS-driven sliders (hue / font / radius) go through the injected <style>;
  // spacing is applied imperatively because CSS calc() can't multiply an
  // element's *existing* padding. We snapshot the original box-model values
  // (data-od-base) on first touch and re-derive from them on every change so
  // repeated edits never compound.
  const applySliders = useCallback((next: SliderState) => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!doc) return;

    // 1) CSS-driven sliders
    let el = doc.getElementById(OD_STYLE_ID);
    const css = buildInjectCss(next);
    if (!el) {
      el = doc.createElement('style');
      el.id = OD_STYLE_ID;
      if (doc.head) doc.head.appendChild(el);
      else doc.body.appendChild(el);
    }
    el.textContent = css;

    // 2) spacing scale (imperative)
    const all = doc.body?.querySelectorAll<HTMLElement>('*');
    if (!all) return;
    for (const node of all) {
      const cs = doc.defaultView;
      if (!cs) continue;
      const view = cs;
      // Snapshot baseline once.
      if (!node.dataset.odBase) {
        const st = view.getComputedStyle(node);
        node.dataset.odBase = JSON.stringify({
          p: st.padding,
          m: st.margin,
        });
      }
      let base: { p: string; m: string };
      try {
        base = JSON.parse(node.dataset.odBase!);
      } catch {
        continue;
      }
      node.style.padding = scaleBox(base.p, next.spacing);
      node.style.margin = scaleBox(base.m, next.spacing);
    }
  }, []);

  // Re-apply whenever sliders change AND the iframe is loaded.
  useEffect(() => {
    if (loaded) applySliders(sliders);
  }, [sliders, loaded, applySliders]);

  const resetSliders = useCallback(() => {
    setSliders(DEFAULT_SLIDERS);
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!doc) return;
    doc.getElementById(OD_STYLE_ID)?.remove();
    // Clear imperative spacing overrides + baseline snapshots.
    const all = doc.body?.querySelectorAll<HTMLElement>('*');
    if (all) {
      for (const node of all) {
        node.style.padding = '';
        node.style.margin = '';
        delete node.dataset.odBase;
      }
    }
  }, []);

  // --- S5: attach click handler for surgical refine ------------------------
  useEffect(() => {
    if (!loaded) return;
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    const wrap = wrapRef.current;
    if (!doc || !wrap) return;

    const handler = (e: MouseEvent) => {
      // Only react to elements carrying (or nested in) a data-od-id.
      const target = e.target as Element | null;
      if (!target || typeof target.closest !== 'function') return;
      const tagged = target.closest('[data-od-id]') as HTMLElement | null;
      if (!tagged) return;
      e.preventDefault();
      e.stopPropagation();

      const sectionId = tagged.getAttribute('data-od-id') || '';
      // Map iframe-internal coords to the wrapper's coordinate space.
      const wrapRect = wrap.getBoundingClientRect();
      const x = e.clientX - wrapRect.left;
      const y = e.clientY - wrapRect.top;
      // Clamp so the popover stays inside the wrapper.
      setRefineText('');
      setRefineError(null);
      setPopover({
        sectionId,
        x: Math.min(Math.max(x, 8), wrapRect.width - 8),
        y: Math.min(Math.max(y, 8), wrapRect.height - 8),
      });
    };

    doc.addEventListener('click', handler, true);
    return () => doc.removeEventListener('click', handler, true);
  }, [loaded]);

  const submitRefine = useCallback(async () => {
    if (!popover || !refineText.trim() || !effectiveProjectId) {
      setRefineError(
        !effectiveProjectId
          ? 'Kein Projekt ausgewählt.'
          : 'Bitte eine Anweisung eingeben.',
      );
      return;
    }
    setRefining(true);
    setRefineError(null);
    const scopedMessage =
      `Surgical refine — modify ONLY the section with data-od-id="${popover.sectionId}". ` +
      `Keep every other section byte-for-byte unchanged. ` +
      `Instruction for that section: ${refineText.trim()}`;
    try {
      const res = await fetch('/api/design/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: scopedMessage,
          projectId: effectiveProjectId,
          concept: concept ?? undefined,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { html?: string };
      if (data.html) {
        setDesignHTML(data.html);
        // Popover closes; new iframe mounts via prop change.
        setPopover(null);
      } else {
        setRefineError('Kein HTML in der Antwort.');
      }
    } catch (err) {
      setRefineError(
        err instanceof Error ? err.message : 'Refine fehlgeschlagen.',
      );
    } finally {
      setRefining(false);
    }
  }, [popover, refineText, effectiveProjectId, concept, setDesignHTML]);

  const width = VIEWPORT_WIDTH[viewport] ?? 0;
  const isFramed = width > 0;

  return (
    <div className="flex-1 min-h-0 overflow-auto bg-muted/30 grid place-items-center p-4 sm:p-8">
      <div
        ref={wrapRef}
        className="relative h-full w-full bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden transition-all"
        style={isFramed ? { maxWidth: width, width: '100%' } : { maxWidth: '100%' }}
      >
        {!loaded && (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground bg-muted/20">
            Rendere Vorschau…
          </div>
        )}
        <iframe
          ref={frameRef}
          title="Design-Vorschau"
          srcDoc={srcDoc}
          onLoad={() => setLoaded(true)}
          // sandbox: allow same-origin so the iframe can apply its <style>/<script>
          // and load Google Fonts / images; no allow-scripts from untrusted sources
          // would be safer, but generated CSS needs none and we keep allow-scripts
          // off by NOT listing it (scripts still run? sandbox defaults: without
          // allow-scripts, scripts do NOT execute — which is fine, CSS-only render).
          sandbox="allow-same-origin"
          className="absolute inset-0 h-full w-full border-0 bg-white"
        />

        {/* --- S2: post-gen controls toggle --- */}
        <button
          type="button"
          onClick={() => setShowControls((v) => !v)}
          className="absolute top-2 left-2 z-20 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white hover:bg-black/80 transition-colors"
          aria-expanded={showControls}
          title="Tuning-Slider ein/aus"
        >
          {showControls ? '× Tuning' : '⚙ Tuning'}
        </button>

        {/* --- S5: surgical-refine hint badge --- */}
        <div className="absolute bottom-2 left-2 z-20 rounded bg-black/50 px-2 py-0.5 text-[10px] text-white/80 pointer-events-none">
          Klicke einen Bereich zum Verfeinern
        </div>

        {/* --- S2: slider panel --- */}
        {showControls && (
          <div className="absolute top-9 left-2 z-30 w-60 rounded-lg border border-black/10 bg-white/95 p-3 shadow-xl backdrop-blur text-xs text-foreground space-y-3">
            <SliderRow
              label="Farbton"
              value={sliders.hue}
              min={0}
              max={360}
              step={1}
              suffix="°"
              onChange={(v) => setSliders((s) => ({ ...s, hue: v }))}
            />
            <SliderRow
              label="Abstand"
              value={sliders.spacing}
              min={0.5}
              max={2}
              step={0.05}
              suffix="×"
              onChange={(v) => setSliders((s) => ({ ...s, spacing: v }))}
            />
            <SliderRow
              label="Schrift"
              value={sliders.fontScale}
              min={0.8}
              max={1.4}
              step={0.02}
              suffix="×"
              onChange={(v) => setSliders((s) => ({ ...s, fontScale: v }))}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">Rundung</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-black"
                  checked={sliders.radius !== null}
                  onChange={(e) =>
                    setSliders((s) => ({
                      ...s,
                      radius: e.target.checked ? 8 : null,
                    }))
                  }
                />
                <span>{sliders.radius === null ? 'aus' : `${sliders.radius}px`}</span>
              </label>
            </div>
            {sliders.radius !== null && (
              <SliderRow
                label=""
                value={sliders.radius}
                min={0}
                max={32}
                step={1}
                suffix="px"
                onChange={(v) => setSliders((s) => ({ ...s, radius: v }))}
              />
            )}
            <button
              type="button"
              onClick={resetSliders}
              className="w-full rounded-md border border-black/15 py-1 font-medium hover:bg-muted transition-colors"
            >
              Zurücksetzen
            </button>
          </div>
        )}

        {/* --- S5: surgical-refine popover --- */}
        {popover && (
          <div
            className="absolute z-40 w-64 -translate-x-1/2 -translate-y-full rounded-lg border border-black/10 bg-white p-3 shadow-2xl text-xs text-foreground"
            style={{ left: popover.x, top: popover.y }}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-semibold">Bereich verfeinern</span>
              <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                {popover.sectionId}
              </code>
            </div>
            <textarea
              value={refineText}
              onChange={(e) => setRefineText(e.target.value)}
              placeholder="z.B. mehr Atemraum, wärmere Farben…"
              rows={3}
              className="w-full resize-none rounded border border-black/15 p-1.5 outline-none focus:ring-1 focus:ring-black"
              disabled={refining}
            />
            {refineError && (
              <p className="mt-1 text-[11px] text-red-600">{refineError}</p>
            )}
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPopover(null)}
                className="rounded border border-black/15 px-2 py-1 hover:bg-muted"
                disabled={refining}
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={submitRefine}
                disabled={refining || !refineText.trim()}
                className="rounded bg-black px-2 py-1 font-medium text-white hover:bg-black/80 disabled:opacity-40"
              >
                {refining ? '…' : 'Verfeinern'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- S2: small slider row helper -------------------------------------------

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}

function SliderRow({ label, value, min, max, step, suffix, onChange }: SliderRowProps) {
  return (
    <label className="block space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-black"
      />
    </label>
  );
}
