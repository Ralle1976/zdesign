"use client";

/**
 * UserPreferencesPanel — M1: edit data/user-memory.md inline.
 *
 * A small collapsible panel. On open it fetches the current memory via
 * GET /api/user-memory, shows it in a textarea, and POSTs on Save (manual —
 * no autosave to avoid clobbering partial edits). Renders below the chat or
 * as a standalone block; self-contained, no parent wiring required.
 */

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Save, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const EMPTY_SEED = `# User Preferences

## Style
- (noch keine — wird durch Nutzung gelernt)

## Brand
- (leer)

## Avoid
- (leer)
`;

type SaveState = "idle" | "saving" | "saved";

export function UserPreferencesPanel() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user-memory", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const c: string = data?.content ?? "";
      setContent(c.length > 0 ? c : EMPTY_SEED);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }, []);

  // Lazy load the first time the panel is opened.
  useEffect(() => {
    if (open && !loaded && !loading) {
      void load();
    }
  }, [open, loaded, loading, load]);

  const handleSave = useCallback(async () => {
    setSaveState("saving");
    setError(null);
    try {
      const res = await fetch("/api/user-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveState("saved");
      // Drop the "saved" indicator after a moment.
      setTimeout(() => setSaveState("idle"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
      setSaveState("idle");
    }
  }, [content]);

  return (
    <div className="border-t border-border bg-background/60">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hover:bg-accent/40 transition-colors"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
        <span>Nutzer-Praeferenzen</span>
        <span className="ml-auto text-[10px] text-muted-foreground/70">
          data/user-memory.md
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-[11px] leading-snug text-muted-foreground">
            Diese Notiz wird bei jeder Design-Generierung als
            „NUTZER-PRAEFERENZEN“-Block in den Prompt injiziert. Trag hier Stil,
            Brand-Vorgaben und No-Gos ein.
          </p>

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
              <Loader2 className="size-3.5 animate-spin" />
              Lade…
            </div>
          ) : (
            <Textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (saveState === "saved") setSaveState("idle");
              }}
              spellCheck={false}
              className="min-h-[160px] resize-y font-mono text-xs leading-relaxed"
              placeholder={EMPTY_SEED}
            />
          )}

          {error && (
            <p className="text-[11px] text-destructive">{error}</p>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleSave}
              disabled={loading || saveState === "saving"}
              className="h-7 gap-1.5 text-xs"
            >
              {saveState === "saving" ? (
                <Loader2 className="size-3 animate-spin" />
              ) : saveState === "saved" ? (
                <Check className="size-3 text-emerald-600" />
              ) : (
                <Save className="size-3" />
              )}
              {saveState === "saving"
                ? "Speichere…"
                : saveState === "saved"
                  ? "Gespeichert"
                  : "Speichern"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void load()}
              disabled={loading}
              className="h-7 text-xs text-muted-foreground"
            >
              Neu laden
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
