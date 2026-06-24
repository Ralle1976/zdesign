'use client';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Paintbrush, Check } from 'lucide-react';
import type { StyleDirection } from '@/lib/ai/agents';

const STYLE_DIRECTIONS: { direction: StyleDirection; name: string; emoji: string; desc: string }[] = [
  { direction: 'minimal-clean', name: 'Minimal', emoji: '\u25FB\uFE0F', desc: 'Clean, spacious, monochrome' },
  { direction: 'bold-dramatic', name: 'Bold', emoji: '\uD83D\uDD25', desc: 'Vibrant, dramatic, sharp' },
  { direction: 'playful-vibrant', name: 'Playful', emoji: '\uD83C\uDFA8', desc: 'Fun, colorful, rounded' },
  { direction: 'corporate-professional', name: 'Corporate', emoji: '\uD83D\uDCBC', desc: 'Professional, structured' },
  { direction: 'organic-natural', name: 'Organic', emoji: '\uD83C\uDF3F', desc: 'Natural, earthy, warm' },
  { direction: 'futuristic-tech', name: 'Futuristic', emoji: '\uD83D\uDE80', desc: 'Tech, neon, glass' },
  { direction: 'retro-vintage', name: 'Retro', emoji: '\uD83D\uDCFB', desc: 'Vintage, warm, textured' },
  { direction: 'brutalist-raw', name: 'Brutalist', emoji: '\uD83E\uDDF1', desc: 'Raw, bold, unstyled' },
  { direction: 'glassmorphism', name: 'Glass', emoji: '\uD83D\uDC8E', desc: 'Frosted glass, pastels' },
  { direction: 'neomorphism', name: 'Neo', emoji: '\uD83E\uDEE7', desc: 'Soft shadows, tactile' },
  { direction: 'mixed-creative', name: 'Creative', emoji: '\u2728', desc: 'AI decides, varied' },
];

interface StyleSelectorProps {
  selectedStyle: StyleDirection | null;
  onStyleChange: (style: StyleDirection | null) => void;
}

export function StyleSelector({ selectedStyle, onStyleChange }: StyleSelectorProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:text-emerald-600"
        >
          <Paintbrush className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground px-2 mb-2">Style Direction</p>
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-0.5">
              {STYLE_DIRECTIONS.map((style) => (
                <button
                  key={style.direction}
                  onClick={() =>
                    onStyleChange(selectedStyle === style.direction ? null : style.direction)
                  }
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-left transition-colors ${
                    selectedStyle === style.direction
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'hover:bg-muted'
                  }`}
                >
                  <span className="text-base">{style.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-xs">{style.name}</span>
                      {selectedStyle === style.direction && (
                        <Check className="size-3 text-emerald-600" />
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{style.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
