'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useZDesignStore } from '@/stores/zdesign-store';
import { useIsMobile } from '@/hooks/use-mobile';
import { TopToolbar } from './TopToolbar';
import { ChatPanel } from './ChatPanel';
import { CanvasArea } from './CanvasArea';
import { PropsPanel } from './PropsPanel';
import { StatusBar } from './StatusBar';
import { ErrorBoundary } from '@/components/zdesign/ErrorBoundary';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Palette, Settings2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { ChatMessage } from '@/types/design';

// ============ Auto-save debounce helper ============

function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref in effect to satisfy lint rule
  useEffect(() => {
    callbackRef.current = callback;
  });

  const debouncedFn = useCallback(
    (...args: unknown[]) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => callbackRef.current(...args), delay);
    },
    [delay]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return debouncedFn;
}

export function ZDesignApp() {
  const isMobile = useIsMobile();
  const { t } = useI18n();
  const projectId = useZDesignStore((s) => s.projectId);
  const setProject = useZDesignStore((s) => s.setProject);
  const loadDesignTree = useZDesignStore((s) => s.loadDesignTree);
  const setChatMessages = useZDesignStore((s) => s.setChatMessages);
  const designTree = useZDesignStore((s) => s.designTree);
  const isDirty = useZDesignStore((s) => s.isDirty);
  const setIsDirty = useZDesignStore((s) => s.setIsDirty);
  const undo = useZDesignStore((s) => s.undo);
  const redo = useZDesignStore((s) => s.redo);
  const leftPanelOpen = useZDesignStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useZDesignStore((s) => s.rightPanelOpen);
  const [mobileTab, setMobileTab] = useState('canvas');

  // Track saving state for StatusBar
  const [isSaving, setIsSaving] = useState(false);

  // Auto-create or load project on first mount
  const initRef = useRef(false);
  const dataLoadedRef = useRef(false);

  // ============ Fix 1: Load project + design + chat on mount ============

  useEffect(() => {
    if (projectId || initRef.current) return;
    initRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        // Try to load existing projects first
        const listRes = await fetch('/api/projects');
        if (listRes.ok && !cancelled) {
          const listData = await listRes.json();
          if (listData.projects && listData.projects.length > 0) {
            const p = listData.projects[0];
            setProject(p.id, p.name, p.type);
            // Data will be loaded in the separate effect below once projectId is set
            return;
          }
        }

        // No projects exist, create one automatically
        if (!cancelled) {
          const res = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'My Project',
              type: 'PROTOTYPE',
            }),
          });
          if (res.ok) {
            const data = await res.json();
            setProject(data.project.id, data.project.name, data.project.type);
            // New project — no data to load
            dataLoadedRef.current = true;
          }
        }
      } catch {
        // Project creation failed silently
      }
    })();

    return () => { cancelled = true; };
  }, [projectId, setProject]);

  // Load full project data (design + chat) once projectId is available
  useEffect(() => {
    if (!projectId || dataLoadedRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        // Fetch full project with designJSON
        const projectRes = await fetch(`/api/projects/${projectId}`);
        if (projectRes.ok && !cancelled) {
          const projectData = await projectRes.json();
          const project = projectData.project;

          if (project?.designJSON) {
            try {
              const parsed = typeof project.designJSON === 'string'
                ? JSON.parse(project.designJSON)
                : project.designJSON;
              loadDesignTree(parsed);
            } catch {
              // Invalid JSON, keep default tree
            }
          }
        }

        // Fetch chat messages
        const chatRes = await fetch(`/api/chat?projectId=${projectId}`);
        if (chatRes.ok && !cancelled) {
          const chatData = await chatRes.json();
          if (chatData.messages && Array.isArray(chatData.messages)) {
            // Normalize messages to match ChatMessage interface
            const messages: ChatMessage[] = chatData.messages.map(
              (m: Record<string, unknown>) => ({
                id: m.id as string,
                projectId: m.projectId as string,
                role: m.role as 'user' | 'assistant' | 'system',
                content: m.content as string,
                metadata: m.metadata as ChatMessage['metadata'],
                createdAt: new Date(m.createdAt as string),
              })
            );
            setChatMessages(messages);
          }
        }

        dataLoadedRef.current = true;
      } catch {
        // Failed to load data silently
      }
    })();

    return () => { cancelled = true; };
  }, [projectId, loadDesignTree, setChatMessages]);

  // ============ Fix 3: Debounced auto-save ============

  const autoSave = useCallback(
    async (pid: string, tree: unknown) => {
      try {
        setIsSaving(true);
        await fetch(`/api/projects/${pid}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ designJSON: JSON.stringify(tree) }),
        });
        setIsDirty(false);
      } catch {
        // Auto-save failed silently
      } finally {
        setIsSaving(false);
      }
    },
    [setIsDirty]
  );

  const debouncedSave = useDebouncedCallback(autoSave, 5000);

  useEffect(() => {
    if (!projectId || !isDirty || !dataLoadedRef.current) return;
    debouncedSave(projectId, designTree);
  }, [projectId, designTree, isDirty, debouncedSave]);

  // ============ Fix 4: Keyboard shortcuts for undo/redo ============

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      // Also support Ctrl+y for redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <TopToolbar />
        <Tabs
          value={mobileTab}
          onValueChange={setMobileTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="w-full rounded-none border-b h-10 flex">
            <TabsTrigger value="chat" className="flex-1 gap-1.5">
              <MessageSquare className="size-4" />
              {t.chat.title}
            </TabsTrigger>
            <TabsTrigger value="canvas" className="flex-1 gap-1.5">
              <Palette className="size-4" />
              {t.canvas.title}
            </TabsTrigger>
            <TabsTrigger value="props" className="flex-1 gap-1.5">
              <Settings2 className="size-4" />
              {t.props.title}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="chat" className="flex-1 min-h-0 mt-0">
            <ErrorBoundary onError={(err) => console.error('[Chat Boundary]', err)}>
              <ChatPanel />
            </ErrorBoundary>
          </TabsContent>
          <TabsContent value="canvas" className="flex-1 min-h-0 mt-0">
            <ErrorBoundary onError={(err) => console.error('[Canvas Boundary]', err)}>
              <CanvasArea />
            </ErrorBoundary>
          </TabsContent>
          <TabsContent value="props" className="flex-1 min-h-0 mt-0">
            <ErrorBoundary onError={(err) => console.error('[Props Boundary]', err)}>
              <PropsPanel />
            </ErrorBoundary>
          </TabsContent>
        </Tabs>
        <StatusBar isSaving={isSaving} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <TopToolbar />
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel - Chat */}
          {leftPanelOpen && (
            <>
              <ResizablePanel
                defaultSize={22}
                minSize={18}
                maxSize={35}
                className="min-w-[280px]"
              >
                <ErrorBoundary onError={(err) => console.error('[Chat Boundary]', err)}>
                  <ChatPanel />
                </ErrorBoundary>
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}

          {/* Center Panel - Canvas */}
          <ResizablePanel defaultSize={leftPanelOpen && rightPanelOpen ? 56 : leftPanelOpen || rightPanelOpen ? 72 : 100}>
            <ErrorBoundary onError={(err) => console.error('[Canvas Boundary]', err)}>
              <CanvasArea />
            </ErrorBoundary>
          </ResizablePanel>

          {/* Right Panel - Props */}
          {rightPanelOpen && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel
                defaultSize={22}
                minSize={18}
                maxSize={30}
                className="min-w-[240px]"
              >
                <ErrorBoundary onError={(err) => console.error('[Props Boundary]', err)}>
                  <PropsPanel />
                </ErrorBoundary>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
      <StatusBar isSaving={isSaving} />
    </div>
  );
}
