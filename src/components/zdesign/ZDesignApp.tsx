'use client';

import { useEffect, useState, useRef } from 'react';
import { useZDesignStore } from '@/stores/zdesign-store';
import { useIsMobile } from '@/hooks/use-mobile';
import { TopToolbar } from './TopToolbar';
import { ChatPanel } from './ChatPanel';
import { CanvasArea } from './CanvasArea';
import { PropsPanel } from './PropsPanel';
import { StatusBar } from './StatusBar';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Palette, Settings2 } from 'lucide-react';
import { useI18n } from '@/i18n';

export function ZDesignApp() {
  const isMobile = useIsMobile();
  const { t } = useI18n();
  const projectId = useZDesignStore((s) => s.projectId);
  const setProject = useZDesignStore((s) => s.setProject);
  const leftPanelOpen = useZDesignStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useZDesignStore((s) => s.rightPanelOpen);
  const [mobileTab, setMobileTab] = useState('canvas');

  // Auto-create or load a project on first load (only once)
  const initRef = useRef(false);

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
            return;
          }
        }

        // No projects exist, create one
        if (!cancelled) {
          const res = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'Untitled Project',
              type: 'PROTOTYPE',
            }),
          });
          if (res.ok) {
            const data = await res.json();
            setProject(data.id, data.name, data.type);
          }
        }
      } catch {
        // Project creation failed silently
      }
    })();

    return () => { cancelled = true; };
  }, [projectId, setProject]);

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
            <ChatPanel />
          </TabsContent>
          <TabsContent value="canvas" className="flex-1 min-h-0 mt-0">
            <CanvasArea />
          </TabsContent>
          <TabsContent value="props" className="flex-1 min-h-0 mt-0">
            <PropsPanel />
          </TabsContent>
        </Tabs>
        <StatusBar />
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
                <ChatPanel />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}

          {/* Center Panel - Canvas */}
          <ResizablePanel defaultSize={leftPanelOpen && rightPanelOpen ? 56 : leftPanelOpen || rightPanelOpen ? 72 : 100}>
            <CanvasArea />
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
                <PropsPanel />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
      <StatusBar />
    </div>
  );
}
