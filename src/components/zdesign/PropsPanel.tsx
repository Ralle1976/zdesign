'use client';

import { useState, useCallback } from 'react';
import { useZDesignStore } from '@/stores/zdesign-store';
import { useI18n } from '@/i18n';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  MousePointerClick,
  Palette,
  Type,
  Space,
  LayoutGrid,
  Sparkles,
  ShieldCheck,
  SwatchBook,
  Layers,
  MessageSquare,
  GitBranch,
  Scan,
} from 'lucide-react';
import { AnnotationsPanel } from './AnnotationsPanel';
import { VersionTree } from './VersionTree';
import { AccessibilityScanner } from './AccessibilityScanner';
import {
  scanDesignTree,
  calculateAccessibilityScore,
  getScoreColor,
  getScoreBgColor,
} from '@/lib/accessibility';

const DESIGN_TOKEN_COLORS = [
  { name: 'Primary', value: '#10b981', category: 'primary' },
  { name: 'Secondary', value: '#14b8a6', category: 'secondary' },
  { name: 'Accent', value: '#06b6d4', category: 'accent' },
  { name: 'Neutral', value: '#6b7280', category: 'neutral' },
  { name: 'Success', value: '#22c55e', category: 'semantic' },
  { name: 'Warning', value: '#f59e0b', category: 'semantic' },
  { name: 'Error', value: '#ef4444', category: 'semantic' },
  { name: 'Info', value: '#3b82f6', category: 'semantic' },
];

const TYPOGRAPHY_SIZES = [
  { name: 'Display', size: '3rem', weight: '700' },
  { name: 'Heading 1', size: '2.25rem', weight: '600' },
  { name: 'Heading 2', size: '1.5rem', weight: '600' },
  { name: 'Body', size: '1rem', weight: '400' },
  { name: 'Caption', size: '0.75rem', weight: '400' },
];

const SPACING_SCALE = [
  { name: 'xs', value: '4px' },
  { name: 'sm', value: '8px' },
  { name: 'md', value: '16px' },
  { name: 'lg', value: '24px' },
  { name: 'xl', value: '32px' },
  { name: '2xl', value: '48px' },
];

function PropertiesContent() {
  const { t } = useI18n();
  const canvas = useZDesignStore((s) => s.canvas);
  const designSystem = useZDesignStore((s) => s.designSystem);
  const designTree = useZDesignStore((s) => s.designTree);

  // Accessibility scanner state
  const [a11yOpen, setA11yOpen] = useState(false);

  // Compute accessibility score from design tree
  const hasDesign = designTree.children && designTree.children.length > 0;
  const a11yScore = hasDesign ? calculateAccessibilityScore(scanDesignTree(designTree)) : null;

  const hasSelection = canvas.selectedNodeId !== null;

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        {/* No selection state */}
        {!hasSelection && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex items-center justify-center size-12 rounded-xl bg-muted mb-3">
              <MousePointerClick className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {t.props.noSelection}
            </p>
          </div>
        )}

        {/* Selected element info - shown when a node is selected */}
        {hasSelection && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
              <div className="size-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-muted-foreground">
                ID: {canvas.selectedNodeId}
              </span>
            </div>
          </div>
        )}

        <Separator />

        {/* Design System section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <SwatchBook className="size-4 text-emerald-600" />
            <span className="text-sm font-medium">
              {t.props.designSystem}
            </span>
            {designSystem && (
              <Badge
                variant="secondary"
                className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              >
                Active
              </Badge>
            )}
          </div>

          <Accordion type="multiple" defaultValue={['colors', 'typography', 'spacing']} className="w-full">
            {/* Colors */}
            <AccordionItem value="colors" className="border-b-0">
              <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
                <div className="flex items-center gap-2">
                  <Palette className="size-3.5 text-muted-foreground" />
                  {t.props.colors}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {DESIGN_TOKEN_COLORS.map((color) => (
                    <div
                      key={color.name}
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <div
                        className="size-5 rounded-md border shadow-sm shrink-0"
                        style={{ backgroundColor: color.value }}
                      />
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium truncate">
                          {color.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {color.value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Typography */}
            <AccordionItem value="typography" className="border-b-0">
              <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
                <div className="flex items-center gap-2">
                  <Type className="size-3.5 text-muted-foreground" />
                  {t.props.typography}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pt-1">
                  {TYPOGRAPHY_SIZES.map((type) => (
                    <div
                      key={type.name}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <span
                        style={{
                          fontSize: `${Math.min(parseInt(type.size), 20)}px`,
                          fontWeight: type.weight,
                        }}
                        className="truncate"
                      >
                        {type.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0 ml-2">
                        {type.size}
                      </span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Spacing */}
            <AccordionItem value="spacing" className="border-b-0">
              <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
                <div className="flex items-center gap-2">
                  <Space className="size-3.5 text-muted-foreground" />
                  {t.props.spacing}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1.5 pt-1">
                  {SPACING_SCALE.map((spacing) => {
                    const px = parseInt(spacing.value);
                    return (
                      <div
                        key={spacing.name}
                        className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors"
                      >
                        <div
                          className="h-3 rounded-sm bg-emerald-500/40"
                          style={{ width: `${Math.max(px * 2, 4)}px` }}
                        />
                        <span className="text-[11px] font-medium min-w-[28px]">
                          {spacing.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono ml-auto">
                          {spacing.value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Layout */}
            <AccordionItem value="layout" className="border-b-0">
              <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="size-3.5 text-muted-foreground" />
                  {t.props.layout}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="text-xs text-muted-foreground py-2">
                  Layout properties will appear here when an element is
                  selected.
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Effects */}
            <AccordionItem value="effects" className="border-b-0">
              <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-3.5 text-muted-foreground" />
                  {t.props.effects}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="text-xs text-muted-foreground py-2">
                  Effects and animations will appear here when an element is
                  selected.
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <Separator />

        {/* Accessibility Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600" />
              <span className="text-sm font-medium">
                {t.props.accessibility}
              </span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-emerald-600"
                  onClick={() => setA11yOpen(true)}
                >
                  <Scan className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {t.a11y?.title || 'Accessibility Scanner'}
              </TooltipContent>
            </Tooltip>
          </div>
          <button
            type="button"
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 border hover:bg-muted/70 transition-colors text-left"
            onClick={() => setA11yOpen(true)}
          >
            <div
              className={`flex items-center justify-center size-10 rounded-full ${
                a11yScore !== null
                  ? getScoreBgColor(a11yScore)
                  : 'bg-muted'
              }`}
            >
              <span
                className={`text-sm font-bold ${
                  a11yScore !== null
                    ? getScoreColor(a11yScore)
                    : 'text-muted-foreground'
                }`}
              >
                {a11yScore !== null ? a11yScore : '--'}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium">{t.props.accessibilityScore}</p>
              <p className="text-[10px] text-muted-foreground">
                {a11yScore !== null
                  ? a11yScore >= 80
                    ? t.a11y?.excellent || 'Excellent accessibility!'
                    : a11yScore >= 50
                      ? t.a11y?.needsWork || 'Needs improvement'
                      : t.a11y?.poor || 'Poor accessibility'
                  : 'Generate a design to see the score'}
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Accessibility Scanner Sheet */}
      <AccessibilityScanner open={a11yOpen} onOpenChange={setA11yOpen} />
    </ScrollArea>
  );
}

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
