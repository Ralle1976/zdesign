'use client';

import { useState, useCallback } from 'react';
import { useZDesignStore } from '@/stores/zdesign-store';
import { useI18n } from '@/i18n';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import {
  Sparkles,
  MousePointer2,
  Monitor,
  Tablet,
  Smartphone,
  Download,
  Share2,
  Sun,
  Moon,
  Languages,
  ChevronDown,
  FileCode,
  FileText,
  Archive,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Globe,
  Pencil,
  Check,
  Layout,
  Paintbrush,
  Settings2,
  Zap,
  Wand2,
  Loader2,
} from 'lucide-react';
import { TemplateHub } from './TemplateHub';
import { DesignSystemManager } from './DesignSystemManager';
import { ProviderSettings } from './ProviderSettings';

export function TopToolbar() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const projectName = useZDesignStore((s) => s.projectName);
  const setProject = useZDesignStore((s) => s.setProject);
  const projectId = useZDesignStore((s) => s.projectId);
  const canvas = useZDesignStore((s) => s.canvas);
  const setCanvasMode = useZDesignStore((s) => s.setCanvasMode);
  const setViewport = useZDesignStore((s) => s.setViewport);
  const leftPanelOpen = useZDesignStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useZDesignStore((s) => s.rightPanelOpen);
  const toggleLeftPanel = useZDesignStore((s) => s.toggleLeftPanel);
  const toggleRightPanel = useZDesignStore((s) => s.toggleRightPanel);
  const creativeMode = useZDesignStore((s) => s.creativeMode);
  const setCreativeMode = useZDesignStore((s) => s.setCreativeMode);
  const activeProviderId = useZDesignStore((s) => s.activeProviderId);
  const qualityReport = useZDesignStore((s) => s.qualityReport);
  const designTree = useZDesignStore((s) => s.designTree);
  const setDesignTree = useZDesignStore((s) => s.setDesignTree);
  const setQualityReport = useZDesignStore((s) => s.setQualityReport);
  const isGenerating = useZDesignStore((s) => s.isGenerating);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const handleEnhance = useCallback(async () => {
    if (!designTree.children || designTree.children.length === 0 || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const res = await fetch('/api/design/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designTree, qualityReport }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.designTree) {
          setDesignTree(data.designTree);
        }
        if (data.qualityReport) {
          setQualityReport(data.qualityReport);
        }
      }
    } catch {
      // Enhancement failed silently
    } finally {
      setIsEnhancing(false);
    }
  }, [designTree, qualityReport, setDesignTree, setQualityReport, isEnhancing]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(projectName);
  const [templateHubOpen, setTemplateHubOpen] = useState(false);
  const [designSystemOpen, setDesignSystemOpen] = useState(false);
  const [providerSettingsOpen, setProviderSettingsOpen] = useState(false);

  const handleNameSave = useCallback(() => {
    if (editName.trim() && projectId) {
      setProject(projectId, editName.trim(), useZDesignStore.getState().projectType);
    }
    setIsEditingName(false);
  }, [editName, projectId, setProject]);

  const handleExport = useCallback(
    async (format: string) => {
      if (!projectId) return;
      try {
        const res = await fetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, format }),
        });
        if (res.ok) {
          const data = await res.json();
          if (format === 'html' && data.html) {
            const blob = new Blob([data.html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${projectName}.html`;
            a.click();
            URL.revokeObjectURL(url);
          } else if (format === 'zip' && data.files) {
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${projectName}-export.json`;
            a.click();
            URL.revokeObjectURL(url);
          }
        }
      } catch {
        // Export failed
      }
    },
    [projectId, projectName]
  );

  return (
    <header className="flex items-center h-12 px-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
      {/* Left section: Logo + Panel toggle */}
      <div className="flex items-center gap-2 min-w-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={toggleLeftPanel}
            >
              {leftPanelOpen ? (
                <PanelLeftClose className="size-4" />
              ) : (
                <PanelLeftOpen className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {leftPanelOpen ? 'Hide Chat' : 'Show Chat'}
          </TooltipContent>
        </Tooltip>

        {/* Logo */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center justify-center size-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold text-sm shadow-sm">
            Z
          </div>
          <span className="font-semibold text-sm tracking-tight hidden sm:inline bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            Z.Design
          </span>
        </div>

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* Project name */}
        {isEditingName ? (
          <div className="flex items-center gap-1">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSave();
                if (e.key === 'Escape') setIsEditingName(false);
              }}
              onBlur={handleNameSave}
              className="h-7 px-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 w-40"
              autoFocus
            />
            <Button variant="ghost" size="icon" className="size-6" onClick={handleNameSave}>
              <Check className="size-3" />
            </Button>
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  setEditName(projectName);
                  setIsEditingName(true);
                }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded-md hover:bg-muted"
              >
                <span className="max-w-[200px] truncate">{projectName}</span>
                <Pencil className="size-3 opacity-50" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Click to rename</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Center: Mode toggle + Viewport + Creative Mode */}
      <div className="flex-1 flex items-center justify-center gap-2">
        {/* Canvas mode toggle */}
        <ToggleGroup
          type="single"
          value={canvas.mode}
          onValueChange={(value) => {
            if (value) setCanvasMode(value as 'ai' | 'editor');
          }}
          variant="outline"
          size="sm"
          className="h-8"
        >
          <ToggleGroupItem value="ai" className="gap-1.5 px-3 text-xs">
            <Sparkles className="size-3.5" />
            <span className="hidden sm:inline">{t.canvas.aiMode}</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="editor" className="gap-1.5 px-3 text-xs">
            <MousePointer2 className="size-3.5" />
            <span className="hidden sm:inline">{t.canvas.editorMode}</span>
          </ToggleGroupItem>
        </ToggleGroup>

        <Separator orientation="vertical" className="h-5" />

        {/* Creative Mode Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={creativeMode ? 'default' : 'outline'}
              size="sm"
              className={`h-8 gap-1.5 text-xs px-3 ${
                creativeMode
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
                  : ''
              }`}
              onClick={() => setCreativeMode(!creativeMode)}
            >
              <Zap className="size-3.5" />
              <span className="hidden sm:inline">
                {locale === 'de' ? 'Kreativ' : 'Creative'}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[200px]">
            {creativeMode
              ? (locale === 'de' ? 'Kreativ-Modus: Mehrstufige Generierung für vielfältigere Designs' : 'Creative Mode: Multi-pass generation for more diverse designs')
              : (locale === 'de' ? 'Kreativ-Modus aktivieren für experimentellere Designs' : 'Enable Creative Mode for more experimental designs')}
          </TooltipContent>
        </Tooltip>

        {/* Enhance Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`h-8 gap-1.5 text-xs px-3 ${
                !designTree.children || designTree.children.length === 0 || isGenerating
                  ? 'opacity-50'
                  : qualityReport && qualityReport.overallScore < 80
                    ? 'border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/20'
                    : ''
              }`}
              onClick={handleEnhance}
              disabled={!designTree.children || designTree.children.length === 0 || isEnhancing || isGenerating}
            >
              {isEnhancing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Wand2 className="size-3.5" />
              )}
              <span className="hidden sm:inline">
                {isEnhancing
                  ? (locale === 'de' ? 'Verbessern...' : 'Enhancing...')
                  : (locale === 'de' ? 'Verbessern' : 'Enhance')}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[200px]">
            {qualityReport && qualityReport.overallScore < 80
              ? (locale === 'de' ? 'Design automatisch verbessern (Qualität: ' + qualityReport.overallScore + '/100)' : 'Auto-enhance design (Quality: ' + qualityReport.overallScore + '/100)')
              : (locale === 'de' ? 'Design-Qualität weiter verbessern' : 'Further improve design quality')}
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5" />

        {/* Viewport selector */}
        <ToggleGroup
          type="single"
          value={canvas.viewport}
          onValueChange={(value) => {
            if (value) setViewport(value as 'desktop' | 'tablet' | 'mobile');
          }}
          variant="outline"
          size="sm"
          className="h-8"
        >
          <ToggleGroupItem value="desktop" className="px-2.5">
            <Monitor className="size-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem value="tablet" className="px-2.5">
            <Tablet className="size-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem value="mobile" className="px-2.5">
            <Smartphone className="size-3.5" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1">
        {/* Templates button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setTemplateHubOpen(true)}
            >
              <Layout className="size-3.5" />
              <span className="hidden lg:inline">{t.nav.templates}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t.templates.title}</TooltipContent>
        </Tooltip>

        {/* Design System button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setDesignSystemOpen(true)}
            >
              <Paintbrush className="size-3.5" />
              <span className="hidden lg:inline">{t.nav.designSystems}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t.designSystem.title}</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        {/* Provider Settings button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setProviderSettingsOpen(true)}
            >
              <Settings2 className="size-3.5" />
              <span className="hidden lg:inline">
                {locale === 'de' ? 'Anbieter' : 'Providers'}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {locale === 'de' ? 'KI-Anbieter & Modelle konfigurieren' : 'Configure AI providers & models'}
          </TooltipContent>
        </Tooltip>

        {/* Share button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
              <Share2 className="size-3.5" />
              <span className="hidden md:inline">Share</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Share project</TooltipContent>
        </Tooltip>

        {/* Export dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
              <Download className="size-3.5" />
              <span className="hidden md:inline">{t.export.title}</span>
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>{t.export.title}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleExport('html')}>
              <FileCode className="size-4" />
              {t.export.html}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('pdf')}>
              <FileText className="size-4" />
              {t.export.pdf}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('zip')}>
              <Archive className="size-4" />
              {t.export.zip}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleExport('nextjs')}>
              <Globe className="size-4" />
              {t.export.nextjs}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('react')}>
              <FileCode className="size-4" />
              {t.export.react}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        {/* Language switcher */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setLocale(locale === 'en' ? 'de' : 'en')}
            >
              <Languages className="size-3.5" />
              <span className="text-[11px] font-medium uppercase">
                {locale}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {locale === 'en' ? 'Auf Deutsch umstellen' : 'Switch to English'}
          </TooltipContent>
        </Tooltip>

        {/* Theme toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {theme === 'dark' ? t.common.lightMode : t.common.darkMode}
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        {/* Right panel toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={toggleRightPanel}
            >
              {rightPanelOpen ? (
                <PanelRightClose className="size-4" />
              ) : (
                <PanelRightOpen className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {rightPanelOpen ? 'Hide Properties' : 'Show Properties'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Dialogs */}
      <TemplateHub open={templateHubOpen} onOpenChange={setTemplateHubOpen} />
      <DesignSystemManager open={designSystemOpen} onOpenChange={setDesignSystemOpen} />
      <ProviderSettings open={providerSettingsOpen} onOpenChange={setProviderSettingsOpen} />
    </header>
  );
}
