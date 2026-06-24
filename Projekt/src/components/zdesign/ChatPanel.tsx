'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useZDesignStore } from '@/stores/zdesign-store';
import { useI18n } from '@/i18n';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import type { ChatMessage, DesignQualityReport, DesignNode } from '@/types/design';
import { deriveDesignDirection } from '@/lib/ai/fusion/design-direction';
import {
  DESIGN_SYSTEMS,
  pickSystemForTopic,
  type DesignSystem,
} from '@/lib/design-systems/systems';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Send,
  Mic,
  Paperclip,
  Trash2,
  Sparkles,
  LayoutDashboard,
  Smartphone,
  Presentation,
  Bot,
  User,
  ImageIcon,
  Search,
  CheckCircle2,
  Brain,
  Palette,
  Zap,
  Loader2,
  Wand2,
  ArrowDown,
  HelpCircle,
  SkipForward,
  Check,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { AIImageDialog } from './AIImageDialog';
import { ResearchDialog } from './ResearchDialog';

const EXAMPLE_PROMPTS = [
  {
    icon: LayoutDashboard,
    key: 'landing' as const,
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    icon: LayoutDashboard,
    key: 'dashboard' as const,
    gradient: 'from-teal-500 to-cyan-500',
  },
  {
    icon: Smartphone,
    key: 'app' as const,
    gradient: 'from-cyan-500 to-emerald-500',
  },
  {
    icon: Presentation,
    key: 'slide' as const,
    gradient: 'from-emerald-500 to-green-500',
  },
];

// ============ Step Progress in Chat ============

function GenerationStepProgress() {
  const { locale } = useI18n();
  const generationProgress = useZDesignStore((s) => s.generationProgress);
  const creativeMode = useZDesignStore((s) => s.creativeMode);
  const isDe = locale === 'de';

  const steps = [
    { id: 'analyzing', label: isDe ? 'Analysiere...' : 'Analyzing request...', icon: Brain },
    { id: 'generating', label: isDe ? 'Generiere Layout...' : 'Generating layout...', icon: Sparkles },
    { id: 'rendering', label: isDe ? 'Füge Stile hinzu...' : 'Adding styles...', icon: Palette },
    { id: 'evaluating', label: isDe ? 'Finalisiere...' : 'Finalizing design...', icon: CheckCircle2 },
  ];

  const currentIdx = steps.findIndex((s) => s.id === generationProgress.stage);

  return (
    <div className="px-4 py-2 space-y-2">
      {/* Main status line */}
      <div className="flex items-center gap-2">
        <Loader2 className="size-3.5 animate-spin text-emerald-500 shrink-0" />
        <span className="text-xs font-medium text-foreground">
          {isDe ? 'KI generiert Design...' : 'Generating design with AI...'}
        </span>
        {generationProgress.estimatedTimeLeft && generationProgress.estimatedTimeLeft > 0 && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            ~{generationProgress.estimatedTimeLeft}s {isDe ? 'übrig' : 'remaining'}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <Progress value={generationProgress.percentage} className="h-1.5 [&>div]:bg-emerald-500" />

      {/* Steps */}
      <div className="flex items-center gap-1">
        {steps.map((step, idx) => {
          const StepIcon = step.icon;
          const isActive = step.id === generationProgress.stage;
          const isDone = idx < currentIdx || generationProgress.stage === 'complete';

          return (
            <div key={step.id} className="flex items-center gap-1 flex-1 min-w-0">
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate ${
                isActive
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : isDone
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-500'
                    : 'bg-muted/50 text-muted-foreground'
              }`}>
                {isActive ? (
                  <Loader2 className="size-2.5 animate-spin shrink-0" />
                ) : isDone ? (
                  <CheckCircle2 className="size-2.5 shrink-0" />
                ) : (
                  <StepIcon className="size-2.5 shrink-0" />
                )}
                <span className="truncate">{step.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`h-px flex-1 min-w-[8px] ${isDone ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-border'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Creative mode indicator */}
      {creativeMode && (
        <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
          <Zap className="size-2.5" />
          <span className="font-medium">Creative Mode active</span>
        </div>
      )}

      {/* Status message */}
      {generationProgress.message && (
        <p className="text-[10px] text-muted-foreground">{generationProgress.message}</p>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-bold">
          Z
        </AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-1 bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5">
        <motion.span
          className="size-2 rounded-full bg-emerald-500"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
        />
        <motion.span
          className="size-2 rounded-full bg-emerald-500"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
        />
        <motion.span
          className="size-2 rounded-full bg-emerald-500"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
        />
      </div>
    </div>
  );
}

function MessageBubble({ message, qualityReport, onEnhance, isEnhancing }: {
  message: ChatMessage;
  qualityReport: DesignQualityReport | null;
  onEnhance: () => void;
  isEnhancing: boolean;
}) {
  // Hydration-safe: only render timestamp after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  if (message.role === 'system') {
    return (
      <div className="flex justify-center px-4 py-1">
        <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  const isUser = message.role === 'user';
  const hasDesign = message.role === 'assistant' && message.metadata?.designUpdate;
  const showQuality = hasDesign && qualityReport;
  const isTemplateUsed = message.role === 'assistant' && message.metadata?.templateUsed;
  // Assistant / copilot reply — distinct amber styling so it reads as a helpful
  // assistant rather than a design-generation message.
  const isAssistant = message.role === 'assistant' && (message.metadata as { assistant?: boolean } | undefined)?.assistant;
  const assistantActionLabels = ((message.metadata as { assistantActions?: string[] } | undefined)?.assistantActions) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex items-start gap-3 px-4 py-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <Avatar className="size-8 shrink-0">
        <AvatarFallback
          className={
            isUser
              ? 'bg-secondary text-secondary-foreground text-xs'
              : isAssistant
                ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white text-xs font-bold'
                : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-bold'
          }
        >
          {isUser ? <User className="size-4" /> : isAssistant ? <HelpCircle className="size-4" /> : <Bot className="size-4" />}
        </AvatarFallback>
      </Avatar>

      <div
        className={`max-w-[85%] space-y-1 flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
      >
        {/* Assistant copilot label */}
        {isAssistant && (
          <div className="flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            <HelpCircle className="size-3" />
            Assistant
          </div>
        )}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-emerald-600 text-white rounded-tr-sm'
              : isAssistant
                ? 'bg-amber-50 border border-amber-200/70 text-foreground rounded-tl-sm dark:bg-amber-900/20 dark:border-amber-800/50'
                : 'bg-muted rounded-tl-sm'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_code]:text-xs [&_code]:bg-black/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-black/5 [&_pre]:rounded-md [&_pre]:p-2">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
        {/* Assistant action chips — record of executed actions (already auto-run) */}
        {isAssistant && assistantActionLabels.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex flex-wrap gap-1 px-1"
          >
            {assistantActionLabels.map((label, i) => (
              <span
                key={`${label}-${i}`}
                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              >
                <CheckCircle2 className="size-2.5" />
                Ausgeführt: {label}
              </span>
            ))}
          </motion.div>
        )}
        {/* Quality Score Badge for design messages */}
        {showQuality && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 px-1"
          >
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
              qualityReport.overallScore >= 80
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : qualityReport.overallScore >= 60
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              <CheckCircle2 className="size-3" />
              Quality: {qualityReport.overallScore}/100
              <div className="flex gap-0.5 ml-1">
                {[
                  { label: 'CSS', value: qualityReport.cssValid },
                  { label: 'Sem', value: qualityReport.semantics },
                  { label: 'Rsp', value: qualityReport.responsiveness },
                  { label: 'A11y', value: qualityReport.accessibility },
                ].map((s) => (
                  <span key={s.label} className={`text-[9px] px-1 rounded ${
                    s.value >= 80 ? 'bg-emerald-200/50 dark:bg-emerald-800/30' : s.value >= 60 ? 'bg-amber-200/50 dark:bg-amber-800/30' : 'bg-red-200/50 dark:bg-red-800/30'
                  }`}>
                    {s.label}:{s.value}
                  </span>
                ))}
              </div>
            </div>
            {/* Enhance button when quality < 80 */}
            {qualityReport.overallScore < 80 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] px-2.5 gap-1 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/20"
                onClick={onEnhance}
                disabled={isEnhancing}
              >
                {isEnhancing ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Wand2 className="size-3" />
                )}
                Enhance
              </Button>
            )}
          </motion.div>
        )}
        {/* AI-guided template indicator */}
        {isTemplateUsed && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-1.5 px-1"
          >
            <span className="text-[11px] text-sky-600 dark:text-sky-400 flex items-center gap-1">
              <Sparkles className="size-3" />
              AI-guided template — You can customize this design by telling me what to change!
            </span>
          </motion.div>
        )}
        {mounted && (
          <p
            className={`text-[10px] text-muted-foreground px-1 ${isUser ? 'text-right' : ''}`}
          >
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>
    </motion.div>
  );
}

function WelcomeState({
  onExampleClick,
}: {
  onExampleClick: (prompt: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="text-center space-y-4 max-w-sm"
      >
        {/* Logo */}
        <div className="flex items-center justify-center size-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold text-2xl shadow-lg shadow-emerald-500/20 mx-auto">
          Z
        </div>

        <div>
          <h2 className="text-lg font-semibold">{t.appName}</h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            {t.chat.welcome}
          </p>
        </div>

        {/* Example prompts */}
        <div className="grid grid-cols-1 gap-2 w-full mt-4">
          {EXAMPLE_PROMPTS.map((example) => (
            <motion.button
              key={example.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onExampleClick(t.chat.examples[example.key])}
              className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-accent/50 transition-colors text-left group"
            >
              <div
                className={`flex items-center justify-center size-9 rounded-lg bg-gradient-to-br ${example.gradient} text-white shrink-0`}
              >
                <example.icon className="size-4" />
              </div>
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                {t.chat.examples[example.key]}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Generative imagery (non-blocking, parallel) ──────────────────────
// After a design returns, any type:"image" node tagged with meta.imageStatus
// "pending" + meta.imagePrompt is filled with a real generated image. Runs in
// the background (fire-and-forget); the design renders immediately and images
// pop in as they arrive. Failures degrade to the node's gradient placeholder.

const MAX_GENERATED_IMAGES = 3;

function pxNum(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = v.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/** Pick a generation size from the node's aspect (hero/wide → landscape). */
function nodeImageSize(n: DesignNode): string {
  const w = pxNum((n.style as Record<string, unknown> | undefined)?.width);
  const h = pxNum((n.style as Record<string, unknown> | undefined)?.height);
  if (w && h) return w >= h ? '1344x768' : '768x1344';
  const label = `${n.id} ${n.meta?.name ?? ''}`.toLowerCase();
  if (label.includes('hero')) return '1344x768';
  return '1024x1024';
}

function collectPendingImages(tree: DesignNode, max: number): DesignNode[] {
  const out: DesignNode[] = [];
  const walk = (n: DesignNode) => {
    if (out.length >= max) return;
    if (n.type === 'image' && n.meta?.imageStatus === 'pending' && n.meta?.imagePrompt) {
      out.push(n);
    }
    if (out.length < max) n.children?.forEach(walk);
  };
  walk(tree);
  return out;
}

/**
 * Generate real images for the pending image nodes in `tree`, patching each into
 * the store (silently — no undo pollution) as it resolves. Non-blocking by
 * contract: callers fire this with `void` and do not await.
 */
export async function generateImagesForDesign(tree: DesignNode, message: string): Promise<void> {
  const pending = collectPendingImages(tree, MAX_GENERATED_IMAGES);
  if (pending.length === 0) return;

  const mood = deriveDesignDirection(message).mood;
  const store = useZDesignStore.getState();
  const setMeta = (n: DesignNode, imageStatus: 'generating' | 'ready' | 'error') =>
    store.patchImageNode(n.id, { meta: { ...(n.meta ?? {}), imageStatus } });

  // Mark all as generating up front (light feedback).
  pending.forEach((n) => setMeta(n, 'generating'));

  await Promise.allSettled(
    pending.map(async (n) => {
      const prompt = n.meta!.imagePrompt!;
      try {
        const res = await fetch('/api/design/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, size: nodeImageSize(n), style: mood }),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as { url?: string };
        if (!data.url) throw new Error('no url returned');
        store.patchImageNode(n.id, { content: data.url });
        setMeta(n, 'ready');
      } catch (e) {
        setMeta(n, 'error');
        console.warn('[images] generation failed for', n.id, e instanceof Error ? e.message : e);
      }
    }),
  );
}

// ─── Concept + Design-System pickers (S1) ─────────────────────────────
// In Agent mode we FIRST fetch 3 creative-direction concepts and render them
// as clickable cards. The user picks one (or skips) before the agent loop
// runs. A separate small dropdown lets the user override the design system
// (default = auto, routed by pickSystemForTopic).

/** Subset of the Concept type from creative-director (only what the UI reads). */
type ConceptCard = {
  name: string;
  bigIdea: string;
  palette: {
    bg: string;
    surface: string;
    primary: string;
    accent: string;
    text: string;
    textMuted: string;
    border: string;
  };
};

/** Swatch dots shown on each concept card — picks 3 representative colors. */
function paletteDots(p: ConceptCard['palette']): string[] {
  return [p.bg, p.accent, p.primary];
}

function ConceptPicker({
  concepts,
  onPick,
  onSkip,
}: {
  concepts: ConceptCard[];
  onPick: (c: ConceptCard) => void;
  onSkip: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 py-3 space-y-2.5"
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Sparkles className="size-3.5 text-amber-500" />
        <span>Wähle eine Kreativrichtung — oder überspringen:</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {concepts.map((c) => (
          <motion.button
            key={c.name}
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onPick(c)}
            className="group flex flex-col gap-1.5 p-2.5 rounded-xl border bg-card hover:border-amber-400 hover:ring-2 hover:ring-amber-400/30 transition-all text-left"
          >
            <span className="text-sm font-semibold leading-tight line-clamp-1">
              {c.name}
            </span>
            <span className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
              {c.bigIdea}
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              {paletteDots(c.palette).map((hex, i) => (
                <span
                  key={i}
                  className="size-3.5 rounded-full border border-black/10"
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              ))}
            </div>
          </motion.button>
        ))}
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[11px] px-2 gap-1 text-muted-foreground"
          onClick={onSkip}
        >
          <SkipForward className="size-3" />
          Überspringen
        </Button>
      </div>
    </motion.div>
  );
}

/** Inline chip showing the picked concept (with a deselect x). */
function PickedConceptChip({
  concept,
  onClear,
}: {
  concept: ConceptCard;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-50 border border-amber-200/70 dark:bg-amber-900/20 dark:border-amber-800/50">
      <Sparkles className="size-3 text-amber-500 shrink-0" />
      <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300 max-w-[140px] truncate">
        {concept.name}
      </span>
      <button
        type="button"
        onClick={onClear}
        aria-label="Konzept entfernen"
        className="size-3.5 rounded-full hover:bg-amber-200/60 dark:hover:bg-amber-800/50 flex items-center justify-center"
      >
        <span className="text-[10px] text-amber-700 dark:text-amber-300 leading-none">×</span>
      </button>
    </div>
  );
}

/**
 * Small design-system override. Default = "auto" (pickSystemForTopic). Renders
 * compact toggle chips; the active one wins. Shown only in Agent mode.
 */
function DesignSystemPicker({
  value,
  onChange,
}: {
  value: string; // "auto" | system key
  onChange: (v: string) => void;
}) {
  const entries: Array<{ key: string; label: string }> = [
    { key: 'auto', label: 'Auto' },
    ...Object.values(DESIGN_SYSTEMS).map((s: DesignSystem) => ({
      key: s.name,
      label: s.label,
    })),
  ];
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Palette className="size-3 text-muted-foreground shrink-0" />
      {entries.map((e) => {
        const active = value === e.key;
        return (
          <button
            key={e.key}
            type="button"
            onClick={() => onChange(e.key)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors border ${
              active
                ? 'bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300'
                : 'bg-muted/40 border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {active && <Check className="size-2.5" />}
            {e.label}
          </button>
        );
      })}
    </div>
  );
}

export function ChatPanel() {
  const { t, locale } = useI18n();
  const chatMessages = useZDesignStore((s) => s.chatMessages);
  const addChatMessage = useZDesignStore((s) => s.addChatMessage);
  const clearChat = useZDesignStore((s) => s.clearChat);
  const isGenerating = useZDesignStore((s) => s.isGenerating);
  const setIsGenerating = useZDesignStore((s) => s.setIsGenerating);
  const projectId = useZDesignStore((s) => s.projectId);
  const designTree = useZDesignStore((s) => s.designTree);
  const designSystem = useZDesignStore((s) => s.designSystem);
  const setDesignTree = useZDesignStore((s) => s.setDesignTree);
  const setDesignHTML = useZDesignStore((s) => s.setDesignHTML);
  const setGenerationProgress = useZDesignStore((s) => s.setGenerationProgress);
  const resetGenerationProgress = useZDesignStore((s) => s.resetGenerationProgress);
  const setQualityReport = useZDesignStore((s) => s.setQualityReport);
  const qualityReport = useZDesignStore((s) => s.qualityReport);
  const generationProgress = useZDesignStore((s) => s.generationProgress);

  const [input, setInput] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Scroll the chat view to the bottom — used by auto-scroll and the jump button.
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setIsAtBottom(true);
  }, []);

  // Track whether the user is near the bottom so we can show a jump-to-end button.
  const handleChatScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(distanceFromBottom < 80);
  }, []);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // AI Image dialog
  const [aiImageOpen, setAiImageOpen] = useState(false);

  // Research dialog
  const [researchOpen, setResearchOpen] = useState(false);

  // Fusion pipeline toggle (multi-model panel -> judge -> synthesis).
  // Opt-in; the backend degrades to the standard chat path if Fusion is unavailable.
  // Fusion (remote multi-model panel→judge→synthesis) is the ONLY working generation
  // path in this environment — the in-app Z.ai path has no valid config, so an OFF
  // default silently degrades every prompt to the canned template fallback. Default ON.
  const [fusionEnabled, setFusionEnabled] = useState(true);

  // Agentic art-directed HTML mode (generate → critique → refine loop producing
  // a live HTML artifact, mirroring Claude Design). Opt-in toggle next to the
  // Fusion wand. Default OFF; node-tree remains the default editor experience.
  const [agentMode, setAgentMode] = useState(false);

  // === Assistant / wizard mode ===
  // When ON, chat behaves as a copilot: it EXPLAINS the UI/workflow and can
  // AUTO-EXECUTE actions the user would otherwise click (enable Agent/Fusion,
  // switch viewport / canvas mode / theme, export HTML, ...). Routes to
  // /api/assistant instead of /api/design/agent or /api/chat. Action chips are
  // rendered under the reply and auto-run on click. Mirrors the agentMode toggle
  // pattern (state + ref) and is mutually exclusive in spirit but not enforced —
  // assistant takes precedence when both are on (see sendMessage).
  const [assistantMode, setAssistantMode] = useState(false);

  // === Concept + Design-System pickers (S1) — Agent mode only ===
  // When ON + Agent mode: after the user sends a prompt we FIRST fetch concepts
  // and show them as cards. The user picks (→ selectedConcept) or skips; only
  // then do we call /api/design/agent with the concept attached.
  // systemOverride lets the user force a design system ("auto" = pickSystemForTopic).
  const [pendingConcepts, setPendingConcepts] = useState<ConceptCard[] | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<ConceptCard | null>(null);
  const [systemOverride, setSystemOverride] = useState<string>('auto');

  // Store actions the assistant may trigger on the client.
  const canvasMode = useZDesignStore((s) => s.canvas.mode);
  const viewport = useZDesignStore((s) => s.canvas.viewport);
  const designMode = useZDesignStore((s) => s.designMode);
  const setViewportAction = useZDesignStore((s) => s.setViewport);
  const setCanvasModeAction = useZDesignStore((s) => s.setCanvasMode);
  const setDesignModeAction = useZDesignStore((s) => s.setDesignMode);

  // === Refs for mutable state to avoid stale closures ===
  const projectIdRef = useRef(projectId);
  const isGeneratingRef = useRef(isGenerating);
  const chatMessagesRef = useRef(chatMessages);
  const designTreeRef = useRef(designTree);
  const designSystemRef = useRef(designSystem);
  const fusionEnabledRef = useRef(fusionEnabled);
  const agentModeRef = useRef(agentMode);
  const assistantModeRef = useRef(assistantMode);
  const setDesignHTMLRef = useRef(setDesignHTML);

  useEffect(() => { projectIdRef.current = projectId; }, [projectId]);
  useEffect(() => { isGeneratingRef.current = isGenerating; }, [isGenerating]);
  useEffect(() => { chatMessagesRef.current = chatMessages; }, [chatMessages]);
  useEffect(() => { fusionEnabledRef.current = fusionEnabled; }, [fusionEnabled]);
  useEffect(() => { agentModeRef.current = agentMode; }, [agentMode]);
  useEffect(() => { assistantModeRef.current = assistantMode; }, [assistantMode]);
  useEffect(() => { setDesignHTMLRef.current = setDesignHTML; }, [setDesignHTML]);
  useEffect(() => { designTreeRef.current = designTree; }, [designTree]);
  useEffect(() => { designSystemRef.current = designSystem; }, [designSystem]);

  // Stable store action refs
  const addChatMessageRef = useRef(addChatMessage);
  const setIsGeneratingRef = useRef(setIsGenerating);
  const setDesignTreeRef = useRef(setDesignTree);
  const setGenerationProgressRef = useRef(setGenerationProgress);
  const resetGenerationProgressRef = useRef(resetGenerationProgress);
  const setQualityReportRef = useRef(setQualityReport);
  const setViewportRef = useRef(setViewportAction);
  const setCanvasModeRef = useRef(setCanvasModeAction);
  const setDesignModeRef = useRef(setDesignModeAction);
  const setAgentModeRef = useRef(setAgentMode);
  const setFusionEnabledRef = useRef(setFusionEnabled);
  const tRef = useRef(t);

  // Picker refs (read inside sendMessage without stale closures)
  const pendingConceptsRef = useRef(pendingConcepts);
  const selectedConceptRef = useRef(selectedConcept);
  const systemOverrideRef = useRef(systemOverride);
  // Stashed agent message awaiting concept selection (resumed by the picker).
  const lastAgentMessageRef = useRef<{ text: string; projectId: string } | null>(null);

  useEffect(() => { addChatMessageRef.current = addChatMessage; }, [addChatMessage]);
  useEffect(() => { setIsGeneratingRef.current = setIsGenerating; }, [setIsGenerating]);
  useEffect(() => { setDesignTreeRef.current = setDesignTree; }, [setDesignTree]);
  useEffect(() => { setGenerationProgressRef.current = setGenerationProgress; }, [setGenerationProgress]);
  useEffect(() => { resetGenerationProgressRef.current = resetGenerationProgress; }, [resetGenerationProgress]);
  useEffect(() => { setQualityReportRef.current = setQualityReport; }, [setQualityReport]);
  useEffect(() => { setViewportRef.current = setViewportAction; }, [setViewportAction]);
  useEffect(() => { setCanvasModeRef.current = setCanvasModeAction; }, [setCanvasModeAction]);
  useEffect(() => { setDesignModeRef.current = setDesignModeAction; }, [setDesignModeAction]);
  useEffect(() => { setAgentModeRef.current = setAgentMode; }, [setAgentMode]);
  useEffect(() => { setFusionEnabledRef.current = setFusionEnabled; }, [setFusionEnabled]);
  useEffect(() => { tRef.current = t; }, [t]);
  useEffect(() => { pendingConceptsRef.current = pendingConcepts; }, [pendingConcepts]);
  useEffect(() => { selectedConceptRef.current = selectedConcept; }, [selectedConcept]);
  useEffect(() => { systemOverrideRef.current = systemOverride; }, [systemOverride]);

  // ============ Progress simulation ============
  // Simulates step-by-step progress while the API call is in flight
  // LLM takes ~60-90s, so we simulate progress over that duration
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgressSimulation = useCallback(() => {
    // Only set up incremental percentage updates during the API call
    // Initial stage is already set by sendMessage
    const startTime = Date.now();
    const totalDuration = 80000; // 80 seconds estimated total for LLM generation

    // Auto-advance stages on a timer
    // analyzing: 0-5s, generating: 5-55s, rendering: handled after API returns
    const stageTimers: Array<{ delay: number; stage: string; pct: number; msg: string }> = [
      { delay: 5000, stage: 'generating', pct: 25, msg: 'AI is creating your design...' },
      { delay: 20000, stage: 'generating', pct: 35, msg: 'Building layout structure...' },
      { delay: 40000, stage: 'generating', pct: 50, msg: 'Adding components and styles...' },
      { delay: 60000, stage: 'generating', pct: 60, msg: 'Polishing design details...' },
    ];

    const stageTimeouts: Array<ReturnType<typeof setTimeout>> = [];
    for (const st of stageTimers) {
      stageTimeouts.push(setTimeout(() => {
        setGenerationProgressRef.current({
          stage: st.stage as 'analyzing' | 'generating' | 'rendering' | 'evaluating' | 'complete' | 'error' | 'idle',
          stageLabel: st.msg,
          percentage: st.pct,
          message: st.msg,
          estimatedTimeLeft: Math.max(0, Math.round((totalDuration - st.delay) / 1000)),
        });
      }, st.delay));
    }

    progressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(65, Math.round(20 + (elapsed / totalDuration) * 45)); // 20-65% range
      const timeLeft = Math.max(0, Math.round((totalDuration - elapsed) / 1000));

      // Update percentage and time remaining
      setGenerationProgressRef.current({
        percentage: pct,
        estimatedTimeLeft: timeLeft,
      });
    }, 1000);

    // Store stage timeouts for cleanup
    (progressTimerRef as React.MutableRefObject<ReturnType<typeof setInterval> | null & { stageTimeouts?: Array<ReturnType<typeof setTimeout>> }>).current = {
      ...progressTimerRef.current,
      stageTimeouts,
    } as unknown as ReturnType<typeof setInterval>;
  }, []);

  const stopProgressSimulation = useCallback((success: boolean) => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      // Clean up stage timeouts
      const ref = progressTimerRef.current as unknown as { stageTimeouts?: Array<ReturnType<typeof setTimeout>> };
      if (ref.stageTimeouts) {
        ref.stageTimeouts.forEach(clearTimeout);
      }
      progressTimerRef.current = null;
    }

    if (success) {
      // If we're still in evaluating stage from sendMessage, set complete
      // If we haven't reached evaluating yet, skip to complete
      setGenerationProgressRef.current({
        stage: 'complete',
        stageLabel: 'Complete!',
        percentage: 100,
        message: 'Design generated successfully!',
      });

      // Reset after a short delay
      setTimeout(() => {
        resetGenerationProgressRef.current();
      }, 1500);
    } else {
      setGenerationProgressRef.current({
        stage: 'error',
        stageLabel: 'Error',
        percentage: 100,
        message: 'Generation failed',
      });

      setTimeout(() => {
        resetGenerationProgressRef.current();
      }, 3000);
    }
  }, []);

  // ============ Evaluate Design Quality ============
  const evaluateDesignQuality = useCallback((designTree: Record<string, unknown>) => {
    const report = {
      overallScore: 0,
      completeness: 0,
      cssValid: 0,
      semantics: 0,
      responsiveness: 0,
      accessibility: 0,
      issues: [] as Array<{
        severity: 'critical' | 'warning' | 'info';
        category: 'css' | 'semantics' | 'responsiveness' | 'accessibility' | 'completeness';
        message: string;
        autoFixable: boolean;
      }>,
      suggestions: [] as string[],
    };

    // Check completeness
    const children = (designTree as { children?: unknown[] }).children;
    if (children && children.length > 0) {
      report.completeness = Math.min(100, children.length * 20);
      // Check for essential sections
      const hasNav = children.some((c: unknown) => {
        const node = c as { type?: string; tag?: string };
        return node.type === 'nav' || node.tag === 'nav' || node.type === 'header';
      });
      const hasFooter = children.some((c: unknown) => {
        const node = c as { type?: string; tag?: string };
        return node.type === 'footer' || node.tag === 'footer';
      });
      const hasContent = children.some((c: unknown) => {
        const node = c as { type?: string; tag?: string };
        return node.type === 'section' || node.tag === 'section' || node.type === 'main';
      });

      if (!hasNav) {
        report.issues.push({
          severity: 'warning',
          category: 'completeness',
          message: 'No navigation section found',
          autoFixable: false,
        });
      }
      if (!hasFooter) {
        report.issues.push({
          severity: 'info',
          category: 'completeness',
          message: 'No footer section found',
          autoFixable: false,
        });
      }
      if (!hasContent) {
        report.issues.push({
          severity: 'warning',
          category: 'completeness',
          message: 'No main content section found',
          autoFixable: false,
        });
      }

      if (hasNav && hasFooter && hasContent) {
        report.completeness = 100;
      }
    } else {
      report.issues.push({
        severity: 'critical',
        category: 'completeness',
        message: 'Design tree has no children',
        autoFixable: false,
      });
    }

    // Check CSS validity (basic check)
    const styleStr = JSON.stringify(designTree);
    const hasTailwindShorthand = /\d+xl|text-md|p-lg|gap-md/.test(styleStr);
    if (hasTailwindShorthand) {
      report.cssValid = 50;
      report.issues.push({
        severity: 'critical',
        category: 'css',
        message: 'Found Tailwind shorthand in CSS values — should use real CSS (px, rem, %)',
        autoFixable: true,
      });
    } else {
      report.cssValid = 95;
    }

    // Check semantics
    const semanticTags = ['header', 'nav', 'main', 'section', 'footer', 'article', 'aside'];
    const usedTags = new Set<string>();
    const findTags = (node: unknown) => {
      const n = node as { tag?: string; children?: unknown[] };
      if (n.tag) usedTags.add(n.tag);
      if (n.children) n.children.forEach(findTags);
    };
    findTags(designTree);
    const semanticCount = semanticTags.filter((tag) => usedTags.has(tag)).length;
    report.semantics = Math.min(100, Math.round((semanticCount / 3) * 100)); // 3+ semantic tags = good

    // Check responsiveness
    const hasFlexOrGrid = /flex|grid/.test(styleStr);
    const hasPercentOrRelative = /%|rem|vh|vw/.test(styleStr);
    report.responsiveness = hasFlexOrGrid ? (hasPercentOrRelative ? 90 : 70) : 40;

    // Check accessibility basics
    const hasHeadings = /"heading"|"h1"|"h2"|"h3"/.test(styleStr);
    const hasButtons = /"button"/.test(styleStr);
    report.accessibility = hasHeadings ? (hasButtons ? 80 : 60) : 40;
    if (!hasHeadings) {
      report.issues.push({
        severity: 'warning',
        category: 'accessibility',
        message: 'No heading elements found — important for screen readers',
        autoFixable: false,
      });
    }

    // Suggestions
    if (report.responsiveness < 80) {
      report.suggestions.push('Consider using flexbox/grid layouts with relative units for better responsiveness');
    }
    if (report.semantics < 80) {
      report.suggestions.push('Use semantic HTML tags (header, nav, main, section, footer) for better structure');
    }
    if (report.accessibility < 80) {
      report.suggestions.push('Add proper heading hierarchy and ARIA labels for accessibility');
    }

    // Overall score
    report.overallScore = Math.round(
      (report.completeness * 0.25 +
        report.cssValid * 0.2 +
        report.semantics * 0.2 +
        report.responsiveness * 0.2 +
        report.accessibility * 0.15)
    );

    return report;
  }, []);

  // === Handle Enhance Design ===
  const handleEnhance = useCallback(async () => {
    const currentDesignTree = designTreeRef.current;
    const currentQualityReport = useZDesignStore.getState().qualityReport;

    if (!currentDesignTree || !currentDesignTree.children || currentDesignTree.children.length === 0) return;

    setIsEnhancing(true);
    try {
      const res = await fetch('/api/design/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designTree: currentDesignTree,
          qualityReport: currentQualityReport,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.designTree) {
          setDesignTreeRef.current(data.designTree);
        }
        if (data.qualityReport) {
          setQualityReportRef.current(data.qualityReport);
        }
        // Add assistant message about enhancement
        const enhanceMessage: ChatMessage = {
          id: `ai-enhance-${Date.now()}`,
          projectId: projectIdRef.current || '',
          role: 'assistant',
          content: `I've enhanced your design! ${data.enhancementsApplied?.length ? 'Applied fixes: ' + data.enhancementsApplied.join(', ') + '.' : 'The quality has been improved.'}`,
          metadata: data.designTree ? { designUpdate: data.designTree } : undefined,
          createdAt: new Date(),
        };
        addChatMessageRef.current(enhanceMessage);
      }
    } catch {
      // Enhancement failed silently
    } finally {
      setIsEnhancing(false);
    }
  }, []);

  // === sendMessage with progress tracking ===

  // A single executable action returned by the /api/assistant copilot. The
  // backend decides WHAT to do; we only dispatch it to the store / call the
  // existing export flow. Unknown types are surfaced to the user rather than
  // executed, so the model can't silently mutate state we didn't agree on.
  type AssistantAction =
    | { type: 'enable_agent' }
    | { type: 'enable_fusion' }
    | { type: 'set_viewport'; payload: 'desktop' | 'tablet' | 'mobile' }
    | { type: 'set_canvas_mode'; payload: 'ai' | 'editor' }
    | { type: 'set_design_mode'; payload: 'NODE_TREE' | 'HTML_ARTIFACT' }
    | { type: 'export'; payload?: 'html' }
    | { type: 'open_chat' }
    | { type: 'explain' };

  const ACTION_LABELS: Record<AssistantAction['type'], string> = {
    enable_agent: 'Agent aktivieren',
    enable_fusion: 'Fusion aktivieren',
    set_viewport: 'Viewport setzen',
    set_canvas_mode: 'Canvas-Modus setzen',
    set_design_mode: 'Design-Modus setzen',
    export: 'HTML exportieren',
    open_chat: 'Chat öffnen',
    explain: 'Erklären',
  };

  /** Execute one assistant action against the live store / export flow. */
  const runAssistantAction = useCallback(
    (action: AssistantAction, currentProjectId: string): string => {
      switch (action.type) {
        case 'enable_agent':
          setAgentModeRef.current(true);
          return 'Agent-Modus aktiviert.';
        case 'enable_fusion':
          setFusionEnabledRef.current(true);
          return 'Fusion-Pipeline aktiviert.';
        case 'set_viewport':
          setViewportRef.current(action.payload);
          return `Viewport → ${action.payload}.`;
        case 'set_canvas_mode':
          setCanvasModeRef.current(action.payload);
          return `Canvas-Modus → ${action.payload}.`;
        case 'set_design_mode':
          setDesignModeRef.current(action.payload);
          return `Design-Modus → ${action.payload}.`;
        case 'export':
          // Trigger the existing export flow (HTML download via POST).
          void fetch('/api/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: currentProjectId, format: 'html' }),
          })
            .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`status ${r.status}`))))
            .then((html) => {
              const blob = new Blob([html], { type: 'text/html' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `zdesign-${currentProjectId || 'export'}.html`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            })
            .catch((e) => console.warn('[assistant] export failed', e));
          return 'HTML-Export gestartet.';
        case 'open_chat':
        case 'explain':
        default:
          return 'OK.';
      }
    },
    []
  );

  /**
   * Run the Agent (HTML artifact) generation for an already-sent message.
   * Includes the selected concept (if any) and the resolved design system in
   * the body. Split out from sendMessage so the ConceptPicker can trigger it
   * AFTER the user picks/skips a concept.
   */
  const runAgentGeneration = useCallback(
    async (cleanText: string, currentProjectId: string) => {
      const concept = selectedConceptRef.current;
      const sysKey = systemOverrideRef.current;

      // Resolve the design system: explicit override, else topic-routed auto.
      let systemName: string | undefined;
      let systemCss: string | undefined;
      if (sysKey && sysKey !== 'auto') {
        const ds = DESIGN_SYSTEMS[sysKey];
        if (ds) {
          systemName = ds.name;
          systemCss = ds.rootCss;
        }
      } else {
        const auto = pickSystemForTopic(cleanText);
        systemName = auto.name;
        systemCss = auto.rootCss;
      }

      setIsGeneratingRef.current(true);
      startProgressSimulation();

      try {
        const res = await fetch('/api/design/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: cleanText,
            projectId: currentProjectId,
            ...(concept ? { concept } : {}),
            ...(systemName ? { designSystemKey: systemName, designSystemCss: systemCss } : {}),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.html) {
            setDesignHTMLRef.current(data.html, data.trace, data.scores);
            const aiMessage: ChatMessage = {
              id: data.id || `ai-${Date.now()}`,
              projectId: currentProjectId,
              role: 'assistant',
              content: data.message || 'Art-directeter Entwurf erstellt.',
              metadata: {
                agent: true,
                mode: 'HTML_ARTIFACT',
                trace: data.trace,
                scores: data.scores,
              } as unknown as ChatMessage['metadata'],
              createdAt: new Date(data.createdAt || Date.now()),
            };
            addChatMessageRef.current(aiMessage);
            stopProgressSimulation(true);
            return;
          }
          // No html — surface whatever message came back.
          const aiMessage: ChatMessage = {
            id: data.id || `ai-${Date.now()}`,
            projectId: currentProjectId,
            role: 'assistant',
            content: data.message || 'Agent lieferte kein HTML zurück.',
            metadata: { agent: true } as unknown as ChatMessage['metadata'],
            createdAt: new Date(data.createdAt || Date.now()),
          };
          addChatMessageRef.current(aiMessage);
          stopProgressSimulation(true);
        } else {
          const errorData = await res.json().catch(() => ({}));
          const errorMessage: ChatMessage = {
            id: `error-${Date.now()}`,
            projectId: currentProjectId,
            role: 'system',
            content: `${tRef.current.common.error}: ${errorData.error || 'Unknown error'}`,
            createdAt: new Date(),
          };
          addChatMessageRef.current(errorMessage);
          stopProgressSimulation(false);
        }
      } catch {
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          projectId: currentProjectId,
          role: 'system',
          content: tRef.current.common.error,
          createdAt: new Date(),
        };
        addChatMessageRef.current(errorMessage);
        stopProgressSimulation(false);
      } finally {
        setIsGeneratingRef.current(false);
      }
    },
    [startProgressSimulation, stopProgressSimulation]
  );

  const sendMessage = useCallback(
    async (messageText: string) => {
      const currentProjectId = projectIdRef.current;
      const currentIsGenerating = isGeneratingRef.current;

      if (!messageText.trim() || !currentProjectId || currentIsGenerating) return;

      // Clean up any voice indicators from the message
      const cleanText = messageText.replace(/🎤/g, '').trim();
      if (!cleanText) return;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        projectId: currentProjectId,
        role: 'user',
        content: cleanText,
        createdAt: new Date(),
      };

      addChatMessageRef.current(userMessage);
      setInput('');
      setIsGeneratingRef.current(true);

      // Start progress — set analyzing stage explicitly
      const progressStartTime = Date.now();
      setGenerationProgressRef.current({
        stage: 'analyzing',
        stageLabel: 'Analyzing request...',
        percentage: 10,
        message: 'Understanding your design request...',
        startedAt: progressStartTime,
        estimatedTimeLeft: 75,
      });

      // Small delay for UX
      await new Promise((r) => setTimeout(r, 300));

      // Move to generating stage
      setGenerationProgressRef.current({
        stage: 'generating',
        stageLabel: 'Generating design...',
        percentage: 30,
        message: 'Creating your design...',
        startedAt: progressStartTime,
      });

      // Start progress simulation for incremental updates during API call
      startProgressSimulation();

      try {
        // === ASSISTANT / WIZARD path (copilot) ===
        // Takes precedence over Agent/Fusion when the Assistant toggle is ON.
        // Explains the UI/workflow and optionally auto-executes app actions.
        // Returns early; the design/agent/fusion paths below are untouched.
        if (assistantModeRef.current) {
          const currentDesignTree = designTreeRef.current;
          const hasDesign = !!(currentDesignTree.children && currentDesignTree.children.length > 0);

          // Assistant replies are quick — skip the long progress simulation.
          stopProgressSimulation(true);

          let assistantData: {
            message?: string;
            reply?: string;
            actions?: Array<Record<string, unknown>>;
          } = {};
          try {
            const res = await fetch('/api/assistant', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: cleanText,
                projectId: currentProjectId,
                context: {
                  mode: canvasMode,
                  viewport,
                  hasDesign,
                  designMode,
                },
              }),
            });
            if (res.ok) {
              assistantData = await res.json();
            } else {
              const errBody = await res.json().catch(() => ({}));
              throw new Error(errBody.error || `status ${res.status}`);
            }
          } catch (e) {
            const errorMessage: ChatMessage = {
              id: `assistant-error-${Date.now()}`,
              projectId: currentProjectId,
              role: 'system',
              content: `${tRef.current.common.error}: ${e instanceof Error ? e.message : 'Assistant unavailable'}`,
              createdAt: new Date(),
            };
            addChatMessageRef.current(errorMessage);
            stopProgressSimulation(false);
            return;
          }

          const replyText = assistantData.message || assistantData.reply || '...';
          const rawActions = Array.isArray(assistantData.actions) ? assistantData.actions : [];

          // Run recognized actions immediately (best-effort) and collect a
          // human-readable summary so the user sees WHAT was done. Unknown
          // action types are ignored, not executed.
          const runResults: string[] = [];
          const recognized: AssistantAction[] = [];
          for (const raw of rawActions) {
            const type = typeof raw?.type === 'string' ? raw.type : '';
            if (type === 'enable_agent') {
              recognized.push({ type: 'enable_agent' });
            } else if (type === 'enable_fusion') {
              recognized.push({ type: 'enable_fusion' });
            } else if (type === 'open_chat') {
              recognized.push({ type: 'open_chat' });
            } else if (type === 'explain') {
              recognized.push({ type: 'explain' });
            } else if (type === 'export') {
              recognized.push({ type: 'export', payload: 'html' });
            } else if (type === 'set_viewport' && (raw.payload === 'desktop' || raw.payload === 'tablet' || raw.payload === 'mobile')) {
              recognized.push({ type: 'set_viewport', payload: raw.payload });
            } else if (type === 'set_canvas_mode' && (raw.payload === 'ai' || raw.payload === 'editor')) {
              recognized.push({ type: 'set_canvas_mode', payload: raw.payload });
            } else if (type === 'set_design_mode' && (raw.payload === 'NODE_TREE' || raw.payload === 'HTML_ARTIFACT')) {
              recognized.push({ type: 'set_design_mode', payload: raw.payload });
            }
          }
          for (const action of recognized) {
            runResults.push(`${ACTION_LABELS[action.type]}: ${runAssistantAction(action, currentProjectId)}`);
          }

          const doneSummary = runResults.length
            ? `\n\n**Ausgeführt:**\n${runResults.map((r) => `- ${r}`).join('\n')}`
            : '';

          const assistantMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            projectId: currentProjectId,
            role: 'assistant',
            content: replyText + doneSummary,
            // Tagged so MessageBubble can render the distinct "Assistant" look.
            metadata: {
              assistant: true,
              assistantActions: recognized.map((a) => ACTION_LABELS[a.type]),
            } as unknown as ChatMessage['metadata'],
            createdAt: new Date(),
          };
          addChatMessageRef.current(assistantMessage);
          stopProgressSimulation(true);
          return;
        }

        const currentMessages = chatMessagesRef.current;
        const history = currentMessages.slice(-10).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

        const currentDesignTree = designTreeRef.current;
        const currentDesignSystem = designSystemRef.current;

        const agentMode = agentModeRef.current;

        // === CONCEPT PICKER gate (Agent mode only) ===
        // Before generating, fetch 3 creative concepts and surface them as
        // clickable cards. We PAUSE here (stop progress, release the
        // isGenerating lock) and let the picker handlers call runAgentGeneration
        // once the user picks or skips. Skipping still proceeds (no concept).
        // If the user sends a NEW message while old concepts are still pending,
        // we drop the stale set and re-fetch for the new message.
        if (agentMode) {
          if (pendingConceptsRef.current !== null) {
            setPendingConcepts(null);
            setSelectedConcept(null);
            pendingConceptsRef.current = null;
            selectedConceptRef.current = null;
          }
          stopProgressSimulation(true);
          setIsGeneratingRef.current(false);
          try {
            const cres = await fetch('/api/design/concepts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: cleanText, count: 3 }),
            });
            const cdata = await cres.json().catch(() => ({}));
            const concepts: ConceptCard[] = Array.isArray(cdata.concepts)
              ? cdata.concepts.filter(
                  (c: unknown): c is ConceptCard =>
                    !!c &&
                    typeof (c as ConceptCard).name === 'string' &&
                    typeof (c as ConceptCard).bigIdea === 'string' &&
                    !!((c as ConceptCard).palette),
                )
              : [];
            if (concepts.length > 0) {
              // Stash the message + projectId on the picker via a ref so the
              // handlers can resume generation without re-sending.
              lastAgentMessageRef.current = { text: cleanText, projectId: currentProjectId };
              setSelectedConcept(null);
              setPendingConcepts(concepts);
              return; // wait for user selection
            }
            // No concepts → fall straight through to generation (skip path).
          } catch {
            // concept fetch failed → proceed without concepts
          }
          // Re-acquire the lock + progress for the direct generation below.
          setIsGeneratingRef.current(true);
          setGenerationProgressRef.current({
            stage: 'generating',
            stageLabel: 'Generating design...',
            percentage: 30,
            message: 'Creating your design...',
          });
          startProgressSimulation();
          await runAgentGeneration(cleanText, currentProjectId);
          return;
        }

        // === Non-agent (chat) path — unchanged ===
        // (Agent mode always returns early above via the concept gate or
        // runAgentGeneration, so this branch only handles the chat pipeline.)
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: cleanText,
            projectId: currentProjectId,
            designTree: currentDesignTree.children && currentDesignTree.children.length > 0 ? currentDesignTree : undefined,
            designSystem: currentDesignSystem || undefined,
            history,
            fusion: fusionEnabledRef.current || undefined,
          }),
        });

        if (res.ok) {
          const data = await res.json();

          const aiMessage: ChatMessage = {
            id: data.id || `ai-${Date.now()}`,
            projectId: currentProjectId,
            role: 'assistant',
            content: data.message || 'I processed your request.',
            metadata: data.design
              ? { designUpdate: data.design, usedFallback: data.usedFallback || false, templateUsed: data.templateUsed || false }
              : undefined,
            createdAt: new Date(data.createdAt || Date.now()),
          };
          addChatMessageRef.current(aiMessage);

          // Show fallback info if the AI was unavailable (positive framing)
          if (data.usedFallback && !data.templateUsed) {
            const infoMessage: ChatMessage = {
              id: `fallback-info-${Date.now()}`,
              projectId: currentProjectId,
              role: 'system',
              content: '✨ AI-guided template used — You can customize this design by telling me what to change!',
              createdAt: new Date(),
            };
            addChatMessageRef.current(infoMessage);
          }

          if (data.design) {
            setDesignTreeRef.current(data.design);

            // Non-blocking: fill pending image nodes with real generated imagery
            // in parallel. The design renders immediately; images pop in as they
            // arrive. Failures degrade gracefully to the gradient placeholder.
            void generateImagesForDesign(data.design, cleanText);

            // Move to rendering stage
            setGenerationProgressRef.current({
              stage: 'rendering',
              stageLabel: 'Rendering preview...',
              percentage: 70,
              message: 'Preparing design preview...',
            });

            // Small delay for UX
            await new Promise((r) => setTimeout(r, 300));

            // Evaluate design quality via API
            setGenerationProgressRef.current({
              stage: 'evaluating',
              stageLabel: 'Evaluating quality...',
              percentage: 90,
              message: 'Checking design quality...',
            });

            try {
              const evalRes = await fetch('/api/design/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ designTree: data.design }),
              });
              if (evalRes.ok) {
                const qualityResult = await evalRes.json();
                setQualityReportRef.current(qualityResult);
              } else {
                // Fallback to client-side evaluation
                const clientReport = evaluateDesignQuality(data.design);
                setQualityReportRef.current(clientReport);
              }
            } catch {
              // Fallback to client-side evaluation
              const clientReport = evaluateDesignQuality(data.design);
              setQualityReportRef.current(clientReport);
            }
          }

          // Show parse failure info if AI output couldn't be parsed (smart fallback should prevent this, but just in case)
          if (!data.design && data.parseFailed) {
            const parseInfoMessage: ChatMessage = {
              id: `parse-info-${Date.now()}`,
              projectId: currentProjectId,
              role: 'system',
              content: `I had trouble generating your design. Please try describing what you'd like again!`,
              createdAt: new Date(),
            };
            addChatMessageRef.current(parseInfoMessage);
          }

          // Stop progress with success
          stopProgressSimulation(true);
        } else {
          const errorData = await res.json().catch(() => ({}));
          const errorMessage: ChatMessage = {
            id: `error-${Date.now()}`,
            projectId: currentProjectId,
            role: 'system',
            content: `${tRef.current.common.error}: ${errorData.error || 'Unknown error'}`,
            createdAt: new Date(),
          };
          addChatMessageRef.current(errorMessage);
          stopProgressSimulation(false);
        }
      } catch {
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          projectId: currentProjectId,
          role: 'system',
          content: tRef.current.common.error,
          createdAt: new Date(),
        };
        addChatMessageRef.current(errorMessage);
        stopProgressSimulation(false);
      } finally {
        setIsGeneratingRef.current(false);
      }
    },
    [startProgressSimulation, stopProgressSimulation, evaluateDesignQuality, runAssistantAction, canvasMode, viewport, designMode]
  );

  // Voice input handlers
  const handleVoiceTranscript = useCallback(
    (transcript: string) => {
      if (transcript.trim()) {
        sendMessage(transcript.trim());
      }
    },
    [sendMessage]
  );

  const handleVoiceInterim = useCallback((interim: string) => {
    setInput((prev) => {
      const base = prev.replace(/🎤.*$/, '');
      return interim ? `${base}🎤 ${interim}` : base;
    });
  }, []);

  const {
    isListening,
    isSupported: voiceSupported,
    startListening,
    stopListening,
    error: voiceError,
  } = useVoiceInput({
    onTranscript: handleVoiceTranscript,
    onInterimTranscript: handleVoiceInterim,
    language: locale === 'de' ? 'de-DE' : 'en-US',
  });

  // Auto-scroll to bottom when new messages arrive / while generating, but only
  // if the user is already near the bottom (don't yank them down while reading up).
  useEffect(() => {
    if (isAtBottom) scrollToBottom('auto');
  }, [chatMessages, isGenerating, isAtBottom, scrollToBottom]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const cleanInput = input.replace(/🎤/g, '');
        sendMessage(cleanInput);
      }
    },
    [input, sendMessage]
  );

  const handleExampleClick = useCallback(
    (prompt: string) => {
      sendMessage(prompt);
    },
    [sendMessage]
  );

  // === Concept picker handlers (resume the paused agent generation) ===
  const handlePickConcept = useCallback(
    (c: ConceptCard) => {
      const stash = lastAgentMessageRef.current;
      setSelectedConcept(c);
      setPendingConcepts(null);
      if (!stash) return;
      void runAgentGeneration(stash.text, stash.projectId);
    },
    [runAgentGeneration]
  );

  const handleSkipConcept = useCallback(() => {
    const stash = lastAgentMessageRef.current;
    setSelectedConcept(null);
    setPendingConcepts(null);
    if (!stash) return;
    void runAgentGeneration(stash.text, stash.projectId);
  }, [runAgentGeneration]);

  const handleClearSelectedConcept = useCallback(() => {
    setSelectedConcept(null);
  }, []);

  const handleClear = useCallback(() => {
    clearChat();
  }, [clearChat]);

  const handleVoiceToggle = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const hasMessages = chatMessages.length > 0;
  const showProgress = isGenerating && generationProgress.stage !== 'idle';

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-11 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-emerald-600" />
          <span className="text-sm font-medium">{t.chat.title}</span>
          {isGenerating && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            >
              {t.chat.thinking}
            </Badge>
          )}
        </div>
        {hasMessages && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={handleClear}
              >
                <Trash2 className="size-3.5 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t.chat.clearChat}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Messages or Welcome */}
      {!hasMessages ? (
        <WelcomeState onExampleClick={handleExampleClick} />
      ) : (
        <div className="relative flex-1 min-h-0">
          <div
            ref={scrollRef}
            onScroll={handleChatScroll}
            className="h-full overflow-y-auto overscroll-contain"
          >
            <div className="py-2 space-y-1">
              <AnimatePresence mode="popLayout">
                {chatMessages.map((message) => (
                  <MessageBubble key={message.id} message={message} qualityReport={qualityReport} onEnhance={handleEnhance} isEnhancing={isEnhancing} />
                ))}
              </AnimatePresence>
              {pendingConcepts && pendingConcepts.length > 0 && (
                <ConceptPicker
                  concepts={pendingConcepts}
                  onPick={handlePickConcept}
                  onSkip={handleSkipConcept}
                />
              )}
              {isGenerating && !showProgress && <TypingIndicator />}
            </div>
          </div>

          {/* Jump to latest — appears when the user has scrolled up */}
          {!isAtBottom && (
            <button
              type="button"
              onClick={() => scrollToBottom('smooth')}
              aria-label="Jump to latest message"
              className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 rounded-full border bg-background/95 backdrop-blur px-3 py-1.5 text-xs font-medium shadow-md hover:bg-accent transition-colors"
            >
              <ArrowDown className="size-3.5" />
              Latest
            </button>
          )}
        </div>
      )}

      {/* Generation Step Progress */}
      {showProgress && <GenerationStepProgress />}

      {/* Concept + Design-System pickers — Agent mode only */}
      {agentMode && (
        <div className="px-3 py-1.5 flex flex-wrap items-center gap-1.5 border-b bg-muted/20">
          {selectedConcept && (
            <PickedConceptChip
              concept={selectedConcept}
              onClear={handleClearSelectedConcept}
            />
          )}
          <DesignSystemPicker
            value={systemOverride}
            onChange={setSystemOverride}
          />
        </div>
      )}

      <Separator />

      {/* Input area */}
      <div className="p-3 shrink-0">
        <div className="relative flex items-end gap-2 bg-muted/50 rounded-xl border focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
          {/* Attachment button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 ml-2 mb-1.5 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <Paperclip className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Attach file</TooltipContent>
          </Tooltip>

          {/* Research button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 mb-1.5 shrink-0 text-muted-foreground hover:text-emerald-600"
                onClick={() => setResearchOpen(true)}
              >
                <Search className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {t.research?.button || 'Research'}
            </TooltipContent>
          </Tooltip>

          {/* AI Image button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 mb-1.5 shrink-0 text-muted-foreground hover:text-emerald-600"
                onClick={() => setAiImageOpen(true)}
              >
                <ImageIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {t.aiImage?.buttonText || 'AI Image'}
            </TooltipContent>
          </Tooltip>

          {/* Fusion pipeline toggle (multi-model panel -> judge -> synthesis) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-pressed={fusionEnabled}
                onClick={() => setFusionEnabled((v) => !v)}
                className={`size-8 mb-1.5 shrink-0 transition-colors ${
                  fusionEnabled
                    ? 'text-violet-600 bg-violet-50 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Wand2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {fusionEnabled
                ? 'Fusion ON — multi-model panel (click to disable)'
                : 'Fusion: multi-model panel → judge → synthesis (click to enable)'}
            </TooltipContent>
          </Tooltip>

          {/* Agentic art-directed HTML mode toggle (Generate → Critique → Refine → live HTML).
              Mirrors Claude Design: an iterative, skill-driven loop producing a rich
              HTML artifact rendered live, instead of the single-shot node tree. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-pressed={agentMode}
                onClick={() => setAgentMode((v) => !v)}
                className={`size-8 mb-1.5 shrink-0 transition-colors ${
                  agentMode
                    ? 'text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Bot className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {agentMode
                ? 'Agent ON — art-directed HTML (Generate → Critique → Refine). Klick für Node-Modus.'
                : 'Agent: art-directed HTML-Design-Loop (Generate → Critique → Refine → live HTML). Klick zum Aktivieren.'}
            </TooltipContent>
          </Tooltip>

          {/* Assistant / wizard toggle — turns the chat into a copilot that
              explains the UI/workflow and can auto-execute app actions
              (enable Agent/Fusion, switch viewport/theme, export, ...).
              Takes precedence over Agent + Fusion when ON. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-pressed={assistantMode}
                onClick={() => setAssistantMode((v) => !v)}
                className={`size-8 mb-1.5 shrink-0 transition-colors ${
                  assistantMode
                    ? 'text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <HelpCircle className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {assistantMode
                ? 'Assistent ON — erklärt UI & führt Aktionen aus (Klick zum Deaktivieren).'
                : 'Assistent/Wizard: erklärt Workflow & führt App-Aktionen automatisch aus (Klick zum Aktivieren).'}
            </TooltipContent>
          </Tooltip>

          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? t.voice?.listening || 'Listening...'
                : t.chat.placeholder
            }
            className={`min-h-[44px] max-h-[120px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:border-0 shadow-none text-sm py-2.5 px-0 placeholder:text-muted-foreground/60 ${
              isListening ? 'placeholder:text-red-500/60' : ''
            }`}
            rows={1}
            disabled={isGenerating}
          />

          <div className="flex items-center gap-0.5 mr-1.5 mb-1.5 shrink-0">
            {/* Voice input button */}
            {voiceSupported && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`size-8 ${
                      isListening
                        ? 'text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/20'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={handleVoiceToggle}
                  >
                    {isListening ? (
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        <Mic className="size-4" />
                      </motion.div>
                    ) : (
                      <Mic className="size-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {isListening
                    ? t.voice?.stopListening || 'Stop listening'
                    : t.voice?.startListening || 'Start voice input'}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Send button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  className="size-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    const cleanInput = input.replace(/🎤/g, '');
                    sendMessage(cleanInput);
                  }}
                  disabled={!input.replace(/🎤/g, '').trim() || isGenerating}
                >
                  <Send className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {t.chat.send} (Enter)
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Voice error */}
        {voiceError && (
          <p className="text-[10px] text-red-500 mt-1 text-center">
            {voiceError}
          </p>
        )}

        {/* Listening indicator */}
        {isListening && (
          <div className="flex items-center justify-center gap-2 mt-1.5">
            <motion.div
              className="size-2 rounded-full bg-red-500"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <span className="text-[10px] text-red-500 font-medium">
              {t.voice?.listening || 'Listening...'}
            </span>
          </div>
        )}

        {!isListening && (
          <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
            Shift+Enter for new line
          </p>
        )}
      </div>

      {/* AI Image Dialog */}
      <AIImageDialog open={aiImageOpen} onOpenChange={setAiImageOpen} />

      {/* Research Dialog */}
      <ResearchDialog
        open={researchOpen}
        onOpenChange={setResearchOpen}
        onResults={(query, results) => {
          // Add a user message showing what was searched
          const userMessage: ChatMessage = {
            id: `user-research-${Date.now()}`,
            projectId: projectId || '',
            role: 'user',
            content: `🔍 ${t.research?.button || 'Research'}: ${query}`,
            createdAt: new Date(),
          };
          addChatMessage(userMessage);

          // Add an assistant message with the results
          const resultLines = results
            .map(
              (r, i) =>
                `${i + 1}. **[${r.title}](${r.url})**\n   ${r.description}\n   _${r.domain}${r.date ? ` · ${r.date}` : ''}_`
            )
            .join('\n\n');

          const assistantMessage: ChatMessage = {
            id: `ai-research-${Date.now()}`,
            projectId: projectId || '',
            role: 'assistant',
            content: `${t.research?.results || 'Found inspiration!'} Here's what I found for "${query}":\n\n${resultLines}`,
            createdAt: new Date(),
          };
          addChatMessage(assistantMessage);
        }}
      />
    </div>
  );
}
