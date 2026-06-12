import type { DesignNode, DesignNodeType, DesignStyle } from '@/types/design';

/**
 * Maps a DesignNodeType to the appropriate HTML tag string.
 * Falls back to 'div' for unknown types.
 */
export function getHtmlTag(node: DesignNode): string {
  // If an explicit tag is provided, use it
  if (node.tag) return node.tag;

  const tagMap: Record<DesignNodeType, string> = {
    root: 'div',
    container: 'div',
    flex: 'div',
    grid: 'div',
    text: 'p',
    heading: 'h1',
    button: 'button',
    input: 'input',
    image: 'div',
    icon: 'span',
    link: 'a',
    list: 'ul',
    card: 'div',
    nav: 'nav',
    header: 'header',
    footer: 'footer',
    section: 'section',
    sidebar: 'aside',
    form: 'form',
    table: 'table',
    chart: 'div',
    video: 'div',
    audio: 'div',
    slider: 'input',
    toggle: 'button',
    tabs: 'div',
    accordion: 'div',
    dialog: 'div',
    dropdown: 'div',
    badge: 'span',
    avatar: 'div',
    divider: 'hr',
    spacer: 'div',
    custom: 'div',
  };

  return tagMap[node.type] ?? 'div';
}

/**
 * Returns the heading level (h1-h6) based on metadata or defaults.
 */
export function getHeadingLevel(node: DesignNode): string {
  if (node.tag && /^h[1-6]$/.test(node.tag)) return node.tag;
  if (node.meta?.componentRef) {
    const match = node.meta.componentRef.match(/^h([1-6])$/);
    if (match) return `h${match[1]}`;
  }
  return 'h1';
}

/**
 * Returns sensible default styles for each DesignNodeType.
 * These provide base styling that can be overridden by the node's own style.
 */
export function getDefaultStyle(nodeType: DesignNodeType): Partial<DesignStyle> {
  const defaults: Record<DesignNodeType, Partial<DesignStyle>> = {
    root: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      minHeight: '100vh',
    },
    container: {
      maxWidth: '1200px',
      width: '100%',
      marginLeft: 'auto',
      marginRight: 'auto',
      paddingLeft: '24px',
      paddingRight: '24px',
    },
    flex: {
      display: 'flex',
    },
    grid: {
      display: 'grid',
    },
    text: {
      fontSize: '16px',
      lineHeight: '1.6',
      color: '#374151',
    },
    heading: {
      fontSize: '32px',
      fontWeight: '700',
      lineHeight: '1.2',
      color: '#111827',
    },
    button: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '10px 20px',
      borderRadius: '8px',
      backgroundColor: '#10b981',
      color: '#ffffff',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      border: 'none',
    },
    input: {
      padding: '10px 14px',
      borderRadius: '8px',
      border: '1px solid #d1d5db',
      fontSize: '14px',
      width: '100%',
      backgroundColor: '#ffffff',
    },
    image: {
      width: '100%',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      minHeight: '200px',
      borderRadius: '8px',
    },
    icon: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '24px',
      height: '24px',
    },
    link: {
      color: '#10b981',
      textDecoration: 'underline',
      cursor: 'pointer',
      fontSize: '14px',
    },
    list: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      paddingLeft: '20px',
    },
    card: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
      padding: '24px',
      border: '1px solid #f3f4f6',
    },
    nav: {
      display: 'flex',
      alignItems: 'center',
      gap: '24px',
      padding: '12px 0',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 24px',
      width: '100%',
    },
    footer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      width: '100%',
      color: '#6b7280',
      fontSize: '14px',
    },
    section: {
      padding: '64px 24px',
      width: '100%',
    },
    sidebar: {
      display: 'flex',
      flexDirection: 'column',
      width: '256px',
      minHeight: '100%',
      padding: '16px',
      backgroundColor: '#f9fafb',
      borderRight: '1px solid #e5e7eb',
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
    },
    chart: {
      width: '100%',
      minHeight: '300px',
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      padding: '16px',
    },
    video: {
      width: '100%',
      minHeight: '300px',
      borderRadius: '12px',
      overflow: 'hidden',
      backgroundColor: '#000000',
    },
    audio: {
      width: '100%',
    },
    slider: {
      width: '100%',
    },
    toggle: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '44px',
      height: '24px',
      borderRadius: '12px',
      cursor: 'pointer',
      border: 'none',
    },
    tabs: {
      display: 'flex',
      flexDirection: 'column',
    },
    accordion: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
    dialog: {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
      padding: '24px',
      zIndex: 50,
    },
    dropdown: {
      position: 'absolute',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
      border: '1px solid #e5e7eb',
      padding: '4px',
      zIndex: 50,
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 10px',
      borderRadius: '9999px',
      fontSize: '12px',
      fontWeight: '600',
      backgroundColor: '#d1fae5',
      color: '#065f46',
    },
    avatar: {
      width: '40px',
      height: '40px',
      borderRadius: '9999px',
      backgroundColor: '#e5e7eb',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    },
    divider: {
      border: 'none',
      borderTop: '1px solid #e5e7eb',
      width: '100%',
      margin: '16px 0',
    },
    spacer: {
      flex: '1',
    },
    custom: {},
  };

  return defaults[nodeType] ?? {};
}

/**
 * Self-closing HTML elements that should not have children rendered inside.
 */
export const SELF_CLOSING_TAGS = new Set([
  'img', 'input', 'br', 'hr', 'area', 'base', 'col', 'embed',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * Returns whether a given HTML tag is self-closing.
 */
export function isSelfClosingTag(tag: string): boolean {
  return SELF_CLOSING_TAGS.has(tag.toLowerCase());
}
