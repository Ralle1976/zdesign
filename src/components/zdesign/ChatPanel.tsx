'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useZDesignStore } from '@/stores/zdesign-store';
import { useI18n } from '@/i18n';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import type { ChatMessage, DesignQualityReport } from '@/types/design';
import { ScrollArea } from '@/components/ui/scroll-area';
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
              : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-bold'
          }
        >
          {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
        </AvatarFallback>
      </Avatar>

      <div
        className={`max-w-[85%] space-y-1 ${isUser ? 'items-end' : 'items-start'}`}
      >
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-emerald-600 text-white rounded-tr-sm'
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

export function ChatPanel() {
  const { t } = useI18n();
  const chatMessages = useZDesignStore((s) => s.chatMessages);
  const addChatMessage = useZDesignStore((s) => s.addChatMessage);
  const clearChat = useZDesignStore((s) => s.clearChat);
  const isGenerating = useZDesignStore((s) => s.isGenerating);
  const setIsGenerating = useZDesignStore((s) => s.setIsGenerating);
  const projectId = useZDesignStore((s) => s.projectId);
  const designTree = useZDesignStore((s) => s.designTree);
  const designSystem = useZDesignStore((s) => s.designSystem);
  const setDesignTree = useZDesignStore((s) => s.setDesignTree);
  const setGenerationProgress = useZDesignStore((s) => s.setGenerationProgress);
  const resetGenerationProgress = useZDesignStore((s) => s.resetGenerationProgress);
  const setQualityReport = useZDesignStore((s) => s.setQualityReport);
  const qualityReport = useZDesignStore((s) => s.qualityReport);
  const generationProgress = useZDesignStore((s) => s.generationProgress);

  const [input, setInput] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // AI Image dialog
  const [aiImageOpen, setAiImageOpen] = useState(false);

  // Research dialog
  const [researchOpen, setResearchOpen] = useState(false);

  // === Refs for mutable state to avoid stale closures ===
  const projectIdRef = useRef(projectId);
  const isGeneratingRef = useRef(isGenerating);
  const chatMessagesRef = useRef(chatMessages);
  const designTreeRef = useRef(designTree);
  const designSystemRef = useRef(designSystem);

  useEffect(() => { projectIdRef.current = projectId; }, [projectId]);
  useEffect(() => { isGeneratingRef.current = isGenerating; }, [isGenerating]);
  useEffect(() => { chatMessagesRef.current = chatMessages; }, [chatMessages]);
  useEffect(() => { designTreeRef.current = designTree; }, [designTree]);
  useEffect(() => { designSystemRef.current = designSystem; }, [designSystem]);

  // Stable store action refs
  const addChatMessageRef = useRef(addChatMessage);
  const setIsGeneratingRef = useRef(setIsGenerating);
  const setDesignTreeRef = useRef(setDesignTree);
  const setGenerationProgressRef = useRef(setGenerationProgress);
  const resetGenerationProgressRef = useRef(resetGenerationProgress);
  const setQualityReportRef = useRef(setQualityReport);
  const tRef = useRef(t);

  useEffect(() => { addChatMessageRef.current = addChatMessage; }, [addChatMessage]);
  useEffect(() => { setIsGeneratingRef.current = setIsGenerating; }, [setIsGenerating]);
  useEffect(() => { setDesignTreeRef.current = setDesignTree; }, [setDesignTree]);
  useEffect(() => { setGenerationProgressRef.current = setGenerationProgress; }, [setGenerationProgress]);
  useEffect(() => { resetGenerationProgressRef.current = resetGenerationProgress; }, [resetGenerationProgress]);
  useEffect(() => { setQualityReportRef.current = setQualityReport; }, [setQualityReport]);
  useEffect(() => { tRef.current = t; }, [t]);

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
        const currentMessages = chatMessagesRef.current;
        const history = currentMessages.slice(-10).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

        const currentDesignTree = designTreeRef.current;
        const currentDesignSystem = designSystemRef.current;

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: cleanText,
            projectId: currentProjectId,
            designTree: currentDesignTree.children && currentDesignTree.children.length > 0 ? currentDesignTree : undefined,
            designSystem: currentDesignSystem || undefined,
            history,
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
    [startProgressSimulation, stopProgressSimulation, evaluateDesignQuality]
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
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isGenerating]);

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
        <ScrollArea className="flex-1">
          <div ref={scrollRef} className="py-2 space-y-1">
            <AnimatePresence mode="popLayout">
              {chatMessages.map((message) => (
                <MessageBubble key={message.id} message={message} qualityReport={qualityReport} onEnhance={handleEnhance} isEnhancing={isEnhancing} />
              ))}
            </AnimatePresence>
            {isGenerating && !showProgress && <TypingIndicator />}
          </div>
        </ScrollArea>
      )}

      {/* Generation Step Progress */}
      {showProgress && <GenerationStepProgress />}

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
