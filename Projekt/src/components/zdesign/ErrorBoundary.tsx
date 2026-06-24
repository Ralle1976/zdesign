'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

export interface FallbackProps {
  error: Error;
  reset: () => void;
}

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<FallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Sanitizes an error message for user-facing display.
 * Strips stack traces and internal paths, returns a safe short message.
 */
function sanitizeErrorMessage(message: string | undefined): string {
  if (!message) return 'Ein unerwarteter Fehler ist aufgetreten.';
  // Strip anything that looks like a file path or stack frame
  const firstLine = message.split('\n')[0].trim();
  if (!firstLine) return 'Ein unerwarteter Fehler ist aufgetreten.';
  return firstLine;
}

/**
 * Default fallback UI rendered when a child component throws and no custom
 * fallback prop was supplied. User-friendly, in German, with recovery actions.
 */
export function DefaultErrorFallback({ error, reset }: FallbackProps) {
  const message = sanitizeErrorMessage(error?.message);

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-4 p-8 rounded-lg border border-destructive/30 bg-background text-foreground text-center min-h-[200px]"
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-semibold">Etwas ist schiefgelaufen</h3>
        <p className="text-sm text-muted-foreground max-w-sm break-words">
          {message}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Erneut versuchen
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Seite neu laden
        </button>
      </div>
    </div>
  );
}

/**
 * Reusable React Error Boundary (class component — error boundaries require
 * the class API: getDerivedStateFromError + componentDidCatch).
 *
 * Catches render errors in the child tree and renders a fallback instead of
 * crashing the whole app (white screen). Supports a custom fallback component,
 * an onError callback for logging/telemetry, and resetKeys for auto-recovery
 * when upstream values change.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', {
      error,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Auto-reset when resetKeys change, but only if currently in error state.
    if (this.state.hasError && this.props.resetKeys) {
      const changed = this.props.resetKeys.some(
        (key, index) =>
          !Object.is(key, prevProps.resetKeys?.[index]),
      );
      if (changed) {
        this.reset();
      }
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback: Fallback } = this.props;

    if (hasError && error) {
      if (Fallback) {
        return <Fallback error={error} reset={this.reset} />;
      }
      return <DefaultErrorFallback error={error} reset={this.reset} />;
    }

    return children;
  }
}

export default ErrorBoundary;
