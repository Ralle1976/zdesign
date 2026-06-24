'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useZDesignStore } from '@/stores/zdesign-store';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCollaboration } from '@/hooks/useCollaboration';
import { TopToolbar } from './TopToolbar';
import { ChatPanel } from './ChatPanel';
import { CanvasArea } from './CanvasArea';
import { PropsPanel } from './PropsPanel';
import { StatusBar } from './StatusBar';
import { StatsBar } from './StatsBar';
import { PresenceBar } from './PresenceBar';
import { CursorOverlay } from './CursorOverlay';
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

function useDebouncedCallback<T extends (...args: any[]) => void>(
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
    (...args: any[]) => {
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
  const designMode = useZDesignStore((s) => s.designMode);
  const designHTML = useZDesignStore((s) => s.designHTML);
  const loadDesignHTML = useZDesignStore((s) => s.loadDesignHTML);
  const isDirty = useZDesignStore((s) => s.isDirty);
  const setIsDirty = useZDesignStore((s) => s.setIsDirty);
  const undo = useZDesignStore((s) => s.undo);
  const redo = useZDesignStore((s) => s.redo);
  const leftPanelOpen = useZDesignStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useZDesignStore((s) => s.rightPanelOpen);
  // Selection lives under canvas.selectedNodeId in the store
  const selectedNodeId = useZDesignStore((s) => s.canvas.selectedNodeId);
  const [mobileTab, setMobileTab] = useState('canvas');

  // Track saving state for StatusBar
  const [isSaving, setIsSaving] = useState(false);

  // ============ Collaboration: stable anonymous identity ============
  const [userId] = useState(() => {
    if (typeof window === 'undefined') {
      return `user-${Math.random().toString(36).slice(2, 10)}`;
    }
    const stored = localStorage.getItem('zdesign:userId');
    if (stored) return stored;
    const id = `user-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('zdesign:userId', id);
    return id;
  });
  const userName = useMemo(() => `Gast-${userId.slice(-4)}`, [userId]);

  // ============ Collaboration: hook (users, cursors, selections, emit/listen) ============
  const collab = useCollaboration(projectId, userId, userName);

  // Refs for loop-protection during remote design sync
  const isRemoteUpdateRef = useRef(false);
  const lastEmittedTreeRef = useRef<string>('');

  // Container ref for the canvas area — used by CursorOverlay for offset math
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // ============ Cursor movement emit (throttled ~50ms) ============
  const lastCursorEmit = useRef(0);
  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const now = Date.now();
      if (now - lastCursorEmit.current < 50) return;
      lastCursorEmit.current = now;
      collab.emitCursorMove(e.clientX, e.clientY);
    },
    [collab]
  );

  // ============ Selection emit ============
  useEffect(() => {
    if (selectedNodeId) collab.emitElementSelected(selectedNodeId);
  }, [selectedNodeId, collab]);

  // ============ Outgoing: emit local design changes (debounced 300ms) ============
  useEffect(() => {
    if (!collab.isConnected || !designTree) return;
    // If this update came from a remote apply, consume the flag and skip emitting.
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }
    const serialized = JSON.stringify(designTree);
    // Avoid re-emitting identical state
    if (serialized === lastEmittedTreeRef.current) return;
    lastEmittedTreeRef.current = serialized;
    const t = setTimeout(() => collab.emitDesignUpdate(designTree), 300);
    return () => clearTimeout(t);
  }, [designTree, collab]);

  // ============ Incoming: apply remote design changes without re-emitting ============
  useEffect(() => {
    const off = collab.onDesignChanged((data) => {
      // Safety: ignore echoes of our own updates
      if (data.userId === userId) return;
      if (!data.designTree) return;
      isRemoteUpdateRef.current = true;
      lastEmittedTreeRef.current = JSON.stringify(data.designTree);
      loadDesignTree(data.designTree as Parameters<typeof loadDesignTree>[0]);
    });
    return off;
  }, [collab, userId, loadDesignTree]);

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

          if (project?.designMode === 'HTML_ARTIFACT' && project?.designHTML) {
            loadDesignHTML(project.designHTML);
          } else if (project?.designJSON) {
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
    async (pid: string, payload: unknown) => {
      try {
        setIsSaving(true);
        await fetch(`/api/projects/${pid}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
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
    const payload =
      designMode === 'HTML_ARTIFACT'
        ? { designHTML: designHTML ?? '', designMode: 'HTML_ARTIFACT' }
        : { designJSON: JSON.stringify(designTree) };
    debouncedSave(projectId, payload);
  }, [projectId, designTree, designHTML, designMode, isDirty, debouncedSave]);

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
        <div className="flex items-center">
          <div className="flex-1 min-w-0">
            <TopToolbar />
          </div>
          <div className="shrink-0 px-2 border-b h-12 flex items-center bg-background/95">
            <PresenceBar
              users={collab.users}
              currentUserId={userId}
              isConnected={collab.isConnected}
            />
          </div>
        </div>
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
        <StatsBar />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center">
        <div className="flex-1 min-w-0">
          <TopToolbar />
        </div>
        <div className="shrink-0 px-2 border-b h-12 flex items-center bg-background/95">
          <PresenceBar
            users={collab.users}
            currentUserId={userId}
            isConnected={collab.isConnected}
          />
        </div>
      </div>
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

          {/* Center Panel - Canvas (wrapped for collaboration: containerRef + mouse tracking) */}
          <ResizablePanel defaultSize={leftPanelOpen && rightPanelOpen ? 56 : leftPanelOpen || rightPanelOpen ? 72 : 100}>
            <div
              ref={canvasContainerRef}
              className="relative h-full"
              onMouseMove={handleCanvasMouseMove}
            >
              <ErrorBoundary onError={(err) => console.error('[Canvas Boundary]', err)}>
                <CanvasArea />
              </ErrorBoundary>
              <CursorOverlay
                cursors={collab.cursors}
                selections={collab.selections}
                containerRef={canvasContainerRef}
                currentUserId={userId}
              />
            </div>
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
      <StatsBar />
    </div>
  );
}
