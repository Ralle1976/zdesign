// Z.Design i18n - Internationalization
// Supports: English (en), German (de)

export type Locale = 'en' | 'de';

export const translations = {
  en: {
    // App
    appName: 'Z.Design',
    appTagline: 'AI-Powered Visual Design Platform',
    appDescription: 'Create stunning designs, prototypes, and websites through conversation with AI',

    // Navigation
    nav: {
      projects: 'Projects',
      templates: 'Templates',
      designSystems: 'Design Systems',
      settings: 'Settings',
      providers: 'Providers',
    },

    // Chat Panel
    chat: {
      title: 'Design Chat',
      placeholder: 'Describe what you want to build...',
      send: 'Send',
      voice: 'Voice Input',
      thinking: 'Designing...',
      welcome: 'Welcome to Z.Design! Describe what you want to create and I\'ll build it for you.',
      examples: {
        landing: 'Create a landing page for a SaaS product',
        dashboard: 'Design a dashboard with analytics charts',
        app: 'Build a mobile app onboarding flow',
        slide: 'Create a pitch deck for a startup',
      },
      clearChat: 'Clear Chat',
      exportDesign: 'Export Design',
      saveVersion: 'Save Version',
    },

    // Canvas
    canvas: {
      title: 'Canvas',
      aiMode: 'AI Mode',
      editorMode: 'Editor Mode',
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      zoomReset: 'Reset Zoom',
      fullscreen: 'Fullscreen',
      responsive: {
        desktop: 'Desktop',
        tablet: 'Tablet',
        mobile: 'Mobile',
      },
      noDesign: 'Your design will appear here. Start by describing what you want in the chat!',
      loading: 'Generating your design...',
      steps: {
        analyzing: 'Analyzing request...',
        generating: 'Generating design...',
        rendering: 'Rendering preview...',
        evaluating: 'Evaluating quality...',
        complete: 'Complete!',
        error: 'Generation failed',
      },
    },

    // Props Panel
    props: {
      title: 'Properties',
      designSystem: 'Design System',
      element: 'Element',
      noSelection: 'Select an element to see its properties',
      colors: 'Colors',
      typography: 'Typography',
      spacing: 'Spacing',
      layout: 'Layout',
      effects: 'Effects',
      accessibility: 'Accessibility',
      accessibilityScore: 'A11y Score',
    },

    // Annotations
    annotations: {
      title: 'Comments',
      addComment: 'Add a comment...',
      resolve: 'Resolve',
      unresolve: 'Reopen',
      resolved: 'Resolved',
      open: 'Open',
      all: 'All',
      noComments: 'No comments yet. Click on the canvas to add one!',
      reply: 'Reply',
      replies: 'Replies',
      submit: 'Send',
      justNow: 'Just now',
      elementRef: 'Element',
    },

    // Versions
    versions: {
      title: 'Versions',
      current: 'Current',
      save: 'Save Version',
      branch: 'New Branch',
      rollback: 'Rollback',
      rollbackConfirm: 'Roll back to this version?',
      rollbackSuccess: 'Rolled back successfully',
      compare: 'Compare',
      noVersions: 'No versions saved yet',
      label: 'Version label',
      summary: 'Change summary',
      summaryPlaceholder: 'Describe what changed...',
      saveSuccess: 'Version saved',
      createBranch: 'Create branch',
      branchName: 'Branch name',
      activeBranch: 'Active branch',
      ago: 'ago',
    },

    // Export
    export: {
      title: 'Export',
      html: 'Standalone HTML',
      pdf: 'PDF Document',
      pptx: 'PowerPoint',
      zip: 'ZIP Archive',
      nextjs: 'Next.js Project',
      react: 'React Components',
      figma: 'Figma JSON',
      canva: 'Send to Canva',
      downloading: 'Preparing export...',
      success: 'Export successful!',
      error: 'Export failed',
    },

    // Projects
    projects: {
      title: 'My Projects',
      newProject: 'New Project',
      delete: 'Delete',
      duplicate: 'Duplicate',
      share: 'Share',
      lastEdited: 'Last edited',
      noProjects: 'No projects yet. Create your first one!',
      types: {
        PROTOTYPE: 'Prototype',
        SLIDE_DECK: 'Slide Deck',
        LANDING_PAGE: 'Landing Page',
        DASHBOARD: 'Dashboard',
        WEB_APP: 'Web App',
        MOBILE_APP: 'Mobile App',
        MARKETING: 'Marketing',
        CUSTOM: 'Custom',
      },
    },

    // Design System
    designSystem: {
      title: 'Design System',
      newSystem: 'New Design System',
      colors: 'Brand Colors',
      typography: 'Typography',
      components: 'Components',
      spacing: 'Spacing Scale',
      importFromCode: 'Import from Codebase',
      importFromImage: 'Import from Screenshot',
      importFromWeb: 'Import from Website',
      apply: 'Apply to Project',
      borderRadius: 'Border Radius',
      shadows: 'Shadows',
      tokenSummary: 'Token Summary',
      importOptions: 'Import',
      startFromScratch: 'Start from Scratch',
      usePreset: 'Use Preset',
      presetPalettes: 'Preset Palettes',
      uploadScreenshot: 'Upload Screenshot',
      websiteUrl: 'Website URL',
      saveApply: 'Save & Apply',
      noSystem: 'No design system configured',
    },

    // Templates
    templates: {
      title: 'Template Hub',
      search: 'Search templates...',
      categories: {
        all: 'All',
        landing: 'Landing Pages',
        dashboard: 'Dashboards',
        app: 'App UI',
        marketing: 'Marketing',
        portfolio: 'Portfolio',
        ecommerce: 'E-Commerce',
        saas: 'SaaS',
      },
      useTemplate: 'Use Template',
      preview: 'Preview',
      sortByPopular: 'Popular',
      sortByNewest: 'Newest',
      sortByRating: 'Highest Rated',
      noTemplates: 'No templates found',
      applying: 'Applying...',
      templateApplied: 'Template applied successfully!',
      projectCreated: 'Project created from template!',
      downloads: 'downloads',
      rating: 'rating',
    },

    // Collaboration
    collab: {
      online: 'Online',
      shareLink: 'Share Link',
      roles: {
        VIEWER: 'Viewer',
        COMMENTER: 'Commenter',
        EDITOR: 'Editor',
        ADMIN: 'Admin',
      },
      invite: 'Invite Members',
    },

    // AI Image
    aiImage: {
      title: 'AI Image Generator',
      subtitle: 'Generate images with AI and insert them into your design',
      promptLabel: 'Describe your image',
      promptPlaceholder: 'A futuristic city skyline at sunset with neon lights...',
      styleLabel: 'Style',
      sizeLabel: 'Size',
      generate: 'Generate Image',
      generating: 'Generating...',
      insert: 'Insert into Canvas',
      regenerate: 'Regenerate',
      buttonText: 'AI Image',
    },

    // Voice
    voice: {
      title: 'Voice Input',
      listening: 'Listening...',
      notSupported: 'Voice input not supported in this browser',
      startListening: 'Start voice input',
      stopListening: 'Stop voice input',
      transcript: 'Transcript',
    },

    // Research
    research: {
      title: 'Design Research',
      placeholder: 'Search for design inspiration...',
      button: 'Research',
      searching: 'Searching...',
      results: 'Found inspiration!',
      noResults: 'No results found',
    },

    // Accessibility
    a11y: {
      title: 'Accessibility Scanner',
      subtitle: 'Scan your design for accessibility issues',
      scanButton: 'Scan Now',
      scanning: 'Scanning...',
      scanPrompt: 'Scan your design to check for accessibility issues',
      excellent: 'Excellent accessibility!',
      needsWork: 'Needs improvement',
      poor: 'Poor accessibility — many issues found',
      allGood: 'No accessibility issues found!',
      allGoodDesc: 'Your design meets accessibility standards.',
      critical: 'Critical',
      warning: 'Warning',
      info: 'Info',
      autoFix: 'Auto-fix',
      autoFixAll: 'Auto-fix all',
      reScan: 'Re-scan',
      categories: {
        contrast: 'Color Contrast',
        altText: 'Alt Text',
        labels: 'Form Labels',
        headings: 'Heading Hierarchy',
        touchTarget: 'Touch Targets',
        semantics: 'Semantic HTML',
      },
    },

    // Provider Settings
    provider: {
      title: 'AI Provider Settings',
      subtitle: 'Configure AI providers and models for design generation',
      selectProvider: 'Select Provider',
      modelSelection: 'Model Selection',
      activeConfig: 'Active Configuration',
      capabilities: 'Capabilities',
      featureRequirements: 'Feature Requirements',
      apiKeys: 'API Keys',
      securityNotice: 'Security Notice',
      securityDesc: 'API keys are stored locally in your browser session. They are never sent to our servers.',
      noKeyNeeded: 'No key needed',
      keyRequired: 'Key required',
      keySet: 'Key set',
      available: 'Available',
      missingCapability: 'Missing capability',
      default: 'Default',
      recommended: 'Recommended',
    },

    // Quality
    quality: {
      title: 'Quality Score',
      css: 'CSS',
      semantic: 'Semantic',
      responsive: 'Responsive',
      a11y: 'A11y',
      complete: 'Complete',
      excellent: 'Excellent',
      good: 'Good',
      needsWork: 'Needs work',
      poor: 'Poor',
    },

    // Creative Mode
    creative: {
      title: 'Creative Mode',
      description: 'Multi-pass generation for more diverse and experimental designs',
      enabled: 'Creative Mode active',
      disabled: 'Creative Mode off',
    },

    // Common
    common: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      create: 'Create',
      close: 'Close',
      confirm: 'Confirm',
      loading: 'Loading...',
      error: 'Something went wrong',
      retry: 'Retry',
      search: 'Search',
      filter: 'Filter',
      sort: 'Sort',
      more: 'More',
      back: 'Back',
      next: 'Next',
      darkMode: 'Dark Mode',
      lightMode: 'Light Mode',
      language: 'Language',
    },
  },

  de: {
    // App
    appName: 'Z.Design',
    appTagline: 'KI-gestützte visuelle Design-Plattform',
    appDescription: 'Erstelle beeindruckende Designs, Prototypen und Websites durch Konversation mit KI',

    // Navigation
    nav: {
      projects: 'Projekte',
      templates: 'Vorlagen',
      designSystems: 'Design-Systeme',
      settings: 'Einstellungen',
      providers: 'Anbieter',
    },

    // Chat Panel
    chat: {
      title: 'Design-Chat',
      placeholder: 'Beschreibe, was du erstellen möchtest...',
      send: 'Senden',
      voice: 'Spracheingabe',
      thinking: 'Entwerfe...',
      welcome: 'Willkommen bei Z.Design! Beschreibe, was du erstellen möchtest, und ich baue es für dich.',
      examples: {
        landing: 'Erstelle eine Landing Page für ein SaaS-Produkt',
        dashboard: 'Entwerfe ein Dashboard mit Analytics-Charts',
        app: 'Erstelle einen Mobile-App-Onboarding-Flow',
        slide: 'Erstelle ein Pitch Deck für ein Startup',
      },
      clearChat: 'Chat leeren',
      exportDesign: 'Design exportieren',
      saveVersion: 'Version speichern',
    },

    // Canvas
    canvas: {
      title: 'Canvas',
      aiMode: 'KI-Modus',
      editorMode: 'Editor-Modus',
      zoomIn: 'Vergrößern',
      zoomOut: 'Verkleinern',
      zoomReset: 'Zoom zurücksetzen',
      fullscreen: 'Vollbild',
      responsive: {
        desktop: 'Desktop',
        tablet: 'Tablet',
        mobile: 'Mobil',
      },
      noDesign: 'Dein Design erscheint hier. Beginne, indem du beschreibst, was du möchtest!',
      loading: 'Generiere dein Design...',
      steps: {
        analyzing: 'Anfrage analysieren...',
        generating: 'Design generieren...',
        rendering: 'Vorschau rendern...',
        evaluating: 'Qualität bewerten...',
        complete: 'Fertig!',
        error: 'Generierung fehlgeschlagen',
      },
    },

    // Props Panel
    props: {
      title: 'Eigenschaften',
      designSystem: 'Design-System',
      element: 'Element',
      noSelection: 'Wähle ein Element aus, um seine Eigenschaften zu sehen',
      colors: 'Farben',
      typography: 'Typografie',
      spacing: 'Abstände',
      layout: 'Layout',
      effects: 'Effekte',
      accessibility: 'Barrierefreiheit',
      accessibilityScore: 'A11y-Score',
    },

    // Annotations
    annotations: {
      title: 'Kommentare',
      addComment: 'Kommentar hinzufügen...',
      resolve: 'Erledigen',
      unresolve: 'Wieder öffnen',
      resolved: 'Erledigt',
      open: 'Offen',
      all: 'Alle',
      noComments: 'Noch keine Kommentare. Klicke auf den Canvas, um einen hinzuzufügen!',
      reply: 'Antworten',
      replies: 'Antworten',
      submit: 'Senden',
      justNow: 'Gerade eben',
      elementRef: 'Element',
    },

    // Versions
    versions: {
      title: 'Versionen',
      current: 'Aktuell',
      save: 'Version speichern',
      branch: 'Neuer Branch',
      rollback: 'Zurücksetzen',
      rollbackConfirm: 'Auf diese Version zurücksetzen?',
      rollbackSuccess: 'Erfolgreich zurückgesetzt',
      compare: 'Vergleichen',
      noVersions: 'Noch keine Versionen gespeichert',
      label: 'Versionsbezeichnung',
      summary: 'Änderungszusammenfassung',
      summaryPlaceholder: 'Beschreibe was sich geändert hat...',
      saveSuccess: 'Version gespeichert',
      createBranch: 'Branch erstellen',
      branchName: 'Branch-Name',
      activeBranch: 'Aktiver Branch',
      ago: 'vor',
    },

    // Export
    export: {
      title: 'Export',
      html: 'Standalone HTML',
      pdf: 'PDF-Dokument',
      pptx: 'PowerPoint',
      zip: 'ZIP-Archiv',
      nextjs: 'Next.js-Projekt',
      react: 'React-Komponenten',
      figma: 'Figma JSON',
      canva: 'An Canva senden',
      downloading: 'Export wird vorbereitet...',
      success: 'Export erfolgreich!',
      error: 'Export fehlgeschlagen',
    },

    // Projects
    projects: {
      title: 'Meine Projekte',
      newProject: 'Neues Projekt',
      delete: 'Löschen',
      duplicate: 'Duplizieren',
      share: 'Teilen',
      lastEdited: 'Zuletzt bearbeitet',
      noProjects: 'Noch keine Projekte. Erstelle dein erstes!',
      types: {
        PROTOTYPE: 'Prototyp',
        SLIDE_DECK: 'Präsentation',
        LANDING_PAGE: 'Landing Page',
        DASHBOARD: 'Dashboard',
        WEB_APP: 'Web-App',
        MOBILE_APP: 'Mobile App',
        MARKETING: 'Marketing',
        CUSTOM: 'Benutzerdefiniert',
      },
    },

    // Design System
    designSystem: {
      title: 'Design-System',
      newSystem: 'Neues Design-System',
      colors: 'Marken-Farben',
      typography: 'Typografie',
      components: 'Komponenten',
      spacing: 'Abstandsskala',
      importFromCode: 'Aus Codebasis importieren',
      importFromImage: 'Aus Screenshot importieren',
      importFromWeb: 'Von Website importieren',
      apply: 'Auf Projekt anwenden',
      borderRadius: 'Randradius',
      shadows: 'Schatten',
      tokenSummary: 'Token-Zusammenfassung',
      importOptions: 'Importieren',
      startFromScratch: 'Von Grund auf neu',
      usePreset: 'Vorlage verwenden',
      presetPalettes: 'Vorlagen-Paletten',
      uploadScreenshot: 'Screenshot hochladen',
      websiteUrl: 'Website-URL',
      saveApply: 'Speichern & Anwenden',
      noSystem: 'Kein Design-System konfiguriert',
    },

    // Templates
    templates: {
      title: 'Vorlagen-Hub',
      search: 'Vorlagen suchen...',
      categories: {
        all: 'Alle',
        landing: 'Landing Pages',
        dashboard: 'Dashboards',
        app: 'App-UI',
        marketing: 'Marketing',
        portfolio: 'Portfolio',
        ecommerce: 'E-Commerce',
        saas: 'SaaS',
      },
      useTemplate: 'Vorlage verwenden',
      preview: 'Vorschau',
      sortByPopular: 'Beliebt',
      sortByNewest: 'Neueste',
      sortByRating: 'Bestbewertet',
      noTemplates: 'Keine Vorlagen gefunden',
      applying: 'Wird angewendet...',
      templateApplied: 'Vorlage erfolgreich angewendet!',
      projectCreated: 'Projekt aus Vorlage erstellt!',
      downloads: 'Downloads',
      rating: 'Bewertung',
    },

    // Collaboration
    collab: {
      online: 'Online',
      shareLink: 'Link teilen',
      roles: {
        VIEWER: 'Betrachter',
        COMMENTER: 'Kommentator',
        EDITOR: 'Bearbeiter',
        ADMIN: 'Admin',
      },
      invite: 'Mitglieder einladen',
    },

    // AI Image
    aiImage: {
      title: 'KI-Bildgenerator',
      subtitle: 'Generiere Bilder mit KI und füge sie in dein Design ein',
      promptLabel: 'Beschreibe dein Bild',
      promptPlaceholder: 'Eine futuristische Stadtlinie bei Sonnenuntergang mit Neonlicht...',
      styleLabel: 'Stil',
      sizeLabel: 'Größe',
      generate: 'Bild generieren',
      generating: 'Generiere...',
      insert: 'In Canvas einfügen',
      regenerate: 'Neu generieren',
      buttonText: 'KI-Bild',
    },

    // Voice
    voice: {
      title: 'Spracheingabe',
      listening: 'Hört zu...',
      notSupported: 'Spracheingabe wird in diesem Browser nicht unterstützt',
      startListening: 'Spracheingabe starten',
      stopListening: 'Spracheingabe stoppen',
      transcript: 'Transkript',
    },

    // Research
    research: {
      title: 'Design-Recherche',
      placeholder: 'Suche nach Design-Inspiration...',
      button: 'Recherchieren',
      searching: 'Suche...',
      results: 'Inspiration gefunden!',
      noResults: 'Keine Ergebnisse gefunden',
    },

    // Accessibility
    a11y: {
      title: 'Barrierefreiheits-Scanner',
      subtitle: 'Scanne dein Design auf Barrierefreiheitsprobleme',
      scanButton: 'Jetzt scannen',
      scanning: 'Scanne...',
      scanPrompt: 'Scanne dein Design, um Barrierefreiheitsprobleme zu finden',
      excellent: 'Hervorragende Barrierefreiheit!',
      needsWork: 'Verbesserungsbedarf',
      poor: 'Schlechte Barrierefreiheit — viele Probleme gefunden',
      allGood: 'Keine Barrierefreiheitsprobleme gefunden!',
      allGoodDesc: 'Dein Design erfüllt die Barrierefreiheitsstandards.',
      critical: 'Kritisch',
      warning: 'Warnung',
      info: 'Info',
      autoFix: 'Automatisch beheben',
      autoFixAll: 'Alle beheben',
      reScan: 'Erneut scannen',
      categories: {
        contrast: 'Farbkontrast',
        altText: 'Alt-Text',
        labels: 'Formular-Labels',
        headings: 'Überschriften-Hierarchie',
        touchTarget: 'Berührungsziele',
        semantics: 'Semantisches HTML',
      },
    },

    // Provider Settings
    provider: {
      title: 'KI-Anbieter-Einstellungen',
      subtitle: 'Konfiguriere KI-Anbieter und Modelle für die Designgenerierung',
      selectProvider: 'Anbieter auswählen',
      modelSelection: 'Modellauswahl',
      activeConfig: 'Aktive Konfiguration',
      capabilities: 'Fähigkeiten',
      featureRequirements: 'Feature-Anforderungen',
      apiKeys: 'API-Schlüssel',
      securityNotice: 'Sicherheitshinweis',
      securityDesc: 'API-Schlüssel werden lokal in deiner Browsersitzung gespeichert und niemals an unsere Server gesendet.',
      noKeyNeeded: 'Kein Schlüssel nötig',
      keyRequired: 'Schlüssel erforderlich',
      keySet: 'Schlüssel gesetzt',
      available: 'Verfügbar',
      missingCapability: 'Fähigkeit fehlt',
      default: 'Standard',
      recommended: 'Empfohlen',
    },

    // Quality
    quality: {
      title: 'Qualitätsbewertung',
      css: 'CSS',
      semantic: 'Semantisch',
      responsive: 'Responsiv',
      a11y: 'Barrierefr.',
      complete: 'Vollst.',
      excellent: 'Hervorragend',
      good: 'Gut',
      needsWork: 'Verbesserungsbedarf',
      poor: 'Schlecht',
    },

    // Creative Mode
    creative: {
      title: 'Kreativ-Modus',
      description: 'Mehrstufige Generierung für vielfältigere und experimentellere Designs',
      enabled: 'Kreativ-Modus aktiv',
      disabled: 'Kreativ-Modus aus',
    },

    // Common
    common: {
      save: 'Speichern',
      cancel: 'Abbrechen',
      delete: 'Löschen',
      edit: 'Bearbeiten',
      create: 'Erstellen',
      close: 'Schließen',
      confirm: 'Bestätigen',
      loading: 'Laden...',
      error: 'Etwas ist schiefgelaufen',
      retry: 'Erneut versuchen',
      search: 'Suchen',
      filter: 'Filtern',
      sort: 'Sortieren',
      more: 'Mehr',
      back: 'Zurück',
      next: 'Weiter',
      darkMode: 'Dunkelmodus',
      lightMode: 'Hellmodus',
      language: 'Sprache',
    },
  },
} as const;

export type TranslationKey = typeof translations.en;
