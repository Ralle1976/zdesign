'use client';

import { useState, useCallback } from 'react';
import { useZDesignStore } from '@/stores/zdesign-store';
import { useI18n } from '@/i18n';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  MessageSquare,
  Check,
  RotateCcw,
  Send,
  Filter,
  Pin,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

type FilterMode = 'all' | 'open' | 'resolved';

export function AnnotationsPanel() {
  const { t } = useI18n();
  const annotations = useZDesignStore((s) => s.annotations);
  const resolveAnnotation = useZDesignStore((s) => s.resolveAnnotation);
  const unresolveAnnotation = useZDesignStore((s) => s.unresolveAnnotation);
  const addAnnotation = useZDesignStore((s) => s.addAnnotation);
  const selectNode = useZDesignStore((s) => s.selectNode);
  const projectId = useZDesignStore((s) => s.projectId);

  const [filter, setFilter] = useState<FilterMode>('all');
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredAnnotations = annotations.filter((a) => {
    if (filter === 'open') return !a.isResolved;
    if (filter === 'resolved') return a.isResolved;
    return true;
  });

  const openCount = annotations.filter((a) => !a.isResolved).length;
  const resolvedCount = annotations.filter((a) => a.isResolved).length;

  const handleSubmit = useCallback(async () => {
    if (!newComment.trim() || !projectId) return;
    setIsSubmitting(true);
    try {
      const annotation = {
        id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        projectId,
        userId: 'current-user',
        userName: 'You',
        x: 0,
        y: 0,
        content: newComment.trim(),
        isResolved: false,
        createdAt: new Date(),
        color: '#f59e0b',
      };
      addAnnotation(annotation);
      setNewComment('');
    } finally {
      setIsSubmitting(false);
    }
  }, [newComment, projectId, addAnnotation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleAnnotationClick = useCallback(
    (elementId?: string) => {
      if (elementId) {
        selectNode(elementId);
      }
    },
    [selectNode]
  );

  const formatTimestamp = useCallback((date: Date) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return t.annotations.justNow;
    }
  }, [t.annotations.justNow]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-11 border-b shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-emerald-600" />
          <span className="text-sm font-medium">{t.annotations.title}</span>
          {annotations.length > 0 && (
            <Badge
              variant="secondary"
              className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 h-5 min-w-[20px] flex items-center justify-center"
            >
              {annotations.length}
            </Badge>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b shrink-0">
        <Filter className="size-3.5 text-muted-foreground mr-1" />
        {(['all', 'open', 'resolved'] as const).map((mode) => (
          <Button
            key={mode}
            variant={filter === mode ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 text-[11px] px-2.5"
            onClick={() => setFilter(mode)}
          >
            {t.annotations[mode]}
            {mode === 'open' && openCount > 0 && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">
                {openCount}
              </span>
            )}
            {mode === 'resolved' && resolvedCount > 0 && (
              <span className="ml-1 text-muted-foreground">
                {resolvedCount}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Comment List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          <AnimatePresence mode="popLayout">
            {filteredAnnotations.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="flex items-center justify-center size-12 rounded-xl bg-muted mb-3">
                  <Pin className="size-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground max-w-[200px]">
                  {t.annotations.noComments}
                </p>
              </motion.div>
            )}

            {filteredAnnotations.map((annotation, index) => (
              <motion.div
                key={annotation.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ delay: index * 0.03, duration: 0.2 }}
                className="group"
              >
                <div
                  className="relative p-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => handleAnnotationClick(annotation.elementId)}
                >
                  {/* Color indicator */}
                  <div
                    className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
                    style={{
                      backgroundColor: annotation.isResolved
                        ? '#9ca3af'
                        : annotation.color || '#f59e0b',
                    }}
                  />

                  <div className="pl-2 space-y-2">
                    {/* User row */}
                    <div className="flex items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarFallback className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          {getInitials(annotation.userName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium">
                        {annotation.userName}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {formatTimestamp(annotation.createdAt)}
                      </span>
                    </div>

                    {/* Content */}
                    <p className="text-xs text-foreground/90 leading-relaxed">
                      {annotation.content}
                    </p>

                    {/* Meta row */}
                    <div className="flex items-center gap-2">
                      {annotation.elementId && (
                        <Badge
                          variant="outline"
                          className="text-[9px] h-4 px-1.5 font-mono"
                        >
                          <Pin className="size-2.5 mr-0.5" />
                          {annotation.elementId.slice(0, 8)}
                        </Badge>
                      )}
                      {annotation.replies && annotation.replies.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {annotation.replies.length} {t.annotations.replies}
                        </span>
                      )}
                      {annotation.isResolved && (
                        <Badge
                          variant="secondary"
                          className="text-[9px] h-4 px-1.5 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        >
                          <Check className="size-2.5 mr-0.5" />
                          {t.annotations.resolved}
                        </Badge>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (annotation.isResolved) {
                            unresolveAnnotation(annotation.id);
                          } else {
                            resolveAnnotation(annotation.id);
                          }
                        }}
                      >
                        {annotation.isResolved ? (
                          <>
                            <RotateCcw className="size-3 mr-1" />
                            {t.annotations.unresolve}
                          </>
                        ) : (
                          <>
                            <Check className="size-3 mr-1" />
                            {t.annotations.resolve}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {index < filteredAnnotations.length - 1 && (
                  <Separator className="my-1 opacity-50" />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Add Comment Form */}
      <div className="border-t p-3 shrink-0">
        <div className="flex items-center gap-2">
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.annotations.addComment}
            className="text-xs h-8 flex-1"
          />
          <Button
            size="sm"
            className="h-8 w-8 p-0 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleSubmit}
            disabled={!newComment.trim() || isSubmitting}
          >
            <Send className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
