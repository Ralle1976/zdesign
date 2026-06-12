'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useZDesignStore } from '@/stores/zdesign-store';
import { useI18n } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Star,
  Download,
  Layout,
  X,
  Loader2,
  Check,
  Upload,
  Link,
  FileJson,
  Globe,
  Figma,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { DesignNode } from '@/types/design';

interface TemplateData {
  id: string;
  name: string;
  description: string;
  category: string;
  designJSON: string;
  thumbnail: string | null;
  tags: string[];
  downloads: number;
  rating: number;
  isPublic: boolean;
  createdAt: string;
}

const CATEGORY_GRADIENTS: Record<string, string> = {
  'SaaS': 'from-emerald-400 to-teal-500',
  'Dashboard': 'from-cyan-400 to-emerald-500',
  'App UI': 'from-teal-400 to-emerald-600',
  'E-Commerce': 'from-amber-400 to-orange-500',
  'Portfolio': 'from-rose-400 to-pink-500',
  'Marketing': 'from-violet-400 to-purple-500',
  'Landing Pages': 'from-emerald-500 to-cyan-500',
};

const CATEGORY_ICONS: Record<string, string> = {
  'SaaS': '☁️',
  'Dashboard': '📊',
  'App UI': '📱',
  'E-Commerce': '🛍️',
  'Portfolio': '🎨',
  'Marketing': '📣',
  'Landing Pages': '🚀',
};

type SortOption = 'popular' | 'newest' | 'rating';

interface TemplateHubProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateHub({ open, onOpenChange }: TemplateHubProps) {
  const { t } = useI18n();
  const setProject = useZDesignStore((s) => s.setProject);
  const setDesignTree = useZDesignStore((s) => s.setDesignTree);

  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [loading, setLoading] = useState(false);
  const [usingTemplate, setUsingTemplate] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [importTab, setImportTab] = useState<'browse' | 'import'>('browse');
  const [importJson, setImportJson] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importFigmaUrl, setImportFigmaUrl] = useState('');
  const [importing, setImporting] = useState<string | null>(null); // 'json' | 'url' | 'figma' | null
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  // Seed templates if none exist
  const seedTemplates = useCallback(async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/templates/seed', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (!data.skipped) {
          // Templates were just seeded, fetch them
        }
      }
    } catch {
      // Seeding failed
    } finally {
      setSeeding(false);
    }
  }, []);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      // First, ensure templates are seeded
      await seedTemplates();

      const params = new URLSearchParams();
      params.set('limit', '50');
      if (selectedCategory !== 'all') {
        params.set('category', selectedCategory);
      }
      if (searchQuery) {
        params.set('search', searchQuery);
      }
      if (sortBy === 'popular') {
        params.set('sortBy', 'downloads');
        params.set('sortOrder', 'desc');
      } else if (sortBy === 'newest') {
        params.set('sortBy', 'createdAt');
        params.set('sortOrder', 'desc');
      } else if (sortBy === 'rating') {
        params.set('sortBy', 'rating');
        params.set('sortOrder', 'desc');
      }

      const res = await fetch(`/api/templates?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
        if (data.categories && data.categories.length > 0) {
          setCategories(data.categories);
        }
      }
    } catch {
      // Fetch failed
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery, sortBy, seedTemplates]);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open, fetchTemplates]);

  // Filter categories for display - always show the standard categories
  const displayCategories = useMemo(() => {
    const standard = [
      'all',
      'SaaS',
      'Dashboard',
      'App UI',
      'Marketing',
      'Portfolio',
      'E-Commerce',
      'Landing Pages',
    ];
    // Merge with any from DB
    const merged = [...standard];
    for (const cat of categories) {
      if (!merged.includes(cat)) {
        merged.push(cat);
      }
    }
    return merged;
  }, [categories]);

  // Use template handler
  const handleUseTemplate = useCallback(
    async (template: TemplateData) => {
      setUsingTemplate(template.id);
      try {
        let designTree: DesignNode;
        try {
          designTree = JSON.parse(template.designJSON);
        } catch {
          designTree = {
            id: 'root',
            type: 'root',
            tag: 'div',
            children: [],
            style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' },
          };
        }

        // Create a new project with the template's design
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${template.name} Project`,
            type: 'PROTOTYPE',
            designJSON: template.designJSON,
          }),
        });

        if (res.ok) {
          const project = await res.json();
          setProject(project.id, project.name, project.type);
          setDesignTree(designTree);
          onOpenChange(false);
          toast.success(
            `${template.name} applied! Project created successfully.`,
            { icon: '🎨' }
          );
        } else {
          // Fallback: just update the current project
          setDesignTree(designTree);
          onOpenChange(false);
          toast.success(`${template.name} template applied!`, { icon: '🎨' });
        }
      } catch {
        toast.error('Failed to apply template. Please try again.');
      } finally {
        setUsingTemplate(null);
      }
    },
    [setProject, setDesignTree, onOpenChange]
  );

  // Render star rating
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.3;
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Star key={i} className="size-3.5 fill-amber-400 text-amber-400" />
        );
      } else if (i === fullStars && hasHalf) {
        stars.push(
          <Star key={i} className="size-3.5 fill-amber-400/50 text-amber-400" />
        );
      } else {
        stars.push(
          <Star key={i} className="size-3.5 text-gray-300 dark:text-gray-600" />
        );
      }
    }
    return stars;
  };

  // Helper: apply imported design tree to the store and optionally create a project
  const applyImportedDesign = useCallback(async (design: Record<string, unknown>, sourceLabel: string) => {
    const designTree = design as unknown as DesignNode;
    const designName = (design.meta as Record<string, unknown>)?.name as string || sourceLabel;

    // Try to create a project for the imported design
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Imported: ${designName}`,
          type: 'CUSTOM',
          designJSON: JSON.stringify(designTree),
        }),
      });
      if (res.ok) {
        const project = await res.json();
        setProject(project.id, project.name, project.type);
      }
    } catch {
      // Project creation failed, but we still apply the design
    }

    setDesignTree(designTree);
    onOpenChange(false);
    toast.success(`Design imported from ${sourceLabel}!`, { icon: '📦' });
  }, [setProject, setDesignTree, onOpenChange]);

  // Handle JSON import via /api/design/import
  const handleImportJson = useCallback(async () => {
    if (!importJson.trim()) return;
    setImporting('json');
    setImportError(null);
    setImportSuccess(null);
    try {
      const res = await fetch('/api/design/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'json', data: importJson.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || 'Failed to import JSON');
      }
      if (data.design) {
        await applyImportedDesign(data.design, data.source === 'figma-json' ? 'Figma JSON' : 'JSON');
      } else {
        throw new Error('No design data returned from import');
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Invalid JSON format');
    } finally {
      setImporting(null);
    }
  }, [importJson, applyImportedDesign]);

  // Handle URL import via /api/design/import
  const handleImportUrl = useCallback(async () => {
    if (!importUrl.trim()) return;
    setImporting('url');
    setImportError(null);
    setImportSuccess(null);
    try {
      const res = await fetch('/api/design/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'url', data: importUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || 'Failed to import from URL');
      }
      if (data.design) {
        const hostname = (() => { try { return new URL(importUrl).hostname; } catch { return importUrl; } })();
        await applyImportedDesign(data.design, hostname);
      } else {
        throw new Error('No design data returned from URL import');
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import from URL');
    } finally {
      setImporting(null);
    }
  }, [importUrl, applyImportedDesign]);

  // Handle Figma URL import via /api/design/import
  const handleImportFigma = useCallback(async () => {
    if (!importFigmaUrl.trim()) return;
    setImporting('figma');
    setImportError(null);
    setImportSuccess(null);
    try {
      const res = await fetch('/api/design/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'figma', data: importFigmaUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || 'Failed to import from Figma');
      }
      if (data.design) {
        await applyImportedDesign(data.design, 'Figma');
      } else {
        throw new Error('No design data returned from Figma import');
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import from Figma');
    } finally {
      setImporting(null);
    }
  }, [importFigmaUrl, applyImportedDesign]);

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJson(content);
      setImportError(null);
      setImportSuccess(`File "${file.name}" loaded. Click "Import JSON Design" to apply.`);
    };
    reader.readAsText(file);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">{t.templates.title}</DialogTitle>

        {/* Header */}
        <div className="flex flex-col border-b bg-background px-6 py-4 gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
                <Layout className="size-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{t.templates.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {loading ? t.common.loading : `${templates.length} templates available`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Browse / Import Tabs */}
              <div className="flex rounded-lg border bg-muted/50 p-0.5">
                <button
                  onClick={() => setImportTab('browse')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    importTab === 'browse'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Layout className="size-3.5" />
                    Browse
                  </span>
                </button>
                <button
                  onClick={() => setImportTab('import')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    importTab === 'import'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Upload className="size-3.5" />
                    Import
                  </span>
                </button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => onOpenChange(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Search + Sort */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder={t.templates.search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">
                  <span className="flex items-center gap-2">
                    <Download className="size-3.5" /> Popular
                  </span>
                </SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="rating">
                  <span className="flex items-center gap-2">
                    <Star className="size-3.5" /> Highest Rated
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {displayCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {cat === 'all'
                  ? t.templates.categories.all
                  : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Import Tab */}
        {importTab === 'import' ? (
          <ScrollArea className="flex-1 h-[calc(90vh-200px)]">
            <div className="p-6 max-w-2xl mx-auto space-y-6">
              <div className="text-center space-y-2 mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Sparkles className="size-5 text-emerald-500" />
                  <h3 className="text-lg font-semibold">Import Design from External Sources</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Import designs from JSON files, URLs, or Figma. Each source is processed and converted to a Z.Design design tree.
                </p>
              </div>

              {/* URL Import */}
              <div className="space-y-3 p-4 rounded-xl border bg-card">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Globe className="size-4 text-violet-500" />
                  Import from URL
                </h4>
                <p className="text-xs text-muted-foreground">
                  Paste a URL to analyze the page design, extract colors, headings, and create a similar layout.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={importUrl}
                    onChange={(e) => { setImportUrl(e.target.value); setImportError(null); setImportSuccess(null); }}
                    placeholder="https://example.com"
                    className="flex-1 h-9"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleImportUrl(); }}
                  />
                  <Button
                    onClick={handleImportUrl}
                    disabled={!importUrl.trim() || importing !== null}
                    className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {importing === 'url' ? (
                      <><Loader2 className="size-4 mr-1.5 animate-spin" />Importing...</>
                    ) : (
                      <><Link className="size-4 mr-1.5" />Import URL</>
                    )}
                  </Button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>

              {/* Figma Import */}
              <div className="space-y-3 p-4 rounded-xl border bg-card">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Figma className="size-4 text-[#A259FF]" />
                  Import from Figma
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                    Beta
                  </Badge>
                </h4>
                <p className="text-xs text-muted-foreground">
                  Paste a Figma file URL to import as a starting design. You can also paste Figma export JSON below.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={importFigmaUrl}
                    onChange={(e) => { setImportFigmaUrl(e.target.value); setImportError(null); setImportSuccess(null); }}
                    placeholder="https://figma.com/file/..."
                    className="flex-1 h-9"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleImportFigma(); }}
                  />
                  <Button
                    onClick={handleImportFigma}
                    disabled={!importFigmaUrl.trim() || importing !== null}
                    variant="outline"
                    className="shrink-0 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900/20"
                  >
                    {importing === 'figma' ? (
                      <><Loader2 className="size-4 mr-1.5 animate-spin" />Importing...</>
                    ) : (
                      <><Figma className="size-4 mr-1.5" />Import Figma</>
                    )}
                  </Button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>

              {/* File Upload + Paste JSON */}
              <div className="space-y-3 p-4 rounded-xl border bg-card">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <FileJson className="size-4 text-emerald-500" />
                  Import from JSON
                </h4>
                <p className="text-xs text-muted-foreground">
                  Upload a .json file or paste a Z.Design JSON / Figma export JSON directly.
                </p>

                {/* File Upload */}
                <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-emerald-400 transition-colors">
                  <input
                    type="file"
                    accept=".json,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="template-file-upload"
                  />
                  <label
                    htmlFor="template-file-upload"
                    className="cursor-pointer flex flex-col items-center gap-1.5"
                  >
                    <Upload className="size-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Click to upload a .json design file</span>
                    <span className="text-xs text-muted-foreground/60">Supports Z.Design and Figma JSON</span>
                  </label>
                </div>

                {/* Paste JSON */}
                <textarea
                  value={importJson}
                  onChange={(e) => { setImportJson(e.target.value); setImportError(null); setImportSuccess(null); }}
                  placeholder={'Paste your design JSON here...\n\nExample: {\n  "id": "root",\n  "type": "root",\n  "tag": "div",\n  "children": [...]\n}'}
                  className="w-full h-36 rounded-lg border bg-muted/30 p-3 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
                <Button
                  onClick={handleImportJson}
                  disabled={!importJson.trim() || importing !== null}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {importing === 'json' ? (
                    <><Loader2 className="size-4 mr-2 animate-spin" />Importing...</>
                  ) : (
                    <><FileJson className="size-4 mr-2" />Import JSON Design</>
                  )}
                </Button>
              </div>

              {/* Import Success */}
              {importSuccess && !importError && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">{importSuccess}</p>
                </div>
              )}

              {/* Import Error */}
              {importError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-600 dark:text-red-400">{importError}</p>
                </div>
              )}

              {/* Supported Sources Info */}
              <div className="p-4 rounded-xl bg-muted/30 border">
                <h4 className="text-sm font-medium mb-2">Supported Import Sources</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Globe className="size-3.5 text-violet-500" />
                    Website URLs
                  </div>
                  <div className="flex items-center gap-2">
                    <Figma className="size-3.5 text-[#A259FF]" />
                    Figma URLs
                  </div>
                  <div className="flex items-center gap-2">
                    <FileJson className="size-3.5 text-emerald-500" />
                    Z.Design JSON
                  </div>
                  <div className="flex items-center gap-2">
                    <FileJson className="size-3.5 text-cyan-500" />
                    Figma export JSON
                  </div>
                  <div className="flex items-center gap-2">
                    <Upload className="size-3.5 text-amber-500" />
                    File upload
                  </div>
                  <div className="flex items-center gap-2">
                    <ImageIcon className="size-3.5 text-rose-500" />
                    Image (via chat)
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <ScrollArea className="flex-1 h-[calc(90vh-200px)]">
            <div className="p-6">
              {seeding ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="size-8 animate-spin text-emerald-500" />
                  <p className="text-sm text-muted-foreground">Loading templates...</p>
                </div>
              ) : loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="size-8 animate-spin text-emerald-500" />
                  <p className="text-sm text-muted-foreground">{t.common.loading}</p>
                </div>
              ) : templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
                    <Layout className="size-8 text-muted-foreground" />
                  </div>
                <p className="text-muted-foreground">No templates found</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchTemplates}
                  className="gap-2"
                >
                  <Loader2 className="size-3.5" />
                  {t.common.retry}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                <AnimatePresence mode="popLayout">
                  {templates.map((template, index) => {
                    const gradient =
                      CATEGORY_GRADIENTS[template.category] ||
                      'from-gray-400 to-gray-500';
                    const icon =
                      CATEGORY_ICONS[template.category] || '📄';
                    const isUsing = usingTemplate === template.id;

                    return (
                      <motion.div
                        key={template.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ y: -4 }}
                        className="group flex flex-col rounded-xl border bg-card overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
                      >
                        {/* Thumbnail */}
                        <div
                          className={`relative h-44 bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden`}
                        >
                          <span className="text-5xl opacity-80 group-hover:scale-110 transition-transform duration-300">
                            {icon}
                          </span>
                          {/* Category badge overlay */}
                          <div className="absolute top-3 left-3">
                            <Badge
                              variant="secondary"
                              className="bg-white/90 text-gray-800 backdrop-blur-sm text-[11px] font-semibold"
                            >
                              {template.category}
                            </Badge>
                          </div>
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </div>

                        {/* Content */}
                        <div className="flex flex-col flex-1 p-4 gap-2">
                          <h3 className="font-semibold text-sm text-foreground leading-tight">
                            {template.name}
                          </h3>
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {template.description}
                          </p>

                          {/* Tags */}
                          {template.tags && template.tags.length > 0 && (
                            <div className="flex gap-1.5 flex-wrap mt-1">
                              {template.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Footer: rating + downloads + button */}
                          <div className="flex items-center justify-between mt-auto pt-3 border-t">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1">
                                {renderStars(template.rating)}
                                <span className="text-[11px] text-muted-foreground ml-1">
                                  {template.rating.toFixed(1)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Download className="size-3" />
                                <span className="text-[11px]">
                                  {template.downloads.toLocaleString()}
                                </span>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={isUsing}
                              onClick={() => handleUseTemplate(template)}
                            >
                              {isUsing ? (
                                <>
                                  <Loader2 className="size-3 animate-spin" />
                                  Applying...
                                </>
                              ) : (
                                <>
                                  <Check className="size-3" />
                                  {t.templates.useTemplate}
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
