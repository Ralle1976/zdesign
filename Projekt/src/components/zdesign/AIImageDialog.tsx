'use client';

import { useState, useCallback } from 'react';
import { useI18n } from '@/i18n';
import { useZDesignStore } from '@/stores/zdesign-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  ImageIcon,
  Loader2,
  Wand2,
  Camera,
  Palette,
  Layers,
  Zap,
  Upload,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DesignNode } from '@/types/design';

const STYLE_OPTIONS = [
  { id: 'photorealistic', label: 'Photorealistic', icon: Camera },
  { id: 'illustration', label: 'Illustration', icon: Palette },
  { id: 'icon', label: 'Icon', icon: Zap },
  { id: 'abstract', label: 'Abstract', icon: Layers },
  { id: 'gradient', label: 'Gradient', icon: Wand2 },
] as const;

const SIZE_OPTIONS = [
  { id: '1024x1024', label: '1:1 Square', w: 1024, h: 1024 },
  { id: '1344x768', label: '16:9 Wide', w: 1344, h: 768 },
  { id: '768x1344', label: '9:16 Tall', w: 768, h: 1344 },
  { id: '1152x864', label: '4:3 Standard', w: 1152, h: 864 },
  { id: '864x1152', label: '3:4 Portrait', w: 864, h: 1152 },
] as const;

const PROMPT_SUGGESTIONS = [
  { key: 'hero', icon: '🏔️', text: 'Hero background with mountains and gradient sky' },
  { key: 'illustration', icon: '🎨', text: 'Flat illustration of a team collaborating' },
  { key: 'icon', icon: '✨', text: 'Minimal app icon with gradient' },
  { key: 'product', icon: '📦', text: 'Product photo on clean white background' },
  { key: 'abstract', icon: '🌀', text: 'Abstract geometric pattern with soft colors' },
  { key: 'nature', icon: '🌿', text: 'Nature landscape with soft lighting' },
];

interface AIImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIImageDialog({ open, onOpenChange }: AIImageDialogProps) {
  const { t } = useI18n();
  const designTree = useZDesignStore((s) => s.designTree);
  const setDesignTree = useZDesignStore((s) => s.setDesignTree);

  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string>('photorealistic');
  const [selectedSize, setSelectedSize] = useState<string>('1024x1024');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedImageUrl(null);

    try {
      const res = await fetch('/api/design/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          size: selectedSize,
          style: selectedStyle,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Image generation failed');
      }

      const data = await res.json();
      setGeneratedImageUrl(data.url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Generation failed';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, selectedStyle, selectedSize, isGenerating]);

  const handleInsert = useCallback(() => {
    if (!generatedImageUrl) return;

    const sizeOption = SIZE_OPTIONS.find((s) => s.id === selectedSize) || SIZE_OPTIONS[0];
    const imageNode: DesignNode = {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'image',
      content: generatedImageUrl,
      style: {
        width: `${Math.min(sizeOption.w, 800)}px`,
        height: 'auto',
        maxWidth: '100%',
        objectFit: 'cover',
        borderRadius: '8px',
      },
      meta: {
        name: 'AI Generated Image',
        description: prompt,
      },
    };

    // Add the image node as a child of the root
    const newTree = {
      ...designTree,
      children: [...(designTree.children || []), imageNode],
    };
    setDesignTree(newTree);

    // Reset and close
    setPrompt('');
    setGeneratedImageUrl(null);
    setError(null);
    onOpenChange(false);
  }, [generatedImageUrl, selectedSize, prompt, designTree, setDesignTree, onOpenChange]);

  const handleClose = useCallback(() => {
    if (!isGenerating) {
      setGeneratedImageUrl(null);
      setError(null);
      onOpenChange(false);
    }
  }, [isGenerating, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="flex items-center justify-center size-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <Sparkles className="size-4" />
            </div>
            {t.aiImage?.title || 'AI Image Generator'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t.aiImage?.subtitle || 'Generate images with AI and insert them into your design'}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {/* Prompt Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t.aiImage?.promptLabel || 'Describe your image'}
            </label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t.aiImage?.promptPlaceholder || 'A futuristic city skyline at sunset with neon lights...'}
              className="min-h-[80px] resize-none text-sm"
              disabled={isGenerating}
            />
            {/* Quick suggestions */}
            <div className="flex flex-wrap gap-1.5">
              {PROMPT_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion.key}
                  type="button"
                  onClick={() => setPrompt(suggestion.text)}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border bg-muted/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  disabled={isGenerating}
                >
                  <span>{suggestion.icon}</span>
                  {suggestion.text.split(' ').slice(0, 3).join(' ')}...
                </button>
              ))}
            </div>
          </div>

          {/* Style Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t.aiImage?.styleLabel || 'Style'}
            </label>
            <div className="flex flex-wrap gap-2">
              {STYLE_OPTIONS.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setSelectedStyle(style.id)}
                  disabled={isGenerating}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    selectedStyle === style.id
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-600'
                      : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <style.icon className="size-3.5" />
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          {/* Size Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t.aiImage?.sizeLabel || 'Size'}
            </label>
            <div className="grid grid-cols-5 gap-2">
              {SIZE_OPTIONS.map((size) => (
                <button
                  key={size.id}
                  type="button"
                  onClick={() => setSelectedSize(size.id)}
                  disabled={isGenerating}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg text-[11px] font-medium transition-all border ${
                    selectedSize === size.id
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-600'
                      : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {/* Aspect ratio preview */}
                  <div
                    className={`rounded-sm border-current ${
                      selectedSize === size.id ? 'border-emerald-500' : 'border-muted-foreground/30'
                    }`}
                    style={{
                      width: `${Math.max(Math.round((size.w / size.h) * 20), 8)}px`,
                      height: `${Math.max(Math.round((size.h / size.w) * 20), 8)}px`,
                      maxWidth: '24px',
                      maxHeight: '24px',
                    }}
                  />
                  {size.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
          >
            {isGenerating ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                {t.aiImage?.generating || 'Generating...'}
              </>
            ) : (
              <>
                <Wand2 className="size-4 mr-2" />
                {t.aiImage?.generate || 'Generate Image'}
              </>
            )}
          </Button>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Preview */}
          <AnimatePresence>
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles className="size-8 text-emerald-500" />
                </motion.div>
                <p className="text-sm text-muted-foreground mt-3">
                  {t.aiImage?.generating || 'Generating your image...'}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  This may take a few seconds
                </p>
              </motion.div>
            )}

            {generatedImageUrl && !isGenerating && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-3"
              >
                <div className="relative rounded-xl overflow-hidden border bg-muted">
                  <img
                    src={generatedImageUrl}
                    alt={prompt}
                    className="w-full h-auto max-h-[320px] object-contain"
                  />
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-emerald-600 text-white text-[10px]">
                      <ImageIcon className="size-3 mr-1" />
                      AI Generated
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setGeneratedImageUrl(null);
                    }}
                  >
                    {t.aiImage?.regenerate || 'Regenerate'}
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleInsert}
                  >
                    <Upload className="size-4 mr-2" />
                    {t.aiImage?.insert || 'Insert into Canvas'}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
