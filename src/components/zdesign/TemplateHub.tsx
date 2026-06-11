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
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
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

        {/* Template Grid */}
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
      </DialogContent>
    </Dialog>
  );
}
