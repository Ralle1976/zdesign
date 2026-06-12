'use client';

import { useState, useCallback } from 'react';
import { useI18n } from '@/i18n';
import { useZDesignStore } from '@/stores/zdesign-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Loader2,
  ExternalLink,
  Globe,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ResearchResult {
  title: string;
  url: string;
  description: string;
  domain: string;
  rank: number;
  date: string | null;
  favicon: string | null;
}

interface ResearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResults: (query: string, results: ResearchResult[]) => void;
}

export function ResearchDialog({ open, onOpenChange, onResults }: ResearchDialogProps) {
  const { t } = useI18n();
  const projectId = useZDesignStore((s) => s.projectId);

  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || isSearching || !projectId) return;

    setIsSearching(true);
    setError(null);
    setResults([]);
    setHasSearched(true);

    try {
      const res = await fetch('/api/design/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          projectId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Research failed');
      }

      const data = await res.json();
      setResults(data.results || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Search failed';
      setError(message);
    } finally {
      setIsSearching(false);
    }
  }, [query, isSearching, projectId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch();
      }
    },
    [handleSearch]
  );

  const handleAddToChat = useCallback(() => {
    if (results.length > 0) {
      onResults(query.trim(), results);
      handleClose();
    }
  }, [results, query, onResults]);

  const handleClose = useCallback(() => {
    if (!isSearching) {
      setQuery('');
      setResults([]);
      setHasSearched(false);
      setError(null);
      onOpenChange(false);
    }
  }, [isSearching, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="flex items-center justify-center size-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <Search className="size-4" />
            </div>
            {t.research?.title || 'Design Research'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t.research?.placeholder || 'Search for design inspiration...'}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {/* Search Input */}
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.research?.placeholder || 'Search for design inspiration...'}
              className="text-sm"
              disabled={isSearching}
              autoFocus
            />
            <Button
              onClick={handleSearch}
              disabled={!query.trim() || isSearching}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
            >
              {isSearching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
            </Button>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Searching State */}
          <AnimatePresence>
            {isSearching && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles className="size-8 text-emerald-500" />
                </motion.div>
                <p className="text-sm text-muted-foreground mt-3">
                  {t.research?.searching || 'Searching...'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          <AnimatePresence>
            {!isSearching && results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[11px]">
                    {results.length} results
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {t.research?.results || 'Found inspiration!'}
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {results.map((result, index) => (
                    <motion.a
                      key={result.url}
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                    >
                      <div className="flex items-center justify-center size-8 rounded-md bg-muted shrink-0 mt-0.5">
                        {result.favicon ? (
                          <img
                            src={result.favicon}
                            alt=""
                            className="size-4 rounded-sm"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Globe className="size-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-foreground group-hover:text-emerald-600 transition-colors truncate">
                            {result.title}
                          </p>
                          <ExternalLink className="size-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {result.description}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60">
                          {result.domain}
                          {result.date && ` · ${result.date}`}
                        </p>
                      </div>
                    </motion.a>
                  ))}
                </div>

                <Button
                  onClick={handleAddToChat}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Sparkles className="size-4 mr-2" />
                  Add to Chat
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* No Results */}
          <AnimatePresence>
            {!isSearching && hasSearched && results.length === 0 && !error && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="text-center py-6"
              >
                <Search className="size-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">
                  {t.research?.noResults || 'No results found'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
