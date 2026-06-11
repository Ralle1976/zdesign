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
} from '@/types/design';
import type { Locale } from '@/i18n/translations';

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
  updateNode: (nodeId: string, updates: Partial<DesignNode>) => void;
  deleteNode: (nodeId: string) => void;

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
  clearChat: () => void;
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;

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

export const useZDesignStore = create<ZDesignState>((set) => ({
  // Project
  projectId: null,
  projectName: 'Untitled Project',
  projectType: 'PROTOTYPE',
  setProject: (id, name, type) =>
    set({ projectId: id, projectName: name, projectType: type }),

  // Design Tree
  designTree: defaultDesignTree,
  setDesignTree: (tree) => set({ designTree: tree }),
  updateNode: (nodeId, updates) =>
    set((state) => ({
      designTree: updateNodeInTree(state.designTree, nodeId, updates),
    })),
  deleteNode: (nodeId) =>
    set((state) => ({
      designTree: deleteNodeFromTree(state.designTree, nodeId),
    })),

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
  clearChat: () => set({ chatMessages: [] }),
  isGenerating: false,
  setIsGenerating: (generating) => set({ isGenerating: generating }),

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
