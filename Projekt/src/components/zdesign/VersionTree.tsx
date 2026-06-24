'use client';

import { useState, useCallback, useEffect } from 'react';
import { useZDesignStore } from '@/stores/zdesign-store';
import { useI18n } from '@/i18n';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  GitBranch,
  Plus,
  RotateCcw,
  ArrowLeftRight,
  GitFork,
  Save,
  Clock,
  MoreHorizontal,
  CheckCircle2,
  Pencil,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import type { VersionData } from '@/types/design';

export function VersionTree() {
  const { t } = useI18n();
  const projectId = useZDesignStore((s) => s.projectId);
  const designTree = useZDesignStore((s) => s.designTree);
  const setDesignTree = useZDesignStore((s) => s.setDesignTree);
  const versions = useZDesignStore((s) => s.versions);
  const setVersions = useZDesignStore((s) => s.setVersions);
  const addVersion = useZDesignStore((s) => s.addVersion);
  const currentVersionId = useZDesignStore((s) => s.currentVersionId);
  const setCurrentVersionId = useZDesignStore((s) => s.setCurrentVersionId);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [versionLabel, setVersionLabel] = useState('');
  const [versionSummary, setVersionSummary] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchFromVersionId, setBranchFromVersionId] = useState<string | null>(null);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');

  // Determine active branch from the latest version
  const activeBranch =
    versions.length > 0 ? versions[0].branch : 'main';
  const branches = [...new Set(versions.map((v) => v.branch))];

  // Fetch versions when projectId changes
  useEffect(() => {
    if (!projectId) return;
    const fetchVersions = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/versions`);
        if (res.ok) {
          const data = await res.json();
          const mapped: VersionData[] = data.versions.map(
            (v: Record<string, unknown>) => ({
              id: v.id as string,
              projectId: v.projectId as string,
              parentVersionId: v.parentVersionId as string | undefined,
              label: v.label as string,
              designJSON: v.designJSON as string,
              thumbnail: v.thumbnail as string | undefined,
              branch: v.branch as string,
              changeSummary: v.changeSummary as string | undefined,
              createdAt: new Date(v.createdAt as string),
            })
          );
          setVersions(mapped);
          if (mapped.length > 0 && !currentVersionId) {
            setCurrentVersionId(mapped[0].id);
          }
        }
      } catch {
        // Failed to load versions
      }
    };
    fetchVersions();
  }, [projectId, setVersions, setCurrentVersionId, currentVersionId]);

  const handleSaveVersion = useCallback(async () => {
    if (!projectId || !versionLabel.trim()) return;
    setIsSaving(true);
    try {
      // First update the project's designJSON
      const updateRes = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designJSON: JSON.stringify(designTree),
        }),
      });

      if (!updateRes.ok) {
        throw new Error('Failed to update project');
      }

      // Then create a version
      const versionRes = await fetch(`/api/projects/${projectId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: versionLabel.trim(),
          changeSummary: versionSummary.trim() || undefined,
          branch: activeBranch,
        }),
      });

      if (!versionRes.ok) {
        throw new Error('Failed to create version');
      }

      const data = await versionRes.json();
      const newVersion: VersionData = {
        id: data.version.id,
        projectId: data.version.projectId,
        parentVersionId: data.version.parentVersionId || undefined,
        label: data.version.label,
        designJSON: data.version.designJSON,
        thumbnail: data.version.thumbnail || undefined,
        branch: data.version.branch,
        changeSummary: data.version.changeSummary || undefined,
        createdAt: new Date(data.version.createdAt),
      };

      addVersion(newVersion);
      setCurrentVersionId(newVersion.id);
      setVersionLabel('');
      setVersionSummary('');
      setSaveDialogOpen(false);
      toast.success(t.versions.saveSuccess);
    } catch {
      toast.error(t.common.error);
    } finally {
      setIsSaving(false);
    }
  }, [
    projectId,
    versionLabel,
    versionSummary,
    activeBranch,
    designTree,
    addVersion,
    setCurrentVersionId,
    t,
  ]);

  const handleRollback = useCallback(
    async (version: VersionData) => {
      if (!projectId) return;
      try {
        const res = await fetch(
          `/api/projects/${projectId}/versions/${version.id}`
        );
        if (!res.ok) throw new Error('Version not found');

        const data = await res.json();
        const designJSON =
          typeof data.version.designJSON === 'string'
            ? JSON.parse(data.version.designJSON)
            : data.version.designJSON;

        setDesignTree(designJSON);
        setCurrentVersionId(version.id);

        // Also update the project's designJSON
        await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ designJSON: JSON.stringify(designJSON) }),
        });

        toast.success(t.versions.rollbackSuccess);
      } catch {
        toast.error(t.common.error);
      }
    },
    [projectId, setDesignTree, setCurrentVersionId, t]
  );

  const handleCreateBranch = useCallback(async () => {
    if (!projectId || !branchName.trim()) return;
    setIsCreatingBranch(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: `Branch: ${branchName.trim()}`,
          changeSummary: `Created from ${branchFromVersionId ? 'version' : 'current state'}`,
          branch: branchName.trim(),
          parentVersionId: branchFromVersionId || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to create branch');

      const data = await res.json();
      const newVersion: VersionData = {
        id: data.version.id,
        projectId: data.version.projectId,
        parentVersionId: data.version.parentVersionId || undefined,
        label: data.version.label,
        designJSON: data.version.designJSON,
        thumbnail: data.version.thumbnail || undefined,
        branch: data.version.branch,
        changeSummary: data.version.changeSummary || undefined,
        createdAt: new Date(data.version.createdAt),
      };

      addVersion(newVersion);
      setCurrentVersionId(newVersion.id);
      setBranchDialogOpen(false);
      setBranchName('');
      setBranchFromVersionId(null);
      toast.success(t.versions.createBranch);
    } catch {
      toast.error(t.common.error);
    } finally {
      setIsCreatingBranch(false);
    }
  }, [
    projectId,
    branchName,
    branchFromVersionId,
    addVersion,
    setCurrentVersionId,
    t,
  ]);

  const handleEditLabel = useCallback(
    async (versionId: string, newLabel: string) => {
      if (!projectId || !newLabel.trim()) return;
      try {
        await fetch(`/api/projects/${projectId}/versions/${versionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: newLabel.trim() }),
        });
        // Update local state
        const updatedVersions = versions.map((v) =>
          v.id === versionId ? { ...v, label: newLabel.trim() } : v
        );
        setVersions(updatedVersions);
        setEditingVersionId(null);
      } catch {
        toast.error(t.common.error);
      }
    },
    [projectId, versions, setVersions, t]
  );

  const formatTimestamp = useCallback(
    (date: Date) => {
      try {
        return formatDistanceToNow(new Date(date), { addSuffix: false });
      } catch {
        return '';
      }
    },
    []
  );

  // Group versions by branch for display
  const versionsByBranch = versions.reduce<Record<string, VersionData[]>>(
    (acc, v) => {
      if (!acc[v.branch]) acc[v.branch] = [];
      acc[v.branch].push(v);
      return acc;
    },
    {}
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-11 border-b shrink-0">
          <div className="flex items-center gap-2">
            <GitBranch className="size-4 text-emerald-600" />
            <span className="text-sm font-medium">{t.versions.title}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] px-2"
                >
                  <GitFork className="size-3.5 mr-1" />
                  {t.versions.branch}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{t.versions.createBranch}</DialogTitle>
                  <DialogDescription>
                    Create a new branch from the current design state
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <Input
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder={t.versions.branchName}
                    className="text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateBranch();
                    }}
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setBranchDialogOpen(false)}
                    className="text-sm"
                  >
                    {t.common.cancel}
                  </Button>
                  <Button
                    onClick={handleCreateBranch}
                    disabled={!branchName.trim() || isCreatingBranch}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                  >
                    {t.versions.createBranch}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="h-7 text-[11px] px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Save className="size-3.5 mr-1" />
                  {t.versions.save}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{t.versions.save}</DialogTitle>
                  <DialogDescription>
                    Save the current design state as a version
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">
                      {t.versions.label}
                    </label>
                    <Input
                      value={versionLabel}
                      onChange={(e) => setVersionLabel(e.target.value)}
                      placeholder="v1.0"
                      className="text-sm"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">
                      {t.versions.summary}
                    </label>
                    <Input
                      value={versionSummary}
                      onChange={(e) => setVersionSummary(e.target.value)}
                      placeholder={t.versions.summaryPlaceholder}
                      className="text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && versionLabel.trim())
                          handleSaveVersion();
                      }}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setSaveDialogOpen(false)}
                    className="text-sm"
                  >
                    {t.common.cancel}
                  </Button>
                  <Button
                    onClick={handleSaveVersion}
                    disabled={!versionLabel.trim() || isSaving}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                  >
                    {isSaving ? t.common.loading : t.common.save}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Active Branch Indicator */}
        {branches.length > 1 && (
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30 shrink-0">
            <GitBranch className="size-3 text-emerald-600" />
            <span className="text-[11px] text-muted-foreground">
              {t.versions.activeBranch}:
            </span>
            <Badge
              variant="secondary"
              className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            >
              {activeBranch}
            </Badge>
          </div>
        )}

        {/* Version Timeline */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            <AnimatePresence mode="popLayout">
              {versions.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <div className="flex items-center justify-center size-12 rounded-xl bg-muted mb-3">
                    <Clock className="size-5 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.versions.noVersions}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 h-7 text-[11px] border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                    onClick={() => setSaveDialogOpen(true)}
                  >
                    <Plus className="size-3 mr-1" />
                    {t.versions.save}
                  </Button>
                </motion.div>
              )}

              {/* Version timeline */}
              {Object.entries(versionsByBranch).map(
                ([branchName, branchVersions]) => (
                  <div key={branchName} className="mb-4 last:mb-0">
                    {branches.length > 1 && (
                      <div className="flex items-center gap-2 mb-2">
                        <GitBranch className="size-3 text-muted-foreground" />
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {branchName}
                        </span>
                        {branchName === activeBranch && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] h-4 px-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          >
                            {t.versions.current}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="relative ml-2">
                      {/* Timeline line */}
                      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

                      {branchVersions.map((version, index) => {
                        const isCurrent = version.id === currentVersionId;
                        const isFirst = index === 0;

                        return (
                          <motion.div
                            key={version.id}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05, duration: 0.2 }}
                            className="relative pl-6 pb-3 last:pb-0 group"
                          >
                            {/* Timeline dot */}
                            <div className="absolute left-0 top-2.5">
                              <div
                                className={`size-3.5 rounded-full border-2 flex items-center justify-center ${
                                  isCurrent
                                    ? 'bg-emerald-500 border-emerald-500'
                                    : 'bg-background border-border'
                                }`}
                              >
                                {isCurrent && (
                                  <div className="size-1.5 rounded-full bg-white" />
                                )}
                              </div>
                            </div>

                            {/* Version Card */}
                            <div
                              className={`rounded-lg border p-2.5 transition-colors ${
                                isCurrent
                                  ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10'
                                  : 'hover:bg-muted/30'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  {/* Editable Label */}
                                  {editingVersionId === version.id ? (
                                    <Input
                                      value={editingLabel}
                                      onChange={(e) =>
                                        setEditingLabel(e.target.value)
                                      }
                                      onBlur={() =>
                                        handleEditLabel(
                                          version.id,
                                          editingLabel
                                        )
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter')
                                          handleEditLabel(
                                            version.id,
                                            editingLabel
                                          );
                                        if (e.key === 'Escape')
                                          setEditingVersionId(null);
                                      }}
                                      className="h-6 text-xs"
                                      autoFocus
                                    />
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-medium truncate">
                                        {version.label}
                                      </span>
                                      {isCurrent && (
                                        <Badge
                                          variant="secondary"
                                          className="text-[9px] h-4 px-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0"
                                        >
                                          <CheckCircle2 className="size-2.5 mr-0.5" />
                                          {t.versions.current}
                                        </Badge>
                                      )}
                                      {isFirst &&
                                        !isCurrent &&
                                        version.branch === activeBranch && (
                                          <Badge
                                            variant="outline"
                                            className="text-[9px] h-4 px-1 shrink-0"
                                          >
                                            Latest
                                          </Badge>
                                        )}
                                    </div>
                                  )}

                                  {/* Timestamp */}
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <Clock className="size-2.5 text-muted-foreground" />
                                    <span className="text-[10px] text-muted-foreground">
                                      {formatTimestamp(version.createdAt)}{' '}
                                      {t.versions.ago}
                                    </span>
                                  </div>

                                  {/* Change summary */}
                                  {version.changeSummary && (
                                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                                      {version.changeSummary}
                                    </p>
                                  )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingVersionId(version.id);
                                          setEditingLabel(version.label);
                                        }}
                                      >
                                        <Pencil className="size-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="text-xs">
                                      Edit label
                                    </TooltipContent>
                                  </Tooltip>

                                  {!isCurrent && (
                                    <>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRollback(version);
                                            }}
                                          >
                                            <RotateCcw className="size-3" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="left" className="text-xs">
                                          {t.versions.rollback}
                                        </TooltipContent>
                                      </Tooltip>

                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setBranchFromVersionId(
                                                version.id
                                              );
                                              setBranchDialogOpen(true);
                                            }}
                                          >
                                            <GitFork className="size-3" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="left" className="text-xs">
                                          {t.versions.branch}
                                        </TooltipContent>
                                      </Tooltip>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}
