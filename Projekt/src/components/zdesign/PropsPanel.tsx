'use client';

import { useState, useCallback, useMemo } from 'react';
import { useZDesignStore } from '@/stores/zdesign-store';
import { useI18n } from '@/i18n';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ArrowRight,
  ArrowDown,
  Rows3,
  WrapText,
  Paintbrush,
  Square,
  MoveHorizontal,
  Pencil,
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
import type { DesignNode, DesignStyle } from '@/types/design';

// ============ Design Token Constants (for no-selection state) ============

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

// ============ Helper Functions ============

function findNodeById(tree: DesignNode, id: string): DesignNode | null {
  if (tree.id === id) return tree;
  if (tree.children) {
    for (const child of tree.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  return null;
}

/** Strip "px" and return numeric value, or empty string */
function pxToNum(val: string | undefined): string {
  if (!val) return '';
  const num = parseInt(val, 10);
  return isNaN(num) ? '' : String(num);
}

/** Add "px" suffix to a numeric string */
function numToPx(val: string): string | undefined {
  if (!val || val.trim() === '') return undefined;
  const num = parseInt(val, 10);
  if (isNaN(num)) return undefined;
  return `${num}px`;
}

/** Extract hex color from various CSS color formats */
function toHexColor(val: string | undefined): string {
  if (!val) return '#000000';
  if (val.startsWith('#')) return val.length >= 7 ? val.slice(0, 7) : val;
  return '#000000';
}

/** Node types that have text content */
const TEXT_NODE_TYPES = new Set(['text', 'heading', 'button', 'link', 'badge']);

/** Node types that have typography controls */
const TYPO_NODE_TYPES = new Set(['text', 'heading', 'button', 'link', 'badge']);

// ============ Sub-Components ============

/** Small label used in property editors */
function PropLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-[11px] font-medium text-muted-foreground mb-1 block">
      {children}
    </Label>
  );
}



/** Color input: swatch + hex text */
function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const hex = toHexColor(value);
  const [textVal, setTextVal] = useState(value || '');
  const [isEditing, setIsEditing] = useState(false);

  // Derive display value: use local state when editing, otherwise use prop
  const displayVal = isEditing ? textVal : (value || '');

  const handleColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newColor = e.target.value;
      onChange(newColor);
      setTextVal(newColor);
    },
    [onChange]
  );

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setTextVal(val);
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        onChange(val);
      }
    },
    [onChange]
  );

  const handleTextFocus = useCallback(() => {
    setIsEditing(true);
    setTextVal(value || '');
  }, [value]);

  const handleTextBlur = useCallback(() => {
    setIsEditing(false);
    if (/^#[0-9a-fA-F]{6}$/.test(textVal)) {
      onChange(textVal);
    }
  }, [textVal, onChange]);

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative shrink-0">
        <input
          type="color"
          value={hex}
          onChange={handleColorChange}
          className="absolute inset-0 opacity-0 cursor-pointer size-7"
        />
        <div
          className="size-7 rounded-md border shadow-sm cursor-pointer"
          style={{ backgroundColor: hex }}
        />
      </div>
      <input
        type="text"
        value={displayVal}
        onChange={handleTextChange}
        onFocus={handleTextFocus}
        onBlur={handleTextBlur}
        placeholder="#000000"
        className="h-7 flex-1 rounded-md border border-input bg-transparent px-2 text-[11px] font-mono outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
      />
    </div>
  );
}

/** Icon toggle button */
function IconButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          title={title}
          className={`flex items-center justify-center size-7 rounded-md border transition-colors ${
            active
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'border-input bg-transparent text-muted-foreground hover:bg-muted/50'
          }`}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[10px]">
        {title}
      </TooltipContent>
    </Tooltip>
  );
}

// ============ Editor Sections ============

function ContentEditor({
  node,
  onStyleChange,
  onContentChange,
}: {
  node: DesignNode;
  onStyleChange: (key: string, value: string | undefined) => void;
  onContentChange: (content: string) => void;
}) {
  if (!TEXT_NODE_TYPES.has(node.type)) return null;

  return (
    <AccordionItem value="content" className="border-b-0">
      <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
        <div className="flex items-center gap-2">
          <Pencil className="size-3.5 text-muted-foreground" />
          Content
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-2 pt-1">
          <PropLabel>Text</PropLabel>
          <textarea
            value={node.content || ''}
            onChange={(e) => onContentChange(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-[11px] outline-none focus:border-ring focus:ring-1 focus:ring-ring/50 resize-none"
            placeholder="Enter text content..."
          />
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function LayoutEditor({
  style,
  onStyleChange,
}: {
  style: DesignStyle;
  onStyleChange: (key: string, value: string | undefined) => void;
}) {
  return (
    <AccordionItem value="layout" className="border-b-0">
      <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
        <div className="flex items-center gap-2">
          <LayoutGrid className="size-3.5 text-muted-foreground" />
          Layout
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-3 pt-1">
          {/* Display */}
          <div>
            <PropLabel>Display</PropLabel>
            <Select
              value={style.display || 'block'}
              onValueChange={(v) => onStyleChange('display', v)}
            >
              <SelectTrigger className="h-7 text-[11px] w-full" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flex">flex</SelectItem>
                <SelectItem value="grid">grid</SelectItem>
                <SelectItem value="block">block</SelectItem>
                <SelectItem value="inline-flex">inline-flex</SelectItem>
                <SelectItem value="inline">inline</SelectItem>
                <SelectItem value="none">none</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Flex Direction */}
          {(style.display === 'flex' || style.display === 'inline-flex') && (
            <div>
              <PropLabel>Direction</PropLabel>
              <div className="flex gap-1">
                <IconButton
                  active={style.flexDirection !== 'column'}
                  onClick={() => onStyleChange('flexDirection', 'row')}
                  title="Row"
                >
                  <ArrowRight className="size-3.5" />
                </IconButton>
                <IconButton
                  active={style.flexDirection === 'column'}
                  onClick={() => onStyleChange('flexDirection', 'column')}
                  title="Column"
                >
                  <ArrowDown className="size-3.5" />
                </IconButton>
              </div>
            </div>
          )}

          {/* Justify Content */}
          {(style.display === 'flex' || style.display === 'inline-flex') && (
            <div>
              <PropLabel>Justify Content</PropLabel>
              <div className="flex gap-1 flex-wrap">
                {[
                  { value: 'flex-start', icon: <Rows3 className="size-3.5" />, title: 'Start' },
                  { value: 'center', icon: <Rows3 className="size-3.5" />, title: 'Center' },
                  { value: 'flex-end', icon: <Rows3 className="size-3.5" />, title: 'End' },
                  { value: 'space-between', icon: <Rows3 className="size-3.5" />, title: 'Space Between' },
                  { value: 'space-around', icon: <Rows3 className="size-3.5" />, title: 'Space Around' },
                  { value: 'space-evenly', icon: <Rows3 className="size-3.5" />, title: 'Space Evenly' },
                ].map((opt) => (
                  <IconButton
                    key={opt.value}
                    active={style.justifyContent === opt.value}
                    onClick={() => onStyleChange('justifyContent', opt.value)}
                    title={opt.title}
                  >
                    {opt.icon}
                  </IconButton>
                ))}
              </div>
              <div className="mt-1">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {style.justifyContent || 'flex-start'}
                </span>
              </div>
            </div>
          )}

          {/* Align Items */}
          {(style.display === 'flex' || style.display === 'inline-flex') && (
            <div>
              <PropLabel>Align Items</PropLabel>
              <div className="flex gap-1">
                {[
                  { value: 'flex-start', title: 'Start' },
                  { value: 'center', title: 'Center' },
                  { value: 'flex-end', title: 'End' },
                  { value: 'stretch', title: 'Stretch' },
                ].map((opt) => (
                  <IconButton
                    key={opt.value}
                    active={style.alignItems === opt.value}
                    onClick={() => onStyleChange('alignItems', opt.value)}
                    title={opt.title}
                  >
                    <span className="text-[9px] font-medium leading-none">
                      {opt.value === 'flex-start'
                        ? '⇧'
                        : opt.value === 'center'
                          ? '⬌'
                          : opt.value === 'flex-end'
                            ? '⇩'
                            : '↕'}
                    </span>
                  </IconButton>
                ))}
              </div>
              <div className="mt-1">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {style.alignItems || 'stretch'}
                </span>
              </div>
            </div>
          )}

          {/* Gap */}
          {(style.display === 'flex' || style.display === 'inline-flex' || style.display === 'grid') && (
            <div>
              <PropLabel>Gap</PropLabel>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={pxToNum(style.gap)}
                  onChange={(e) => {
                    const val = e.target.value;
                    onStyleChange('gap', numToPx(val));
                  }}
                  onBlur={(e) => {
                    onStyleChange('gap', numToPx(e.target.value));
                  }}
                  placeholder="0"
                  className="h-7 w-20 rounded-md border border-input bg-transparent px-2 pr-6 text-[11px] outline-none focus:border-ring focus:ring-1 focus:ring-ring/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-[9px] text-muted-foreground">px</span>
              </div>
            </div>
          )}

          {/* Flex Wrap */}
          {(style.display === 'flex' || style.display === 'inline-flex') && (
            <div>
              <PropLabel>Flex Wrap</PropLabel>
              <div className="flex gap-1">
                <IconButton
                  active={style.flexWrap !== 'wrap'}
                  onClick={() => onStyleChange('flexWrap', 'nowrap')}
                  title="No Wrap"
                >
                  <MoveHorizontal className="size-3.5" />
                </IconButton>
                <IconButton
                  active={style.flexWrap === 'wrap'}
                  onClick={() => onStyleChange('flexWrap', 'wrap')}
                  title="Wrap"
                >
                  <WrapText className="size-3.5" />
                </IconButton>
              </div>
            </div>
          )}

          {/* Grid Template Columns (for grid display) */}
          {style.display === 'grid' && (
            <div>
              <PropLabel>Grid Columns</PropLabel>
              <input
                type="text"
                value={style.gridTemplateColumns || ''}
                onChange={(e) => onStyleChange('gridTemplateColumns', e.target.value || undefined)}
                placeholder="e.g. repeat(3, 1fr)"
                className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-[11px] outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
              />
            </div>
          )}

          {style.display === 'grid' && (
            <div>
              <PropLabel>Grid Rows</PropLabel>
              <input
                type="text"
                value={style.gridTemplateRows || ''}
                onChange={(e) => onStyleChange('gridTemplateRows', e.target.value || undefined)}
                placeholder="e.g. auto 1fr auto"
                className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-[11px] outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
              />
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function SpacingEditor({
  style,
  onStyleChange,
}: {
  style: DesignStyle;
  onStyleChange: (key: string, value: string | undefined) => void;
}) {
  return (
    <AccordionItem value="spacing" className="border-b-0">
      <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
        <div className="flex items-center gap-2">
          <Space className="size-3.5 text-muted-foreground" />
          Spacing
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pt-1">
          {/* Padding - Visual Box Model */}
          <div>
            <PropLabel>Padding</PropLabel>
            <div className="relative bg-muted/30 border border-border rounded-lg p-3">
              {/* Outer box = margin, Inner box = content */}
              <div className="relative bg-emerald-500/10 border-2 border-emerald-500/30 rounded-md p-2">
                {/* Top */}
                <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                  <input
                    type="number"
                    value={pxToNum(style.paddingTop)}
                    onChange={(e) => onStyleChange('paddingTop', numToPx(e.target.value))}
                    placeholder="0"
                    className="h-5 w-12 rounded border border-input bg-background px-1 text-[10px] text-center outline-none focus:border-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                {/* Right */}
                <div className="absolute -right-1 top-1/2 -translate-y-1/2 translate-x-full">
                  <input
                    type="number"
                    value={pxToNum(style.paddingRight)}
                    onChange={(e) => onStyleChange('paddingRight', numToPx(e.target.value))}
                    placeholder="0"
                    className="h-5 w-12 rounded border border-input bg-background px-1 text-[10px] text-center outline-none focus:border-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                {/* Bottom */}
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2">
                  <input
                    type="number"
                    value={pxToNum(style.paddingBottom)}
                    onChange={(e) => onStyleChange('paddingBottom', numToPx(e.target.value))}
                    placeholder="0"
                    className="h-5 w-12 rounded border border-input bg-background px-1 text-[10px] text-center outline-none focus:border-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                {/* Left */}
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 -translate-x-full">
                  <input
                    type="number"
                    value={pxToNum(style.paddingLeft)}
                    onChange={(e) => onStyleChange('paddingLeft', numToPx(e.target.value))}
                    placeholder="0"
                    className="h-5 w-12 rounded border border-input bg-background px-1 text-[10px] text-center outline-none focus:border-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                {/* Content box */}
                <div className="bg-background border border-dashed border-muted-foreground/30 rounded px-2 py-1 text-[9px] text-muted-foreground text-center min-h-[20px]">
                  Content
                </div>
              </div>
            </div>
            {/* Shorthand padding */}
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground shrink-0">All:</span>
              <input
                type="number"
                value={pxToNum(style.padding)}
                onChange={(e) => {
                  const val = numToPx(e.target.value);
                  onStyleChange('padding', val);
                  // Also set individual values
                  onStyleChange('paddingTop', val);
                  onStyleChange('paddingRight', val);
                  onStyleChange('paddingBottom', val);
                  onStyleChange('paddingLeft', val);
                }}
                placeholder="0"
                className="h-5 w-14 rounded border border-input bg-transparent px-1.5 text-[10px] outline-none focus:border-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-[9px] text-muted-foreground">px</span>
            </div>
          </div>

          <Separator />

          {/* Margin - Visual Box Model */}
          <div>
            <PropLabel>Margin</PropLabel>
            <div className="relative bg-muted/30 border border-border rounded-lg p-3">
              <div className="relative bg-blue-500/10 border-2 border-blue-500/30 rounded-md p-2">
                {/* Top */}
                <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                  <input
                    type="number"
                    value={pxToNum(style.marginTop)}
                    onChange={(e) => onStyleChange('marginTop', numToPx(e.target.value))}
                    placeholder="0"
                    className="h-5 w-12 rounded border border-input bg-background px-1 text-[10px] text-center outline-none focus:border-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                {/* Right */}
                <div className="absolute -right-1 top-1/2 -translate-y-1/2 translate-x-full">
                  <input
                    type="number"
                    value={pxToNum(style.marginRight)}
                    onChange={(e) => onStyleChange('marginRight', numToPx(e.target.value))}
                    placeholder="0"
                    className="h-5 w-12 rounded border border-input bg-background px-1 text-[10px] text-center outline-none focus:border-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                {/* Bottom */}
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2">
                  <input
                    type="number"
                    value={pxToNum(style.marginBottom)}
                    onChange={(e) => onStyleChange('marginBottom', numToPx(e.target.value))}
                    placeholder="0"
                    className="h-5 w-12 rounded border border-input bg-background px-1 text-[10px] text-center outline-none focus:border-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                {/* Left */}
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 -translate-x-full">
                  <input
                    type="number"
                    value={pxToNum(style.marginLeft)}
                    onChange={(e) => onStyleChange('marginLeft', numToPx(e.target.value))}
                    placeholder="0"
                    className="h-5 w-12 rounded border border-input bg-background px-1 text-[10px] text-center outline-none focus:border-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                {/* Content box */}
                <div className="bg-background border border-dashed border-muted-foreground/30 rounded px-2 py-1 text-[9px] text-muted-foreground text-center min-h-[20px]">
                  Content
                </div>
              </div>
            </div>
            {/* Shorthand margin */}
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground shrink-0">All:</span>
              <input
                type="number"
                value={pxToNum(style.margin)}
                onChange={(e) => {
                  const val = numToPx(e.target.value);
                  onStyleChange('margin', val);
                  onStyleChange('marginTop', val);
                  onStyleChange('marginRight', val);
                  onStyleChange('marginBottom', val);
                  onStyleChange('marginLeft', val);
                }}
                placeholder="0"
                className="h-5 w-14 rounded border border-input bg-transparent px-1.5 text-[10px] outline-none focus:border-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-[9px] text-muted-foreground">px</span>
            </div>
          </div>

          {/* Width & Height */}
          <Separator />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <PropLabel>Width</PropLabel>
              <input
                type="text"
                value={style.width || ''}
                onChange={(e) => onStyleChange('width', e.target.value || undefined)}
                placeholder="auto"
                className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-[11px] outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
              />
            </div>
            <div>
              <PropLabel>Height</PropLabel>
              <input
                type="text"
                value={style.height || ''}
                onChange={(e) => onStyleChange('height', e.target.value || undefined)}
                placeholder="auto"
                className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-[11px] outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <PropLabel>Min Width</PropLabel>
              <input
                type="text"
                value={style.minWidth || ''}
                onChange={(e) => onStyleChange('minWidth', e.target.value || undefined)}
                placeholder="auto"
                className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-[11px] outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
              />
            </div>
            <div>
              <PropLabel>Min Height</PropLabel>
              <input
                type="text"
                value={style.minHeight || ''}
                onChange={(e) => onStyleChange('minHeight', e.target.value || undefined)}
                placeholder="auto"
                className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-[11px] outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
              />
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function TypographyEditor({
  node,
  style,
  onStyleChange,
}: {
  node: DesignNode;
  style: DesignStyle;
  onStyleChange: (key: string, value: string | undefined) => void;
}) {
  if (!TYPO_NODE_TYPES.has(node.type)) return null;

  return (
    <AccordionItem value="typography" className="border-b-0">
      <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
        <div className="flex items-center gap-2">
          <Type className="size-3.5 text-muted-foreground" />
          Typography
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-3 pt-1">
          {/* Font Family */}
          <div>
            <PropLabel>Font Family</PropLabel>
            <input
              type="text"
              value={style.fontFamily || ''}
              onChange={(e) => onStyleChange('fontFamily', e.target.value || undefined)}
              placeholder="e.g. Inter, sans-serif"
              className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-[11px] outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
            />
          </div>

          {/* Font Size */}
          <div>
            <PropLabel>Font Size</PropLabel>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={pxToNum(style.fontSize)}
                onChange={(e) => onStyleChange('fontSize', numToPx(e.target.value))}
                placeholder="16"
                className="h-7 w-20 rounded-md border border-input bg-transparent px-2 pr-6 text-[11px] outline-none focus:border-ring focus:ring-1 focus:ring-ring/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-[9px] text-muted-foreground">px</span>
            </div>
          </div>

          {/* Font Weight */}
          <div>
            <PropLabel>Font Weight</PropLabel>
            <Select
              value={style.fontWeight || '400'}
              onValueChange={(v) => onStyleChange('fontWeight', v)}
            >
              <SelectTrigger className="h-7 text-[11px] w-full" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="300">300 - Light</SelectItem>
                <SelectItem value="400">400 - Regular</SelectItem>
                <SelectItem value="500">500 - Medium</SelectItem>
                <SelectItem value="600">600 - Semi Bold</SelectItem>
                <SelectItem value="700">700 - Bold</SelectItem>
                <SelectItem value="800">800 - Extra Bold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Line Height */}
          <div>
            <PropLabel>Line Height</PropLabel>
            <input
              type="text"
              value={style.lineHeight || ''}
              onChange={(e) => onStyleChange('lineHeight', e.target.value || undefined)}
              placeholder="1.5"
              className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-[11px] outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
            />
          </div>

          {/* Letter Spacing */}
          <div>
            <PropLabel>Letter Spacing</PropLabel>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={pxToNum(style.letterSpacing)}
                onChange={(e) => onStyleChange('letterSpacing', numToPx(e.target.value))}
                placeholder="0"
                className="h-7 w-20 rounded-md border border-input bg-transparent px-2 pr-6 text-[11px] outline-none focus:border-ring focus:ring-1 focus:ring-ring/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-[9px] text-muted-foreground">px</span>
            </div>
          </div>

          {/* Text Align */}
          <div>
            <PropLabel>Text Align</PropLabel>
            <div className="flex gap-1">
              <IconButton
                active={style.textAlign === 'left' || !style.textAlign}
                onClick={() => onStyleChange('textAlign', 'left')}
                title="Align Left"
              >
                <AlignLeft className="size-3.5" />
              </IconButton>
              <IconButton
                active={style.textAlign === 'center'}
                onClick={() => onStyleChange('textAlign', 'center')}
                title="Align Center"
              >
                <AlignCenter className="size-3.5" />
              </IconButton>
              <IconButton
                active={style.textAlign === 'right'}
                onClick={() => onStyleChange('textAlign', 'right')}
                title="Align Right"
              >
                <AlignRight className="size-3.5" />
              </IconButton>
              <IconButton
                active={style.textAlign === 'justify'}
                onClick={() => onStyleChange('textAlign', 'justify')}
                title="Justify"
              >
                <AlignJustify className="size-3.5" />
              </IconButton>
            </div>
          </div>

          {/* Text Color */}
          <div>
            <PropLabel>Text Color</PropLabel>
            <ColorInput
              value={style.color || ''}
              onChange={(hex) => onStyleChange('color', hex)}
            />
          </div>

          {/* Text Decoration */}
          <div>
            <PropLabel>Text Decoration</PropLabel>
            <Select
              value={style.textDecoration || 'none'}
              onValueChange={(v) => onStyleChange('textDecoration', v === 'none' ? undefined : v)}
            >
              <SelectTrigger className="h-7 text-[11px] w-full" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">none</SelectItem>
                <SelectItem value="underline">underline</SelectItem>
                <SelectItem value="line-through">line-through</SelectItem>
                <SelectItem value="overline">overline</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Text Transform */}
          <div>
            <PropLabel>Text Transform</PropLabel>
            <Select
              value={style.textTransform || 'none'}
              onValueChange={(v) => onStyleChange('textTransform', v === 'none' ? undefined : v)}
            >
              <SelectTrigger className="h-7 text-[11px] w-full" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">none</SelectItem>
                <SelectItem value="uppercase">UPPERCASE</SelectItem>
                <SelectItem value="lowercase">lowercase</SelectItem>
                <SelectItem value="capitalize">Capitalize</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function BackgroundEditor({
  style,
  onStyleChange,
}: {
  style: DesignStyle;
  onStyleChange: (key: string, value: string | undefined) => void;
}) {
  return (
    <AccordionItem value="background" className="border-b-0">
      <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
        <div className="flex items-center gap-2">
          <Paintbrush className="size-3.5 text-muted-foreground" />
          Background
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-3 pt-1">
          {/* Background Color */}
          <div>
            <PropLabel>Color</PropLabel>
            <ColorInput
              value={style.backgroundColor || ''}
              onChange={(hex) => onStyleChange('backgroundColor', hex)}
            />
          </div>

          {/* Background Image */}
          <div>
            <PropLabel>Image URL</PropLabel>
            <input
              type="text"
              value={style.backgroundImage || ''}
              onChange={(e) => onStyleChange('backgroundImage', e.target.value || undefined)}
              placeholder="url(...)"
              className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-[11px] outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
            />
          </div>

          {/* Background Size */}
          <div>
            <PropLabel>Size</PropLabel>
            <Select
              value={style.backgroundSize || 'cover'}
              onValueChange={(v) => onStyleChange('backgroundSize', v)}
            >
              <SelectTrigger className="h-7 text-[11px] w-full" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cover">cover</SelectItem>
                <SelectItem value="contain">contain</SelectItem>
                <SelectItem value="auto">auto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Background Position */}
          <div>
            <PropLabel>Position</PropLabel>
            <Select
              value={style.backgroundPosition || 'center'}
              onValueChange={(v) => onStyleChange('backgroundPosition', v)}
            >
              <SelectTrigger className="h-7 text-[11px] w-full" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="center">center</SelectItem>
                <SelectItem value="top">top</SelectItem>
                <SelectItem value="bottom">bottom</SelectItem>
                <SelectItem value="left">left</SelectItem>
                <SelectItem value="right">right</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function BorderEditor({
  style,
  onStyleChange,
}: {
  style: DesignStyle;
  onStyleChange: (key: string, value: string | undefined) => void;
}) {
  return (
    <AccordionItem value="border" className="border-b-0">
      <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
        <div className="flex items-center gap-2">
          <Square className="size-3.5 text-muted-foreground" />
          Border
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-3 pt-1">
          {/* Border Width */}
          <div>
            <PropLabel>Width</PropLabel>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={pxToNum(style.borderWidth)}
                onChange={(e) => onStyleChange('borderWidth', numToPx(e.target.value))}
                placeholder="0"
                className="h-7 w-20 rounded-md border border-input bg-transparent px-2 pr-6 text-[11px] outline-none focus:border-ring focus:ring-1 focus:ring-ring/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-[9px] text-muted-foreground">px</span>
            </div>
          </div>

          {/* Border Style */}
          <div>
            <PropLabel>Style</PropLabel>
            <Select
              value={style.borderStyle || 'none'}
              onValueChange={(v) => onStyleChange('borderStyle', v === 'none' ? undefined : v)}
            >
              <SelectTrigger className="h-7 text-[11px] w-full" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">none</SelectItem>
                <SelectItem value="solid">solid</SelectItem>
                <SelectItem value="dashed">dashed</SelectItem>
                <SelectItem value="dotted">dotted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Border Color */}
          <div>
            <PropLabel>Color</PropLabel>
            <ColorInput
              value={style.borderColor || ''}
              onChange={(hex) => onStyleChange('borderColor', hex)}
            />
          </div>

          {/* Border Radius */}
          <div>
            <PropLabel>Radius</PropLabel>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={pxToNum(style.borderRadius)}
                onChange={(e) => onStyleChange('borderRadius', numToPx(e.target.value))}
                placeholder="0"
                className="h-7 w-20 rounded-md border border-input bg-transparent px-2 pr-6 text-[11px] outline-none focus:border-ring focus:ring-1 focus:ring-ring/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-[9px] text-muted-foreground">px</span>
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function EffectsEditor({
  style,
  onStyleChange,
}: {
  style: DesignStyle;
  onStyleChange: (key: string, value: string | undefined) => void;
}) {
  const opacityValue = style.opacity !== undefined ? Math.round(style.opacity * 100) : 100;

  return (
    <AccordionItem value="effects" className="border-b-0">
      <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-muted-foreground" />
          Effects
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-3 pt-1">
          {/* Box Shadow */}
          <div>
            <PropLabel>Box Shadow</PropLabel>
            <input
              type="text"
              value={style.boxShadow || ''}
              onChange={(e) => onStyleChange('boxShadow', e.target.value || undefined)}
              placeholder="e.g. 0 4px 6px rgba(0,0,0,0.1)"
              className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-[11px] outline-none focus:border-ring focus:ring-1 focus:ring-ring/50 font-mono"
            />
          </div>

          {/* Opacity */}
          <div>
            <PropLabel>Opacity — {opacityValue}%</PropLabel>
            <Slider
              value={[opacityValue]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => {
                // @ts-expect-error pre-existing: onStyleChange expects string, opacity passes number
                onStyleChange('opacity', v === 100 ? undefined : v / 100);
              }}
              className="mt-1"
            />
          </div>

          {/* Transform */}
          <div>
            <PropLabel>Transform</PropLabel>
            <input
              type="text"
              value={style.transform || ''}
              onChange={(e) => onStyleChange('transform', e.target.value || undefined)}
              placeholder="e.g. rotate(5deg) scale(1.1)"
              className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-[11px] outline-none focus:border-ring focus:ring-1 focus:ring-ring/50 font-mono"
            />
          </div>

          {/* Filter */}
          <div>
            <PropLabel>Filter</PropLabel>
            <input
              type="text"
              value={style.filter || ''}
              onChange={(e) => onStyleChange('filter', e.target.value || undefined)}
              placeholder="e.g. blur(4px) brightness(1.2)"
              className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-[11px] outline-none focus:border-ring focus:ring-1 focus:ring-ring/50 font-mono"
            />
          </div>

          {/* Transition */}
          <div>
            <PropLabel>Transition</PropLabel>
            <input
              type="text"
              value={style.transition || ''}
              onChange={(e) => onStyleChange('transition', e.target.value || undefined)}
              placeholder="e.g. all 0.3s ease"
              className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-[11px] outline-none focus:border-ring focus:ring-1 focus:ring-ring/50 font-mono"
            />
          </div>

          {/* Overflow */}
          <div>
            <PropLabel>Overflow</PropLabel>
            <Select
              value={style.overflow || 'visible'}
              onValueChange={(v) => onStyleChange('overflow', v === 'visible' ? undefined : v)}
            >
              <SelectTrigger className="h-7 text-[11px] w-full" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="visible">visible</SelectItem>
                <SelectItem value="hidden">hidden</SelectItem>
                <SelectItem value="scroll">scroll</SelectItem>
                <SelectItem value="auto">auto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// ============ Main Properties Content ============

function PropertiesContent() {
  const { t } = useI18n();
  const canvas = useZDesignStore((s) => s.canvas);
  const designSystem = useZDesignStore((s) => s.designSystem);
  const designTree = useZDesignStore((s) => s.designTree);
  const updateNode = useZDesignStore((s) => s.updateNode);

  // Accessibility scanner state
  const [a11yOpen, setA11yOpen] = useState(false);

  // Compute accessibility score from design tree
  const hasDesign = designTree.children && designTree.children.length > 0;
  const a11yScore = hasDesign ? calculateAccessibilityScore(scanDesignTree(designTree)) : null;

  const hasSelection = canvas.selectedNodeId !== null;

  // Find the selected node
  const selectedNode = useMemo(
    () => (canvas.selectedNodeId ? findNodeById(designTree, canvas.selectedNodeId) : null),
    [canvas.selectedNodeId, designTree]
  );

  const selectedStyle: DesignStyle = selectedNode?.style || {};

  // Handler to update a single style property
  const handleStyleChange = useCallback(
    (key: string, value: string | number | undefined) => {
      if (!canvas.selectedNodeId || !selectedNode) return;
      const newStyle: DesignStyle = { ...selectedStyle };
      if (value === undefined || value === '') {
        delete newStyle[key];
      } else {
        newStyle[key] = value;
      }
      updateNode(canvas.selectedNodeId, { style: newStyle });
    },
    [canvas.selectedNodeId, selectedNode, selectedStyle, updateNode]
  );

  // Handler to update content
  const handleContentChange = useCallback(
    (content: string) => {
      if (!canvas.selectedNodeId) return;
      updateNode(canvas.selectedNodeId, { content });
    },
    [canvas.selectedNodeId, updateNode]
  );

  // Determine which accordion items to expand by default
  const defaultAccordionValues = useMemo(() => {
    if (!hasSelection) return ['colors', 'typography', 'spacing'];
    const vals = ['layout', 'spacing', 'background', 'border', 'effects'];
    if (selectedNode && TEXT_NODE_TYPES.has(selectedNode.type)) {
      vals.unshift('content');
    }
    if (selectedNode && TYPO_NODE_TYPES.has(selectedNode.type)) {
      vals.push('typography');
    }
    return vals;
  }, [hasSelection, selectedNode]);

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

        {/* Selected element info */}
        {hasSelection && selectedNode && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
              <div className="size-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-muted-foreground">
                {selectedNode.type}
                {selectedNode.meta?.name ? ` — ${selectedNode.meta.name}` : ''}
              </span>
              <span className="text-[10px] text-muted-foreground/60 font-mono ml-auto">
                #{canvas.selectedNodeId}
              </span>
            </div>
          </div>
        )}

        <Separator />

        {/* ===== Property Editors (when node selected) ===== */}
        {hasSelection && selectedNode ? (
          <Accordion type="multiple" defaultValue={defaultAccordionValues} className="w-full">
            <ContentEditor
              node={selectedNode}
              onStyleChange={handleStyleChange}
              onContentChange={handleContentChange}
            />
            <LayoutEditor style={selectedStyle} onStyleChange={handleStyleChange} />
            <SpacingEditor style={selectedStyle} onStyleChange={handleStyleChange} />
            <TypographyEditor
              node={selectedNode}
              style={selectedStyle}
              onStyleChange={handleStyleChange}
            />
            <BackgroundEditor style={selectedStyle} onStyleChange={handleStyleChange} />
            <BorderEditor style={selectedStyle} onStyleChange={handleStyleChange} />
            <EffectsEditor style={selectedStyle} onStyleChange={handleStyleChange} />
          </Accordion>
        ) : null}

        {/* ===== Design System section (always visible, more prominent when no selection) ===== */}
        {!hasSelection && (
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
            </Accordion>
          </div>
        )}

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

// ============ Main PropsPanel Export ============

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
