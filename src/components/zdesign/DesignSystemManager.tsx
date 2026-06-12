'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Palette,
  Type,
  Ruler,
  Square,
  Layers,
  Plus,
  Trash2,
  X,
  Loader2,
  Save,
  Upload,
  Globe,
  Sparkles,
  Check,
  Paintbrush,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type {
  ColorToken,
  TypographyToken,
  SpacingToken,
  BorderRadiusToken,
  ShadowToken,
  DesignTokens,
} from '@/types/design';

// ============ Preset Palettes ============

interface PresetPalette {
  name: string;
  description: string;
  colors: ColorToken[];
  gradient: string;
}

const PRESET_PALETTES: PresetPalette[] = [
  {
    name: 'Emerald Modern',
    description: 'Our default palette — emerald & teal tones for a fresh, modern feel',
    gradient: 'from-emerald-400 to-teal-500',
    colors: [
      { name: 'primary', value: '#10b981', category: 'primary', description: 'Main brand color' },
      { name: 'primary-dark', value: '#059669', category: 'primary', description: 'Dark variant' },
      { name: 'primary-light', value: '#34d399', category: 'primary', description: 'Light variant' },
      { name: 'secondary', value: '#14b8a6', category: 'secondary', description: 'Teal accent' },
      { name: 'accent', value: '#06b6d4', category: 'accent', description: 'Cyan accent' },
      { name: 'success', value: '#22c55e', category: 'semantic', description: 'Success state' },
      { name: 'warning', value: '#f59e0b', category: 'semantic', description: 'Warning state' },
      { name: 'error', value: '#ef4444', category: 'semantic', description: 'Error state' },
      { name: 'text-primary', value: '#0f172a', category: 'neutral', description: 'Primary text' },
      { name: 'text-secondary', value: '#475569', category: 'neutral', description: 'Secondary text' },
      { name: 'text-muted', value: '#94a3b8', category: 'neutral', description: 'Muted text' },
      { name: 'background', value: '#ffffff', category: 'neutral', description: 'Page background' },
      { name: 'surface', value: '#f8fafc', category: 'neutral', description: 'Surface background' },
      { name: 'border', value: '#e2e8f0', category: 'neutral', description: 'Border color' },
    ],
  },
  {
    name: 'Ocean Blue',
    description: 'Professional blue palette for corporate and enterprise products',
    gradient: 'from-blue-400 to-indigo-500',
    colors: [
      { name: 'primary', value: '#3b82f6', category: 'primary', description: 'Main brand blue' },
      { name: 'primary-dark', value: '#2563eb', category: 'primary', description: 'Dark blue' },
      { name: 'primary-light', value: '#60a5fa', category: 'primary', description: 'Light blue' },
      { name: 'secondary', value: '#6366f1', category: 'secondary', description: 'Indigo accent' },
      { name: 'accent', value: '#8b5cf6', category: 'accent', description: 'Violet accent' },
      { name: 'success', value: '#22c55e', category: 'semantic', description: 'Success state' },
      { name: 'warning', value: '#f59e0b', category: 'semantic', description: 'Warning state' },
      { name: 'error', value: '#ef4444', category: 'semantic', description: 'Error state' },
      { name: 'text-primary', value: '#0f172a', category: 'neutral', description: 'Primary text' },
      { name: 'text-secondary', value: '#475569', category: 'neutral', description: 'Secondary text' },
      { name: 'text-muted', value: '#94a3b8', category: 'neutral', description: 'Muted text' },
      { name: 'background', value: '#ffffff', category: 'neutral', description: 'Page background' },
      { name: 'surface', value: '#f1f5f9', category: 'neutral', description: 'Surface' },
      { name: 'border', value: '#e2e8f0', category: 'neutral', description: 'Border color' },
    ],
  },
  {
    name: 'Sunset Warm',
    description: 'Warm orange and red tones for energetic, friendly brands',
    gradient: 'from-orange-400 to-rose-500',
    colors: [
      { name: 'primary', value: '#f97316', category: 'primary', description: 'Warm orange' },
      { name: 'primary-dark', value: '#ea580c', category: 'primary', description: 'Dark orange' },
      { name: 'primary-light', value: '#fb923c', category: 'primary', description: 'Light orange' },
      { name: 'secondary', value: '#f43f5e', category: 'secondary', description: 'Rose accent' },
      { name: 'accent', value: '#eab308', category: 'accent', description: 'Yellow accent' },
      { name: 'success', value: '#22c55e', category: 'semantic', description: 'Success state' },
      { name: 'warning', value: '#f59e0b', category: 'semantic', description: 'Warning state' },
      { name: 'error', value: '#ef4444', category: 'semantic', description: 'Error state' },
      { name: 'text-primary', value: '#1c1917', category: 'neutral', description: 'Primary text' },
      { name: 'text-secondary', value: '#57534e', category: 'neutral', description: 'Secondary text' },
      { name: 'text-muted', value: '#a8a29e', category: 'neutral', description: 'Muted text' },
      { name: 'background', value: '#ffffff', category: 'neutral', description: 'Page background' },
      { name: 'surface', value: '#fafaf9', category: 'neutral', description: 'Surface' },
      { name: 'border', value: '#e7e5e4', category: 'neutral', description: 'Border color' },
    ],
  },
  {
    name: 'Forest Natural',
    description: 'Green earth tones for eco, nature, and sustainability brands',
    gradient: 'from-green-500 to-lime-500',
    colors: [
      { name: 'primary', value: '#22c55e', category: 'primary', description: 'Natural green' },
      { name: 'primary-dark', value: '#16a34a', category: 'primary', description: 'Dark green' },
      { name: 'primary-light', value: '#4ade80', category: 'primary', description: 'Light green' },
      { name: 'secondary', value: '#84cc16', category: 'secondary', description: 'Lime accent' },
      { name: 'accent', value: '#a3e635', category: 'accent', description: 'Yellow-green' },
      { name: 'success', value: '#22c55e', category: 'semantic', description: 'Success state' },
      { name: 'warning', value: '#eab308', category: 'semantic', description: 'Warning state' },
      { name: 'error', value: '#ef4444', category: 'semantic', description: 'Error state' },
      { name: 'text-primary', value: '#1a2e05', category: 'neutral', description: 'Primary text' },
      { name: 'text-secondary', value: '#365314', category: 'neutral', description: 'Secondary text' },
      { name: 'text-muted', value: '#84cc16', category: 'neutral', description: 'Muted text' },
      { name: 'background', value: '#ffffff', category: 'neutral', description: 'Page background' },
      { name: 'surface', value: '#f7fee7', category: 'neutral', description: 'Surface' },
      { name: 'border', value: '#d9f99d', category: 'neutral', description: 'Border color' },
    ],
  },
  {
    name: 'Midnight Dark',
    description: 'Dark theme palette with cool neutrals and accent pops',
    gradient: 'from-gray-700 to-gray-900',
    colors: [
      { name: 'primary', value: '#a78bfa', category: 'primary', description: 'Violet primary' },
      { name: 'primary-dark', value: '#8b5cf6', category: 'primary', description: 'Dark violet' },
      { name: 'primary-light', value: '#c4b5fd', category: 'primary', description: 'Light violet' },
      { name: 'secondary', value: '#38bdf8', category: 'secondary', description: 'Sky accent' },
      { name: 'accent', value: '#34d399', category: 'accent', description: 'Emerald accent' },
      { name: 'success', value: '#4ade80', category: 'semantic', description: 'Success state' },
      { name: 'warning', value: '#fbbf24', category: 'semantic', description: 'Warning state' },
      { name: 'error', value: '#f87171', category: 'semantic', description: 'Error state' },
      { name: 'text-primary', value: '#f1f5f9', category: 'neutral', description: 'Primary text' },
      { name: 'text-secondary', value: '#94a3b8', category: 'neutral', description: 'Secondary text' },
      { name: 'text-muted', value: '#64748b', category: 'neutral', description: 'Muted text' },
      { name: 'background', value: '#0f172a', category: 'neutral', description: 'Page background' },
      { name: 'surface', value: '#1e293b', category: 'neutral', description: 'Surface' },
      { name: 'border', value: '#334155', category: 'neutral', description: 'Border color' },
    ],
  },
  {
    name: 'Minimal Monochrome',
    description: 'Clean black, white, and gray for minimalist designs',
    gradient: 'from-gray-400 to-gray-600',
    colors: [
      { name: 'primary', value: '#18181b', category: 'primary', description: 'Near black' },
      { name: 'primary-dark', value: '#09090b', category: 'primary', description: 'Black' },
      { name: 'primary-light', value: '#3f3f46', category: 'primary', description: 'Dark gray' },
      { name: 'secondary', value: '#71717a', category: 'secondary', description: 'Mid gray' },
      { name: 'accent', value: '#10b981', category: 'accent', description: 'Emerald pop' },
      { name: 'success', value: '#22c55e', category: 'semantic', description: 'Success state' },
      { name: 'warning', value: '#f59e0b', category: 'semantic', description: 'Warning state' },
      { name: 'error', value: '#ef4444', category: 'semantic', description: 'Error state' },
      { name: 'text-primary', value: '#09090b', category: 'neutral', description: 'Primary text' },
      { name: 'text-secondary', value: '#52525b', category: 'neutral', description: 'Secondary text' },
      { name: 'text-muted', value: '#a1a1aa', category: 'neutral', description: 'Muted text' },
      { name: 'background', value: '#ffffff', category: 'neutral', description: 'Page background' },
      { name: 'surface', value: '#fafafa', category: 'neutral', description: 'Surface' },
      { name: 'border', value: '#e4e4e7', category: 'neutral', description: 'Border color' },
    ],
  },
];

// Common font families
const FONT_FAMILIES = [
  'Inter, system-ui, sans-serif',
  'Arial, Helvetica, sans-serif',
  'Georgia, serif',
  'Menlo, monospace',
  'Roboto, sans-serif',
  'Open Sans, sans-serif',
  'Lato, sans-serif',
  'Montserrat, sans-serif',
  'Poppins, sans-serif',
  'Playfair Display, serif',
  'Source Code Pro, monospace',
  'Fira Code, monospace',
];

const FONT_WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];

const COLOR_CATEGORIES: ColorToken['category'][] = [
  'primary',
  'secondary',
  'accent',
  'neutral',
  'semantic',
  'custom',
];

const DEFAULT_SPACING: SpacingToken[] = [
  { name: 'xs', value: '4px' },
  { name: 'sm', value: '8px' },
  { name: 'md', value: '12px' },
  { name: 'lg', value: '16px' },
  { name: 'xl', value: '24px' },
  { name: '2xl', value: '32px' },
  { name: '3xl', value: '48px' },
  { name: '4xl', value: '64px' },
];

const DEFAULT_BORDER_RADIUS: BorderRadiusToken[] = [
  { name: 'none', value: '0px' },
  { name: 'sm', value: '4px' },
  { name: 'md', value: '8px' },
  { name: 'lg', value: '12px' },
  { name: 'xl', value: '16px' },
  { name: '2xl', value: '24px' },
  { name: 'full', value: '9999px' },
];

const DEFAULT_SHADOWS: ShadowToken[] = [
  { name: 'xs', value: '0 1px 2px rgba(0,0,0,0.05)' },
  { name: 'sm', value: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' },
  { name: 'md', value: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)' },
  { name: 'lg', value: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)' },
  { name: 'xl', value: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)' },
];

const DEFAULT_TYPOGRAPHY: TypographyToken[] = [
  { name: 'heading-xl', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '48px', fontWeight: '800', lineHeight: '1.1' },
  { name: 'heading-lg', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '36px', fontWeight: '700', lineHeight: '1.2' },
  { name: 'heading-md', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '24px', fontWeight: '700', lineHeight: '1.3' },
  { name: 'heading-sm', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '20px', fontWeight: '600', lineHeight: '1.4' },
  { name: 'body-lg', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '18px', fontWeight: '400', lineHeight: '1.6' },
  { name: 'body-md', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '16px', fontWeight: '400', lineHeight: '1.6' },
  { name: 'body-sm', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '14px', fontWeight: '400', lineHeight: '1.5' },
  { name: 'caption', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12px', fontWeight: '400', lineHeight: '1.4' },
];

// ============ Component ============

interface DesignSystemManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DesignSystemManager({ open, onOpenChange }: DesignSystemManagerProps) {
  const { t } = useI18n();
  const designSystem = useZDesignStore((s) => s.designSystem);
  const setDesignSystem = useZDesignStore((s) => s.setDesignSystem);
  const projectId = useZDesignStore((s) => s.projectId);

  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [activeTab, setActiveTab] = useState('colors');
  const [saving, setSaving] = useState(false);

  // Form state
  const [systemName, setSystemName] = useState('');
  const [systemDescription, setSystemDescription] = useState('');
  const [importMode, setImportMode] = useState<'scratch' | 'preset' | 'screenshot' | 'url'>('scratch');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);

  // Token state
  const [colors, setColors] = useState<ColorToken[]>([]);
  const [typography, setTypography] = useState<TypographyToken[]>([]);
  const [spacing, setSpacing] = useState<SpacingToken[]>(DEFAULT_SPACING);
  const [borderRadius, setBorderRadius] = useState<BorderRadiusToken[]>(DEFAULT_BORDER_RADIUS);
  const [shadows, setShadows] = useState<ShadowToken[]>(DEFAULT_SHADOWS);

  // Load existing design system if present
  useEffect(() => {
    if (open && designSystem) {
      setMode('edit');
      setSystemName(designSystem.name);
      setSystemDescription(designSystem.description || '');
      setColors(designSystem.tokens.colors);
      setTypography(designSystem.tokens.typography);
      setSpacing(designSystem.tokens.spacing);
      setBorderRadius(designSystem.tokens.borderRadius);
      setShadows(designSystem.tokens.shadows);
    } else if (open) {
      setMode('create');
      setSystemName('');
      setSystemDescription('');
      setImportMode('scratch');
      setSelectedPreset(null);
      setColors(PRESET_PALETTES[0].colors);
      setTypography(DEFAULT_TYPOGRAPHY);
      setSpacing(DEFAULT_SPACING);
      setBorderRadius(DEFAULT_BORDER_RADIUS);
      setShadows(DEFAULT_SHADOWS);
    }
  }, [open, designSystem]);

  // Apply preset palette
  const applyPreset = useCallback((paletteName: string) => {
    const preset = PRESET_PALETTES.find((p) => p.name === paletteName);
    if (preset) {
      setSelectedPreset(paletteName);
      setColors([...preset.colors]);
      if (!systemName) {
        setSystemName(paletteName + ' System');
      }
    }
  }, [systemName]);

  // Import from URL using web reader
  const handleImportFromUrl = useCallback(async () => {
    if (!importUrl.trim()) return;
    setImporting(true);
    try {
      const res = await fetch('/api/design/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: importUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.tokens) {
          if (data.tokens.colors && data.tokens.colors.length > 0) {
            setColors(data.tokens.colors);
          }
          toast.success('Design tokens imported from URL!');
        }
      } else {
        toast.error('Could not extract design tokens from this URL');
      }
    } catch {
      toast.error('Failed to import from URL');
    } finally {
      setImporting(false);
    }
  }, [importUrl]);

  // Import from screenshot using VLM
  const handleImportFromScreenshot = useCallback(async (file: File) => {
    setImporting(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/design/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.tokens) {
          if (data.tokens.colors && data.tokens.colors.length > 0) {
            setColors(data.tokens.colors);
          }
          if (data.tokens.typography && data.tokens.typography.length > 0) {
            setTypography(data.tokens.typography);
          }
          toast.success('Design tokens extracted from screenshot!');
        }
      } else {
        toast.error('Could not extract design tokens from image');
      }
    } catch {
      toast.error('Failed to import from screenshot');
    } finally {
      setImporting(false);
    }
  }, []);

  // Color CRUD
  const addColor = useCallback(() => {
    setColors((prev) => [
      ...prev,
      { name: `color-${prev.length + 1}`, value: '#6b7280', category: 'custom', description: '' },
    ]);
  }, []);

  const removeColor = useCallback((index: number) => {
    setColors((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateColor = useCallback((index: number, field: keyof ColorToken, value: string) => {
    setColors((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  }, []);

  // Typography CRUD
  const addTypography = useCallback(() => {
    setTypography((prev) => [
      ...prev,
      { name: `style-${prev.length + 1}`, fontFamily: 'Inter, system-ui, sans-serif', fontSize: '16px', fontWeight: '400', lineHeight: '1.5' },
    ]);
  }, []);

  const removeTypography = useCallback((index: number) => {
    setTypography((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateTypography = useCallback((index: number, field: keyof TypographyToken, value: string) => {
    setTypography((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    );
  }, []);

  // Spacing CRUD
  const updateSpacing = useCallback((index: number, value: string) => {
    setSpacing((prev) =>
      prev.map((s, i) => (i === index ? { ...s, value } : s))
    );
  }, []);

  // Border radius CRUD
  const updateBorderRadius = useCallback((index: number, value: string) => {
    setBorderRadius((prev) =>
      prev.map((b, i) => (i === index ? { ...b, value } : b))
    );
  }, []);

  // Shadow CRUD
  const addShadow = useCallback(() => {
    setShadows((prev) => [
      ...prev,
      { name: `shadow-${prev.length + 1}`, value: '0 1px 3px rgba(0,0,0,0.1)' },
    ]);
  }, []);

  const removeShadow = useCallback((index: number) => {
    setShadows((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateShadow = useCallback((index: number, field: keyof ShadowToken, value: string) => {
    setShadows((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }, []);

  // Save design system
  const handleSave = useCallback(async () => {
    if (!systemName.trim()) {
      toast.error('Please enter a name for the design system');
      return;
    }

    setSaving(true);
    try {
      const tokens: DesignTokens = {
        colors,
        typography,
        spacing,
        borderRadius,
        shadows,
      };

      const payload = {
        name: systemName,
        description: systemDescription,
        tokens,
        components: [],
        styles: { presetStyles: [], animationPresets: [] },
        isDefault: false,
      };

      let dsId = designSystem?.id;

      if (mode === 'edit' && dsId) {
        // Update existing
        const res = await fetch(`/api/design-systems/${dsId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          dsId = data.designSystem.id;
        }
      } else {
        // Create new
        const res = await fetch('/api/design-systems', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          dsId = data.designSystem.id;
        }
      }

      // Apply to project
      if (dsId && projectId) {
        await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ designSystemId: dsId }),
        });
      }

      // Update store
      setDesignSystem({
        id: dsId || 'temp',
        name: systemName,
        description: systemDescription || undefined,
        tokens,
        components: [],
        styles: { presetStyles: [], animationPresets: [] },
      });

      toast.success(`Design system "${systemName}" saved & applied!`, { icon: '🎨' });
      onOpenChange(false);
    } catch {
      toast.error('Failed to save design system');
    } finally {
      setSaving(false);
    }
  }, [systemName, systemDescription, colors, typography, spacing, borderRadius, shadows, mode, designSystem, projectId, setDesignSystem, onOpenChange]);

  // Validate hex color
  const isValidHex = (hex: string) => /^#[0-9A-Fa-f]{6}$/.test(hex);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] w-full max-h-[90vh] h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">{t.designSystem.title}</DialogTitle>

        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
                <Paintbrush className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {mode === 'create' ? t.designSystem.newSystem : t.designSystem.title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {mode === 'create' ? 'Create a new design system' : `Editing: ${systemName}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                {t.common.save}
              </Button>
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

          <div className="flex-1 min-h-0 flex">
            {/* Left: Name + Import (create mode) or Info (edit mode) */}
            <div className="w-[280px] border-r bg-muted/30 p-4 flex flex-col gap-4 overflow-y-auto">
              {/* Name */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Name
                </label>
                <Input
                  placeholder="My Design System"
                  value={systemName}
                  onChange={(e) => setSystemName(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Description
                </label>
                <Textarea
                  placeholder="Describe your design system..."
                  value={systemDescription}
                  onChange={(e) => setSystemDescription(e.target.value)}
                  className="min-h-[80px] resize-none text-sm"
                />
              </div>

              {mode === 'create' && (
                <>
                  {/* Import Options */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Import
                    </label>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant={importMode === 'scratch' ? 'default' : 'outline'}
                        size="sm"
                        className="w-full justify-start gap-2 text-xs h-8"
                        onClick={() => setImportMode('scratch')}
                      >
                        <Sparkles className="size-3.5" />
                        Start from Scratch
                      </Button>
                      <Button
                        variant={importMode === 'preset' ? 'default' : 'outline'}
                        size="sm"
                        className="w-full justify-start gap-2 text-xs h-8"
                        onClick={() => setImportMode('preset')}
                      >
                        <Layers className="size-3.5" />
                        Use Preset
                      </Button>
                      <Button
                        variant={importMode === 'screenshot' ? 'default' : 'outline'}
                        size="sm"
                        className="w-full justify-start gap-2 text-xs h-8"
                        onClick={() => setImportMode('screenshot')}
                      >
                        <Upload className="size-3.5" />
                        Import from Screenshot
                      </Button>
                      <Button
                        variant={importMode === 'url' ? 'default' : 'outline'}
                        size="sm"
                        className="w-full justify-start gap-2 text-xs h-8"
                        onClick={() => setImportMode('url')}
                      >
                        <Globe className="size-3.5" />
                        Import from URL
                      </Button>
                    </div>
                  </div>

                  {/* Preset Selection */}
                  {importMode === 'preset' && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Preset Palettes
                      </label>
                      <div className="flex flex-col gap-2">
                        {PRESET_PALETTES.map((preset) => (
                          <motion.button
                            key={preset.name}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => applyPreset(preset.name)}
                            className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${
                              selectedPreset === preset.name
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                                : 'border-border hover:border-emerald-300'
                            }`}
                          >
                            <div
                              className={`size-8 rounded-md bg-gradient-to-br ${preset.gradient} shrink-0`}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground truncate">
                                {preset.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {preset.description}
                              </p>
                            </div>
                            {selectedPreset === preset.name && (
                              <Check className="size-4 text-emerald-600 shrink-0 ml-auto" />
                            )}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Screenshot Import */}
                  {importMode === 'screenshot' && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Upload Screenshot
                      </label>
                      <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-emerald-400 transition-colors">
                        <Upload className="size-8 text-muted-foreground mb-2" />
                        <span className="text-xs text-muted-foreground">
                          {importing ? 'Analyzing...' : 'Click to upload image'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImportFromScreenshot(file);
                          }}
                          disabled={importing}
                        />
                      </label>
                    </div>
                  )}

                  {/* URL Import */}
                  {importMode === 'url' && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Website URL
                      </label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="https://example.com"
                          value={importUrl}
                          onChange={(e) => setImportUrl(e.target.value)}
                          className="h-8 text-xs"
                        />
                        <Button
                          size="sm"
                          className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                          disabled={importing || !importUrl.trim()}
                          onClick={handleImportFromUrl}
                        >
                          {importing ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Globe className="size-3" />
                          )}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Extract colors and typography from any website
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Token Summary */}
              <div className="mt-auto pt-4 border-t space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Token Summary
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-md bg-background border text-center">
                    <p className="text-lg font-bold text-foreground">{colors.length}</p>
                    <p className="text-[10px] text-muted-foreground">Colors</p>
                  </div>
                  <div className="p-2 rounded-md bg-background border text-center">
                    <p className="text-lg font-bold text-foreground">{typography.length}</p>
                    <p className="text-[10px] text-muted-foreground">Typography</p>
                  </div>
                  <div className="p-2 rounded-md bg-background border text-center">
                    <p className="text-lg font-bold text-foreground">{spacing.length}</p>
                    <p className="text-[10px] text-muted-foreground">Spacing</p>
                  </div>
                  <div className="p-2 rounded-md bg-background border text-center">
                    <p className="text-lg font-bold text-foreground">{shadows.length}</p>
                    <p className="text-[10px] text-muted-foreground">Shadows</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Token Editor */}
            <div className="flex-1 min-w-0 flex flex-col">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList className="w-full rounded-none border-b h-10 flex px-4 bg-transparent">
                  <TabsTrigger value="colors" className="gap-1.5 text-xs data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
                    <Palette className="size-3.5" />
                    {t.designSystem.colors}
                  </TabsTrigger>
                  <TabsTrigger value="typography" className="gap-1.5 text-xs data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
                    <Type className="size-3.5" />
                    {t.designSystem.typography}
                  </TabsTrigger>
                  <TabsTrigger value="spacing" className="gap-1.5 text-xs data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
                    <Ruler className="size-3.5" />
                    {t.designSystem.spacing}
                  </TabsTrigger>
                  <TabsTrigger value="radius" className="gap-1.5 text-xs data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
                    <Square className="size-3.5" />
                    Radius
                  </TabsTrigger>
                  <TabsTrigger value="shadows" className="gap-1.5 text-xs data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
                    <Layers className="size-3.5" />
                    Shadows
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1">
                  {/* Colors Tab */}
                  <TabsContent value="colors" className="p-4 mt-0">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-medium text-foreground">
                        {colors.length} color tokens
                      </p>
                      <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={addColor}>
                        <Plus className="size-3" /> Add Color
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <AnimatePresence>
                        {colors.map((color, index) => (
                          <motion.div
                            key={`${color.name}-${index}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex items-center gap-3 p-3 rounded-lg border bg-background group"
                          >
                            {/* Color swatch + picker */}
                            <div className="relative shrink-0">
                              <div
                                className="size-10 rounded-lg border cursor-pointer shadow-sm"
                                style={{ backgroundColor: color.value }}
                              />
                              <input
                                type="color"
                                value={color.value}
                                onChange={(e) => updateColor(index, 'value', e.target.value)}
                                className="absolute inset-0 opacity-0 cursor-pointer size-10"
                              />
                            </div>

                            {/* Name */}
                            <Input
                              value={color.name}
                              onChange={(e) => updateColor(index, 'name', e.target.value)}
                              className="h-8 text-xs w-[120px]"
                              placeholder="Token name"
                            />

                            {/* Hex value */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">#</span>
                              <Input
                                value={color.value.replace('#', '')}
                                onChange={(e) => {
                                  const val = `#${e.target.value}`;
                                  if (isValidHex(val) || e.target.value.length <= 6) {
                                    updateColor(index, 'value', val.length <= 7 ? val : color.value);
                                  }
                                }}
                                className="h-8 text-xs w-[80px] font-mono"
                                maxLength={6}
                              />
                            </div>

                            {/* Category */}
                            <Select
                              value={color.category}
                              onValueChange={(v) => updateColor(index, 'category', v)}
                            >
                              <SelectTrigger className="h-8 text-xs w-[100px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {COLOR_CATEGORIES.map((cat) => (
                                  <SelectItem key={cat} value={cat}>
                                    <span className="capitalize text-xs">{cat}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Delete */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                              onClick={() => removeColor(index)}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </TabsContent>

                  {/* Typography Tab */}
                  <TabsContent value="typography" className="p-4 mt-0">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-medium text-foreground">
                        {typography.length} typography tokens
                      </p>
                      <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={addTypography}>
                        <Plus className="size-3" /> Add Style
                      </Button>
                    </div>
                    <div className="space-y-3">
                      <AnimatePresence>
                        {typography.map((typo, index) => (
                          <motion.div
                            key={`${typo.name}-${index}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="p-4 rounded-lg border bg-background space-y-3 group"
                          >
                            <div className="flex items-center justify-between">
                              <Input
                                value={typo.name}
                                onChange={(e) => updateTypography(index, 'name', e.target.value)}
                                className="h-8 text-xs w-[140px] font-semibold"
                                placeholder="Style name"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                                onClick={() => removeTypography(index)}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-4 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] text-muted-foreground font-medium">Font</label>
                                <Select
                                  value={typo.fontFamily}
                                  onValueChange={(v) => updateTypography(index, 'fontFamily', v)}
                                >
                                  <SelectTrigger className="h-8 text-[11px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FONT_FAMILIES.map((ff) => (
                                      <SelectItem key={ff} value={ff}>
                                        <span className="text-xs" style={{ fontFamily: ff }}>
                                          {ff.split(',')[0]}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] text-muted-foreground font-medium">Size</label>
                                <Input
                                  value={typo.fontSize}
                                  onChange={(e) => updateTypography(index, 'fontSize', e.target.value)}
                                  className="h-8 text-[11px] font-mono"
                                  placeholder="16px"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] text-muted-foreground font-medium">Weight</label>
                                <Select
                                  value={typo.fontWeight}
                                  onValueChange={(v) => updateTypography(index, 'fontWeight', v)}
                                >
                                  <SelectTrigger className="h-8 text-[11px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FONT_WEIGHTS.map((w) => (
                                      <SelectItem key={w} value={w}>
                                        <span className="text-xs font-mono">{w}</span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] text-muted-foreground font-medium">Line H</label>
                                <Input
                                  value={typo.lineHeight}
                                  onChange={(e) => updateTypography(index, 'lineHeight', e.target.value)}
                                  className="h-8 text-[11px] font-mono"
                                  placeholder="1.5"
                                />
                              </div>
                            </div>
                            {/* Preview */}
                            <div className="pt-2 border-t">
                              <p
                                className="text-foreground truncate"
                                style={{
                                  fontFamily: typo.fontFamily,
                                  fontSize: `${Math.min(parseInt(typo.fontSize) || 16, 32)}px`,
                                  fontWeight: typo.fontWeight,
                                  lineHeight: typo.lineHeight,
                                }}
                              >
                                The quick brown fox
                              </p>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </TabsContent>

                  {/* Spacing Tab */}
                  <TabsContent value="spacing" className="p-4 mt-0">
                    <p className="text-sm font-medium text-foreground mb-4">
                      {spacing.length} spacing tokens
                    </p>
                    <div className="space-y-3">
                      {spacing.map((sp, index) => {
                        const pxVal = parseInt(sp.value) || 0;
                        const barWidth = Math.min(pxVal * 2, 200);
                        return (
                          <div key={sp.name} className="flex items-center gap-4 p-3 rounded-lg border bg-background">
                            <span className="text-xs font-mono font-semibold text-foreground w-[40px]">
                              {sp.name}
                            </span>
                            <Input
                              value={sp.value}
                              onChange={(e) => updateSpacing(index, e.target.value)}
                              className="h-8 text-xs font-mono w-[80px]"
                            />
                            <div className="flex-1 h-6 rounded bg-muted relative overflow-hidden">
                              <div
                                className="h-full rounded bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-300"
                                style={{ width: `${barWidth}px` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-[40px] text-right">
                              {pxVal}px
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </TabsContent>

                  {/* Border Radius Tab */}
                  <TabsContent value="radius" className="p-4 mt-0">
                    <p className="text-sm font-medium text-foreground mb-4">
                      {borderRadius.length} border radius tokens
                    </p>
                    <div className="space-y-3">
                      {borderRadius.map((br, index) => {
                        const pxVal = parseInt(br.value) || 0;
                        const clampedVal = Math.min(pxVal, 32);
                        return (
                          <div key={br.name} className="flex items-center gap-4 p-3 rounded-lg border bg-background">
                            <span className="text-xs font-mono font-semibold text-foreground w-[40px]">
                              {br.name}
                            </span>
                            <Input
                              value={br.value}
                              onChange={(e) => updateBorderRadius(index, e.target.value)}
                              className="h-8 text-xs font-mono w-[80px]"
                            />
                            <div className="flex-1 flex items-center justify-center">
                              <div
                                className="size-10 border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 transition-all duration-300"
                                style={{ borderRadius: `${clampedVal}px` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-[40px] text-right">
                              {pxVal}px
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </TabsContent>

                  {/* Shadows Tab */}
                  <TabsContent value="shadows" className="p-4 mt-0">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-medium text-foreground">
                        {shadows.length} shadow tokens
                      </p>
                      <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={addShadow}>
                        <Plus className="size-3" /> Add Shadow
                      </Button>
                    </div>
                    <div className="space-y-3">
                      <AnimatePresence>
                        {shadows.map((shadow, index) => (
                          <motion.div
                            key={`${shadow.name}-${index}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex items-center gap-4 p-3 rounded-lg border bg-background group"
                          >
                            <Input
                              value={shadow.name}
                              onChange={(e) => updateShadow(index, 'name', e.target.value)}
                              className="h-8 text-xs font-mono w-[100px]"
                              placeholder="Name"
                            />
                            <Input
                              value={shadow.value}
                              onChange={(e) => updateShadow(index, 'value', e.target.value)}
                              className="h-8 text-[11px] font-mono flex-1"
                              placeholder="0 4px 6px rgba(0,0,0,0.1)"
                            />
                            {/* Preview */}
                            <div
                              className="size-12 rounded-lg bg-white dark:bg-gray-800 shrink-0"
                              style={{ boxShadow: shadow.value }}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                              onClick={() => removeShadow(index)}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
