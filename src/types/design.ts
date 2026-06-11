// Z.Design - Core Type Definitions

// ============ Design JSON Schema ============

export interface DesignNode {
  id: string;
  type: DesignNodeType;
  tag?: string;
  content?: string;
  children?: DesignNode[];
  style?: DesignStyle;
  props?: Record<string, unknown>;
  events?: Record<string, string>;
  meta?: DesignNodeMeta;
}

export type DesignNodeType =
  | 'root'
  | 'container'
  | 'flex'
  | 'grid'
  | 'text'
  | 'heading'
  | 'button'
  | 'input'
  | 'image'
  | 'icon'
  | 'link'
  | 'list'
  | 'card'
  | 'nav'
  | 'header'
  | 'footer'
  | 'section'
  | 'sidebar'
  | 'form'
  | 'table'
  | 'chart'
  | 'video'
  | 'audio'
  | 'slider'
  | 'toggle'
  | 'tabs'
  | 'accordion'
  | 'dialog'
  | 'dropdown'
  | 'badge'
  | 'avatar'
  | 'divider'
  | 'spacer'
  | 'custom';

export interface DesignStyle {
  // Layout
  display?: string;
  flexDirection?: string;
  flexWrap?: string;
  justifyContent?: string;
  alignItems?: string;
  gap?: string;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  gridArea?: string;
  position?: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  zIndex?: number;

  // Sizing
  width?: string;
  height?: string;
  minWidth?: string;
  minHeight?: string;
  maxWidth?: string;
  maxHeight?: string;

  // Spacing
  padding?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  margin?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;

  // Typography
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
  textAlign?: string;
  textDecoration?: string;
  textTransform?: string;
  color?: string;

  // Background
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;

  // Border
  border?: string;
  borderWidth?: string;
  borderStyle?: string;
  borderColor?: string;
  borderRadius?: string;

  // Effects
  boxShadow?: string;
  opacity?: number;
  transform?: string;
  transition?: string;
  filter?: string;
  backdropFilter?: string;

  // Overflow
  overflow?: string;
  overflowX?: string;
  overflowY?: string;

  // Custom
  [key: string]: unknown;
}

export interface DesignNodeMeta {
  name?: string;
  description?: string;
  isEditable?: boolean;
  isClickable?: boolean;
  componentRef?: string;
  a11yRole?: string;
  a11yLabel?: string;
}

// ============ Design System ============

export interface DesignSystemData {
  id: string;
  name: string;
  description?: string;
  tokens: DesignTokens;
  components: DesignComponent[];
  styles: DesignStyles;
}

export interface DesignTokens {
  colors: ColorToken[];
  typography: TypographyToken[];
  spacing: SpacingToken[];
  borderRadius: BorderRadiusToken[];
  shadows: ShadowToken[];
}

export interface ColorToken {
  name: string;
  value: string;
  category: 'primary' | 'secondary' | 'accent' | 'neutral' | 'semantic' | 'custom';
  description?: string;
}

export interface TypographyToken {
  name: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing?: string;
}

export interface SpacingToken {
  name: string;
  value: string;
}

export interface BorderRadiusToken {
  name: string;
  value: string;
}

export interface ShadowToken {
  name: string;
  value: string;
}

export interface DesignComponent {
  id: string;
  name: string;
  category: string;
  node: DesignNode;
  description?: string;
}

export interface DesignStyles {
  presetStyles: PresetStyle[];
  animationPresets: AnimationPreset[];
}

export interface PresetStyle {
  name: string;
  style: DesignStyle;
  description?: string;
}

export interface AnimationPreset {
  name: string;
  keyframes: string;
  duration: string;
  easing: string;
}

// ============ Chat ============

export interface ChatMessage {
  id: string;
  projectId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: ChatMessageMeta;
  createdAt: Date;
}

export interface ChatMessageMeta {
  designUpdate?: DesignNode;
  styleUpdate?: Record<string, DesignStyle>;
  suggestions?: string[];
  tokensUsed?: number;
}

// ============ Project ============

export type ProjectType =
  | 'PROTOTYPE'
  | 'SLIDE_DECK'
  | 'LANDING_PAGE'
  | 'DASHBOARD'
  | 'WEB_APP'
  | 'MOBILE_APP'
  | 'MARKETING'
  | 'CUSTOM';

export type ProjectStatus = 'DRAFT' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED' | 'ARCHIVED';

export type MemberRole = 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN';

// ============ Canvas ============

export type CanvasMode = 'ai' | 'editor';
export type ViewportSize = 'desktop' | 'tablet' | 'mobile';

export interface CanvasState {
  mode: CanvasMode;
  viewport: ViewportSize;
  zoom: number;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  isDragging: boolean;
  showGrid: boolean;
  showAnnotations: boolean;
}

// ============ Export ============

export type ExportFormat = 'html' | 'pdf' | 'pptx' | 'zip' | 'nextjs' | 'react' | 'figma';

// ============ Annotations ============

export interface Annotation {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  elementId?: string;
  x: number;
  y: number;
  content: string;
  isResolved: boolean;
  parentId?: string;
  replies?: Annotation[];
  createdAt: Date;
  color: string;
}

// ============ Version ============

export interface VersionData {
  id: string;
  projectId: string;
  parentVersionId?: string;
  label: string;
  designJSON: string;
  thumbnail?: string;
  branch: string;
  changeSummary?: string;
  createdAt: Date;
}
