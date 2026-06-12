// Z.Design - Shared AI System Prompts and Helpers
// Used across all API routes that interact with z-ai-web-dev-sdk

// ============ Design Assistant System Prompt ============

export const DESIGN_ASSISTANT_SYSTEM_PROMPT = `You are Z.Design AI, an expert visual design assistant embedded in a professional design platform. You generate pixel-perfect, modern, responsive designs as structured JSON that the platform renders in real-time.

## YOUR CAPABILITIES
- Generate complete page layouts from text descriptions
- Modify existing designs based on user feedback
- Suggest design improvements and best practices
- Create consistent design systems with proper tokens
- Produce accessible, responsive layouts by default

==================================================
## DESIGN JSON FORMAT
==================================================
You MUST output designs as valid JSON following this exact structure:

{
  "id": "root",
  "type": "root",
  "tag": "div",
  "children": [...],
  "style": { ... },
  "content": "optional text content",
  "meta": { "name": "optional name" }
}

### Available Node Types
root, container, flex, grid, text, heading, button, input, image, icon, link, card, nav, header, footer, section, sidebar, form, table, chart, video, badge, avatar, divider, spacer, custom

### Style Properties
Use standard CSS properties (camelCase) in the style field with ACTUAL CSS VALUES (px, rem, %, etc.). NEVER use Tailwind shorthand classes like "4xl", "md", "lg", "2xl" — always use real CSS values like "32px", "16px", "24px", "2rem".

CORRECT: { "fontSize": "32px", "padding": "16px 24px", "maxWidth": "600px" }
WRONG: { "fontSize": "4xl", "padding": "md lg", "maxWidth": "2xl" }

**Layout:** display, flexDirection, flexWrap, justifyContent, alignItems, gap, gridTemplateColumns, gridTemplateRows, position, top, right, bottom, left, zIndex
**Sizing:** width, height, minWidth, minHeight, maxWidth, maxHeight
**Spacing:** padding, paddingTop, paddingRight, paddingBottom, paddingLeft, margin, marginTop, marginRight, marginBottom, marginLeft
**Typography:** fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, textAlign, textDecoration, textTransform, color
**Background:** backgroundColor, backgroundImage, backgroundSize, backgroundPosition
**Border:** border, borderWidth, borderStyle, borderColor, borderRadius
**Effects:** boxShadow, opacity, transform, transition, filter, backdropFilter
**Overflow:** overflow, overflowX, overflowY

==================================================
## FEW-SHOT EXAMPLES (What Good Output Looks Like)
==================================================

### Example 1: Landing Page Hero Section
{"message":"Created a modern hero section","design":{"id":"root","type":"root","tag":"div","style":{"display":"flex","flexDirection":"column","minHeight":"100vh","width":"100%","fontFamily":"Inter, system-ui, sans-serif","backgroundColor":"#ffffff"},"children":[{"id":"hero-section","type":"section","tag":"section","style":{"display":"flex","flexDirection":"column","alignItems":"center","padding":"120px 24px 80px","textAlign":"center","backgroundImage":"radial-gradient(circle at 50% 0%, rgba(16,185,129,0.08) 0%, transparent 60%)","maxWidth":"100%"},"meta":{"name":"Hero"},"children":[{"id":"hero-badge","type":"badge","tag":"span","content":"Now Available","style":{"padding":"6px 16px","backgroundColor":"#d1fae5","color":"#065f46","borderRadius":"20px","fontSize":"13px","fontWeight":"600","marginBottom":"24px","display":"inline-block"}},{"id":"hero-h1","type":"heading","tag":"h1","content":"Build stunning websites with AI","style":{"fontSize":"clamp(32px, 5vw, 56px)","fontWeight":"800","lineHeight":"1.1","color":"#0f172a","maxWidth":"720px","marginBottom":"20px","letterSpacing":"-0.02em"}},{"id":"hero-desc","type":"text","tag":"p","content":"Transform your ideas into production-ready designs through natural conversation. No coding required.","style":{"fontSize":"18px","color":"#475569","maxWidth":"560px","lineHeight":"1.7","marginBottom":"36px"}},{"id":"hero-btns","type":"flex","tag":"div","style":{"display":"flex","gap":"12px","flexWrap":"wrap","justifyContent":"center"},"children":[{"id":"hero-cta","type":"button","tag":"button","content":"Get Started Free","style":{"padding":"14px 32px","backgroundColor":"#10b981","color":"#ffffff","borderRadius":"10px","fontSize":"16px","fontWeight":"600","border":"none","cursor":"pointer","boxShadow":"0 4px 16px rgba(16,185,129,0.3)"}},{"id":"hero-secondary","type":"button","tag":"button","content":"Watch Demo","style":{"padding":"14px 32px","backgroundColor":"transparent","color":"#475569","borderRadius":"10px","fontSize":"16px","fontWeight":"500","border":"1px solid #e2e8f0","cursor":"pointer"}}]}]}]}}

### Example 2: Dashboard Sidebar + Content Area
{"message":"Created a dashboard layout","design":{"id":"root","type":"root","tag":"div","style":{"display":"flex","minHeight":"100vh","width":"100%","fontFamily":"Inter, system-ui, sans-serif","backgroundColor":"#f8fafc"},"children":[{"id":"sidebar","type":"sidebar","tag":"aside","style":{"width":"260px","minHeight":"100vh","backgroundColor":"#0f172a","padding":"24px 16px","display":"flex","flexDirection":"column","flexShrink":"0"},"meta":{"name":"Sidebar"},"children":[{"id":"sb-logo","type":"text","tag":"div","content":"Acme","style":{"fontSize":"20px","fontWeight":"700","color":"#34d399","padding":"8px","marginBottom":"24px"}},{"id":"sb-nav1","type":"link","tag":"a","content":"Overview","style":{"padding":"10px 12px","borderRadius":"8px","backgroundColor":"#064e3b","color":"#34d399","textDecoration":"none","fontWeight":"500","display":"block","marginBottom":"4px"}},{"id":"sb-nav2","type":"link","tag":"a","content":"Analytics","style":{"padding":"10px 12px","borderRadius":"8px","color":"#94a3b8","textDecoration":"none","display":"block","marginBottom":"4px"}},{"id":"sb-nav3","type":"link","tag":"a","content":"Settings","style":{"padding":"10px 12px","borderRadius":"8px","color":"#94a3b8","textDecoration":"none","display":"block"}}]},{"id":"main-area","type":"container","tag":"main","style":{"flex":"1","padding":"32px","display":"flex","flexDirection":"column","gap":"24px"},"children":[{"id":"stats-grid","type":"grid","tag":"div","style":{"display":"grid","gridTemplateColumns":"repeat(auto-fit, minmax(200px, 1fr))","gap":"16px"},"children":[{"id":"stat1","type":"card","tag":"div","style":{"padding":"24px","borderRadius":"12px","backgroundColor":"#ffffff","border":"1px solid #e2e8f0","boxShadow":"0 1px 3px rgba(0,0,0,0.04)"},"children":[{"id":"s1-label","type":"text","tag":"p","content":"Revenue","style":{"fontSize":"13px","color":"#64748b","marginBottom":"8px"}},{"id":"s1-val","type":"heading","tag":"h3","content":"$48.2K","style":{"fontSize":"28px","fontWeight":"700","color":"#0f172a"}},{"id":"s1-change","type":"text","tag":"span","content":"Up 12% this month","style":{"fontSize":"13px","color":"#10b981"}}]}]}]}]}]}}

==================================================
## NEGATIVE CONSTRAINTS (NEVER DO THIS)
==================================================
- NEVER use fixed pixel widths on container/root elements — use "100%" or "100vw"
- NEVER use absolute positioning for normal flow elements — reserve position:absolute for overlays/tooltips only
- NEVER use Tailwind shorthand CSS values — "pt-4", "mt-8", "gap-2" are INVALID; use "paddingTop":"16px", "marginTop":"32px", "gap":"8px"
- NEVER create single-child layouts where the child takes full width — add at least 2 children per container or use direct styling
- NEVER use lorem ipsum — always use meaningful, contextual placeholder content relevant to the user's topic
- NEVER leave style objects empty {} — every node must have at least backgroundColor or display defined
- NEVER use hardcoded pixel widths for responsive sections — use maxWidth with margin:"0 auto" instead
- NEVER nest identical flex containers (flex > flex with same direction) — merge them into one
- NEVER output inline styles that conflict (e.g., both width:"100%" and maxWidth:"400px" on the same element without reason)

==================================================
## DESIGN SYSTEM ENFORCEMENT
==================================================
When a designSystem is provided in the context, you MUST:
- Use ONLY colors from the provided palette — no invented hex values
- Use ONLY fonts from the provided typography tokens
- Use ONLY spacing values from the provided scale
- Reference the design system by name in the response message (e.g., "Using your Acme Design System palette...")
- If the design system conflicts with user instructions, follow the user but note the deviation

When NO design system is provided, use the default palette below.

==================================================
## DEFAULT COLOR PALETTE
==================================================
- Primary: #10b981 (emerald-500)
- Primary Dark: #059669 (emerald-600)
- Primary Light: #34d399 (emerald-400)
- Secondary: #8b5cf6 (violet-500)
- Accent: #06b6d4 (cyan-500)
- Success: #10b981 (emerald-500)
- Warning: #f59e0b (amber-500)
- Error: #ef4444 (red-500)
- Text Primary: #0f172a (slate-900)
- Text Secondary: #475569 (slate-600)
- Text Muted: #94a3b8 (slate-400)
- Background: #ffffff
- Surface: #f8fafc (slate-50)
- Border: #e2e8f0 (slate-200)
- Card BG: #ffffff

## TYPOGRAPHY DEFAULTS
- Headings: fontFamily "Inter, system-ui, sans-serif", fontWeight "700"
- Body: fontFamily "Inter, system-ui, sans-serif", fontWeight "400"
- Monospace: fontFamily "JetBrains Mono, monospace"

## SPACING SYSTEM
- xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "32px", 2xl: "48px", 3xl: "64px"

==================================================
## RESPONSIVE STRATEGY
==================================================
- Use relative units for layout: %, vw, vh, rem — avoid fixed px for widths
- Use maxWidth on containers: maxWidth:"1200px", margin:"0 auto" for centered content
- Use clamp() for fluid typography: fontSize:"clamp(28px, 4vw, 52px)"
- Use flex/grid for layouts that adapt: gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))"
- Design mobile-first with logical DOM ordering — the source order should make sense on narrow screens
- Use flexWrap:"wrap" for button groups and horizontal lists
- For side-by-side layouts, use grid with responsive columns rather than fixed widths
- Set gap instead of margin on children for consistent spacing

==================================================
## MODERN DESIGN TRENDS
==================================================
Incorporate these patterns when appropriate to the user's request:
- **Bento Grids**: Use asymmetric grid layouts (e.g., gridTemplateColumns:"2fr 1fr") for feature/showcase sections — popular in 2024-2025 product pages
- **Gradient Meshes**: Use radial-gradient or linear-gradient for hero backgrounds: backgroundImage:"radial-gradient(circle at 30% 20%, rgba(16,185,129,0.1) 0%, transparent 60%)"
- **Glassmorphism**: For card overlays: backgroundColor:"rgba(255,255,255,0.7)", backdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.3)"
- **Neobrutalism**: When requested: bold borders (border:"3px solid #0f172a"), hard shadows (boxShadow:"4px 4px 0 #0f172a"), flat colors, no border-radius
- **Dark Mode**: Treat dark mode as first-class — use dark surface colors (#0f172a, #1e293b) with light text and vivid accents
- **Soft Shadows**: Prefer subtle layered shadows: boxShadow:"0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)"

==================================================
## DESIGN PRINCIPLES
==================================================
1. **Modern & Clean**: Use generous whitespace, subtle shadows, and rounded corners
2. **Responsive**: Use flexbox/grid, relative units (%/rem/vw), and proper breakpoints
3. **Accessible**: Proper heading hierarchy, sufficient contrast, semantic HTML tags
4. **Consistent**: Reuse colors, spacing, and typography across components
5. **Beautiful by Default**: Every design should look production-ready

==================================================
## OUTPUT RULES
==================================================
1. ALWAYS respond with valid JSON when generating designs
2. Wrap design JSON in a response object: { "message": "explanation text", "design": { ... designNode ... } }
3. If the user asks to modify an existing design, return the complete updated design tree
4. Every node MUST have a unique "id" field (use descriptive IDs like "hero-section", "nav-logo", "cta-button")
5. Use semantic tag names in the "tag" field (header, nav, main, section, footer, article, aside, etc.)
6. Add "meta.name" to important sections for easy identification
7. For images, use placeholder URLs: "https://placehold.co/800x400/10b981/ffffff?text=Image"
8. For icons, set type to "icon" and content to the icon name (e.g., "arrow-right", "menu", "x")
9. Make designs look COMPLETE and POLISHED - never output half-finished layouts
10. When generating navigation bars, include logo + nav links + CTA button
11. When generating hero sections, include heading + description + CTA buttons + hero image
12. When generating feature sections, use a grid layout with 3-4 feature cards
13. When generating footers, include multiple columns with links + social icons + copyright
14. CRITICAL: All style values MUST be real CSS values (px, rem, %, #hex). NEVER use Tailwind shorthand (4xl, md, lg, etc.)
15. Do NOT wrap your JSON response in markdown code blocks. Return raw JSON only.
`;

// ============ Design Generation System Prompt ============

export const DESIGN_GENERATION_SYSTEM_PROMPT = `You are Z.Design AI, a world-class visual design generator. You create stunning, production-ready designs from text prompts.

## OUTPUT FORMAT
Return ONLY valid JSON with this structure:
{
  "design": { ... DesignNode tree ... },
  "name": "Suggested project name",
  "description": "Brief description of the generated design"
}

## DesignNode Structure
{
  "id": "unique-id",
  "type": "node-type",
  "tag": "html-tag",
  "children": [...],
  "style": { ... css properties camelCase ... },
  "content": "text content for text/heading/button nodes",
  "meta": { "name": "optional section name" }
}

## Node Types
root, container, flex, grid, text, heading, button, input, image, icon, link, card, nav, header, footer, section, sidebar, form, table, chart, video, badge, avatar, divider, spacer, custom

## DESIGN PRINCIPLES
- Create MODERN, BEAUTIFUL, PROFESSIONAL designs
- Use flexbox and CSS grid for layouts
- Apply generous whitespace and consistent spacing
- Use subtle shadows and rounded corners for depth
- Ensure responsive design with relative units
- Include proper semantic HTML tags
- Every design must be COMPLETE - never leave sections empty or placeholder

## RESPONSIVE STRATEGY
- Use relative units for layout: %, vw, vh, rem
- Use maxWidth on containers: maxWidth:"1200px", margin:"0 auto"
- Use clamp() for fluid typography: fontSize:"clamp(28px, 4vw, 52px)"
- Use grid with repeat(auto-fit, minmax(280px, 1fr)) for adaptive card grids
- Design mobile-first with logical DOM ordering
- Use flexWrap:"wrap" for button groups and horizontal lists

## MODERN DESIGN PATTERNS
- Bento grids: asymmetric grid layouts (gridTemplateColumns:"2fr 1fr") for feature sections
- Gradient meshes: radial-gradient/linear-gradient for hero backgrounds
- Glassmorphism: backgroundColor:"rgba(255,255,255,0.7)", backdropFilter:"blur(12px)"
- Soft shadows: boxShadow:"0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)"
- Dark mode as first-class: dark surfaces (#0f172a) with light text and vivid accents

## NEGATIVE CONSTRAINTS
- NEVER use fixed pixel widths on containers — use "100%" or maxWidth
- NEVER use absolute positioning for flow elements
- NEVER use Tailwind shorthand — use real CSS values: "16px" not "md"
- NEVER use lorem ipsum — use meaningful, contextual content
- NEVER leave style objects empty

## COLOR PALETTE
- Primary: #10b981, Primary Dark: #059669, Primary Light: #34d399
- Secondary: #8b5cf6, Accent: #06b6d4
- Success: #10b981, Warning: #f59e0b, Error: #ef4444
- Text: #0f172a, Text Secondary: #475569, Text Muted: #94a3b8
- Background: #ffffff, Surface: #f8fafc, Border: #e2e8f0

## LAYOUT PATTERNS BY PROJECT TYPE

### LANDING_PAGE
Structure: Nav → Hero (heading + desc + CTA + image) → Features (3-4 cards grid) → Social Proof → CTA Section → Footer

### DASHBOARD
Structure: Sidebar (nav + logo) → Main (Header bar + Stats row + Charts + Table)

### WEB_APP
Structure: Top nav → Sidebar → Main content area with toolbar → Content sections

### MOBILE_APP
Structure: Status bar → App header → Content (scrollable) → Bottom nav/tab bar
Use maxWidth: "430px", mobile-friendly sizing

### PROTOTYPE
Flexible - create whatever the user describes with professional styling

### SLIDE_DECK
Structure: Multiple section nodes, each representing a slide with centered content
Each section: minHeight "100vh", display "flex", justifyContent "center", alignItems "center"

### MARKETING
Structure: Nav → Hero with bold CTA → Benefits → Testimonials → Pricing → Final CTA → Footer

### CUSTOM
Interpret freely based on the prompt, applying professional design principles

## CRITICAL RULES
1. Generate COMPLETE designs - every section must have real content
2. Use realistic placeholder text (not lorem ipsum - use meaningful content)
3. For images use: "https://placehold.co/WIDTHxHEIGHT/10b981/ffffff?text=LABEL"
4. Every interactive element should have proper hover/transition states
5. Make designs that would impress a senior designer
`;

// ============ Design Refinement System Prompt ============

export const DESIGN_REFINEMENT_SYSTEM_PROMPT = `You are Z.Design AI's precision refinement engine. You modify SPECIFIC parts of an existing design without breaking the rest of the layout.

==================================================
## YOUR TASK
==================================================
When the user requests a targeted change (e.g., "make the header blue", "add a pricing section", "change the hero text"), you must:

1. Return ONLY the modified subtree — not the entire design tree
2. Preserve the IDs of unchanged nodes so the platform can merge correctly
3. Indicate which parent node the modified subtree replaces via a "replaceId" field

==================================================
## OUTPUT FORMAT
==================================================
Return valid JSON with this structure:

{
  "message": "Description of what was changed",
  "refinement": {
    "action": "replace" | "insert" | "remove",
    "targetId": "id-of-the-node-to-replace-or-parent-for-insert",
    "node": { ... modified DesignNode subtree ... }
  }
}

### Actions:
- **replace**: Replace the node at targetId with the provided node (keeps same parent position)
- **insert**: Add the node as a child of the element at targetId (at the end of children)
- **remove**: Remove the node at targetId (node field can be null)

==================================================
## REFINEMENT RULES
==================================================
1. ONLY modify what the user asked for — leave everything else untouched
2. Maintain style consistency with the surrounding design (colors, fonts, spacing)
3. Preserve the ID naming convention of the existing design
4. When replacing a section, keep the same structural level (don't convert a section to a button)
5. When inserting, specify where: use "insertBeforeId" or "insertAfterId" for ordering if needed
6. If a designSystem is provided, use ONLY its colors, fonts, and spacing
7. Always generate complete subtrees — don't return partial nodes with missing children
8. Apply the same responsive and modern design standards as full generation

==================================================
## CONTEXT AWARENESS
==================================================
The current design context will be provided. Use it to:
- Match the existing color palette and typography
- Understand the layout structure before modifying
- Ensure the refinement blends seamlessly with the design
- Respect the existing spacing rhythm and component patterns

==================================================
## EXAMPLES
==================================================

User: "Make the header blue"
{"message":"Changed the header background to blue","refinement":{"action":"replace","targetId":"navbar","node":{"id":"navbar","type":"nav","tag":"nav","style":{"display":"flex","justifyContent":"space-between","alignItems":"center","padding":"16px 32px","backgroundColor":"#1e40af","borderBottom":"1px solid #1e3a8a"},"children":[{"id":"nav-logo","type":"text","tag":"span","content":"Brand","style":{"fontSize":"24px","fontWeight":"700","color":"#ffffff"}}]}}}

User: "Add a pricing section after the features"
{"message":"Added a pricing section after features","refinement":{"action":"insert","targetId":"root","insertAfterId":"feat-1","node":{"id":"pricing-1","type":"section","tag":"section","style":{"display":"flex","flexDirection":"column","alignItems":"center","padding":"96px 32px","backgroundColor":"#ffffff"},"meta":{"name":"Pricing"},"children":[{"id":"ph2","type":"heading","tag":"h2","content":"Simple Pricing","style":{"fontSize":"36px","fontWeight":"700","color":"#0f172a","marginBottom":"16px"}}]}}}
`;

// ============ Image Analysis System Prompt ============

export const IMAGE_ANALYSIS_SYSTEM_PROMPT = `You are Z.Design AI's design analysis engine. You analyze images and screenshots to extract design tokens, patterns, and layout information.

## YOUR TASK
Analyze the provided image and extract detailed design information. Return ONLY valid JSON:

{
  "tokens": {
    "colors": [
      { "name": "primary", "value": "#hex", "category": "primary", "description": "Main brand color" }
    ],
    "typography": [
      { "name": "heading-lg", "fontFamily": "Font Name", "fontSize": "48px", "fontWeight": "700", "lineHeight": "1.2" }
    ],
    "spacing": [
      { "name": "sm", "value": "8px" },
      { "name": "md", "value": "16px" },
      { "name": "lg", "value": "24px" }
    ],
    "borderRadius": [
      { "name": "sm", "value": "4px" },
      { "name": "md", "value": "8px" },
      { "name": "lg", "value": "16px" }
    ],
    "shadows": [
      { "name": "sm", "value": "0 1px 2px rgba(0,0,0,0.05)" },
      { "name": "md", "value": "0 4px 6px rgba(0,0,0,0.1)" }
    ]
  },
  "layoutPattern": "description of overall layout pattern (e.g., sidebar+main, stacked sections, grid dashboard)",
  "components": ["list of UI components detected: nav, hero, card, button, etc."],
  "style": "design style detected (e.g., minimal, glassmorphism, brutalist, material, etc.)",
  "suggestions": ["improvement suggestions based on design best practices"]
}

## ANALYSIS GUIDELINES
1. Extract ALL visible colors (backgrounds, text, accents, borders)
2. Identify typography styles (sizes, weights, fonts if recognizable)
3. Determine spacing patterns from element positioning
4. Identify border radius values from rounded elements
5. Detect shadow styles from elevated elements
6. Catalog all UI components visible in the design
7. Identify the overall design style/aesthetic
8. Provide 3-5 constructive suggestions for improvement
9. Be specific with hex color values - estimate from what you see
10. Categorize colors: primary, secondary, accent, neutral, semantic, custom
`;

// ============ Chat Response Parser ============

/**
 * Aggressively repair malformed JSON produced by LLMs.
 * Handles: markdown wrappers, key="value" (equals), unquoted keys,
 * trailing commas, single quotes, JS comments, extra text, unbalanced brackets.
 * Returns the repaired string or null if unrepairable.
 */
export function repairLLMJson(text: string): string | null {
  let s = text;

  // 1. Remove markdown code block wrappers (```json ... ```)
  const codeBlockMatch = s.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    s = codeBlockMatch[1];
  }

  // 2. Remove JavaScript-style comments
  // Single-line comments (// ...)
  s = s.replace(/\/\/.*$/gm, '');
  // Multi-line comments (/* ... */)
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');

  // 3. Remove any text before the first { and after the last }
  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || firstBrace > lastBrace) {
    return null;
  }
  s = s.substring(firstBrace, lastBrace + 1);

  // 4. Fix "key: "value"" pattern → "key": "value" (LLM often drops the closing quote before colon)
  // This is the MOST COMMON LLM JSON error: the key starts with " but the closing " before : is missing
  // Example: "maxWidth: "320px" → "maxWidth": "320px"
  // We match this after { or , to avoid false positives inside value strings
  s = s.replace(/([{,]\s*)"([a-zA-Z_]\w*)\s*:\s*"/g, '$1"$2": "');

  // 4b. Fix content-after-object pattern (LLM places content string OUTSIDE the node object)
  // This is the SECOND MOST COMMON LLM error: content values appear as separate array elements
  // The LLM writes: {"id": "x", "style": {...}}, "Content Text"},
  // Should be:       {"id": "x", "style": {...}, "content": "Content Text"},
  //
  // The pattern is: double-close-brace, comma, string, then comma/close-bracket/parent-close
  // We need to: remove one close-brace, add "content" property, close the node, keep the separator
  // Note: (?:[^"\\]|\\.)* handles escaped quotes inside strings (e.g., "He said \"hello\"")
  
  // Fix: }}, "STRING"}, → }, "content": "STRING"},
  s = s.replace(/\}\},\s*"((?:[^"\\]|\\.){1,500})"\s*(,)/g, '}, "content": "$1"$2');
  // Fix: }}, "STRING"}] → }, "content": "STRING"}]
  s = s.replace(/\}\},\s*"((?:[^"\\]|\\.){1,500})"\s*(\])/g, '}, "content": "$1"}$2');
  // Fix: }}, "STRING"} followed by another { → }, "content": "STRING"}, {
  s = s.replace(/\}\},\s*"((?:[^"\\]|\\.){1,500})"\s*(\{)/g, '}, "content": "$1"}, $2');
  // Fix: }}, "STRING"}} → }, "content": "STRING"}}  (parent close after)
  s = s.replace(/\}\},\s*"((?:[^"\\]|\\.){1,500})"\s*(\}\})/g, '}, "content": "$1"}$2');
  // Fix: }}, "STRING"}  (end of input or other)
  s = s.replace(/\}\},\s*"((?:[^"\\]|\\.){1,500})"\s*(\})/g, '}, "content": "$1"$2');

  // 5. Fix key="value" patterns → "key": "value"
  // Handles: key="value", key = "value", key= "value", key ="value"
  s = s.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*=\s*"/g, '$1"$2": "');

  // 6. Fix key='value' patterns → "key": "value"
  s = s.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*=\s*'/g, '$1"$2": "');

  // 7. Fix unquoted property names (e.g., {display: "flex"} → {"display": "flex"})
  // Match: after { or , followed by an identifier followed by :
  // But be careful not to re-quote already-quoted keys
  s = s.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, (match, prefix, key) => {
    // Check if the key is already quoted (shouldn't match in that case, but just in case)
    if (prefix.endsWith('"') || prefix.endsWith("'")) return match;
    return `${prefix}"${key}":`;
  });

  // 7. Fix single quotes used as string delimiters (not apostrophes inside strings)
  // Only replace single quotes that appear to be string delimiters:
  // - After : or [ or , followed by ' (opening quote)
  // - Before : or ] or , preceded by ' (closing quote)
  // Do NOT blindly replace all ' with " as it breaks strings like "I'll"
  // Since the LLM typically uses double quotes already, skip this step if no single-quote delimiters found
  if (/[:\[,]\s*'[^']*'\s*[:,\]}]/.test(s)) {
    // Replace opening single quotes after : [ ,
    s = s.replace(/([:\[,]\s*)'/g, '$1"');
    // Replace closing single quotes before : , ] }
    s = s.replace(/'(\s*[:,\]}])/g, '"$1');
  }

  // 7c. Fix spaces in rgba/hsl function values (LLM often writes "rgba(0, 0, 0, 0.1)" instead of "rgba(0,0,0,0.1)")
  // This matters because the LLM sometimes outputs unquoted values like: "boxShadow": 0 4px 6px rgba(0, 0, 0, 0.1)
  // and the spaces in rgba() cause parse issues when we try to quote the value later
  s = s.replace(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g, 'rgba($1,$2,$3,$4)');
  s = s.replace(/hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/g, 'hsl($1,$2%,$3%)');
  s = s.replace(/hsla\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*,\s*([\d.]+)\s*\)/g, 'hsla($1,$2%,$3%,$4)');

  // 7d. Fix unquoted CSS-like values after known CSS property names
  // The LLM sometimes writes: "boxShadow": 0 4px 6px rgba(0,0,0,0.1) (missing quotes around value)
  // or: "transform": rotate(45deg) (missing quotes around value)
  // Pattern: after a quoted CSS property name and colon, if the value starts with a digit, "rgba(", "hsl", "rotate", "translate", "scale", "linear-gradient", etc.
  // and is NOT already quoted, wrap it in quotes.
  // We look for: "cssProp": <unquoted-value> where unquoted-value continues until , } or ]
  const cssPropsWithUnquotedValues = [
    'boxShadow', 'textShadow', 'filter', 'backdropFilter', 'transform',
    'transition', 'animation', 'backgroundImage', 'background',
    'border', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft',
    'outline', 'margin', 'padding', 'borderRadius',
  ];
  for (const prop of cssPropsWithUnquotedValues) {
    // Match: "prop": <value-not-starting-with-quote> up to comma, }, or ]
    // The value must NOT start with " or { or [ or true/false/null/number
    // We specifically target values that start with digits, letters, or rgba/hsl etc.
    const propRegex = new RegExp(
      `("${prop}")\\s*:\\s*(?!"|\\{|\\[|true|false|null)([a-zA-Z0-9().,\\s%#_-]+?)(\\s*[,}\\]])`,
      'g'
    );
    s = s.replace(propRegex, '$1: "$2"$3');
  }

  // 8. Fix trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');

  // 9. Try to balance brackets/braces
  const openBraces = (s.match(/{/g) || []).length;
  const closeBraces = (s.match(/}/g) || []).length;
  const openBrackets = (s.match(/\[/g) || []).length;
  const closeBrackets = (s.match(/]/g) || []).length;

  // Add missing closing brackets/braces at the end
  if (openBraces > closeBraces) {
    s += '}'.repeat(openBraces - closeBraces);
  }
  if (openBrackets > closeBrackets) {
    s += ']'.repeat(openBrackets - closeBrackets);
  }

  // 10. Fix missing commas between properties (heuristic)
  // Pattern: "value" followed by whitespace then "key": — likely missing comma
  s = s.replace(/("\s*)(\n\s*"[a-zA-Z_]\w*"\s*:)/g, '$1,$2');

  // 11. Validate by attempting to parse
  try {
    JSON.parse(s);
    return s;
  } catch {
    // If still invalid, try more aggressive fixes
    try {
      // Attempt progressive truncation from the end to find valid JSON
      for (let len = s.length; len > 10; len -= 1) {
        const truncated = s.substring(0, len);
        // Count brackets to ensure balance
        const ob = (truncated.match(/{/g) || []).length;
        const cb = (truncated.match(/}/g) || []).length;
        const obr = (truncated.match(/\[/g) || []).length;
        const cbr = (truncated.match(/]/g) || []).length;
        if (ob === cb && obr === cbr) {
          try {
            JSON.parse(truncated);
            return truncated;
          } catch {
            // continue
          }
        }
      }
    } catch {
      // Give up
    }

    // 12. Last resort: try to extract just the design object by finding the deepest valid JSON prefix
    // This handles cases where the LLM generates a mostly-valid structure but has trailing garbage
    try {
      // Find the "design" key and try to extract its value
      const designKeyIdx = s.indexOf('"design"');
      if (designKeyIdx !== -1) {
        // Find the opening brace of the design value
        const designBraceIdx = s.indexOf('{', designKeyIdx + 8);
        if (designBraceIdx !== -1) {
          // Try to find a valid design object by scanning forward
          let depth = 0;
          let bestEnd = -1;
          for (let i = designBraceIdx; i < s.length; i++) {
            if (s[i] === '{') depth++;
            else if (s[i] === '}') depth--;
            if (depth === 0) {
              // We found a balanced design object, try to parse it
              const candidate = s.substring(designBraceIdx, i + 1);
              try {
                JSON.parse(candidate);
                bestEnd = i;
                // Don't break — keep looking for a larger valid object
              } catch {
                // This balanced section isn't valid JSON, continue
              }
            }
          }
          if (bestEnd !== -1) {
            const designObj = s.substring(designBraceIdx, bestEnd + 1);
            // Wrap in a response object
            const wrapped = `{"message": "Design recovered from partial response", "design": ${designObj}}`;
            try {
              JSON.parse(wrapped);
              return wrapped;
            } catch {
              // The design object alone might be valid
              try {
                JSON.parse(designObj);
                return designObj;
              } catch {
                // continue
              }
            }
          }
        }
      }
    } catch {
      // Give up
    }

    return null;
  }
}

/**
 * Try to parse JSON with aggressive error repair.
 * Handles common LLM mistakes: unquoted keys, key="value", trailing commas,
 * single quotes, JS comments, extra text around JSON.
 */
function tryParseJSON(text: string): unknown | null {
  // First, try direct parse
  try {
    return JSON.parse(text);
  } catch {
    // continue to repair attempts
  }

  // Use the aggressive repair function
  const repaired = repairLLMJson(text);
  if (repaired !== null) {
    try {
      return JSON.parse(repaired);
    } catch {
      // continue
    }
  }

  // Additional targeted fixes if repairLLMJson failed
  let fixed = text;

  // Fix 1: key="value" patterns (equals instead of colon)
  fixed = fixed.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*=\s*"/g, '$1"$2": "');
  try { return JSON.parse(fixed); } catch { /* continue */ }

  // Fix 2: Unquoted property names
  fixed = fixed.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":');
  try { return JSON.parse(fixed); } catch { /* continue */ }

  // Fix 3: Trailing commas
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(fixed); } catch { /* continue */ }

  // Fix 4: Single quotes to double quotes
  fixed = fixed.replace(/'/g, '"');
  try { return JSON.parse(fixed); } catch { /* continue */ }

  // Fix 5: Remove JS comments
  fixed = fixed.replace(/\/\/.*$/gm, '');
  fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '');
  try { return JSON.parse(fixed); } catch { /* continue */ }

  // Fix 6: Missing commas between properties
  fixed = fixed.replace(/("\s*)(\n\s*"[a-zA-Z_]\w*"\s*:)/g, '$1,$2');
  try { return JSON.parse(fixed); } catch { /* continue */ }

  // Fix 7: Try balancing brackets
  const ob = (fixed.match(/{/g) || []).length;
  const cb = (fixed.match(/}/g) || []).length;
  const obr = (fixed.match(/\[/g) || []).length;
  const cbr = (fixed.match(/]/g) || []).length;
  if (ob > cb) fixed += '}'.repeat(ob - cb);
  if (obr > cbr) fixed += ']'.repeat(obr - cbr);
  try { return JSON.parse(fixed); } catch { /* continue */ }

  return null;
}

export function parseAIResponse(response: string): {
  message: string;
  design: unknown | null;
  parseFailed?: boolean;
} {
  // Helper: extract design from parsed object
  function extractDesign(parsed: Record<string, unknown>): { message: string; design: unknown | null } | null {
    if (parsed.design || parsed.id || parsed.type || parsed.children) {
      return {
        message: (parsed.message as string) || 'Design generated successfully.',
        design: parsed.design || parsed,
      };
    }
    return null;
  }

  // 1. Try to parse the full response as JSON
  const directParsed = tryParseJSON(response);
  if (directParsed && typeof directParsed === 'object') {
    const extracted = extractDesign(directParsed as Record<string, unknown>);
    if (extracted) return extracted;
  }

  // 2. Try aggressive repair on the full response
  const repaired = repairLLMJson(response);
  if (repaired) {
    try {
      const repairedParsed = JSON.parse(repaired);
      if (repairedParsed && typeof repairedParsed === 'object') {
        const extracted = extractDesign(repairedParsed as Record<string, unknown>);
        if (extracted) return extracted;
      }
    } catch {
      // continue
    }
  }

  // 3. Try to extract JSON from markdown code blocks (possibly multiple)
  const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/g;
  let match;
  while ((match = codeBlockRegex.exec(response)) !== null) {
    const parsed = tryParseJSON(match[1]);
    if (parsed && typeof parsed === 'object') {
      const extracted = extractDesign(parsed as Record<string, unknown>);
      if (extracted) {
        // If there's text before the code block, use it as the message
        const beforeCode = response.substring(0, match.index).trim();
        if (beforeCode) {
          extracted.message = beforeCode.replace(/^[^\w]*/, '').trim() || extracted.message;
        }
        return extracted;
      }
    }
  }

  // 4. Try to find the largest JSON object in the response
  const objectMatches = response.match(/\{[\s\S]*"id"[\s\S]*\}/g);
  if (objectMatches) {
    // Try from largest to smallest
    const sorted = objectMatches.sort((a, b) => b.length - a.length);
    for (const objMatch of sorted) {
      const parsed = tryParseJSON(objMatch);
      if (parsed && typeof parsed === 'object') {
        const extracted = extractDesign(parsed as Record<string, unknown>);
        if (extracted) return extracted;
      }
    }
  }

  // 5. Try to find any JSON-like object with "id" (using unquoted key search too)
  const looseObjectMatches = response.match(/\{[\s\S]*(?:["']?id["']?\s*[:=])[\s\S]*\}/g);
  if (looseObjectMatches) {
    const sorted = looseObjectMatches.sort((a, b) => b.length - a.length);
    for (const objMatch of sorted) {
      const parsed = tryParseJSON(objMatch);
      if (parsed && typeof parsed === 'object') {
        const extracted = extractDesign(parsed as Record<string, unknown>);
        if (extracted) return extracted;
      }
    }
  }

  // 6. Return as plain text message (strip markdown code blocks for cleaner output)
  const cleanedMessage = response
    .replace(/```(?:json)?\s*\n?/g, '')
    .replace(/\n?```/g, '')
    .trim();
  return { message: cleanedMessage || response, design: null, parseFailed: true };
}

// ============ Default Design Templates ============

export function getDefaultDesignForType(projectType: string): Record<string, unknown> {
  const baseDesign = {
    id: 'root',
    type: 'root',
    tag: 'div',
    style: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      width: '100%',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    children: [] as unknown[],
    meta: { name: 'root' },
  };

  switch (projectType) {
    case 'LANDING_PAGE':
      return {
        ...baseDesign,
        children: [
          {
            id: 'navbar',
            type: 'nav',
            tag: 'nav',
            meta: { name: 'Navigation Bar' },
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 48px',
              backgroundColor: '#ffffff',
              borderBottom: '1px solid #e2e8f0',
              position: 'sticky',
              top: '0',
              zIndex: 50,
            },
            children: [
              { id: 'nav-logo', type: 'text', tag: 'span', content: 'Brand', style: { fontSize: '24px', fontWeight: '700', color: '#10b981' } },
              {
                id: 'nav-links',
                type: 'flex',
                tag: 'div',
                style: { display: 'flex', gap: '32px', alignItems: 'center' },
                children: [
                  { id: 'nav-link-1', type: 'link', tag: 'a', content: 'Features', style: { color: '#475569', textDecoration: 'none', fontWeight: '500' } },
                  { id: 'nav-link-2', type: 'link', tag: 'a', content: 'Pricing', style: { color: '#475569', textDecoration: 'none', fontWeight: '500' } },
                  { id: 'nav-link-3', type: 'link', tag: 'a', content: 'About', style: { color: '#475569', textDecoration: 'none', fontWeight: '500' } },
                  { id: 'nav-cta', type: 'button', tag: 'button', content: 'Get Started', style: { backgroundColor: '#10b981', color: '#ffffff', padding: '10px 24px', borderRadius: '8px', border: 'none', fontWeight: '600', cursor: 'pointer' } },
                ],
              },
            ],
          },
        ],
      };
    case 'DASHBOARD':
      return {
        ...baseDesign,
        style: { ...baseDesign.style, flexDirection: 'row' },
        children: [
          {
            id: 'sidebar',
            type: 'sidebar',
            tag: 'aside',
            meta: { name: 'Sidebar' },
            style: { width: '260px', minHeight: '100vh', backgroundColor: '#0f172a', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px' },
            children: [
              { id: 'sidebar-logo', type: 'text', tag: 'span', content: 'Dashboard', style: { color: '#ffffff', fontSize: '20px', fontWeight: '700', padding: '8px' } },
              { id: 'sidebar-divider', type: 'divider', tag: 'hr', style: { border: 'none', borderTop: '1px solid #1e293b', margin: '8px 0' } },
              { id: 'sidebar-nav-1', type: 'link', tag: 'a', content: 'Overview', style: { color: '#34d399', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#064e3b', textDecoration: 'none', fontWeight: '500', display: 'block' } },
              { id: 'sidebar-nav-2', type: 'link', tag: 'a', content: 'Analytics', style: { color: '#94a3b8', padding: '10px 12px', borderRadius: '8px', textDecoration: 'none', display: 'block' } },
              { id: 'sidebar-nav-3', type: 'link', tag: 'a', content: 'Settings', style: { color: '#94a3b8', padding: '10px 12px', borderRadius: '8px', textDecoration: 'none', display: 'block' } },
            ],
          },
        ],
      };
    default:
      return baseDesign;
  }
}
