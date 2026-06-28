/**
 * nextgen/emitter.ts — the bridge: Z.Design's design intelligence → a
 * NextGenWepApp webapp. Maps a brief + Z.Design art-direction to a typed
 * VerticalTemplateRegistryEntry + real module content, emitted as JSON the
 * NextGenWepApp platform consumes (registry + renderer).
 *
 * Uses Gemini (3.5-flash) for structured output. Validates the result against
 * the contract; falls back gracefully on malformed output (never returns a
 * half-template — returns null + a reason).
 */
import { callGemini } from '@/lib/ai/gemini-direct';
import type {
  ModuleKey,
  VerticalTemplateRegistryEntry,
  ModuleContent,
  NextGenEmission,
} from './contracts';
import { MODULE_KEYS } from './contracts';

const EMISSION_PROMPT = (brief: string, artHint: string) => `Du bist ein WebApp-Architekt für die NextGenWepApp-Plattform. Erzeuge aus dem Briefing eine vollständige, lauffähige WebApp als TYPERTE VerticalTemplateRegistryEntry + echten Modul-Content.

BRIEFING: ${brief}
${artHint ? `ART-DIRECTION (Design-Family ableiten): ${artHint}` : ''}

VERFÜGBARE MODULE: ${MODULE_KEYS.join(', ')}.
CTA-Boundaries (governance, nur diese): demo_booking_request_only | demo_voucher_checkout_only | service_catalog_navigation_only | tenant_contact_only.

WÄHLE passend zum Briefing: verticalKey (z.B. thai-massage, gastronomie, kanzlei), die benötigten Module (z.B. serviceCatalog+booking+voucher für Spa; menu für Gastronomie), Slot-Bindings (slot→Modul→ContentBinding+purpose), CTAs mit korrekter Boundary, Legal/Privacy-Impacts (tenantScoped:true, finalLegalReviewRequired:true), eine Design-Family (themeIntent.tone aus der Art-Direction, structureMutationAllowed:false, alle safety-Flags wie spezifiziert).

MODUL-CONTENT: echten, themenpassenden Content pro gebundenem Modul (z.B. serviceCatalog → 4-6 echte Behandlungen/Gerichte mit Name, Beschreibung, Dauer, Preis-Label; voucher → 2-3 Gutscheine; team → Mitarbeiter). Echte deutsche Texte, keine Platzhalter.

Gib NUR ein JSON-Objekt zurück mit genau dieser Form (kein Markdown, kein Kommentar):
{
  "template": {
    "key": "kebab-case", "name": "...", "verticalKey": "...", "tenantKey": "demo-tenant", "lifecycle": "demo",
    "publicRoute": {"path": "/", "layoutKey": "...", "themeKey": "...", "module": "publicWebsite"},
    "templateVariantKey": "...", "requiredModules": ["..."],
    "layoutSlotBindings": [{"slotKey":"...","moduleKey":"...","contentBinding":"...","purpose":"..."}],
    "callsToAction": [{"key":"...","label":"...","href":"...","moduleKey":"...","boundary":"demo_booking_request_only"}],
    "legalPrivacyImpacts": [{"moduleKey":"...","previewedPurpose":"...","tenantScoped":true,"finalLegalReviewRequired":true}],
    "designFamilies": [{"key":"...","name":"...","variantKey":"...","referenceSource":"zdesign-cream","layoutIntent":["..."],"themeIntent":{"tone":"...","allowedTokenFamilies":["colors","typography","spacing","radius"],"structureMutationAllowed":false},"contentBindingIntent":["..."],"requiredLayoutSlots":["..."],"presentationIntent":{"heroStance":"...","ctaPriority":["..."],"emphasisSlots":["..."],"trustBookingBalance":"...","publicCopyReviewRequired":true},"safety":{"competitorCopyAllowed":false,"competitorAssetsAllowed":false,"medicalClaimsRequireReview":true,"legalPrivacyReviewRequired":true}}],
    "benchmark": {}
  },
  "moduleContent": [{"moduleKey":"...","records":[{...echter Content...}]}]
}`;

function parseJsonLoose(raw: string): unknown | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

/**
 * Emit a NextGenWepApp webapp for a brief. Returns null on malformed output.
 */
export async function emitNextGen(
  brief: string,
  artHint?: string,
  designReferenceHtml?: string,
): Promise<{ emission: NextGenEmission | null; reason?: string }> {
  const raw = await callGemini(EMISSION_PROMPT(brief, artHint || ''), {
    maxTokens: 16000,
    temperature: 0.5,
    timeoutMs: 180_000,
  });
  const parsed = parseJsonLoose(raw) as { template?: VerticalTemplateRegistryEntry; moduleContent?: ModuleContent[] } | null;
  if (!parsed?.template) return { emission: null, reason: 'no template in Gemini output' };

  const t = parsed.template;
  // basic contract validation
  const validModules = (m: string): m is ModuleKey => (MODULE_KEYS as readonly string[]).includes(m);
  const badModules = [...(t.requiredModules || [])].filter((m) => !validModules(m));
  if (badModules.length) return { emission: null, reason: `invalid module keys: ${badModules.join(',')}` };
  if (!t.publicRoute?.path || !t.callsToAction?.length || !t.designFamilies?.length) {
    return { emission: null, reason: 'missing required template fields (publicRoute/callsToAction/designFamilies)' };
  }
  if (t.lifecycle !== 'demo') t.lifecycle = 'demo';

  const emission: NextGenEmission = {
    template: t,
    moduleContent: Array.isArray(parsed.moduleContent) ? parsed.moduleContent : [],
    designReferenceHtml,
  };
  return { emission };
}
