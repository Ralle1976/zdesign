/**
 * nextgen/contracts.ts — mirror of NextGenWepApp's typed generation contract.
 *
 * Z.Design emits THESE shapes (not raw HTML) so the generated webapp runs on the
 * NextGenWepApp platform (the user's universal modular backend). Mirrored from
 * NextGenWepApp: src/core/contracts/platform-contracts.ts +
 * src/modules/vertical-templates/vertical-template-registry.ts.
 *
 * Keep this in sync with the source repo when the contract evolves. RegistryKey
 * = string everywhere; governance/safety fields are part of the contract (the
 * platform enforces them), so emit them faithfully — never fabricate "safe" on
 * unsafe content.
 */

export type RegistryKey = string;

/** NextGenWepApp module keys (start-modules.ts). */
export const MODULE_KEYS = [
  'publicWebsite', 'menu', 'serviceCatalog', 'voucher', 'booking', 'payment',
  'customerAccount', 'qrCode', 'notifications', 'media', 'legalPrivacy', 'aiBackendAssistant',
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

/** Safety boundary a CTA may use (governance-first). */
export type CallToActionBoundary =
  | 'demo_booking_request_only'
  | 'demo_voucher_checkout_only'
  | 'service_catalog_navigation_only'
  | 'tenant_contact_only';

export type PublicRoute = { path: string; layoutKey: RegistryKey; themeKey: RegistryKey; module: RegistryKey };

export type LayoutSlotBinding = {
  slotKey: RegistryKey;
  moduleKey: ModuleKey;
  contentBinding: string;
  purpose: string;
};

export type CallToAction = {
  key: RegistryKey;
  label: string;
  href: string;
  moduleKey: ModuleKey;
  boundary: CallToActionBoundary;
};

export type LegalPrivacyImpact = {
  moduleKey: ModuleKey;
  previewedPurpose: string;
  tenantScoped: true;
  finalLegalReviewRequired: true;
};

export type DesignFamily = {
  key: RegistryKey;
  name: string;
  variantKey: RegistryKey;
  referenceSource: RegistryKey; // e.g. the Z.Design cream design id it derives from
  layoutIntent: string[];
  themeIntent: {
    tone: RegistryKey;
    allowedTokenFamilies: Array<'colors' | 'typography' | 'spacing' | 'radius' | 'shadows' | 'buttons' | 'cards'>;
    structureMutationAllowed: false;
  };
  contentBindingIntent: string[];
  requiredLayoutSlots: RegistryKey[];
  presentationIntent: {
    heroStance: RegistryKey;
    ctaPriority: RegistryKey[];
    emphasisSlots: RegistryKey[];
    trustBookingBalance: string;
    publicCopyReviewRequired: true;
  };
  safety: {
    competitorCopyAllowed: false;
    competitorAssetsAllowed: false;
    medicalClaimsRequireReview: true;
    legalPrivacyReviewRequired: true;
  };
};

/** The structured artifact Z.Design emits for a webapp. */
export type VerticalTemplateRegistryEntry = {
  key: RegistryKey;
  name: string;
  verticalKey: RegistryKey;
  tenantKey: RegistryKey;
  lifecycle: 'demo';
  publicRoute: PublicRoute;
  templateVariantKey: RegistryKey;
  requiredModules: ModuleKey[];
  layoutSlotBindings: LayoutSlotBinding[];
  callsToAction: CallToAction[];
  legalPrivacyImpacts: LegalPrivacyImpact[];
  designFamilies: DesignFamily[];
  benchmark: Record<string, unknown>;
};

/** Real content for a bound module (emitted alongside the template). */
export type ModuleContent = {
  moduleKey: ModuleKey;
  /** Free-form structured records (validated loosely here; the platform persists). */
  records: Record<string, unknown>[];
};

/** Full generation output: the registry entry + the content each module renders. */
export type NextGenEmission = {
  template: VerticalTemplateRegistryEntry;
  moduleContent: ModuleContent[];
  /** The Z.Design cream HTML that informed the design-family (design reference). */
  designReferenceHtml?: string;
};
