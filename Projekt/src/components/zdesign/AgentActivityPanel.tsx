'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  LayoutGrid,
  Palette,
  Lightbulb,
  MessageSquareWarning,
  Combine,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

export interface AgentStatus {
  role: string;
  name: string;
  status: 'pending' | 'thinking' | 'done' | 'error';
  creativity?: number;
  confidence?: number;
}

const AGENT_ICONS: Record<string, { icon: typeof Sparkles; color: string; bg: string }> = {
  'creative-director': { icon: Sparkles, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  'ux-architect': { icon: LayoutGrid, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  'visual-designer': { icon: Palette, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  'innovation-agent': { icon: Lightbulb, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  'critique-agent': { icon: MessageSquareWarning, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
  'synthesis-agent': { icon: Combine, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
};

export function AgentActivityPanel({ agents }: { agents: AgentStatus[] }) {
  if (!agents || agents.length === 0) return null;

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="size-3.5 text-emerald-600" />
        <span className="text-xs font-medium text-muted-foreground">Creative Orchestra</span>
      </div>
      <div className="space-y-1.5">
        <AnimatePresence>
          {agents.map((agent) => {
            const agentInfo = AGENT_ICONS[agent.role] || {
              icon: Sparkles,
              color: 'text-gray-500',
              bg: 'bg-gray-100',
            };
            const Icon = agentInfo.icon;

            return (
              <motion.div
                key={agent.role}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2"
              >
                <div
                  className={`flex items-center justify-center size-6 rounded-md ${agentInfo.bg}`}
                >
                  <Icon className={`size-3 ${agentInfo.color}`} />
                </div>
                <span className="text-xs font-medium flex-1">{agent.name}</span>
                {agent.status === 'thinking' && (
                  <Loader2 className="size-3 animate-spin text-emerald-500" />
                )}
                {agent.status === 'done' && (
                  <CheckCircle2 className="size-3 text-emerald-500" />
                )}
                {agent.status === 'pending' && (
                  <div className="size-1.5 rounded-full bg-muted-foreground/30" />
                )}
                {agent.creativity !== undefined && agent.status === 'done' && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                    {Math.round(agent.creativity * 100)}%
                  </Badge>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
