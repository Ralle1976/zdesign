'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useZDesignStore } from '@/stores/zdesign-store';
import { useI18n } from '@/i18n';
import { DesignRenderer } from '@/components/zdesign/canvas/DesignRenderer';
import { HtmlArtifactPreview } from '@/components/zdesign/canvas/HtmlArtifactPreview';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Monitor,
  Tablet,
  Smartphone,
  Brain,
  Palette,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Zap,
  Wand2,
  ChevronDown,
  ChevronUp,
  XCircle,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ViewportSize, GenerationStage, DesignQualityReport } from '@/types/design';

const VIEWPORT_ICONS: Record<ViewportSize, typeof Monitor> = {
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
};

// ============ Step-based Progress Indicator ============

const GENERATION_STEPS: { stage: GenerationStage; label: { en: string; de: string }; icon: typeof Brain }[] = [
  { stage: 'analyzing', label: { en: 'Analyzing request...', de: 'Anfrage analysieren...' }, icon: Brain },
  { stage: 'generating', label: { en: 'Generating layout...', de: 'Layout generieren...' }, icon: Sparkles },
  { stage: 'rendering', label: { en: 'Adding styles...', de: 'Stile hinzufügen...' }, icon: Palette },
  { stage: 'evaluating', label: { en: 'Finalizing design...', de: 'Design finalisieren...' }, icon: CheckCircle2 },
  { stage: 'complete', label: { en: 'Complete!', de: 'Fertig!' }, icon: CheckCircle2 },
];

function getStepIndex(stage: GenerationStage): number {
  const idx = GENERATION_STEPS.findIndex((s) => s.stage === stage);
  return idx === -1 ? 0 : idx;
}

function GenerationProgressIndicator() {
  const { t, locale } = useI18n();
  const generationProgress = useZDesignStore((s) => s.generationProgress);
  const creativeMode = useZDesignStore((s) => s.creativeMode);
  const qualityReport = useZDesignStore((s) => s.qualityReport);
  const setIsGenerating = useZDesignStore((s) => s.setIsGenerating);
  const resetGenerationProgress = useZDesignStore((s) => s.resetGenerationProgress);
  const isDe = locale === 'de';

  // Auto-advance step indicators on a timer for better UX during long LLM calls
  // Use a tick counter that increments every 15s to drive step advancement
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (generationProgress.stage === 'complete' || generationProgress.stage === 'error' || generationProgress.stage === 'idle') {
      return;
    }
    // Advance tick every 15 seconds to show progress through steps
    const timer = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 15000);
    return () => clearInterval(timer);
  }, [generationProgress.stage]);

  // Compute auto-step from tick, capped at 'evaluating' step
  const autoStep = Math.min(tick, GENERATION_STEPS.length - 2);

  const currentStepIndex = getStepIndex(generationProgress.stage);
  // Use the higher of actual progress step or auto-advanced step
  const displayStepIndex = Math.max(currentStepIndex, autoStep);
  const isComplete = generationProgress.stage === 'complete';
  const isError = generationProgress.stage === 'error';

  const handleCancel = useCallback(() => {
    resetGenerationProgress();
    setIsGenerating(false);
  }, [resetGenerationProgress, setIsGenerating]);

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-background rounded-xl shadow-lg border p-8 flex flex-col items-center gap-6 w-full max-w-md"
      >
        {/* Animated Logo */}
        <motion.div
          className="flex items-center justify-center size-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25"
          animate={!isComplete ? { scale: [1, 1.08, 1], rotate: [0, 2, -2, 0] } : { scale: 1 }}
          transition={{ duration: 2, repeat: isComplete ? 0 : Infinity, ease: 'easeInOut' }}
        >
          {isError ? (
            <AlertCircle className="size-8" />
          ) : isComplete ? (
            <CheckCircle2 className="size-8" />
          ) : (
            <Loader2 className="size-8 animate-spin" />
          )}
        </motion.div>

        {/* Status Message */}
        <div className="text-center space-y-1">
          <p className="text-base font-semibold">
            {isError
              ? (isDe ? 'Fehler bei der Generierung' : 'Generation failed')
              : isComplete
                ? (isDe ? 'Design fertig!' : 'Design complete!')
                : (isDe ? 'KI erstellt dein Design...' : 'AI is creating your design...')}
          </p>
          {generationProgress.message && (
            <p className="text-xs text-muted-foreground">{generationProgress.message}</p>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full space-y-1.5">
          <Progress
            value={isError ? 100 : generationProgress.percentage}
            className={`h-2 ${isError ? '[&>div]:bg-red-500' : isComplete ? '[&>div]:bg-emerald-500' : '[&>div]:bg-emerald-500'}`}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{generationProgress.percentage}%</span>
            {generationProgress.estimatedTimeLeft && generationProgress.estimatedTimeLeft > 0 && !isComplete && (
              <span>~{generationProgress.estimatedTimeLeft}s {isDe ? 'übrig' : 'remaining'}</span>
            )}
          </div>
        </div>

        {/* Step Indicators */}
        <div className="w-full space-y-1.5">
          {GENERATION_STEPS.map((step, index) => {
            const isActive = index === displayStepIndex && !isComplete;
            const isDone = index < displayStepIndex || isComplete;
            const isPending = index > displayStepIndex;
            const StepIcon = step.icon;

            return (
              <motion.div
                key={step.stage}
                initial={false}
                animate={{ opacity: isPending ? 0.4 : 1 }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                    : isDone
                      ? 'bg-muted/30'
                      : ''
                }`}
              >
                <div className={`flex items-center justify-center size-6 rounded-md shrink-0 ${
                  isDone
                    ? 'bg-emerald-100 dark:bg-emerald-900/30'
                    : isActive
                      ? 'bg-emerald-500 text-white'
                      : 'bg-muted'
                }`}>
                  {isDone ? (
                    <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : isActive ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <StepIcon className="size-3.5 text-muted-foreground" />
                  )}
                </div>
                <span className={`text-xs font-medium ${
                  isDone ? 'text-emerald-700 dark:text-emerald-400' : isActive ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {isDe ? step.label.de : step.label.en}
                </span>
                {isActive && (
                  <motion.div
                    className="ml-auto flex gap-0.5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {[0, 0.15, 0.3].map((delay, i) => (
                      <motion.div
                        key={i}
                        className="size-1.5 rounded-full bg-emerald-500"
                        animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay }}
                      />
                    ))}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Cancel Button */}
        {!isComplete && !isError && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={handleCancel}
          >
            <X className="size-3.5" />
            {isDe ? 'Abbrechen' : 'Cancel'}
          </Button>
        )}

        {/* Creative Mode Indicator */}
        {creativeMode && !isComplete && (
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
            <Zap className="size-3.5" />
            <span className="font-medium">Creative Mode — Multi-pass generation enabled</span>
          </div>
        )}

        {/* Quality Report Preview */}
        {isComplete && qualityReport && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full p-3 rounded-lg border bg-muted/30"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium">Quality Score</span>
              <span className={`text-sm font-bold ${
                qualityReport.overallScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                qualityReport.overallScore >= 60 ? 'text-amber-600 dark:text-amber-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {qualityReport.overallScore}/100
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {[
                { label: 'CSS', value: qualityReport.cssValid },
                { label: 'Semantic', value: qualityReport.semantics },
                { label: 'Responsive', value: qualityReport.responsiveness },
                { label: 'A11y', value: qualityReport.accessibility },
                { label: 'Complete', value: qualityReport.completeness },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <div className="text-[10px] text-muted-foreground">{item.label}</div>
                  <div className={`text-xs font-semibold ${
                    item.value >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                    item.value >= 60 ? 'text-amber-600 dark:text-amber-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// ============ Quality Badge (Expandable) ============

function QualityBadge({ report }: { report: DesignQualityReport | null }) {
  const [expanded, setExpanded] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const setDesignTree = useZDesignStore((s) => s.setDesignTree);
  const setQualityReport = useZDesignStore((s) => s.setQualityReport);
  const designTree = useZDesignStore((s) => s.designTree);

  const handleAutoEnhance = useCallback(async () => {
    if (!designTree.children || designTree.children.length === 0) return;
    setIsEnhancing(true);
    try {
      const res = await fetch('/api/design/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designTree, qualityReport: report }),
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
  }, [designTree, report, setDesignTree, setQualityReport]);

  if (!report) return null;

  const scoreColor = report.overallScore >= 80
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
    : report.overallScore >= 60
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800'
      : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';

  const scoreBarColor = report.overallScore >= 80
    ? '[&>div]:bg-emerald-500'
    : report.overallScore >= 60
      ? '[&>div]:bg-amber-500'
      : '[&>div]:bg-red-500';

  const getScoreColor = (value: number) =>
    value >= 80 ? 'text-emerald-600 dark:text-emerald-400' : value >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';

  const getBarColor = (value: number) =>
    value >= 80 ? '[&>div]:bg-emerald-500' : value >= 60 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500';

  const getSeverityIcon = (severity: string) => {
    if (severity === 'critical') return <XCircle className="size-3 text-red-500 shrink-0" />;
    if (severity === 'warning') return <AlertTriangle className="size-3 text-amber-500 shrink-0" />;
    return <AlertCircle className="size-3 text-blue-500 shrink-0" />;
  };

  const topIssues = report.issues.slice(0, 3);
  const topSuggestions = report.suggestions.slice(0, 3);

  return (
    <div className="relative">
      {/* Collapsed Badge */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all hover:shadow-md cursor-pointer ${scoreColor}`}
      >
        <CheckCircle2 className="size-3" />
        Quality: {report.overallScore}/100
        {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>

      {/* Expanded Panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 w-72 bg-background border rounded-xl shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="p-3 border-b bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Quality Report</span>
                <span className={`text-lg font-bold ${getScoreColor(report.overallScore)}`}>
                  {report.overallScore}
                </span>
              </div>
              <Progress value={report.overallScore} className={`h-2 ${scoreBarColor}`} />
            </div>

            {/* Individual Scores */}
            <div className="p-3 space-y-2">
              {[
                { label: 'Completeness', value: report.completeness },
                { label: 'CSS Validity', value: report.cssValid },
                { label: 'Semantics', value: report.semantics },
                { label: 'Responsiveness', value: report.responsiveness },
                { label: 'Accessibility', value: report.accessibility },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">{item.label}</span>
                  <Progress value={item.value} className={`h-1.5 flex-1 ${getBarColor(item.value)}`} />
                  <span className={`text-xs font-medium w-8 text-right ${getScoreColor(item.value)}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Top Issues */}
            {topIssues.length > 0 && (
              <div className="px-3 pb-2">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Top Issues</h4>
                <div className="space-y-1">
                  {topIssues.map((issue, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs">
                      {getSeverityIcon(issue.severity)}
                      <span className="text-muted-foreground leading-tight">{issue.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Suggestions */}
            {topSuggestions.length > 0 && (
              <div className="px-3 pb-3">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Suggestions</h4>
                <div className="space-y-1">
                  {topSuggestions.map((suggestion, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs">
                      <Zap className="size-3 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-muted-foreground leading-tight">{suggestion}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Auto-Enhance Button */}
            {report.overallScore < 80 && (
              <div className="p-3 border-t bg-muted/20">
                <Button
                  size="sm"
                  className="w-full h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleAutoEnhance}
                  disabled={isEnhancing}
                >
                  {isEnhancing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="size-3.5" />
                  )}
                  {isEnhancing ? 'Enhancing...' : 'Auto-Enhance Design'}
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============ Main Canvas Area ============

export function CanvasArea() {
  const { t } = useI18n();
  const canvas = useZDesignStore((s) => s.canvas);
  const isGenerating = useZDesignStore((s) => s.isGenerating);
  const designTree = useZDesignStore((s) => s.designTree);
  const generationProgress = useZDesignStore((s) => s.generationProgress);
  const qualityReport = useZDesignStore((s) => s.qualityReport);
  const designMode = useZDesignStore((s) => s.designMode);
  const designHTML = useZDesignStore((s) => s.designHTML);
  const hasDesign = designTree.children && designTree.children.length > 0;
  const showHtml = designMode === 'HTML_ARTIFACT' && !!designHTML && !isGenerating;
  const ViewportIcon = VIEWPORT_ICONS[canvas.viewport];

  // Show progress indicator during generation
  const showProgress = isGenerating && generationProgress.stage !== 'idle';

  return (
    <div className="flex flex-col h-full bg-muted/30 relative">
      {/* Quality Badge Overlay */}
      {hasDesign && !isGenerating && qualityReport && (
        <div className="absolute top-3 right-3 z-10">
          <QualityBadge report={qualityReport} />
        </div>
      )}

      {showHtml ? (
        /* === HTML ARTIFACT (agentic art-directed HTML, live iframe) === */
        <HtmlArtifactPreview html={designHTML!} viewport={canvas.viewport} />
      ) : hasDesign && !isGenerating ? (
        /* === DESIGN RENDERED (node tree) === */
        <div className="flex-1 min-h-0 overflow-hidden">
          <DesignRenderer node={designTree} />
        </div>
      ) : showProgress ? (
        /* === PROGRESS INDICATOR === */
        <GenerationProgressIndicator />
      ) : isGenerating ? (
        /* === FALLBACK GENERATING STATE (no progress yet) === */
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-xl shadow-lg border p-12 flex flex-col items-center gap-6"
          >
            <motion.div
              className="flex items-center justify-center size-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25"
              animate={{ scale: [1, 1.08, 1], rotate: [0, 2, -2, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sparkles className="size-8" />
            </motion.div>
            <div className="text-center space-y-2">
              <p className="text-base font-semibold">{t.canvas.loading}</p>
              <div className="flex items-center justify-center gap-1.5">
                {[0, 0.2, 0.4].map((delay, i) => (
                  <motion.div
                    key={i}
                    className="size-2 rounded-full bg-emerald-500"
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      ) : (
        /* === WELCOME / EMPTY STATE === */
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center space-y-8 max-w-md"
          >
            {/* Logo animation */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mx-auto"
            >
              <div className="flex items-center justify-center size-24 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200/50 dark:border-emerald-800/30 mx-auto shadow-xl shadow-emerald-500/10">
                <div className="flex items-center justify-center size-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
                  <Sparkles className="size-7" />
                </div>
              </div>
            </motion.div>

            {/* Text */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="space-y-3"
            >
              <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                {t.canvas.title}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t.canvas.noDesign}
              </p>
            </motion.div>

            {/* Viewport indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex items-center justify-center gap-2 text-xs text-muted-foreground/50"
            >
              <ViewportIcon className="size-3.5" />
              <span>
                {t.canvas.responsive[canvas.viewport]} &middot; {canvas.zoom}%
              </span>
            </motion.div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
