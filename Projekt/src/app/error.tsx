'use client';

import { useEffect } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

interface NextErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Next.js App Router error boundary for the root route segment.
 * Catches errors thrown during render/streaming of pages under src/app.
 * (Does NOT catch errors in layout.tsx — global-error.tsx handles those.)
 */
export default function Error({ error, reset }: NextErrorProps) {
  useEffect(() => {
    console.error('[app/error]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  const isDev = process.env.NODE_ENV !== 'production';
  const message = error.message?.split('\n')[0]?.trim();

  return (
    <main
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground"
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-8" aria-hidden="true" />
      </div>

      <div className="space-y-2 max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">
          Unerwarteter Fehler
        </h1>
        <p className="text-sm text-muted-foreground break-words">
          {message || 'Es ist ein unerwarteter Fehler aufgetreten.'}
        </p>
        {isDev && error.digest && (
          <p className="text-xs text-muted-foreground/70 font-mono">
            Digest: {error.digest}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Erneut versuchen
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.href = '/';
          }}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Home className="size-4" aria-hidden="true" />
          Zur Startseite
        </button>
      </div>
    </main>
  );
}
