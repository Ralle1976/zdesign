'use client';

import { useState, useCallback, useMemo } from 'react';
import { useI18n } from '@/i18n';
import { useZDesignStore } from '@/stores/zdesign-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  Wand2,
  Eye,
  Palette,
  Type,
  Hand,
  FileText,
  Heading,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  scanDesignTree,
  calculateAccessibilityScore,
  getScoreColor,
  getScoreBgColor,
  getScoreRingColor,
  type AccessibilityIssue,
  type A11ySeverity,
  type A11yCategory,
} from '@/lib/accessibility';
import type { DesignNode } from '@/types/design';

const SEVERITY_CONFIG: Record<
  A11ySeverity,
  { icon: typeof AlertCircle; color: string; bgColor: string; label: string }
> = {
  critical: {
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    label: 'Critical',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    label: 'Warning',
  },
  info: {
    icon: Info,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    label: 'Info',
  },
};

const CATEGORY_CONFIG: Record<
  A11yCategory,
  { icon: typeof Eye; label: string }
> = {
  contrast: { icon: Palette, label: 'Color Contrast' },
  'alt-text': { icon: FileText, label: 'Alt Text' },
  labels: { icon: Type, label: 'Form Labels' },
  headings: { icon: Heading, label: 'Heading Hierarchy' },
  'touch-target': { icon: Hand, label: 'Touch Targets' },
  semantics: { icon: Eye, label: 'Semantic HTML' },
};

function ScoreCircle({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="relative size-24">
      <svg className="size-24 -rotate-90" viewBox="0 0 96 96">
        {/* Background circle */}
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth="6"
        />
        {/* Progress circle */}
        <motion.circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          className={getScoreRingColor(score)}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
          {score}
        </span>
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function IssueItem({
  issue,
  onAutoFix,
}: {
  issue: AccessibilityIssue;
  onAutoFix: (issue: AccessibilityIssue) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = SEVERITY_CONFIG[issue.severity];
  const categoryConfig = CATEGORY_CONFIG[issue.category];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border ${config.bgColor} overflow-hidden`}
    >
      <button
        type="button"
        className="w-full flex items-start gap-2 p-3 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <Icon className={`size-4 mt-0.5 shrink-0 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium leading-tight">
            {issue.description}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <categoryConfig.icon className="size-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              {categoryConfig.label}
            </span>
            <span className="text-[10px] text-muted-foreground">•</span>
            <span className="text-[10px] text-muted-foreground font-mono truncate">
              {issue.elementId}
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-3 pb-3 pt-0">
              <Separator className="mb-2" />
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                    Suggestion
                  </p>
                  <p className="text-xs text-foreground/80">
                    {issue.suggestion}
                  </p>
                </div>
                {issue.autoFixable && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAutoFix(issue);
                    }}
                  >
                    <Wand2 className="size-3" />
                    Auto-fix
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface AccessibilityScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccessibilityScanner({
  open,
  onOpenChange,
}: AccessibilityScannerProps) {
  const { t } = useI18n();
  const designTree = useZDesignStore((s) => s.designTree);
  const setDesignTree = useZDesignStore((s) => s.setDesignTree);
  const updateNode = useZDesignStore((s) => s.updateNode);

  const [isScanning, setIsScanning] = useState(false);
  const [issues, setIssues] = useState<AccessibilityIssue[]>([]);
  const [hasScanned, setHasScanned] = useState(false);

  const score = useMemo(
    () => calculateAccessibilityScore(issues),
    [issues]
  );

  const groupedIssues = useMemo(() => {
    const groups: Record<A11ySeverity, AccessibilityIssue[]> = {
      critical: [],
      warning: [],
      info: [],
    };
    for (const issue of issues) {
      groups[issue.severity].push(issue);
    }
    return groups;
  }, [issues]);

  const handleScan = useCallback(() => {
    setIsScanning(true);
    // Small delay for animation effect
    setTimeout(() => {
      const found = scanDesignTree(designTree);
      setIssues(found);
      setHasScanned(true);
      setIsScanning(false);
    }, 500);
  }, [designTree]);

  const handleAutoFix = useCallback(
    (issue: AccessibilityIssue) => {
      if (!issue.autoFix) return;

      // Find the node in the tree and apply the fix
      function applyFixToNode(node: DesignNode): DesignNode {
        if (node.id === issue.elementId) {
          return issue.autoFix!(node);
        }
        if (node.children) {
          return {
            ...node,
            children: node.children.map(applyFixToNode),
          };
        }
        return node;
      }

      const newTree = applyFixToNode(designTree);
      setDesignTree(newTree);

      // Re-scan after fix
      const newIssues = scanDesignTree(newTree);
      setIssues(newIssues);
    },
    [designTree, setDesignTree]
  );

  const handleAutoFixAll = useCallback(() => {
    let currentTree = { ...designTree };

    function applyFixToNode(node: DesignNode, fixableIssues: AccessibilityIssue[]): DesignNode {
      const matchingIssue = fixableIssues.find((i) => i.elementId === node.id);
      if (matchingIssue?.autoFix) {
        node = matchingIssue.autoFix(node);
      }
      if (node.children) {
        return {
          ...node,
          children: node.children.map((child) => applyFixToNode(child, fixableIssues)),
        };
      }
      return node;
    }

    const fixableIssues = issues.filter((i) => i.autoFixable);
    currentTree = applyFixToNode(currentTree, fixableIssues);
    setDesignTree(currentTree);

    // Re-scan
    const newIssues = scanDesignTree(currentTree);
    setIssues(newIssues);
  }, [designTree, issues, setDesignTree]);

  const criticalCount = groupedIssues.critical.length;
  const warningCount = groupedIssues.warning.length;
  const infoCount = groupedIssues.info.length;
  const fixableCount = issues.filter((i) => i.autoFixable).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[420px] p-0 gap-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-emerald-600" />
            {t.a11y?.title || 'Accessibility Scanner'}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {t.a11y?.subtitle || 'Scan your design for accessibility issues'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col h-[calc(100vh-100px)]">
          {/* Score Section */}
          <div className="px-6 py-5 border-b">
            {!hasScanned ? (
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center size-20 rounded-full bg-muted mb-3">
                  <ShieldCheck className="size-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {t.a11y?.scanPrompt || 'Scan your design to check for accessibility issues'}
                </p>
                <Button
                  onClick={handleScan}
                  disabled={isScanning}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isScanning ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <ShieldCheck className="size-4 mr-2" />
                      </motion.div>
                      {t.a11y?.scanning || 'Scanning...'}
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-4 mr-2" />
                      {t.a11y?.scanButton || 'Scan Now'}
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-5">
                <ScoreCircle score={score} />
                <div className="flex-1 space-y-2">
                  {/* Severity counts */}
                  <div className="grid grid-cols-3 gap-2">
                    {criticalCount > 0 && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <div className="size-2 rounded-full bg-red-500" />
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          {criticalCount}
                        </span>
                      </div>
                    )}
                    {warningCount > 0 && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <div className="size-2 rounded-full bg-amber-500" />
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          {warningCount}
                        </span>
                      </div>
                    )}
                    {infoCount > 0 && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <div className="size-2 rounded-full bg-blue-500" />
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          {infoCount}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Score label */}
                  <p className="text-xs text-muted-foreground">
                    {score >= 80
                      ? t.a11y?.excellent || 'Excellent accessibility!'
                      : score >= 50
                        ? t.a11y?.needsWork || 'Needs improvement'
                        : t.a11y?.poor || 'Poor accessibility — many issues found'}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={handleScan}
                      disabled={isScanning}
                    >
                      Re-scan
                    </Button>
                    {fixableCount > 0 && (
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={handleAutoFixAll}
                      >
                        <Wand2 className="size-3 mr-1" />
                        Auto-fix {fixableCount}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Issues List */}
          {hasScanned && (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {issues.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-8 text-center"
                  >
                    <CheckCircle2 className="size-12 text-emerald-500 mb-3" />
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      {t.a11y?.allGood || 'No accessibility issues found!'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t.a11y?.allGoodDesc || 'Your design meets accessibility standards.'}
                    </p>
                  </motion.div>
                ) : (
                  <>
                    {/* Critical Issues */}
                    {groupedIssues.critical.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="destructive"
                            className="text-[10px] h-5"
                          >
                            {groupedIssues.critical.length} Critical
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          {groupedIssues.critical.map((issue) => (
                            <IssueItem
                              key={issue.id}
                              issue={issue}
                              onAutoFix={handleAutoFix}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warning Issues */}
                    {groupedIssues.warning.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className="text-[10px] h-5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                            {groupedIssues.warning.length} Warning
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          {groupedIssues.warning.map((issue) => (
                            <IssueItem
                              key={issue.id}
                              issue={issue}
                              onAutoFix={handleAutoFix}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Info Issues */}
                    {groupedIssues.info.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="text-[10px] h-5"
                          >
                            {groupedIssues.info.length} Info
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          {groupedIssues.info.map((issue) => (
                            <IssueItem
                              key={issue.id}
                              issue={issue}
                              onAutoFix={handleAutoFix}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
