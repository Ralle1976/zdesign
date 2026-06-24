// Z.Design — Deterministic Design Direction
//
// The "missing Phase 1+2" of the design pipeline: derive a coherent,
// TOPIC-APPROPRIATE aesthetic (palette + typography + layout archetype)
// from the user's message — deterministically, with NO LLM call.
//
// Why deterministic (not an LLM pre-step):
//   • Respects the hard constraint "no in-app LLM before Fusion" on the
//     remote path. This runs on BOTH paths identically and for free.
//   • Fast (µs), free, reproducible → "systematisch + hochwertig".
//   • The intelligence lives in the curated direction library below.
//
// The output DesignDirective is injected as ENFORCED TOKENS into the tree-
// building prompt (legacy + remote-fusion), replacing the old hardcoded
// emerald palette that made every design look identical ("AI-generic").

export interface DesignPalette {
  background: string;
  surface: string;
  primary: string; // brand / dark
  accent: string; // the ONE vivid color
  secondary?: string;
  text: string;
  textMuted: string;
  border: string;
}

export interface DesignDirective {
  domain: string; // e.g. "coffee-food"
  mood: string; // "warm · handwerklich · eingeladen"
  rationale: string; // why this fits the topic (shown to user + fed to LLM)
  palette: DesignPalette;
  fonts: { display: string; body: string }; // CSS font-family stacks
  typeScale: { h1: string; h2: string; h3: string; body: string; eyebrow: string };
  archetype: string; // layout DNA
  craft: {
    radii: string; // concrete radius guidance
    spacing: string; // rhythm
    shadow: string; // a ready-to-use shadow CSS value
  };
  antiTells: string[]; // domain-specific "avoid the generic look"
}

// ─── Craft families (radii / spacing / shadow variants) ───────────────

const CRAFT = {
  warm: {
    radii: 'Cards 14px, Buttons 8px, Badges/Pills 999px (gemischt, NICHT überall rounded-2xl)',
    spacing: '8px-Raster (8·16·24·32·48·64·96·128), großzügig',
    shadow: '0 1px 2px rgba(43,27,18,0.04), 0 8px 24px rgba(43,27,18,0.06)',
  },
  clean: {
    radii: 'Cards 12px, Buttons 8px, Badges 999px',
    spacing: '8px-Raster, ordentlich und dicht',
    shadow: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.06)',
  },
  dark: {
    radii: 'Cards 16px, Buttons 10px, Badges 999px',
    spacing: '8px-Raster, luftig mit dark surface-Kontrast',
    shadow: '0 1px 2px rgba(0,0,0,0.4), 0 12px 32px rgba(0,0,0,0.5)',
  },
  playful: {
    radii: 'Cards 20px, Buttons 14px, Badges 999px (rund und freundlich)',
    spacing: '8px-Raster, locker',
    shadow: '0 2px 6px rgba(45,49,66,0.08), 0 8px 20px rgba(255,107,107,0.18)',
  },
} as const;

// Shared type scales (only the value differs; mood picks one)
const SCALE_EDITORIAL = {
  h1: 'clamp(40px, 6vw, 68px) · lineHeight 1.05 · weight 600 · letterSpacing -0.02em (Display-Serif)',
  h2: '36px · 1.15 · 600 · -0.01em (Serif)',
  h3: '22px · 1.3 · 600 (Serif)',
  body: '17px · lineHeight 1.7 · 400 (Body-Sans)',
  eyebrow: '13px · 600 · uppercase · letterSpacing 0.12em (Akzentfarbe)',
};
const SCALE_MODERN = {
  h1: 'clamp(36px, 5vw, 60px) · 1.08 · 700 · -0.02em (Display-Sans)',
  h2: '32px · 1.15 · 700 (Sans)',
  h3: '20px · 1.4 · 600 (Sans)',
  body: '16px · 1.65 · 400 (Sans)',
  eyebrow: '12px · 600 · uppercase · 0.1em (Akzent)',
};
const SCALE_BOLD = {
  h1: 'clamp(40px, 6vw, 64px) · 1.05 · 800 · -0.02em (Runder Bold-Sans)',
  h2: '34px · 1.15 · 800 (Sans)',
  h3: '22px · 1.35 · 700 (Sans)',
  body: '17px · 1.7 · 500 (Sans)',
  eyebrow: '13px · 800 · uppercase · 0.08em (Akzent)',
};

// ─── Direction library (domain → directive) ──────────────────────────
// `match` keywords are matched (lowercased, word-boundary tolerant) against
// the user message. First/best match wins. Order = priority.

interface DirectionDef {
  domain: string;
  match: string[];
  mood: string;
  rationale: string;
  palette: DesignPalette;
  fonts: { display: string; body: string };
  scale: typeof SCALE_EDITORIAL;
  archetype: string;
  craft: (typeof CRAFT)[keyof typeof CRAFT];
  antiTells: string[];
}

const DIRECTIONS: DirectionDef[] = [
  {
    // Highest priority: spa/wellness/massage is its own world (warm ivory +
    // gold, elegant serif) — must win before generic health-fitness (energetic
    // green) and before the neutral defaults. Covers Thai/spa specifically.
    domain: 'asian-spa-thai-wellness',
    match: ['massage', 'thaimassage', 'thai-massage', 'thai', 'spa', 'wellness', 'fusspflege', 'fußpflege', 'manikuere', 'maniküre', 'pedikuere', 'pediküre', 'hot stone', 'hot-stone', 'aroma', 'oel-massage', 'öl-massage', 'entspannung', 'kosmetik', 'beautyfarm', 'ayurveda', 'reflexzonen', 'balinese', 'shiatsu', 'lomi', 'ritual', 'thermal', 'kurbad', 'massagestudio', 'massagesalon', 'kosmetikstudio', 'nagelstudio', 'gesichtsbehandlung'],
    mood: 'seren · warm · edel · asiatisch',
    rationale: 'Thai/Spa/Wellness → edle, warme Spa-Ästhetik (Reispapier-Elfenbein + tiefes Ink + GOLD als Akzent), elegante Serif-Display, viel Weißraum, ruhige Hierarchie. Keine Tech- oder SaaS-Farben.',
    palette: { background: '#FBF6EA', surface: '#F4ECD6', primary: '#2A2118', accent: '#B0892F', secondary: '#7C2D2A', text: '#2A2118', textMuted: '#8A7B62', border: '#E4D6B5' },
    fonts: { display: 'Cormorant Garamond, Georgia, serif', body: 'Mulish, "Segoe UI", system-ui, sans-serif' },
    scale: SCALE_EDITORIAL,
    archetype: 'spa-editorial (asymmetrischer Hero mit Bild, Leistungs-Karten, Gästestimmen, sanfte ruhige Sektionen)',
    craft: CRAFT.warm,
    antiTells: ['KEIN Emerald/SaaS-Grün', 'Keine Tech-Schatten; warm getönte, weiche Schatten', 'Gold sparsam als einzelner Akzent — nicht metallisch überladen', 'Edle Serif für Überschriften; ruhige, großzügige Layouts', 'Keine lauten Bento-Grids — bildgetrieben, viel Weißraum'],
  },
  {
    domain: 'coffee-food',
    match: ['kaffee', 'cafe', 'restaurant', 'bäckerei', 'bakery', 'bistro', 'wein', 'wine', 'cocktail', 'brauerei', 'chocolat', 'schokolade', 'lebensmittel', 'pizzeria', 'konditorei', 'honig', 'teehaus', 'matcha', 'gastronom', 'catering', 'küche', 'koch', 'food', 'metzgerei', 'wirtshaus', 'brew', 'coffee', 'espresso', 'barista', 'eisdiele', 'kantine', 'speise', 'cafehaus', 'menu'],
    mood: 'warm · handwerklich · eingeladen',
    rationale: 'Thema ist Essen/Trinken → warme, erdige Palette (Espresso/Cream/Terrakotta) + Serif-Display für handwerklichen Charakter. Keine Tech-Farben.',
    palette: { background: '#FAF6F0', surface: '#F2EADD', primary: '#2B1B12', accent: '#C2612A', secondary: '#6B7A5A', text: '#2B1B12', textMuted: '#8A7A68', border: '#E4D8C7' },
    fonts: { display: 'Fraunces, Georgia, serif', body: 'Inter, system-ui, sans-serif' },
    scale: SCALE_EDITORIAL,
    archetype: 'editorial-asymmetric (Text links / Bild rechts, kein zentrierter Hero)',
    craft: CRAFT.warm,
    antiTells: ['Kein Emerald/Indigo für Food', 'Keine Tech-Schatten; warm getönte Schatten', 'Editorial, keine 3-Karten-Bento-Grids'],
  },
  {
    domain: 'fashion-beauty',
    match: ['fashion', 'couture', 'modelabel', 'modehaus', 'modemarke', 'bekleidung', 'kleidung', 'textil', 'beauty', 'kosmetik', 'makeup', 'jewelry', 'schmuck', 'parfum', 'perfume', 'boutique', 'salon', 'friseur', 'luxury', 'luxus', 'cosmetic', 'haute', 'nagelstudio', 'barbier', 'beautyfarm'],
    mood: 'edgy · luxuriös · reduziert',
    rationale: 'Mode/Beauty → luxuriös-reduziert (Elfenbein/Schwarz + Champagner-Akzent), elegante Serif, extrem viel Weißraum.',
    palette: { background: '#FBFAF8', surface: '#F4F1EC', primary: '#1A1A1A', accent: '#B58A6A', text: '#1A1A1A', textMuted: '#8C857C', border: '#E7E1D8' },
    fonts: { display: 'Cormorant Garamond, "Times New Roman", serif', body: 'Inter, system-ui, sans-serif' },
    scale: SCALE_EDITORIAL,
    archetype: 'editorial-center (riesige Typo, viel Weißraum, volle Bildflächen)',
    craft: CRAFT.clean,
    antiTells: ['Keine bunten Akzente — ein gedämpfter Ton', 'Keine 3-Karten-Grids; bildgetrieben', 'Nie Button "Get Started" — edle CTAs'],
  },
  {
    domain: 'law-finance-corporate',
    match: ['legal', 'recht', 'anwalt', 'kanzlei', 'notar', 'jurist', 'finanz', 'finance', 'bank', 'consulting', 'beratung', 'corporate', 'enterprise', 'versicher', 'steuer', 'audit', 'wirtschaft', 'holding', 'investment', 'rechnungs', 'bilanz', 'treuhand', 'compliance'],
    mood: 'seriös · vertrauenswürdig · klassisch',
    rationale: 'Recht/Finanz/Corporate → Vertrauen durch Navy + Gold, klassische Serif, ruhige Hierarchie.',
    palette: { background: '#FFFFFF', surface: '#F5F7FA', primary: '#0F2A47', accent: '#B08D57', text: '#0F1B2D', textMuted: '#5A6B7E', border: '#E2E8F0' },
    fonts: { display: 'Source Serif Pro, Georgia, serif', body: 'Inter, system-ui, sans-serif' },
    scale: SCALE_EDITORIAL,
    archetype: 'centered-trust (klare Mitte, Statistik/Leistungen, Testimonials)',
    craft: CRAFT.clean,
    antiTells: ['Keine verspielten Farben', 'Keine Glassmorphism; solide Flächen', 'Klassische Serif für Vertrauen'],
  },
  {
    domain: 'crypto-web3-fintech',
    match: ['crypto', 'krypto', 'web3', 'blockchain', 'bitcoin', 'ethereum', 'nft', 'defi', 'fintech', 'token', 'wallet', 'metaverse', 'dao'],
    mood: 'futuristisch · dark · dynamisch',
    rationale: 'Crypto/Web3 → dark mit Neon-Akzent (Cyan/Violett), Mono/Sans-Mix. Dark-first, kein helles SaaS-Template.',
    palette: { background: '#0B0F1A', surface: '#131A2A', primary: '#6366F1', accent: '#22D3EE', text: '#F1F5F9', textMuted: '#94A3B8', border: '#1E293B' },
    fonts: { display: 'Space Grotesk, Inter, sans-serif', body: 'Inter, system-ui, sans-serif' },
    scale: SCALE_MODERN,
    archetype: 'dark-hero (vollflächiger Dark-Hero, Glow, animierte Stats)',
    craft: CRAFT.dark,
    antiTells: ['Dark-first, niemals helles Standard-Layout', 'Akzente sparsam mit Glow', 'Keine Stockfoto-Office-Bilder'],
  },
  {
    domain: 'health-fitness-wellness',
    match: ['fitness', 'workout', 'gym', 'yoga', 'wellness', 'health', 'gesundheit', 'sport', 'meditation', 'ernährung', 'ernaehrung', 'diät', 'diaet', 'personal trainer', 'physio', 'clinic', 'klinik', 'arzt', 'doctor', 'pharma', 'dental', 'zahn'],
    mood: 'frisch · clean · energetisch',
    rationale: 'Health/Fitness → frisches Grün (hier passend) + warme Energetik, runde Sans, klare Handlungsaufforderungen.',
    palette: { background: '#FFFFFF', surface: '#F0FBF4', primary: '#059669', accent: '#F59E0B', text: '#064E3B', textMuted: '#4B5563', border: '#D1FAE5' },
    fonts: { display: 'Poppins, Inter, sans-serif', body: 'Inter, system-ui, sans-serif' },
    scale: SCALE_MODERN,
    archetype: 'centered-hero (Hero mit Bild + klarem CTA, Kachel-Funktionen, Pricing)',
    craft: CRAFT.clean,
    antiTells: ['Grün nur für Health erlaubt', 'Aktive, freundliche Stimmung — nicht klinisch kalt'],
  },
  {
    domain: 'kids-education',
    match: ['kind', 'kinder', 'kids', 'school', 'schule', 'lern', 'education', 'bildung', 'spielzeug', 'toys', 'spiel', 'kindergarten', 'kita', 'academy', 'akademie', 'kurs', 'tutor', 'universit', 'university', 'college', 'campus', 'studium', 'student', 'schüler', 'krippe', 'nachhilfe', 'vorschule', 'seminar'],
    mood: 'verspielt · freundlich · bold',
    rationale: 'Kinder/Bildung → rund, bold, mehrfarbig freundlich (Coral/Teal), runde Bold-Sans, große Touch-Targets.',
    palette: { background: '#FFF9F0', surface: '#FFF1E6', primary: '#FF6B6B', accent: '#4ECDC4', text: '#2D3142', textMuted: '#6B7280', border: '#FFE0C2' },
    fonts: { display: 'Nunito, "Baloo 2", sans-serif', body: 'Nunito, system-ui, sans-serif' },
    scale: SCALE_BOLD,
    archetype: 'playful-grid (runde Kacheln, Icons, Illustrationen, große Buttons)',
    craft: CRAFT.playful,
    antiTells: ['Keine ernsten Serif', 'Rund und bunt, nicht aufdringlich', 'Große, tippfreundliche Elemente'],
  },
  {
    domain: 'portfolio-creative-agency',
    match: ['portfolio', 'photography', 'fotograf', 'fotografie', 'creative', 'agency', 'agentur', 'designer', 'studio', 'kunst', 'artist', 'illustrator', 'architekt', 'architect', 'atelier', 'galerie', 'gallery', 'grafik', 'branding', 'animation', 'designbüro'],
    mood: 'minimal · mutig · bildstark',
    rationale: 'Portfolio/Kreativ → radikal minimal (Schwarz/Weiß + EIN vivider Akzent), riesige Typo, volle Bildflächen, viel Weißraum.',
    palette: { background: '#FFFFFF', surface: '#F5F5F5', primary: '#111111', accent: '#FF4D2E', text: '#111111', textMuted: '#6B6B6B', border: '#E5E5E5' },
    fonts: { display: 'Inter, system-ui, sans-serif', body: 'Inter, system-ui, sans-serif' },
    scale: SCALE_EDITORIAL,
    archetype: 'fullbleed-image (randlose Bilder, Overlays, große Projekte-Grids)',
    craft: CRAFT.clean,
    antiTells: ['KEIN Bento-Standardgrid', 'Ein Akzent maximal', 'Hierarchie über Dekoration — Typo als Bild'],
  },
  {
    domain: 'music-events-nightlife',
    match: ['music', 'musik', 'band', 'dj', 'festival', 'event', 'concert', 'konzert', 'club', 'nightlife', 'party', 'tickets', 'tournee', 'techno', 'rave', 'disco', 'oper', 'orchester', 'lineup'],
    mood: 'dramatisch · dark · vivid',
    rationale: 'Musik/Events → dark, dramatisch, vivid (Gold/Magenta/Violett), bold-kondensierte Typo. Dark-first.',
    palette: { background: '#0A0A0A', surface: '#161616', primary: '#F5C518', accent: '#EC4899', text: '#FAFAFA', textMuted: '#A1A1AA', border: '#27272A' },
    fonts: { display: 'Anton, Inter, sans-serif', body: 'Inter, system-ui, sans-serif' },
    scale: SCALE_BOLD,
    archetype: 'dark-dramatic (riesiger Dark-Hero, Lineup-Liste, Ticket-CTA)',
    craft: CRAFT.dark,
    antiTells: ['Dark-first', 'Bold & laut, aber strukturiert', 'Keine hellen Business-Templates'],
  },
  {
    domain: 'travel-nature-outdoor',
    match: ['travel', 'reise', 'tourism', 'hotel', 'resort', 'nature', 'natur', 'outdoor', 'abenteuer', 'hiking', 'wandern', 'camping', 'berge', 'beach', 'strand', 'safari', 'nationalpark', 'urlaub', 'ferien', 'ausflug', 'unterkunft', 'hostel', 'pension', 'alpen'],
    mood: 'erdig · abenteuerlich · weit',
    rationale: 'Reise/Natur/Outdoor → erdige Töne (Wald/Sand/Lehm), Serif, randlose Landschaftsbilder, Weite.',
    palette: { background: '#F7F4EE', surface: '#EDE7DB', primary: '#2F4A3A', accent: '#C2703D', text: '#243027', textMuted: '#6B7A6B', border: '#DDD4C2' },
    fonts: { display: 'Fraunces, Georgia, serif', body: 'Inter, system-ui, sans-serif' },
    scale: SCALE_EDITORIAL,
    archetype: 'fullbleed-image (randlose Landschaften, Destination-Karten, Story-Sektionen)',
    craft: CRAFT.warm,
    antiTells: ['Keine Tech-Farben', 'Bildgetrieben, weitläufig', 'Erde-Töne statt Neon'],
  },
  {
    // Catch-all, checked LAST: generic format words (app/dashboard/platform) must
    // NOT override a concrete subject domain matched above (e.g. "Yoga-App" → health,
    // "Bäckerei-Dashboard" → coffee-food, not tech-saas).
    domain: 'tech-saas',
    match: ['saas', 'software', 'app', 'platform', 'plattform', 'developer', 'devtool', 'api', 'cloud', 'startup', 'tech', 'tool', 'dashboard', 'crm', 'erp', 'no-code', 'nocode', 'automatisier', 'agent', 'hosting', 'server', 'backend', 'frontend', 'data', 'analytics', 'workflow', 'pipeline', 'sdk', 'infrastruktur', 'künstliche intelligenz', 'artificial intelligence', 'machine learning', 'chatbot', 'llm', 'gpt'],
    mood: 'modern · präzise · technisch',
    rationale: 'Tech/SaaS → hier PASST Indigo (technisch, nicht generic-forced). Geometrische Sans, präzise Hierarchie, Bento-Grid akzeptabel.',
    palette: { background: '#FFFFFF', surface: '#F8FAFC', primary: '#4F46E5', accent: '#06B6D4', text: '#0F172A', textMuted: '#64748B', border: '#E2E8F0' },
    fonts: { display: 'Space Grotesk, Inter, sans-serif', body: 'Inter, system-ui, sans-serif' },
    scale: SCALE_MODERN,
    archetype: 'bento-grid (asymmetrische Feature-Kacheln, Hero + Logo-Wall + Pricing)',
    craft: CRAFT.clean,
    antiTells: ['Indigo NUR hier erlaubt — sonst vermeiden', 'Kein "Get Started Free" als Copy-Pflicht; thematische CTAs'],
  },
];

// ─── Defaults (used when no domain matches) ──────────────────────────
// A few tasteful, distinct defaults; pick deterministically by message hash
// so even "no keyword" requests get variety instead of one identical look.

const DEFAULTS: Omit<DirectionDef, 'match'>[] = [
  {
    domain: 'default-refined-neutral',
    mood: 'raffiniert · neutral · klar',
    rationale: 'Kein klares Themendomain erkannt → raffinierte Neutralität mit einem tiefen Teal-Akzent und Serif-Display. Edel, nicht generisch.',
    palette: { background: '#FFFFFF', surface: '#F8FAFC', primary: '#0F766E', accent: '#F97316', text: '#0F172A', textMuted: '#64748B', border: '#E2E8F0' },
    fonts: { display: 'Fraunces, Georgia, serif', body: 'Inter, system-ui, sans-serif' },
    scale: SCALE_EDITORIAL,
    archetype: 'editorial-asymmetric',
    craft: CRAFT.clean,
    antiTells: ['NIEMALS Default-Emerald+Inter+zentrierter Hero', 'Ein Akzent, eine Typo-Skala'],
  },
  {
    domain: 'default-soft-modern',
    mood: 'weich · modern · warm-neutral',
    rationale: 'Kein klares Domain → warmes Weiß mit tiefem Anthrazit + Violett-Akzent, geometrische Sans, Bento.',
    palette: { background: '#FAFAF9', surface: '#F5F5F4', primary: '#1C1917', accent: '#7C3AED', text: '#1C1917', textMuted: '#78716C', border: '#E7E5E4' },
    fonts: { display: 'Inter, system-ui, sans-serif', body: 'Inter, system-ui, sans-serif' },
    scale: SCALE_MODERN,
    archetype: 'bento-grid',
    craft: CRAFT.clean,
    antiTells: ['Violett sparsam — nicht der Indigo-SaaS-Look', 'Warme Neutralität, nicht klinisch'],
  },
  {
    domain: 'default-editorial-mono',
    mood: 'editorial · kontraststark · zeitlos',
    rationale: 'Kein klares Domain → schwarz/weiß Editorial mit einem Blau-Akzent, große Serif, viel Weißraum.',
    palette: { background: '#FFFFFF', surface: '#F4F4F5', primary: '#18181B', accent: '#2563EB', text: '#18181B', textMuted: '#71717A', border: '#E4E4E7' },
    fonts: { display: 'Playfair Display, Georgia, serif', body: 'Inter, system-ui, sans-serif' },
    scale: SCALE_EDITORIAL,
    archetype: 'editorial-center',
    craft: CRAFT.clean,
    antiTells: ['Starkes Schwarz/Weiß, ein Blau', 'Editorial, nicht Template'],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────

function hashIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % mod;
}

function matchesTopic(message: string, keywords: string[]): boolean {
  const msgFolded = fold(message);
  const tokens = msgFolded.split(' ').filter(Boolean);
  return keywords.some((kw) => {
    const k = fold(kw);
    if (!k) return false;
    if (k.includes(' ')) {
      // multi-word phrase (e.g. "smart contract", "no code") → substring on folded msg
      return msgFolded.includes(k);
    }
    // single token: equality OR prefix — prefix matching is what makes German
    // compounds work (kaffeerösterei → "kaffee", anwaltskanzlei → "anwalt",
    // kinderspielzeug → "kind"). Keywords are curated ≥3 chars & unambiguous
    // so prefix false-positives stay negligible.
    return tokens.some((t) => t === k || t.startsWith(k));
  });
}

/** Lowercase, strip diacritics (ä→a, ö→o, ü→u, é→e), collapse separators to spaces. */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Derive a topic-appropriate DesignDirective from the user message.
 * Deterministic — same message ⇒ same directive. No LLM, no I/O.
 */
export function deriveDesignDirection(message: string): DesignDirective {
  const clean = (message || '').trim();
  // 1) Best domain match (first def whose keywords hit; ties → earliest = priority)
  for (const def of DIRECTIONS) {
    if (matchesTopic(clean, def.match)) {
      return toDirective(def);
    }
  }
  // 2) Deterministic default variety by message hash
  const def = DEFAULTS[hashIndex(clean || 'default', DEFAULTS.length)];
  return toDirective(def);
}

function toDirective(def: Omit<DirectionDef, 'match'>): DesignDirective {
  return {
    domain: def.domain,
    mood: def.mood,
    rationale: def.rationale,
    palette: def.palette,
    fonts: def.fonts,
    typeScale: def.scale,
    archetype: def.archetype,
    craft: { radii: def.craft.radii, spacing: def.craft.spacing, shadow: def.craft.shadow },
    antiTells: def.antiTells,
  };
}

/**
 * Render the directive as an ENFORCED-TOKENS block to prepend/append to any
 * tree-building prompt. Tells the model: these are FIXED — derive nothing.
 */
export function directiveToPromptBlock(d: DesignDirective): string {
  const p = d.palette;
  return [
    `=== DESIGN-DIRECTION (VERBINDLICH — erfinde KEINE anderen Tokens) ===`,
    `Domain: ${d.domain}`,
    `Mood: ${d.mood}`,
    `Warum das passt: ${d.rationale}`,
    ``,
    `PALETTE (NUR diese Farben verwenden):`,
    `  Background: ${p.background} · Surface: ${p.surface} · Primary(brand/dark): ${p.primary}`,
    `  Akzent (EINE vivide Farbe, sparsam): ${p.accent}${p.secondary ? ` · Sekundär: ${p.secondary}` : ''}`,
    `  Text: ${p.text} · TextMuted: ${p.textMuted} · Border: ${p.border}`,
    `TYPOGRAFIE:`,
    `  Display (Überschriften): fontFamily "${d.fonts.display}"`,
    `  Body: fontFamily "${d.fonts.body}"`,
    `  Skala — H1: ${d.typeScale.h1}`,
    `           H2: ${d.typeScale.h2}`,
    `           H3: ${d.typeScale.h3}`,
    `           Body: ${d.typeScale.body}`,
    `           Eyebrow/Label: ${d.typeScale.eyebrow}`,
    `LAYOUT-ARCHETYP: ${d.archetype}`,
    `CRAFT: Radii → ${d.craft.radii}`,
    `       Spacing → ${d.craft.spacing}`,
    `       Shadow (fertig) → "${d.craft.shadow}"`,
    ``,
    `ANTI-GENERICO-REGELN:`,
    `  • VERMEIDE den generischen KI-Look (Emerald+Inter+zentrierter Hero+3-Karten-Grid für alles).`,
    ...d.antiTells.map((a) => `  • ${a}`),
    `  • Ein Akzent, eine Typo-Skala, klare Hierarchie, großzügiger Weißraum. Restraint schlägt Dekoration.`,
    `=== ENDE DESIGN-DIRECTION ===`,
  ].join('\n');
}

/** Short human label for chat messages / logs (e.g. "Warm · handwerklich"). */
export function directiveLabel(d: DesignDirective): string {
  return `${d.domain} — ${d.mood}`;
}
