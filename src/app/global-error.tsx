'use client';

import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root error boundary. Catches errors that error.tsx cannot, including errors
 * thrown by the root layout.tsx itself (providers, <html>/<body> wrappers).
 *
 * MUST render its own <html> and <body> tags — the root layout is unavailable
 * when this boundary activates. MUST NOT rely on global providers/context
 * (ThemeProvider, Toaster, i18n, etc.) because they live in the crashed layout.
 * Inline styles keep this fully self-contained.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('[app/global-error]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          backgroundColor: '#ffffff',
          color: '#1a1a1a',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            color: '#dc2626',
            fontSize: 28,
          }}
          aria-hidden="true"
        >
          ⚠
        </div>

        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 22, margin: '0 0 8px', fontWeight: 600 }}>
            Schwerwiegender Fehler
          </h1>
          <p style={{ fontSize: 14, color: '#666', margin: 0, wordBreak: 'break-word' }}>
            {error.message?.split('\n')[0]?.trim() ||
              'Die Anwendung konnte nicht geladen werden.'}
          </p>
          {isDev && error.digest && (
            <p
              style={{
                fontSize: 12,
                color: '#999',
                fontFamily: 'monospace',
                marginTop: 8,
              }}
            >
              Digest: {error.digest}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              borderRadius: 6,
              border: 'none',
              backgroundColor: '#1a1a1a',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Erneut versuchen
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = '/';
            }}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              borderRadius: 6,
              border: '1px solid #d4d4d4',
              backgroundColor: '#ffffff',
              color: '#1a1a1a',
              cursor: 'pointer',
            }}
          >
            Zur Startseite
          </button>
        </div>
      </body>
    </html>
  );
}
