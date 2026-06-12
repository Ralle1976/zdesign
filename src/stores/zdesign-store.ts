import { create } from 'zustand';
import type {
  DesignNode,
  CanvasState,
  CanvasMode,
  ViewportSize,
  ChatMessage,
  Annotation,
  VersionData,
  DesignSystemData,
  ProjectType,
  AIProviderConfig,
  AIModelConfig,
  ProviderCapability,
  GenerationProgress,
  GenerationStage,
  DesignQualityReport,
} from '@/types/design';
import type { Locale } from '@/i18n/translations';

// ============ Built-in Provider Definitions ============

export const BUILT_IN_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'z-ai',
    name: 'Z.ai (Default)',
    description: 'Built-in Z.ai model with text generation, vision, and image generation',
    capabilities: ['text', 'vision', 'image', 'code'],
    isDefault: true,
    isAvailable: true,
    models: [
      {
        id: 'z-ai-default',
        name: 'Z.ai Standard',
        description: 'Default Z.ai model — best for design generation',
        capabilities: ['text', 'vision', 'image', 'code'],
        maxTokens: 8192,
        isDefault: true,
      },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'OpenAI GPT models — powerful for text and code generation',
    capabilities: ['text', 'vision', 'code'],
    isAvailable: false,
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Most capable model — text, vision, and code',
        capabilities: ['text', 'vision', 'code'],
        maxTokens: 128000,
        isDefault: true,
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Fast and affordable — good for simple tasks',
        capabilities: ['text', 'code'],
        maxTokens: 128000,
      },
      {
        id: 'dall-e-3',
        name: 'DALL-E 3',
        description: 'Image generation model',
        capabilities: ['image'],
        maxTokens: 4096,
      },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models — excellent for design reasoning and code',
    capabilities: ['text', 'vision', 'code'],
    isAvailable: false,
    models: [
      {
        id: 'claude-4-sonnet',
        name: 'Claude 4 Sonnet',
        description: 'Balanced performance and speed',
        capabilities: ['text', 'vision', 'code'],
        maxTokens: 200000,
        isDefault: true,
      },
      {
        id: 'claude-4-opus',
        name: 'Claude 4 Opus',
        description: 'Most powerful — best for complex designs',
        capabilities: ['text', 'vision', 'code'],
        maxTokens: 200000,
      },
    ],
  },
  {
    id: 'google',
    name: 'Google AI',
    description: 'Gemini models — multimodal capabilities',
    capabilities: ['text', 'vision', 'image', 'code'],
    isAvailable: false,
    models: [
      {
        id: 'gemini-2-pro',
        name: 'Gemini 2 Pro',
        description: 'Advanced multimodal model',
        capabilities: ['text', 'vision', 'code'],
        maxTokens: 1000000,
        isDefault: true,
      },
      {
        id: 'imagen-3',
        name: 'Imagen 3',
        description: 'Image generation model',
        capabilities: ['image'],
        maxTokens: 4096,
      },
    ],
  },
];

// ============ Main App Store ============

interface ZDesignState {
  // Project
  projectId: string | null;
  projectName: string;
  projectType: ProjectType;
  setProject: (id: string, name: string, type: ProjectType) => void;

  // Design Tree
  designTree: DesignNode;
  setDesignTree: (tree: DesignNode) => void;
  /** Set design tree without recording history (used for initial load from DB) */
  loadDesignTree: (tree: DesignNode) => void;
  updateNode: (nodeId: string, updates: Partial<DesignNode>) => void;
  deleteNode: (nodeId: string) => void;
  nudgeNode: (nodeId: string, dx: number, dy: number) => void;

  // Undo/Redo
  history: DesignNode[];
  future: DesignNode[];
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Dirty state (unsaved changes)
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;

  // Canvas
  canvas: CanvasState;
  setCanvasMode: (mode: CanvasMode) => void;
  setViewport: (viewport: ViewportSize) => void;
  setZoom: (zoom: number) => void;
  selectNode: (nodeId: string | null) => void;
  hoverNode: (nodeId: string | null) => void;

  // Chat
  chatMessages: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;
  setChatMessages: (messages: ChatMessage[]) => void;
  clearChat: () => void;
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;

  // Generation Progress
  generationProgress: GenerationProgress;
  setGenerationProgress: (progress: Partial<GenerationProgress>) => void;
  resetGenerationProgress: () => void;

  // Design Quality
  qualityReport: DesignQualityReport | null;
  setQualityReport: (report: DesignQualityReport | null) => void;

  // Annotations
  annotations: Annotation[];
  addAnnotation: (annotation: Annotation) => void;
  resolveAnnotation: (id: string) => void;
  unresolveAnnotation: (id: string) => void;
  removeAnnotation: (id: string) => void;
  setAnnotations: (annotations: Annotation[]) => void;

  // Versions
  versions: VersionData[];
  setVersions: (versions: VersionData[]) => void;
  addVersion: (version: VersionData) => void;
  currentVersionId: string | null;
  setCurrentVersionId: (id: string | null) => void;

  // Design System
  designSystem: DesignSystemData | null;
  setDesignSystem: (system: DesignSystemData | null) => void;

  // Panels
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;

  // i18n
  locale: Locale;
  setLocale: (locale: Locale) => void;

  // Theme
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // AI Provider Settings
  activeProviderId: string;
  activeModelId: string;
  setActiveProvider: (providerId: string) => void;
  setActiveModel: (modelId: string) => void;
  providerApiKey: Record<string, string>;
  setProviderApiKey: (providerId: string, key: string) => void;
  getActiveProvider: () => AIProviderConfig | undefined;
  getActiveModel: () => AIModelConfig | undefined;
  hasCapability: (capability: ProviderCapability) => boolean;

  // Creative Mode
  creativeMode: boolean;
  setCreativeMode: (enabled: boolean) => void;
}

const defaultDesignTree: DesignNode = {
  id: 'root',
  type: 'root',
  tag: 'div',
  children: [],
  style: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    width: '100%',
  },
};

const MAX_HISTORY = 50;

const defaultGenerationProgress: GenerationProgress = {
  stage: 'idle',
  stageLabel: '',
  percentage: 0,
  message: '',
  startedAt: 0,
};

export const useZDesignStore = create<ZDesignState>((set, get) => ({
  // Project
  projectId: null,
  projectName: 'Untitled Project',
  projectType: 'PROTOTYPE',
  setProject: (id, name, type) =>
    set({ projectId: id, projectName: name, projectType: type }),

  // Design Tree
  designTree: defaultDesignTree,
  setDesignTree: (tree) =>
    set((state) => {
      // Push current tree to history, trim to MAX_HISTORY
      const newHistory = [...state.history, state.designTree].slice(-MAX_HISTORY);
      return { designTree: tree, history: newHistory, future: [], isDirty: true };
    }),
  loadDesignTree: (tree) =>
    set({ designTree: tree, history: [], future: [], isDirty: false }),
  updateNode: (nodeId, updates) =>
    set((state) => {
      const newTree = updateNodeInTree(state.designTree, nodeId, updates);
      const newHistory = [...state.history, state.designTree].slice(-MAX_HISTORY);
      return { designTree: newTree, history: newHistory, future: [], isDirty: true };
    }),
  deleteNode: (nodeId) =>
    set((state) => {
      const newTree = deleteNodeFromTree(state.designTree, nodeId);
      const newHistory = [...state.history, state.designTree].slice(-MAX_HISTORY);
      return { designTree: newTree, history: newHistory, future: [], isDirty: true };
    }),
  nudgeNode: (nodeId, dx, dy) =>
    set((state) => {
      const node = findNodeInTree(state.designTree, nodeId);
      if (!node) return {};
      const style = node.style ?? {};
      const currentPosition = style.position ?? 'relative';
      // Only nudge absolutely or relatively positioned elements
      if (currentPosition !== 'absolute' && currentPosition !== 'relative') return {};
      const currentLeft = parsePixelValue(style.left);
      const currentTop = parsePixelValue(style.top);
      const newStyle = {
        ...style,
        position: currentPosition,
        left: `${currentLeft + dx}px`,
        top: `${currentTop + dy}px`,
      };
      const newTree = updateNodeInTree(state.designTree, nodeId, { style: newStyle });
      const newHistory = [...state.history, state.designTree].slice(-MAX_HISTORY);
      return { designTree: newTree, history: newHistory, future: [], isDirty: true };
    }),

  // Undo/Redo
  history: [],
  future: [],
  undo: () =>
    set((state) => {
      if (state.history.length === 0) return {};
      const previous = state.history[state.history.length - 1];
      const newHistory = state.history.slice(0, -1);
      const newFuture = [...state.future, state.designTree].slice(-MAX_HISTORY);
      return { designTree: previous, history: newHistory, future: newFuture, isDirty: true };
    }),
  redo: () =>
    set((state) => {
      if (state.future.length === 0) return {};
      const next = state.future[state.future.length - 1];
      const newFuture = state.future.slice(0, -1);
      const newHistory = [...state.history, state.designTree].slice(-MAX_HISTORY);
      return { designTree: next, history: newHistory, future: newFuture, isDirty: true };
    }),
  canUndo: () => get().history.length > 0,
  canRedo: () => get().future.length > 0,

  // Dirty state
  isDirty: false,
  setIsDirty: (dirty) => set({ isDirty: dirty }),

  // Canvas
  canvas: {
    mode: 'ai',
    viewport: 'desktop',
    zoom: 100,
    selectedNodeId: null,
    hoveredNodeId: null,
    isDragging: false,
    showGrid: false,
    showAnnotations: true,
  },
  setCanvasMode: (mode) =>
    set((state) => ({ canvas: { ...state.canvas, mode } })),
  setViewport: (viewport) =>
    set((state) => ({ canvas: { ...state.canvas, viewport } })),
  setZoom: (zoom) =>
    set((state) => ({ canvas: { ...state.canvas, zoom: Math.max(25, Math.min(200, zoom)) } })),
  selectNode: (nodeId) =>
    set((state) => ({ canvas: { ...state.canvas, selectedNodeId: nodeId } })),
  hoverNode: (nodeId) =>
    set((state) => ({ canvas: { ...state.canvas, hoveredNodeId: nodeId } })),

  // Chat
  chatMessages: [],
  addChatMessage: (message) =>
    set((state) => ({ chatMessages: [...state.chatMessages, message] })),
  setChatMessages: (messages) => set({ chatMessages: messages }),
  clearChat: () => set({ chatMessages: [] }),
  isGenerating: false,
  setIsGenerating: (generating) => set({ isGenerating: generating }),

  // Generation Progress
  generationProgress: defaultGenerationProgress,
  setGenerationProgress: (progress) =>
    set((state) => ({
      generationProgress: { ...state.generationProgress, ...progress },
    })),
  resetGenerationProgress: () => set({ generationProgress: defaultGenerationProgress }),

  // Design Quality
  qualityReport: null,
  setQualityReport: (report) => set({ qualityReport: report }),

  // Annotations
  annotations: [],
  addAnnotation: (annotation) =>
    set((state) => ({ annotations: [...state.annotations, annotation] })),
  resolveAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === id ? { ...a, isResolved: true } : a
      ),
    })),
  unresolveAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === id ? { ...a, isResolved: false } : a
      ),
    })),
  removeAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
    })),
  setAnnotations: (annotations) => set({ annotations }),

  // Versions
  versions: [],
  setVersions: (versions) => set({ versions }),
  addVersion: (version) =>
    set((state) => ({ versions: [version, ...state.versions] })),
  currentVersionId: null,
  setCurrentVersionId: (id) => set({ currentVersionId: id }),

  // Design System
  designSystem: null,
  setDesignSystem: (system) => set({ designSystem: system }),

  // Panels
  leftPanelOpen: true,
  rightPanelOpen: true,
  toggleLeftPanel: () => set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),
  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),

  // i18n
  locale: 'en',
  setLocale: (locale) => set({ locale }),

  // Theme
  theme: 'light',
  setTheme: (theme) => set({ theme }),

  // AI Provider Settings
  activeProviderId: 'z-ai',
  activeModelId: 'z-ai-default',
  setActiveProvider: (providerId) =>
    set((state) => {
      const provider = BUILT_IN_PROVIDERS.find((p) => p.id === providerId);
      const defaultModel = provider?.models.find((m) => m.isDefault) || provider?.models[0];
      return {
        activeProviderId: providerId,
        activeModelId: defaultModel?.id || state.activeModelId,
      };
    }),
  setActiveModel: (modelId) => set({ activeModelId: modelId }),
  providerApiKey: {},
  setProviderApiKey: (providerId, key) =>
    set((state) => ({
      providerApiKey: { ...state.providerApiKey, [providerId]: key },
    })),
  getActiveProvider: () => {
    const state = get();
    return BUILT_IN_PROVIDERS.find((p) => p.id === state.activeProviderId);
  },
  getActiveModel: () => {
    const state = get();
    const provider = BUILT_IN_PROVIDERS.find((p) => p.id === state.activeProviderId);
    return provider?.models.find((m) => m.id === state.activeModelId);
  },
  hasCapability: (capability) => {
    const state = get();
    const provider = BUILT_IN_PROVIDERS.find((p) => p.id === state.activeProviderId);
    const model = provider?.models.find((m) => m.id === state.activeModelId);
    return !!(provider?.capabilities.includes(capability) && model?.capabilities.includes(capability));
  },

  // Creative Mode
  creativeMode: false,
  setCreativeMode: (enabled) => set({ creativeMode: enabled }),
}));

// ============ Helper Functions ============

function updateNodeInTree(
  tree: DesignNode,
  nodeId: string,
  updates: Partial<DesignNode>
): DesignNode {
  if (tree.id === nodeId) {
    return { ...tree, ...updates };
  }
  if (tree.children) {
    return {
      ...tree,
      children: tree.children.map((child) =>
        updateNodeInTree(child, nodeId, updates)
      ),
    };
  }
  return tree;
}

function deleteNodeFromTree(tree: DesignNode, nodeId: string): DesignNode {
  if (tree.children) {
    return {
      ...tree,
      children: tree.children
        .filter((child) => child.id !== nodeId)
        .map((child) => deleteNodeFromTree(child, nodeId)),
    };
  }
  return tree;
}

function findNodeInTree(tree: DesignNode, nodeId: string): DesignNode | null {
  if (tree.id === nodeId) return tree;
  if (tree.children) {
    for (const child of tree.children) {
      const found = findNodeInTree(child, nodeId);
      if (found) return found;
    }
  }
  return null;
}

/** Parse a CSS pixel value like "120px" or "0" into a number. Returns 0 for unset/invalid. */
function parsePixelValue(value: string | number | undefined): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}
