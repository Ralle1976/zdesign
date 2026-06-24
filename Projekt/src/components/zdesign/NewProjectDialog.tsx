'use client';

import { useState, useCallback } from 'react';
import { useZDesignStore } from '@/stores/zdesign-store';
import { useI18n } from '@/i18n';
import type { ProjectType } from '@/types/design';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  LayoutDashboard,
  Smartphone,
  Presentation,
  FileCode,
  BarChart3,
  Globe,
  Megaphone,
  Palette,
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';

const PROJECT_TYPES: {
  type: ProjectType;
  icon: typeof LayoutDashboard;
  gradient: string;
}[] = [
  { type: 'PROTOTYPE', icon: FileCode, gradient: 'from-emerald-500 to-teal-500' },
  { type: 'LANDING_PAGE', icon: Globe, gradient: 'from-teal-500 to-cyan-500' },
  { type: 'DASHBOARD', icon: BarChart3, gradient: 'from-cyan-500 to-emerald-500' },
  { type: 'WEB_APP', icon: LayoutDashboard, gradient: 'from-emerald-500 to-green-500' },
  { type: 'MOBILE_APP', icon: Smartphone, gradient: 'from-green-500 to-emerald-600' },
  { type: 'SLIDE_DECK', icon: Presentation, gradient: 'from-emerald-400 to-teal-600' },
  { type: 'MARKETING', icon: Megaphone, gradient: 'from-teal-400 to-emerald-500' },
  { type: 'CUSTOM', icon: Palette, gradient: 'from-emerald-600 to-green-600' },
];

interface NewProjectDialogProps {
  open: boolean;
  onProjectCreate: (name: string, type: ProjectType) => Promise<void>;
}

export function NewProjectDialog({ open, onProjectCreate }: NewProjectDialogProps) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<ProjectType>('PROTOTYPE');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    const projectName = name.trim() || t.projects.types[selectedType];
    setIsCreating(true);
    try {
      await onProjectCreate(projectName, selectedType);
    } finally {
      setIsCreating(false);
    }
  }, [name, selectedType, onProjectCreate, t]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isCreating) {
        e.preventDefault();
        handleCreate();
      }
    },
    [handleCreate, isCreating]
  );

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex items-center justify-center size-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <Sparkles className="size-4" />
            </div>
            {t.projects.newProject}
          </DialogTitle>
          <DialogDescription>
            {t.appDescription}
          </DialogDescription>
        </DialogHeader>

        {/* Project Name */}
        <div className="space-y-2">
          <Label htmlFor="project-name">{t.common.edit}</Label>
          <Input
            id="project-name"
            placeholder={t.projects.types[selectedType]}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="h-10"
          />
        </div>

        {/* Project Type Selection */}
        <div className="space-y-2">
          <Label>Type</Label>
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            {PROJECT_TYPES.map(({ type, icon: Icon, gradient }) => {
              const isSelected = selectedType === type;
              return (
                <motion.button
                  key={type}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedType(type)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                      : 'border-border bg-card hover:bg-accent/50'
                  }`}
                >
                  <div
                    className={`flex items-center justify-center size-9 rounded-lg bg-gradient-to-br ${gradient} text-white shrink-0`}
                  >
                    <Icon className="size-4" />
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      isSelected ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'
                    }`}
                  >
                    {t.projects.types[type]}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={isCreating}
            className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
          >
            {isCreating ? t.common.loading : t.common.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
