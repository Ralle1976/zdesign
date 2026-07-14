'use client';

// Z.Design - PropsPanel (tab shell)
//
// T6 (2026-07-04): the seven property editors + PropertiesContent were
// extracted to ./props-editors.tsx (~1000 lines moved out). This file now
// owns only the three-tab shell (Properties / Comments / Versions) and
// delegates the Properties tab body to PropertiesContent.

import { useZDesignStore } from '@/stores/zdesign-store';
import { useI18n } from '@/i18n';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Layers, MessageSquare, GitBranch } from 'lucide-react';
import { AnnotationsPanel } from './AnnotationsPanel';
import { VersionTree } from './VersionTree';
import { PropertiesContent } from './props-editors';

export function PropsPanel() {
  const { t } = useI18n();
  const annotations = useZDesignStore((s) => s.annotations);
  const versions = useZDesignStore((s) => s.versions);

  return (
    <div className="flex flex-col h-full bg-background">
      <Tabs defaultValue="properties" className="flex flex-col h-full">
        {/* Tab Header */}
        <div className="border-b px-2 pt-2 shrink-0">
          <TabsList className="w-full h-9 p-0.5 bg-muted/50">
            <TabsTrigger
              value="properties"
              className="flex-1 text-[11px] gap-1 data-[state=active]:bg-background"
            >
              <Layers className="size-3" />
              <span className="hidden sm:inline">{t.props.title}</span>
            </TabsTrigger>
            <TabsTrigger
              value="comments"
              className="flex-1 text-[11px] gap-1 data-[state=active]:bg-background"
            >
              <MessageSquare className="size-3" />
              <span className="hidden sm:inline">{t.annotations.title}</span>
              {annotations.length > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[9px] h-4 min-w-[16px] px-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                >
                  {annotations.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="versions"
              className="flex-1 text-[11px] gap-1 data-[state=active]:bg-background"
            >
              <GitBranch className="size-3" />
              <span className="hidden sm:inline">{t.versions.title}</span>
              {versions.length > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[9px] h-4 min-w-[16px] px-1"
                >
                  {versions.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Content */}
        <TabsContent value="properties" className="flex-1 min-h-0 mt-0 overflow-hidden">
          <PropertiesContent />
        </TabsContent>
        <TabsContent value="comments" className="flex-1 min-h-0 mt-0 overflow-hidden">
          <AnnotationsPanel />
        </TabsContent>
        <TabsContent value="versions" className="flex-1 min-h-0 mt-0 overflow-hidden">
          <VersionTree />
        </TabsContent>
      </Tabs>
    </div>
  );
}
